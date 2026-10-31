import { useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, Camera, Check, FileImage, ImagePlus, LoaderCircle, ShieldCheck, Upload, X } from 'lucide-react';
import type { HazardAnalysis } from '../services/api';
import { analyzeImage } from '../services/api';
import { auth, firebaseConfigured, storage } from '../services/firebase';
import { ref, uploadBytes } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import type { IncidentReport } from '../domain/scenario';

type AnalysisResult = HazardAnalysis & { source: string };
const sampleResult: AnalysisResult = {
  hazard_type: 'Possible floodwater and debris', severity: 'Moderate',
  visual_evidence: ['Water appears to cover part of the road surface', 'A small obstruction is visible near the shoulder'],
  confidence: 0.74, recommended_action: 'Ask a responder or nearby driver to confirm passability before routing.',
  requires_human_verification: true, source: 'SEEDED EXAMPLE · NO UPLOADED IMAGE ANALYZED',
};

export default function ProofCamPage({ onReport }: { onReport: (report: IncidentReport) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<'confirmed' | 'rejected' | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(next: File | undefined) {
    setError(''); setResult(null); setDecision(null); setNotice('');
    if (!next) return;
    if (!next.type.startsWith('image/')) { setError('Choose a supported image file.'); return; }
    if (next.size > 8 * 1024 * 1024) { setError('Image must be smaller than 8 MB.'); return; }
    setFile(next);
  }

  async function submitForAnalysis() {
    if (!file || !consent) return;
    setBusy(true); setError(''); setNotice(''); setResult(null); setDecision(null);
    try {
      if (firebaseConfigured && auth?.currentUser && storage) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
        const storagePath = `image_evidence/${auth.currentUser.uid}/${Date.now()}_${safeName}`;
        await uploadBytes(ref(storage, storagePath), file, {
          contentType: file.type, customMetadata: { consent: 'true', userId: auth.currentUser.uid },
        });
        if (firestore) await addDoc(collection(firestore, 'image_evidence'), {
          storagePath, contentType: file.type, fileSize: file.size, consent: true,
          uploaderUid: auth.currentUser.uid, reviewStatus: 'pending', createdAt: serverTimestamp(),
        });
        setNotice('Consented evidence saved to the configured Firebase Storage project.');
      }
      const output = await analyzeImage(file);
      setResult(output);
      if (!firebaseConfigured || !auth?.currentUser) setNotice('Image sent for this analysis request; no persistent evidence storage is configured for this session.');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Analysis request failed.';
      setError(`${message} This upload has not received an AI analysis. Try the seeded example to demonstrate the review flow.`);
    } finally { setBusy(false); }
  }

  function confirm(accepted: boolean) {
    if (!result) return;
    const nextDecision = accepted ? 'confirmed' : 'rejected';
    setDecision(nextDecision);
    onReport({
      id: `SG-${Math.floor(300 + Math.random() * 600)}`,
      title: accepted ? `Hazard review confirmed: ${result.hazard_type}` : 'AI hazard suggestion rejected by reviewer',
      location: 'Riverbend crossing · scenario location', kind: 'Road hazard',
      status: accepted ? 'Pending review' : 'Needs follow-up', time: 'Just now', source: 'SIMULATION',
      detail: `${result.source}; human response: ${accepted ? 'confirmed' : 'rejected'}. Road passability still needs an on-site check.`,
    });
  }

  return <div className="page-content"><div className="page-heading"><div><div className="breadcrumbs">AI MODULES <span>/</span> PROOFCAM</div><h1>See the road. Ask a human.</h1><p>Review possible hazards in consented road evidence before a route changes.</p></div><span className="source-pill"><Camera size={14}/> MULTIMODAL · HUMAN REVIEW</span></div>
    <div className="module-intro-card proof-intro"><div className="intro-icon amber"><Camera size={20}/></div><div><span className="eyebrow">PROOFCAM</span><h2>A photograph is evidence to inspect, not proof of passability.</h2><p>When the server has Gemini credentials, the image is analyzed on the backend. Without them, this screen clearly reports the analysis as unavailable; a separate seeded example demonstrates the confirmation workflow.</p></div><div className="intro-tag"><span>MAX IMAGE SIZE</span><b>8 MB</b></div></div>
    <div className="proof-grid"><section className="panel upload-panel"><div className="panel-heading"><div><span className="eyebrow">1 · ADD ROAD EVIDENCE</span><h2>Upload a photo</h2></div><span className="sample-label">OPTIONAL</span></div>
      <label className={`upload-dropzone ${preview ? 'has-preview' : ''}`} htmlFor="proofcam-image">{preview ? <img src={preview} alt={`Preview of ${file?.name ?? 'uploaded road evidence'}`}/> : <><span className="upload-icon"><ImagePlus size={22}/></span><b>Choose a road image</b><span>JPG, PNG or WebP · up to 8 MB</span><span className="upload-browse"><Upload size={14}/> Browse files</span></>}<input id="proofcam-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectFile(event.currentTarget.files?.[0])}/></label>
      {file && <div className="selected-file"><FileImage size={15}/><span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(2)} MB · local preview</small></span><button className="icon-button" aria-label="Remove selected image" onClick={() => { setFile(null); setConsent(false); setResult(null); }}><X size={15}/></button></div>}
      <label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/><span>I have permission to share this image for road-hazard review. I understand it may contain location or personal details.</span></label>
      <div className="upload-actions"><button className="button button-primary" disabled={!file || !consent || busy} onClick={submitForAnalysis}>{busy ? <><LoaderCircle size={15} className="spin"/> Sending securely…</> : <><SparkleIcon/> Analyze with configured Gemini</>}</button><button className="button button-ghost" onClick={() => { setResult(sampleResult); setError(''); setDecision(null); setNotice('Seeded sample result · unrelated to any uploaded image.'); }}>Show sample result</button></div>
      {error && <div className="inline-error" role="alert"><AlertTriangle size={15}/>{error}</div>}{notice && <div className="inline-notice"><ShieldCheck size={14}/>{notice}</div>}
      <div className="privacy-note"><ShieldCheck size={15}/><span>Upload requires consent. The analysis API keeps images in memory and does not save them. Firebase Storage is used only when configured and signed in.</span></div>
    </section>
    <section className="panel analysis-panel"><div className="panel-heading"><div><span className="eyebrow">2 · REVIEW THE SUGGESTION</span><h2>AI assessment</h2></div><span className="review-needed"><span/> HUMAN CHECK REQUIRED</span></div>
      {!result ? <div className="analysis-empty"><div className="empty-orbit"><Camera size={20}/></div><b>No analysis to review</b><span>Upload an image and configure Gemini, or use the seeded example to walk through responder review.</span><div className="empty-capabilities"><span>Floodwater</span><span>Debris</span><span>Bridge damage</span><span>Uncertain scene</span></div></div> : <div className="analysis-result"><div className="analysis-source"><span className="tiny-dot"/>{result.source}</div><div className="analysis-type-row"><div><span className="eyebrow">POSSIBLE HAZARD</span><h3>{result.hazard_type}</h3></div><span className={`severity-badge ${result.severity.toLowerCase()}`}>{result.severity}</span></div><div className="confidence-row"><span>Model confidence</span><b>{Math.round(result.confidence * 100)}%</b><div className="confidence-bar"><span style={{ width: `${Math.round(result.confidence * 100)}%` }}/></div></div><div className="evidence-list"><b>Visual evidence described</b>{result.visual_evidence.map((item, index) => <span key={item}><i>{String(index + 1).padStart(2,'0')}</i>{item}</span>)}</div><div className="recommendation-box"><AlertTriangle size={15}/><span><b>Suggested next step</b>{result.recommended_action}</span></div><div className="analysis-disclaimer">A model result cannot confirm whether a vehicle can safely cross. Ask a responder or nearby person to verify.</div>{decision ? <div className={`decision-confirm ${decision}`}><BadgeCheck size={17}/><span>{decision === 'confirmed' ? 'Your confirmation was added to the responder queue.' : 'The AI suggestion was rejected and marked for follow-up.'}</span></div> : <div className="decision-actions"><button className="button button-primary" onClick={() => confirm(true)}><Check size={15}/> Confirm for responder review</button><button className="button button-outline" onClick={() => confirm(false)}><X size={15}/> Reject suggestion</button></div>}</div>}
    </section></div>
  </div>;
}

function SparkleIcon() { return <span className="gemini-star" aria-hidden="true">✦</span>; }
