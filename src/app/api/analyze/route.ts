import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface AnalysisResult {
  progress_pct: number;
  completed_tasks: string[];
  blockers: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  key_metrics: Record<string, string>;
  overall_assessment: string;
  analyzed_at: string;
  provider: string;
}

const SYSTEM_PROMPT = `You are an expert event management AI analyst. Analyze the provided daily progress summary from an event committee and return a structured JSON response.

Return ONLY valid JSON with this exact structure:
{
  "progress_pct": <integer 0-100 representing estimated progress contribution today>,
  "completed_tasks": [<array of strings, tasks completed today>],
  "blockers": [<array of strings, issues blocking progress>],
  "sentiment": <"positive" | "neutral" | "negative">,
  "key_metrics": {<key: value pairs of important numbers/metrics mentioned>},
  "overall_assessment": "<1-2 sentence executive summary of today's work>"
}

Be precise and analytical. Extract concrete metrics when mentioned. Identify blockers that could delay the event.`;

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
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
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

  return {
    progress_pct,
    completed_tasks: completed.length > 0 ? completed : ['Daily update submitted'],
    blockers: blockers.length > 0 ? blockers : [],
    sentiment,
    key_metrics: {},
    overall_assessment: `Committee submitted a ${sentiment} progress report. ${completed.length} key items completed today.${blockers.length > 0 ? ` ${blockers.length} potential blocker(s) identified requiring attention.` : ''}`,
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

    let result: AnalysisResult;

    // Try Groq first
    if (GROQ_API_KEY) {
      try {
        result = await analyzeWithGroq(summary.trim(), committee_id, files);
        return NextResponse.json(result);
      } catch (groqError) {
        console.warn('Groq failed, trying Gemini:', groqError);
      }
    }

    // Fallback to Gemini
    if (GEMINI_API_KEY) {
      try {
        result = await analyzeWithGemini(summary.trim(), committee_id, files);
        return NextResponse.json(result);
      } catch (geminiError) {
        console.warn('Gemini failed, using rule-based fallback:', geminiError);
      }
    }

    // Rule-based fallback
    result = generateFallbackAnalysis(summary.trim());
    return NextResponse.json(result);

  } catch (error) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
