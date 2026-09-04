import { useMemo, useState } from 'react';
import { Copy, Loader2, RotateCcw, Sparkles } from 'lucide-react';

type DomainKey = 'mind' | 'skills' | 'demeanour';
type TestModel = 'gemini-primary' | 'gemini-fallback' | 'openrouter-fallback';

type DomainConfig = {
  label: string;
  kicker: string;
  description: string;
  fields: [string, string];
};

const TALC_LOGO_URL = 'https://static.wixstatic.com/media/87f732_4394f5870beb470bb39567f41989443c~mv2.png/v1/fill/w_466,h_268,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/87f732_4394f5870beb470bb39567f41989443c~mv2.png';

const domains: Record<DomainKey, DomainConfig> = {
  mind: {
    label: 'Mind',
    kicker: 'Cognitive development',
    description: 'Turn three months of involvement and mentor notes into a concise term summary.',
    fields: ['Involvement Notes', 'Mentor Notes'],
  },
  skills: {
    label: 'Skills',
    kicker: 'Practical development',
    description: 'Identify key developments and useful areas of focus from the reporting period.',
    fields: ['Involvement Notes', 'Mentor Notes'],
  },
  demeanour: {
    label: 'Demeanour',
    kicker: 'Behavioural development',
    description: 'Separate observed patterns from the support and strategies provided by mentors.',
    fields: ['Observation Notes', 'Management Notes'],
  },
};

const prompts: Record<DomainKey, string> = {
  mind: 'Summarize the supplied Mind involvement and mentor notes from the last 3 months into 3-4 concise, impactful sentences. Focus on up to 5 key activities or patterns, changes over the term, and an area for future growth. Include "during the term" or "over the last term". Do not include development plans. Integrate negative remarks neutrally in the middle. Use only he/she pronouns and never names. Use active voice and short sentences. Do not use these words: Strong, Demonstrates, Additionally, But, However, Can\'t, Don\'t, Cannot, Although, Student, Teacher, Sometimes, Really. Do not make assumptions or interpretations. Return only the paragraph.',
  skills: 'Summarize the supplied Skills involvement and mentor notes from the last 3 months into 3-4 concise, impactful sentences. Focus on up to 5 key developments or patterns and areas for future growth. Do not include development plans. Integrate negative remarks neutrally in the middle. Use only he/she pronouns and never names. Use active voice and short sentences. Do not use these words: Strong, Demonstrates, Additionally, But, However, Can\'t, Don\'t, Cannot, Although, Student, Teacher, Sometimes, Really. Do not make assumptions or interpretations. Return only the paragraph.',
  demeanour: 'Summarize the supplied Demeanour notes into 3-4 concise sentences split into exactly two paragraphs. Paragraph 1 must summarize observed behavioral patterns and key incidents. Paragraph 2 must summarize mentor support, strategies, or interventions. Do not include development plans. Integrate negative remarks neutrally. Use only he/she pronouns and never names. Use active voice and short sentences. Do not use these words: Strong, Demonstrates, Additionally, But, However, Can\'t, Don\'t, Cannot, Although, Student, Teacher, Sometimes. Do not make assumptions or interpretations. Return only the two paragraphs.',
};

const getOutputParts = (domain: DomainKey, draft: string) => {
  return draft.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
};

