import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface AnalysisResult {
  progress_pct: number;
  completed_tasks: string[];
  blockers: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  key_metrics: Record<string, unknown>;
  overall_assessment: string;
  confidence_score: number;
  needs_attention: boolean;
  attention_reason: string;
  analyzed_at: string;
  provider: string;
}

// Simple in-memory cache (SHA-256 content hash → result, TTL 1 hour)
const analysisCache = new Map<string, { result: AnalysisResult; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const SYSTEM_PROMPT = `You are an expert event management AI analyst for EventPulse. Analyze the provided daily progress summary from an event committee and return a structured JSON response.

Return ONLY valid JSON with this exact structure:
{
  "progress_pct": <integer 0-100 representing estimated progress contribution today>,
  "completed_tasks": [<array of strings, tasks completed today>],
  "blockers": [<array of strings, issues blocking progress>],
  "sentiment": <"positive" | "neutral" | "negative">,
  "key_metrics": {"tasks_mentioned": <int>, "action_items": [<strings>]},
  "overall_assessment": "<1-2 sentence executive summary of today's work>",
  "confidence_score": <float 0.0-1.0 indicating how confident you are in this analysis>,
  "needs_attention": <boolean, true if coordinator should review this urgently>,
  "attention_reason": "<string explaining why attention is needed, empty if not needed>"
}

Be precise and analytical. Extract concrete metrics when mentioned. Identify blockers that could delay the event. Set needs_attention=true if there are critical blockers, very low progress, or negative sentiment.`;

async function analyzeWithGroq(summary: string, committeeId: string, files: string[]): Promise<AnalysisResult> {
  const userMessage = `Committee ID: ${committeeId}
Files attached: ${files.join(', ') || 'none'}

Daily Progress Summary:
${summary}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return { ...parsed, analyzed_at: new Date().toISOString(), provider: 'groq' };
}

async function analyzeWithGemini(summary: string, committeeId: string, files: string[]): Promise<AnalysisResult> {
  const prompt = `${SYSTEM_PROMPT}

Committee ID: ${committeeId}
Files attached: ${files.join(', ') || 'none'}

Daily Progress Summary:
${summary}

Return ONLY the JSON object, no markdown, no code blocks.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  return { ...parsed, analyzed_at: new Date().toISOString(), provider: 'gemini' };
}

function generateFallbackAnalysis(summary: string): AnalysisResult {
  // Smart rule-based fallback when no API keys available
  const lower = summary.toLowerCase();
  const sentiment: 'positive' | 'neutral' | 'negative' =
    lower.includes('completed') || lower.includes('confirmed') || lower.includes('approved')
      ? 'positive'
      : lower.includes('delayed') || lower.includes('blocked') || lower.includes('issue')
      ? 'negative'
      : 'neutral';

  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const completed = sentences.filter(s => /complet|finish|done|confirm|sign|approv/i.test(s)).map(s => s.trim()).slice(0, 3);
  const blockers = sentences.filter(s => /delay|block|issue|pending|waiting|problem|risk/i.test(s)).map(s => s.trim()).slice(0, 2);

  const progress_pct = Math.min(
    100,
    Math.round(
      (completed.length * 15) +
      (summary.split(' ').length / 10) +
      (sentiment === 'positive' ? 20 : sentiment === 'negative' ? 5 : 10)
    )
  );

  const needs_attention = sentiment === 'negative' || blockers.length > 0;

  return {
    progress_pct,
    completed_tasks: completed.length > 0 ? completed : ['Daily update submitted'],
    blockers: blockers.length > 0 ? blockers : [],
    sentiment,
    key_metrics: { tasks_mentioned: completed.length, action_items: [] },
    overall_assessment: `Committee submitted a ${sentiment} progress report. ${completed.length} key items completed today.${blockers.length > 0 ? ` ${blockers.length} potential blocker(s) identified requiring attention.` : ''}`,
    confidence_score: 0.5,
    needs_attention,
    attention_reason: needs_attention ? `${blockers.length} blocker(s) detected with ${sentiment} sentiment` : '',
    analyzed_at: new Date().toISOString(),
    provider: 'fallback',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { summary, committee_id, files = [] } = body;

    if (!summary || typeof summary !== 'string' || summary.trim().length < 20) {
      return NextResponse.json(
        { error: 'Summary must be at least 20 characters.' },
        { status: 400 }
      );
    }

    // Check cache first (SHA-256 of normalized summary)
    const contentHash = await hashContent(summary);
    const cached = analysisCache.get(contentHash);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ...cached.result, _cached: true });
    }

    let result: AnalysisResult;

    // Try Groq first (Llama 3.3 70B per PRD)
    if (GROQ_API_KEY) {
      try {
        result = await analyzeWithGroq(summary.trim(), committee_id, files);
        analysisCache.set(contentHash, { result, timestamp: Date.now() });
        return NextResponse.json(result);
      } catch (groqError) {
        console.warn('Groq failed, trying Gemini fallback:', groqError);
      }
    }

    // Fallback to Gemini Flash 2.0 (per PRD)
    if (GEMINI_API_KEY) {
      try {
        result = await analyzeWithGemini(summary.trim(), committee_id, files);
        analysisCache.set(contentHash, { result, timestamp: Date.now() });
        return NextResponse.json(result);
      } catch (geminiError) {
        console.warn('Gemini failed, using rule-based fallback:', geminiError);
      }
    }

    // Rule-based fallback
    result = generateFallbackAnalysis(summary.trim());
    analysisCache.set(contentHash, { result, timestamp: Date.now() });
    return NextResponse.json(result);

  } catch (error) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
