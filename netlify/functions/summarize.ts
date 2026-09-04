import { GoogleGenAI } from '@google/genai';
import type { Handler } from '@netlify/functions';

type DomainKey = 'mind' | 'skills' | 'demeanour';
type TestModel = 'gemini-primary' | 'gemini-fallback' | 'openrouter-fallback';

type RequestBody = {
  domain?: DomainKey;
  notes?: [string, string];
  context?: string;
  testModel?: TestModel;
};

const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_REQUEST_TIMEOUT_MS = 8000;
const OPENROUTER_MODEL = 'nvidia/nemotron-3.5-lightning:free';
const OPENROUTER_REQUEST_TIMEOUT_MS = 7000;

const prompts: Record<DomainKey, string> = {
  mind: `Summarize this single Mind note from the last term into exactly 3-5 concise, impactful sentences. Do not combine it with any other note. Focus on up to 5 activities or patterns stated in this note. Include "during the term" or "over the last term" where it is supported by the note. Keep documented negative remarks neutral and in the middle. Use he/she pronouns and never names. Use active voice and short, complete sentences. STRICT OUTPUT REQUIREMENT: the final response must never contain these words, in any capitalization or apostrophe style: Strong, Demonstrates, Additionally, But, However, Can't, Don't, Cannot, Although, Student, Teacher, Sometimes, Really. Before responding, silently inspect every word in the completed draft. If any prohibited word appears, rewrite the affected sentence before returning it. Do not make assumptions or interpretations. Do not include a development plan. Return only one paragraph.`,
  skills: `Summarize this single Skills note from the last term into exactly 3-5 concise, impactful sentences. Do not combine it with any other note. Focus on up to 5 practical activities, skills, or work patterns stated in this note. Keep documented negative remarks neutral and in the middle. Use he/she pronouns and never names. Use active voice and short, complete sentences. STRICT OUTPUT REQUIREMENT: the final response must never contain these words, in any capitalization or apostrophe style: Strong, Demonstrates, Additionally, But, However, Can't, Don't, Cannot, Although, Student, Teacher, Sometimes, Really. Before responding, silently inspect every word in the completed draft. If any prohibited word appears, rewrite the affected sentence before returning it. Do not make assumptions or interpretations. Do not include a development plan. Return only one paragraph.`,
  demeanour: `Summarize this single Demeanour note from the last term into exactly 3-5 concise, complete sentences. Do not combine it with any other note. State only observed behaviour, incidents, support, or strategies directly documented in this note. Keep documented negative remarks neutral and in the middle. Use he/she pronouns and never names. Use active voice and short, complete sentences. STRICT OUTPUT REQUIREMENT: the final response must never contain these words, in any capitalization or apostrophe style: Strong, Demonstrates, Additionally, But, However, Can't, Don't, Cannot, Although, Student, Teacher, Sometimes, Really. Before responding, silently inspect every word in the completed draft. If any prohibited word appears, rewrite the affected sentence before returning it. Do not make assumptions or interpretations. Do not include a development plan. Return only one paragraph.`,
};

async function generateDraft(ai: GoogleGenAI, model: string, prompt: string, note: string, context?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);

  const contents = context?.trim()
    ? [{ role: 'user', parts: [{ text: `Additional Context:\n${context.trim()}` }, { text: note }] }]
    : note;

  try {
    return await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: prompt,
        abortSignal: controller.signal,
        httpOptions: { retryOptions: { attempts: 1 } },
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function generateOpenRouterDraft(prompt: string, note: string, context?: string) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_REQUEST_TIMEOUT_MS);

  const messages = [
    { role: 'system', content: prompt },
    ...(context?.trim() ? [{ role: 'user', content: `Additional Context:\n${context.trim()}` }] : []),
    { role: 'user', content: note },
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
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

async function generateGeminiDrafts(ai: GoogleGenAI, model: string, prompt: string, notes: [string, string], context?: string) {
  const drafts = await Promise.all(notes.map(note => generateDraft(ai, model, prompt, note, context)));
  return drafts.map(draft => draft.text?.trim() || '').join('\n\n');
}

async function generateOpenRouterDrafts(prompt: string, notes: [string, string], context?: string) {
  const drafts = await Promise.all(notes.map(note => generateOpenRouterDraft(prompt, note, context)));
  return drafts.join('\n\n');
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
  const context = body.context;
  const testModel = body.testModel;
  if (!domain || !prompts[domain] || !Array.isArray(notes) || notes.length !== 2 || notes.every(note => !note?.trim())) {
    return { statusCode: 400, body: JSON.stringify({ error: 'A domain and at least one note field are required.' }) };
  }

  if (testModel === 'openrouter-fallback') {
    try {
      const summary = await generateOpenRouterDrafts(prompts[domain], notes, context);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary }) };
    } catch (openRouterError) {
      console.error('Selected OpenRouter test request failed', openRouterError);
      return { statusCode: 502, body: JSON.stringify({ error: 'OpenRouter could not create a draft.' }) };
    }
  }

  if (process.env.GEMINI_API_KEY) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
      const summary = await generateGeminiDrafts(ai, testModel === 'gemini-fallback' ? FALLBACK_MODEL : PRIMARY_MODEL, prompts[domain], notes, context);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      };
    } catch (primaryError) {
      console.warn(`Primary model ${PRIMARY_MODEL} failed; using Gemini fallback.`, primaryError);

      try {
        const summary = await generateGeminiDrafts(ai, FALLBACK_MODEL, prompts[domain], notes, context);

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary }),
        };
      } catch (fallbackError) {
        console.warn('Gemini fallback request failed; using OpenRouter fallback.', fallbackError);
      }
    }
  }

  try {
    const summary = await generateOpenRouterDrafts(prompts[domain], notes, context);
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