export default function App() {
  const [activeDomain, setActiveDomain] = useState<DomainKey>('mind');
  const [notes, setNotes] = useState<Record<DomainKey, [string, string]>>({
    mind: ['', ''],
    skills: ['', ''],
    demeanour: ['', ''],
  });
  const [contexts, setContexts] = useState<Record<DomainKey, string>>({
    mind: '',
    skills: '',
    demeanour: '',
  });
  const [summary, setSummary] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [testModel, setTestModel] = useState<TestModel>('gemini-primary');

  const config = domains[activeDomain];
  const activeNotes = notes[activeDomain];
  const activeContext = contexts[activeDomain];
  const wordCount = useMemo(() => summary.trim() ? summary.trim().split(/\s+/).length : 0, [summary]);
  const outputParts = getOutputParts(activeDomain, summary);

  const updateNote = (index: 0 | 1, value: string) => {
    setNotes(previous => ({
      ...previous,
      [activeDomain]: activeNotes.map((note, noteIndex) => noteIndex === index ? value : note) as [string, string],
    }));
  };

  const updateContext = (value: string) => {
    setContexts(previous => ({
      ...previous,
      [activeDomain]: value,
    }));
  };

  const generateSummary = async () => {
    setIsGenerating(true);
    setError('');
    setSummary('');
    setCopied(false);

    try {
      const response = await fetch('/.netlify/functions/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: activeDomain, notes: activeNotes, context: activeContext, testModel }),
      });
      const data = await response.json() as { summary?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to create a draft.');
      setSummary(data.summary || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create a draft.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copySummary = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(outputParts.join('\n\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const reset = () => {
    setNotes(previous => ({ ...previous, [activeDomain]: ['', ''] }));
    setContexts(previous => ({ ...previous, [activeDomain]: '' }));
    setSummary('');
    setCopied(false);
    setError('');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img className="brand-logo" src={TALC_LOGO_URL} alt="TALC World" />
          <div><strong>WPM Summarizer</strong><span>WPM reporting</span></div>
        </div>
        <div className="term-label"><span className="status-dot" /> WPM reporting workspace</div>
      </header>

      <main className="workspace">
        <section className="intro">
          
          <h1>WPM Summarizer</h1>
          <p className="intro-copy">Paste the merged notes from talcworld.com. Keep the language precise, neutral, and ready for your report.</p>
        </section>

        <nav className="domain-tabs" aria-label="Report domains">
          {(Object.keys(domains) as DomainKey[]).map(domain => (
            <button key={domain} className={activeDomain === domain ? 'domain-tab active' : 'domain-tab'} onClick={() => { setActiveDomain(domain); setSummary(''); setCopied(false); }}>
              <span>{domains[domain].label}</span>
              <small>{domain === 'demeanour' ? '03' : domain === 'mind' ? '01' : '02'}</small>
            </button>
          ))}
        </nav>

        <div className="section-heading">
          <div><p className="eyebrow">{config.kicker}</p><h2>{config.label} notes</h2></div>
          <button className="text-button" onClick={reset}><RotateCcw size={15} /> Clear fields</button>
        </div>
        <p className="section-description">{config.description}</p>

        <section className="notes-grid">
          {config.fields.map((field, index) => (
            <label className="note-field" key={field}>
              <span><b>0{index + 1}</b>{field}</span>
              <textarea value={activeNotes[index]} onChange={event => updateNote(index as 0 | 1, event.target.value)} placeholder="Paste notes here..." />
              <small>{activeNotes[index].length} characters</small>
            </label>
          ))}
        </section>

        <div className="context-field-wrap">
          <label className="note-field context-field">
            <span><b>03</b>Additional Context (Optional)</span>
            <textarea
              value={activeContext}
              onChange={event => updateContext(event.target.value)}
              placeholder="Add optional student background, focus areas, or specific guidance for this section..."
            />
            <small>{activeContext.length} characters</small>
          </label>
        </div>

        <div className="action-row">
          <button className="primary-button" onClick={generateSummary} disabled={isGenerating || (!activeNotes[0].trim() && !activeNotes[1].trim())}>{isGenerating ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />} {isGenerating ? 'Creating...' : 'Create draft'}</button>
          <label className="action-hint">Model <select value={testModel} onChange={event => setTestModel(event.target.value as TestModel)}><option value="gemini-primary">Gemini primary</option><option value="gemini-fallback">Gemini fallback</option><option value="openrouter-fallback">OpenRouter fallback</option></select></label>
          <span className="action-hint">Drafts follow the {config.label.toLowerCase()} prompt requirements</span>
        </div>

        <section className="result-panel">
          <div className="result-header"><div><p className="eyebrow">Output</p><h2>Report-ready draft</h2></div><button className="icon-button" onClick={copySummary} disabled={!summary} title="Copy draft"><Copy size={17} /> <span>{copied ? 'Copied' : 'Copy'}</span></button></div>
          <div className={summary ? 'result-body has-content' : error ? 'result-body error-state' : 'result-body'}>{summary ? outputParts.map((part, index) => <div className="output-part" key={`${part}-${index}`}><p className="output-label">{config.fields[index] || 'Draft'}</p><p>{part}</p></div>) : error || <><Sparkles size={22} /><p>Your summaries will appear here.<br /><span>Review the wording before adding it to the WPM report.</span></p></>}</div>
          <div className="result-footer"><span>{wordCount ? `${wordCount} words` : 'No draft yet'}</span><span>Private workspace · Nothing is stored</span></div>
        </section>
      </main>
      <footer>Built for focused WPM reporting <span>•</span> TALC World</footer>
    </div>
  );
}
