import { useEffect, useState } from 'react';
import { BadgeCheck, Check, ClipboardList, Hospital, LoaderCircle, LogIn, LogOut, MessageSquareText, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import type { IncidentReport } from '../domain/scenario';
import { auth, firebaseConfigured, firestore } from '../services/firebase';
import { facilities } from '../domain/scenario';

interface ResponderAction {
  id: string;
  incidentId: string;
  action: string;
  note: string;
  timestamp: string;
  actor: string;
}

export default function ResponderPage({ reports, onUpdate }: { reports: IncidentReport[]; onUpdate: (id: string, status: IncidentReport['status'], note?: string) => void }) {
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [role, setRole] = useState<string | null>(null);
  const [demoAccess, setDemoAccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actions, setActions] = useState<ResponderAction[]>([]);
  const [cloudReports, setCloudReports] = useState<IncidentReport[]>([]);
  const [cloudDocIds, setCloudDocIds] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      if (!next) setRole(null);
    });
  }, []);

  useEffect(() => {
    if (!user || !firestore) return;
    let active = true;
    getDoc(doc(firestore, 'users', user.uid)).then((snapshot) => {
      if (active) setRole(snapshot.exists() ? String(snapshot.data().role ?? '') : '');
    }).catch(() => { if (active) setRole(''); });
    const actionQuery = query(collection(firestore, 'responder_actions'), where('actorUid', '==', user.uid));
    const unsubscribe = onSnapshot(actionQuery, (snapshot) => {
      if (!active) return;
      setActions(snapshot.docs.map((item) => ({ id: item.id, incidentId: String(item.data().incidentId ?? ''), action: String(item.data().action ?? ''), note: String(item.data().note ?? ''), timestamp: String(item.data().timestamp ?? ''), actor: 'Authenticated responder' })).slice(0, 8));
    }, () => { if (active) setActionError('Could not load responder action history from Firestore.'); });
    return () => { active = false; unsubscribe(); };
  }, [user]);

  useEffect(() => {
    if (!user || !firestore || role !== 'responder') return;
    return onSnapshot(collection(firestore, 'citizen_reports'), (snapshot) => {
      const rows = snapshot.docs.map((item) => {
        const data = item.data();
        const id = String(data.incidentId ?? item.id);
        const rawStatus = String(data.verificationStatus ?? 'Pending review');
        const status: IncidentReport['status'] = rawStatus === 'Verified' || rawStatus === 'Approved' || rawStatus === 'Needs follow-up' ? rawStatus : 'Pending review';
        return {
          id, title: String(data.description ?? 'Citizen emergency report').slice(0, 100),
          location: String(data.location ?? 'Location not confirmed'), kind: 'Emergency report' as const,
          status, time: 'Live report', source: 'LIVE' as const,
          detail: `Consent recorded · ${String(data.source ?? 'citizen report')} · awaiting responder context.`,
        };
      });
      setCloudReports(rows);
      setCloudDocIds(Object.fromEntries(snapshot.docs.map((item) => [String(item.data().incidentId ?? item.id), item.id])));
    }, () => setActionError('Could not subscribe to live citizen reports from Firestore.'));
  }, [user, role]);

  const authenticatedResponder = Boolean(user && role === 'responder');
  const hasAccess = authenticatedResponder || demoAccess;
  const visibleReports = [...reports, ...cloudReports.filter((cloud) => !reports.some((local) => local.id === cloud.id))];

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    setBusy(true); setAuthError('');
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = firestore ? await getDoc(doc(firestore, 'users', credential.user.uid)) : null;
      const nextRole = profile?.exists() ? String(profile.data().role ?? '') : '';
      if (nextRole !== 'responder') {
        setRole(nextRole);
        await signOut(auth);
        setAuthError('This account does not have responder access. Ask an administrator to assign the responder role.');
      } else { setUser(credential.user); setRole(nextRole); }
    } catch (caught) { setAuthError(caught instanceof Error ? caught.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }

  async function review(report: IncidentReport, status: IncidentReport['status']) {
    setActionError('');
    const note = notes[report.id]?.trim() ?? '';
    if (authenticatedResponder && firestore && user) {
      try {
        const cloudDoc = cloudDocIds[report.id];
        const batch = writeBatch(firestore);
        batch.set(doc(collection(firestore, 'responder_actions')), { incidentId: report.id, action: status, note, actorUid: user.uid, timestamp: new Date().toISOString(), dataSource: report.source });
        if (cloudDoc) batch.update(doc(firestore, 'citizen_reports', cloudDoc), { verificationStatus: status, reviewedBy: user.uid, reviewedAt: new Date().toISOString(), responderNote: note });
        await batch.commit();
      } catch (caught) { setActionError(caught instanceof Error ? `Could not save audit action: ${caught.message}` : 'Could not save audit action.'); return; }
    }
    onUpdate(report.id, status, note);
  }

  return <div className="page-content"><div className="page-heading"><div><div className="breadcrumbs">OPERATIONS <span>/</span> RESPONDER</div><h1>Human review, in the loop.</h1><p>Inspect citizen reports, image suggestions and route recommendations before status changes.</p></div><span className={`source-pill ${authenticatedResponder ? 'source-live' : ''}`}><span className="pulse-dot"/>{authenticatedResponder ? 'AUTHENTICATED RESPONDER' : 'DEMO WORKSPACE'}</span></div>
    <div className="responder-banner"><div className="responder-banner-icon"><ShieldCheck size={20}/></div><div><b>Responders retain the decision.</b><span>AI suggestions remain unverified until a person reviews the evidence and confirms the next step.</span></div><div className="responder-session">{authenticatedResponder ? <><span>{user?.email}</span><button className="button button-outline button-small" onClick={() => { void signOut(auth!); setDemoAccess(false); }}><LogOut size={14}/> Sign out</button></> : demoAccess ? <><span>SIMULATED RESPONDER</span><button className="button button-outline button-small" onClick={() => setDemoAccess(false)}>Exit demo</button></> : <button className="button button-outline button-small" onClick={() => setDemoAccess(true)}>Enter responder demo <BadgeCheck size={14}/></button>}</div></div>
    {firebaseConfigured && !authenticatedResponder && !demoAccess && <form className="firebase-login panel" onSubmit={login}><div><span className="eyebrow">FIREBASE AUTHENTICATION</span><h2>Responder sign-in</h2><p>Uses the configured Firebase Authentication project and checks the <code>users/{'{uid}'}</code> role document.</p></div><label className="field-label">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)}/></label><label className="field-label">Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)}/></label><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={15} className="spin"/> : <LogIn size={15}/>} Sign in</button>{authError && <span className="inline-error">{authError}</span>}</form>}
    {!firebaseConfigured && !demoAccess && <div className="firebase-notice"><ShieldCheck size={15}/> Firebase credentials are not configured. Use the explicitly simulated responder workspace to demonstrate the approval flow.</div>}
    <div className="responder-layout"><section className="panel responder-queue"><div className="panel-heading"><div><span className="eyebrow">INCOMING REPORTS</span><h2>Review queue <span className="count-chip">{visibleReports.filter((report) => report.status === 'Pending review').length}</span></h2></div><span className="sample-label">{visibleReports.length} ITEMS · LOCAL + LIVE</span></div>{actionError && <div className="inline-error" role="alert"><TriangleAlert size={14}/>{actionError}</div>}
      <div className="queue-list">{visibleReports.length === 0 && <div className="empty-state">No reports in the queue. Add one from ProofCam or VoiceSOS.</div>}{visibleReports.map((report) => <article className="queue-card" key={report.id}><div className="queue-card-top"><div><span className="eyebrow">{report.id} · {report.kind.toUpperCase()}</span><span className={`status-pill ${report.status === 'Pending review' ? 'pending' : report.status === 'Approved' || report.status === 'Verified' ? 'verified' : 'follow-up'}`}>{report.status}</span></div><span className="sample-label">{report.source}</span></div><h3>{report.title}</h3><p className="queue-location">{report.location} <i>·</i> {report.time}</p><p className="queue-detail">{report.detail}</p><label className="field-label note-field">Responder note<textarea rows={2} value={notes[report.id] ?? ''} onChange={(event) => setNotes({ ...notes, [report.id]: event.target.value })} placeholder="Add context for the next responder…" /></label><div className="queue-actions">{report.status === 'Pending review' && <><button className="button button-primary button-small" disabled={!hasAccess} onClick={() => void review(report, report.kind === 'Route recommendation' ? 'Approved' : 'Verified')}><Check size={14}/>{report.kind === 'Route recommendation' ? 'Approve route' : 'Verify report'}</button><button className="button button-outline button-small" disabled={!hasAccess} onClick={() => void review(report, 'Needs follow-up')}><X size={14}/> Needs follow-up</button></>}{report.status !== 'Pending review' && <span className="review-complete"><BadgeCheck size={14}/> Decision recorded: {report.status}</span>}{!hasAccess && <span className="access-required">Enter responder demo or authenticate to take action.</span>}</div></article>)}</div>
    </section><aside className="responder-side"><section className="panel availability-panel"><div className="panel-heading"><div><span className="eyebrow">FACILITY CHECK</span><h2>Sample availability</h2></div><Hospital size={17} className="muted-icon"/></div>{facilities.map((facility) => <div className="availability-row" key={facility.id}><div className="facility-dot"><Hospital size={14}/></div><div><b>{facility.name}</b><span>{facility.type}</span></div><span className="availability-status"><i/>{facility.availability}</span></div>)}<div className="availability-warning"><TriangleAlert size={14}/> Facility status is sample data; confirm by phone or official channel.</div></section>
      <section className="panel responder-log"><div className="panel-heading"><div><span className="eyebrow">AUDIT HISTORY</span><h2>Recent actions</h2></div><ClipboardList size={17} className="muted-icon"/></div>{actions.length ? actions.map((action) => <div className="audit-entry" key={action.id}><span className="audit-dot"/><div><b>{action.action}</b><span>{action.incidentId} · {action.actor}</span>{action.note && <small>{action.note}</small>}</div></div>) : <div className="empty-state compact"><MessageSquareText size={16}/>Responder decisions appear here. Firestore audit writes activate after authenticated sign-in.</div>}</section></aside></div>
  </div>;
}
