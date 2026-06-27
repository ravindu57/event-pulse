import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `You are an expert event management AI. Analyze the attached document (which may be a schedule, contract, project plan, or meeting notes) and extract a list of all key project milestones and deadlines.

Return ONLY a valid JSON array of objects with this exact structure:
[
  {
    "title": "Short, clear title of the milestone",
    "description": "1-2 sentence context",
    "deadline": "YYYY-MM-DD format, strictly inferred from the document. Ensure it is a valid date string.",
    "weight": <integer 1-100 representing relative importance/impact of this milestone>
  }
]

- If the document lacks specific dates, infer them if relative (e.g., "next Friday"), or exclude the milestone if a date is impossible to determine.
- Do not include markdown code blocks (like \`\`\`json) in your response, just the raw JSON array.
- Focus on actionable tasks, deliverables, and critical path items.`;

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const mimeType = file.type || 'application/octet-stream';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: SYSTEM_PROMPT },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'Failed to process document with AI.' }, { status: 502 });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Clean up potential markdown wrapper from the response
    const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
    const milestones = JSON.parse(cleanedText);

    if (!Array.isArray(milestones)) {
       throw new Error('AI did not return an array');
    }

    return NextResponse.json(milestones);
  } catch (error) {
    console.error('AI Schedule API error:', error);
    return NextResponse.json(
      { error: 'Failed to parse file or generate schedule. Ensure it is a valid PDF or text document.' },
      { status: 500 }
    );
  }
}
