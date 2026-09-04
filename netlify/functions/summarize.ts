import { GoogleGenAI } from '@google/genai';
import type { Handler } from '@netlify/functions';

type DomainKey = 'mind' | 'skills' | 'demeanour';

type RequestBody = {
  domain?: DomainKey;
  notes?: [string, string];
};

const PRIMARY_MODEL = 'gemma-4-26b-a4b-it';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';
const GEMINI_REQUEST_TIMEOUT_MS = 8000;

const prompts: Record<DomainKey, string> = {
  mind: `Summarize the supplied Mind involvement and mentor notes from the last 3 months into 3-4 concise, impactful sentences. Focus on up to 5 key activities or patterns, changes over the term, and an area for future growth. Include "during the term" or "over the last term". Do not include development plans. Integrate negative remarks neutrally in the middle. Use only he/she pronouns and never names. Use active voice and short sentences. Do not use these words: Strong, Demonstrates, Additionally, But, However, Can't, Don't, Cannot, Although, Student, Teacher, Sometimes, Really. Do not make assumptions or interpretations. Return only the paragraph.`,
  skills: `Summarize the supplied Skills involvement and mentor notes from the last 3 months into 3-4 concise, impactful sentences. Focus on up to 5 key developments or patterns and areas for future growth. Do not include development plans. Integrate negative remarks neutrally in the middle. Use only he/she pronouns and never names. Use active voice and short sentences. Do not use these words: Strong, Demonstrates, Additionally, But, However, Can't, Don't, Cannot, Although, Student, Teacher, Sometimes, Really. Do not make assumptions or interpretations. Return only the paragraph.`,
  demeanour: `Summarize the supplied Demeanour notes into 3-4 concise sentences split into exactly two paragraphs. Paragraph 1 must summarize observed behavioral patterns and key incidents. Paragraph 2 must summarize mentor support, strategies, or interventions. Do not include development plans. Integrate negative remarks neutrally. Use only he/she pronouns and never names. Use active voice and short sentences. Do not use these words: Strong, Demonstrates, Additionally, But, However, Can't, Don't, Cannot, Although, Student, Teacher, Sometimes. Do not make assumptions or interpretations. Return only the two paragraphs.`,
};

async function generateDraft(ai: GoogleGenAI, model: string, contents: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);

  try {
    return await ai.models.generateContent({
      model,
      contents,
      config: {
        abortSignal: controller.signal,
        httpOptions: { retryOptions: { attempts: 1 } },
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { Allow: 'POST' }, body: 'Method not allowed' };
  }

  if (!process.env.GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }) };
  }

  let body: RequestBody;
  try {
    body = JSON.parse(event.body || '{}') as RequestBody;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const domain = body.domain;
  const notes = body.notes;
  if (!domain || !prompts[domain] || !Array.isArray(notes) || notes.length !== 2 || notes.every(note => !note?.trim())) {
    return { statusCode: 400, body: JSON.stringify({ error: 'A domain and at least one note field are required.' }) };
  }

  const inputLabels = domain === 'demeanour' ? ['Observation Notes', 'Management Notes'] : ['Involvement Notes', 'Mentor Notes'];
  const source = notes.map((note, index) => `${inputLabels[index]}:\n${note || '(none provided)'}`).join('\n\n');

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const contents = `${prompts[domain]}\n\nSOURCE NOTES:\n${source}`;

  try {
    const response = await generateDraft(ai, PRIMARY_MODEL, contents);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: response.text?.trim() || '' }),
    };
  } catch (primaryError) {
    console.warn(`Primary model ${PRIMARY_MODEL} failed; using fallback.`, primaryError);

    try {
      const response = await generateDraft(ai, FALLBACK_MODEL, contents);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: response.text?.trim() || '' }),
      };
    } catch (fallbackError) {
      console.error('Gemini fallback request failed', fallbackError);
      return { statusCode: 502, body: JSON.stringify({ error: 'Gemini could not create a draft.' }) };
    }
  }
};
