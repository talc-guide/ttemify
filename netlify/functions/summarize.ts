import { GoogleGenAI } from '@google/genai';
import type { Handler } from '@netlify/functions';

type DomainKey = 'mind' | 'skills' | 'demeanour';
type TestModel = 'gemini-primary' | 'gemini-fallback' | 'openrouter-fallback';

type RequestBody = {
  domain?: DomainKey;
  notes?: [string, string];
  testModel?: TestModel;
};

const PRIMARY_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_REQUEST_TIMEOUT_MS = 8000;
const OPENROUTER_MODEL = 'nvidia/nemotron-3.5-lightning:free';
const OPENROUTER_REQUEST_TIMEOUT_MS = 7000;

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

async function generateOpenRouterDraft(contents: string) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: contents }],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 220,
        reasoning: { enabled: false },
      }),
      signal: controller.signal,
    });
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };

    if (!response.ok) throw new Error(body.error?.message || 'OpenRouter could not create a draft.');
    return body.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timeout);
  }
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { Allow: 'POST' }, body: 'Method not allowed' };
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No AI API key is configured.' }) };
  }

  let body: RequestBody;
  try {
    body = JSON.parse(event.body || '{}') as RequestBody;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const domain = body.domain;
  const notes = body.notes;
  const testModel = body.testModel;
  if (!domain || !prompts[domain] || !Array.isArray(notes) || notes.length !== 2 || notes.every(note => !note?.trim())) {
    return { statusCode: 400, body: JSON.stringify({ error: 'A domain and at least one note field are required.' }) };
  }
  if (testModel && process.env.NETLIFY) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Model selection is only available during local development.' }) };
  }

  const inputLabels = domain === 'demeanour' ? ['Observation Notes', 'Management Notes'] : ['Involvement Notes', 'Mentor Notes'];
  const source = notes.map((note, index) => `${inputLabels[index]}:\n${note || '(none provided)'}`).join('\n\n');

  const contents = `${prompts[domain]}\n\nSOURCE NOTES:\n${source}`;

  if (testModel === 'openrouter-fallback') {
    try {
      const summary = await generateOpenRouterDraft(contents);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary }) };
    } catch (openRouterError) {
      console.error('Selected OpenRouter test request failed', openRouterError);
      return { statusCode: 502, body: JSON.stringify({ error: 'OpenRouter could not create a draft.' }) };
    }
  }

  if (process.env.GEMINI_API_KEY) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
      const response = await generateDraft(ai, testModel === 'gemini-fallback' ? FALLBACK_MODEL : PRIMARY_MODEL, contents);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: response.text?.trim() || '' }),
      };
    } catch (primaryError) {
      console.warn(`Primary model ${PRIMARY_MODEL} failed; using Gemini fallback.`, primaryError);

      try {
        const response = await generateDraft(ai, FALLBACK_MODEL, contents);

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: response.text?.trim() || '' }),
        };
      } catch (fallbackError) {
        console.warn('Gemini fallback request failed; using OpenRouter fallback.', fallbackError);
      }
    }
  }

  try {
    const summary = await generateOpenRouterDraft(contents);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    };
  } catch (openRouterError) {
    console.error('OpenRouter fallback request failed', openRouterError);
    return { statusCode: 502, body: JSON.stringify({ error: 'No AI provider could create a draft.' }) };
  }
};
