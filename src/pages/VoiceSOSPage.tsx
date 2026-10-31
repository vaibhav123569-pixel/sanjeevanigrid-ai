import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, AudioLines, Check, LoaderCircle, Mic, ShieldAlert, Sparkles } from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import type { IncidentReport } from '../domain/scenario';
import { villages } from '../domain/scenario';
import { extractEmergencyReport, type StructuredReport } from '../services/api';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, firebaseConfigured, firestore } from '../services/firebase';

interface SpeechResult { results: ArrayLike<ArrayLike<{ transcript: string }>> }
interface SpeechRecognizer {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
}
type SpeechRecognizerConstructor = new () => SpeechRecognizer;
declare global { interface Window { SpeechRecognition?: SpeechRecognizerConstructor; webkitSpeechRecognition?: SpeechRecognizerConstructor } }

const languageCode: Record<string, string> = { English: 'en-IN', Hindi: 'hi-IN', Assamese: 'as-IN' };

export default function VoiceSOSPage({ onReport }: { onReport: (report: IncidentReport) => void }) {
  const [language, setLanguage] = useState('Hindi');
  const [text, setText] = useState('');
  const [location, setLocation] = useState('');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [shareConsent, setShareConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth?.currentUser ?? null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setFirebaseUser);
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError('');
    if (!auth) return;
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      setFirebaseUser(credential.user); setPassword('');
    } catch (caught) { setAuthError(caught instanceof Error ? caught.message : 'Firebase sign-in failed.'); }
  }

  function startRecording() {
    const Speech = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Speech) { setError('Speech recognition is not available in this browser. Type the report below instead.'); return; }
    setError('');
    const recognition = new Speech();
    recognition.lang = languageCode[language];
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' ').trim();
      if (transcript) { setText((current) => current ? `${current} ${transcript}` : transcript); setReport(null); setSubmitted(false); setShareConsent(false); }
    };
    recognition.onerror = (event) => setError(`Speech capture stopped (${event.error}). You can continue by typing.`);
    recognition.onend = () => setListening(false);
    setListening(true);
    try { recognition.start(); } catch { setListening(false); setError('Could not start speech capture. Use the text field instead.'); }
  }

  async function structureReport() {
    if (!text.trim()) { setError('Add a short voice or text description first.'); return; }
    setError(''); setBusy(true); setSubmitted(false);
    try {
      if (!aiConsent) throw new Error('Local extraction selected because Gemini sharing was not approved.');
      const extracted = await extractEmergencyReport(text.trim());
      setReport({ ...extracted, location: location || extracted.location });
    } catch {
      const normalized = text.toLowerCase();
      const people = text.match(/\b(\d{1,2})\s*(?:people|person|patients|लोग|জন|জনক)\b/i);
      const explicitVillage = villages.find((village) => normalized.includes(village.name.toLowerCase()));
      const symptoms = ['breathing difficulty', 'breathing problem', 'fever', 'injury', 'unconscious'].filter((phrase) => normalized.includes(phrase));
      const hazard = /water|flood|পানী|पानी|road|রাস্তা|सड़क/.test(normalized) ? 'Caller mentioned water or road conditions' : null;
      setReport({
        description: text.trim(), affected_people: people ? Number(people[1]) : null,
        symptoms, location: location || explicitVillage?.name || null, road_hazard: hazard,
        urgency: 'Human responder review requested · no clinical triage performed', timestamp: new Date().toISOString(),
        source: 'LOCAL DEMO', requires_human_review: true,
      });
    } finally { setBusy(false); }
  }

  async function confirmReport() {
    if (!report || !shareConsent) return;
    setSaving(true); setShareNotice('');
    const locationLabel = location || report.location || 'Location not confirmed';
    const id = `SG-${Math.floor(400 + Math.random() * 500)}`;
    let persisted = false;
    if (firebaseConfigured && auth?.currentUser && firestore) {
      try {
        await addDoc(collection(firestore, 'citizen_reports'), {
          incidentId: id, kind: 'Emergency report', description: report.description,
          affectedPeople: report.affected_people, symptoms: report.symptoms,
          location: locationLabel, roadHazard: report.road_hazard, urgency: report.urgency,
          verificationStatus: 'Pending review', source: 'voice-sos', dataSource: 'citizen-submitted',
          consent: true, reporterUid: auth.currentUser.uid, createdAt: serverTimestamp(),
        });
        persisted = true;
      } catch {
        setError('Firebase could not save this report. It was not added to the local queue. Check your connection and try again.');
        setSaving(false); return;
      }
    }
    onReport({ id, title: report.description.slice(0, 58) || 'Voice emergency report', location: locationLabel, kind: 'Emergency report', status: 'Pending review', time: 'Just now', source: persisted ? 'LIVE' : 'SIMULATION', detail: `Source: ${report.source}. Symptoms and urgency need responder review. ${report.road_hazard ?? ''}` });
    setShareNotice(persisted ? 'Consent recorded. Report sent to the configured Firestore project.' : 'Added to this browser’s local demo queue. No cloud report was stored.');
    setSubmitted(true);
    setSaving(false);
  }

  return <div className="page-content"><div className="page-heading"><div><div className="breadcrumbs">AI MODULES <span>/</span> VOICESOS</div><h1>Let people speak first.</h1><p>Prepare a multilingual report for human responders. No diagnosis. No invented location.</p></div><span className="source-pill"><AudioLines size={14}/> VOICE-FIRST REPORTING</span></div>
    <div className="module-intro-card voice-intro"><div className="intro-icon violet"><AudioLines size={20}/></div><div><span className="eyebrow">VOICESOS · HINDI / ENGLISH / ASSAMESE</span><h2>“Maa ko breathing problem hai. Road par paani badh raha hai.”</h2><p>Speech is transcribed in the browser where available. Gemini extraction requires the configured backend; the local fallback only surfaces text clues and asks a responder to review them.</p></div><div className="intro-tag"><span>REVIEW</span><b>Required before submit</b></div></div>
    {firebaseConfigured && <div className="citizen-auth panel">{firebaseUser ? <><div className="citizen-auth-icon"><Check size={15}/></div><div><b>Firebase session active</b><span>{firebaseUser.email} · reports may be shared after your consent.</span></div><button className="button button-outline button-small" onClick={() => { void signOut(auth!); }}>Sign out</button></> : <><div className="citizen-auth-copy"><b>Optional Firebase sign-in</b><span>Needed to share reports with the configured Firestore project. Demo queue remains available without an account.</span></div><form onSubmit={signIn}><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" aria-label="Firebase email"/><input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" aria-label="Firebase password"/><button className="button button-outline button-small">Sign in</button></form>{authError && <span className="inline-error">{authError}</span>}</>}</div>}
    <div className="voice-layout"><section className="panel voice-capture-panel"><div className="panel-heading"><div><span className="eyebrow">1 · DESCRIBE WHAT IS HAPPENING</span><h2>Voice report</h2></div><span className="sample-label">MIC STAYS ON THIS DEVICE</span></div>
      <div className="voice-input-top"><label className="field-label">Report language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>Hindi</option><option>English</option><option>Assamese</option></select></label><button className={`record-button ${listening ? 'recording' : ''}`} onClick={listening ? undefined : startRecording} aria-label="Start voice recording">{listening ? <><span className="record-pulse"/><span>Listening…</span></> : <><Mic size={16}/><span>Speak now</span></>}</button></div>
      <label className="field-label transcript-label">Transcript or typed report<textarea value={text} onChange={(event) => { setText(event.target.value); setReport(null); setSubmitted(false); setShareConsent(false); }} rows={5} placeholder="Describe the situation in your own words…" /></label>
      <button className="example-link" onClick={() => { setText('Maa ko breathing problem hai. Road par paani badh raha hai.'); setLanguage('Hindi'); setReport(null); setSubmitted(false); setAiConsent(false); setShareConsent(false); }}>Load the example phrase <Sparkles size={13}/></button>
      <label className="field-label location-field">Confirm location if known<select value={location} onChange={(event) => setLocation(event.target.value)}><option value="">Unknown · needs confirmation</option>{villages.map((village) => <option key={village.id} value={village.name}>{village.name} · sample location</option>)}</select><small>Location is never inferred from a voice recording. Select only if you know it.</small></label>
      <div className="sos-safety"><ShieldAlert size={16}/><span>If someone may be in immediate danger, contact local emergency services now. SanjeevaniGrid is a prototype and does not dispatch help.</span></div>
      {error && <div className="inline-error" role="alert"><AlertTriangle size={14}/>{error}</div>}
      <label className="consent-check ai-consent"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)}/><span>Allow this transcript to be sent to the configured Gemini service. If unchecked or unavailable, use local rule-based extraction.</span></label>
      <button className="button button-primary button-block" disabled={busy || !text.trim()} onClick={structureReport}>{busy ? <><LoaderCircle size={15} className="spin"/> Preparing fields…</> : <><Sparkles size={15}/> Structure report for review</>}</button>
    </section>
    <section className="panel voice-review-panel"><div className="panel-heading"><div><span className="eyebrow">2 · CHECK BEFORE SHARING</span><h2>Responder packet</h2></div><span className="review-needed"><span/> HUMAN REVIEW</span></div>{!report ? <div className="analysis-empty"><div className="empty-orbit violet"><AudioLines size={20}/></div><b>Your report stays in draft</b><span>After structuring, review each field. Add or correct anything before it enters the demo responder queue.</span></div> : <div className="voice-report-card"><div className="report-origin"><span className={`source-pill ${report.source === 'LOCAL DEMO' ? 'source-demo' : ''}`}>{report.source === 'LOCAL DEMO' ? 'LOCAL RULE-BASED EXTRACTION' : 'GEMINI STRUCTURED OUTPUT'}</span><span>{new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><div className="report-quote">“{report.description}”</div><div className="structured-grid"><StructuredField label="Affected people" value={report.affected_people === null ? 'Not stated' : `${report.affected_people} (caller stated)`}/><StructuredField label="Reported symptoms" value={report.symptoms.length ? report.symptoms.join(', ') : 'Not stated · confirm'}/><StructuredField label="Location" value={location || report.location || 'Unknown · needs confirmation'}/><StructuredField label="Road hazard" value={report.road_hazard || 'Not stated · confirm'}/><StructuredField label="Urgency" value={report.urgency}/></div><div className="report-confirm-note"><AlertTriangle size={14}/><span>These are caller-reported details, not a diagnosis or triage decision. A responder must review.</span></div>{submitted ? <><div className="decision-confirm confirmed"><Check size={16}/><span>Report added to the {shareNotice.includes('Firestore') ? 'configured Firestore' : 'local demo'} responder queue.</span></div><div className="inline-notice"><Check size={14}/>{shareNotice}</div></> : <><label className="consent-check"><input type="checkbox" checked={shareConsent} onChange={(event) => setShareConsent(event.target.checked)}/><span>I consent to share these details with the responder queue. If no signed-in Firebase session is available, this stays in the local demo queue.</span></label><div className="decision-actions"><button className="button button-primary" disabled={!shareConsent || saving} onClick={() => void confirmReport()}>{saving ? <LoaderCircle size={15} className="spin"/> : <Check size={15}/>} Confirm and add to queue</button><button className="button button-outline" onClick={() => setReport(null)}>Edit report</button></div></>}</div>}</section></div>
  </div>;
}

function StructuredField({ label, value }: { label: string; value: string }) { return <div className="structured-field"><span>{label}</span><b>{value}</b></div>; }

