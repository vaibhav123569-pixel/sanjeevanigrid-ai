import { useEffect, useMemo, useState } from 'react';
import { Activity, AudioLines, Camera, ChevronLeft, ChevronRight, Command, HeartPulse, Home, LayoutDashboard, Menu, Route, ShieldCheck, Waves } from 'lucide-react';
import type { IncidentReport } from './domain/scenario';
import { reportSeed } from './domain/scenario';
import Assistant from './components/Assistant';
import { CareCutoffPage, CareRoutePage, CommandCentre, LandingPage } from './pages/Pages';
import ProofCamPage from './pages/ProofCamPage';
import VoiceSOSPage from './pages/VoiceSOSPage';
import ResponderPage from './pages/ResponderPage';

type Page = 'command' | 'cutoff' | 'proofcam' | 'voicesos' | 'careroute' | 'responder';
const navigation: { group: string; items: { id: Page; label: string; icon: React.ReactNode; badge?: string }[] }[] = [
  { group: 'OPERATIONS', items: [{ id: 'command', label: 'Command Centre', icon: <LayoutDashboard size={17}/> }, { id: 'responder', label: 'Responder review', icon: <ShieldCheck size={17}/>, badge: '02' }] },
  { group: 'AI MODULES', items: [{ id: 'cutoff', label: 'CareCutoff AI', icon: <Waves size={17}/> }, { id: 'proofcam', label: 'ProofCam', icon: <Camera size={17}/> }, { id: 'voicesos', label: 'VoiceSOS', icon: <AudioLines size={17}/> }, { id: 'careroute', label: 'CareRoute', icon: <Route size={17}/> }] },
];

export default function App() {
  const [page, setPage] = useState<Page | 'landing'>('landing');
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reports, setReports] = useState<IncidentReport[]>(reportSeed.map((report) => ({ ...report })));
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState('');

  const pendingCount = useMemo(() => reports.filter((report) => report.status === 'Pending review').length, [reports]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStage((current) => {
        if (current >= 6) { setPlaying(false); return current; }
        return current + 1;
      });
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (stage === 2 && !reports.some((report) => report.id === 'SG-205')) {
      setReports((items) => [{ id: 'SG-205', title: 'Water rising near the bridge approach', location: 'Riverbend crossing', kind: 'Road hazard', status: 'Pending review', time: 'Just now', source: 'SIMULATION', detail: 'Deterministic demo event. A citizen hazard report is awaiting on-site confirmation.' }, ...items]);
    }
    if (stage === 3 && !reports.some((report) => report.id === 'SG-206')) {
      setReports((items) => [{ id: 'SG-206', title: 'ProofCam sample requests a road check', location: 'Riverbend crossing', kind: 'Road hazard', status: 'Pending review', time: 'Just now', source: 'SIMULATION', detail: 'Seeded example analysis. No live image was analyzed; responder confirmation is required.' }, ...items]);
    }
    if (stage === 5 && !reports.some((report) => report.id === 'SG-207')) {
      setReports((items) => [{ id: 'SG-207', title: 'Alternate facility route needs approval', location: 'Riverbend to Valley PHC', kind: 'Route recommendation', status: 'Pending review', time: 'Just now', source: 'SIMULATION', detail: 'A graph-based alternative was found in the sample network. Human approval is required before it can be treated as a recommendation.' }, ...items]);
    }
  }, [stage, reports]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openPage(value?: string) {
    setPage((value as Page) || 'command');
    setMobileNav(false);
  }

  function addReport(report: IncidentReport) {
    setReports((items) => [report, ...items]);
    setToast('Report added to the simulation responder queue.');
  }

  function updateReport(id: string, status: IncidentReport['status'], note = '') {
    const existing = reports.find((report) => report.id === id);
    setReports((items) => items.map((report) => report.id === id ? { ...report, status, detail: note ? `${report.detail} Responder note: ${note}` : report.detail, time: 'Just now' } : report));
    setToast(`Responder action recorded: ${status.toLowerCase()}.`);
    if (existing?.kind === 'Route recommendation' && status === 'Approved') { setStage(7); setPlaying(false); }
  }

  function setManualStage(value: number) { setPlaying(false); setStage(Math.max(0, Math.min(7, value))); }

  function toggleSimulation() {
    if (playing) { setPlaying(false); return; }
    if (stage === 7) resetSimulation();
    setPlaying(true);
  }

  function resetSimulation() {
    setPlaying(false); setStage(0);
    setReports(reportSeed.map((report) => ({ ...report })));
    setToast('Scenario reset to normal conditions.');
  }

  function approveRecommendation() {
    const recommendation = reports.find((report) => report.kind === 'Route recommendation' && report.status === 'Pending review');
    if (!recommendation) { setToast('No pending route recommendation is available.'); return; }
    updateReport(recommendation.id, 'Approved', 'Approved in the simulated responder workspace.');
  }

  if (page === 'landing') return <><LandingPage onOpen={openPage}/><Assistant stage={stage} reports={reports}/></>;

  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    {mobileNav && <button className="mobile-nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand"><button className="brand brand-sidebar" onClick={() => setPage('landing')}><span className="brand-mark"><Activity size={17}/></span><span>SANJEEVANI<span className="brand-light">GRID</span><small>CARE ACCESS NETWORK</small></span></button><button className="collapse-button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={15}/> : <ChevronLeft size={15}/>}</button></div>
      <div className="environment-label"><span className="environment-dot"/>DEMO ENVIRONMENT</div>
      <nav className="sidebar-navigation" aria-label="Main navigation">{navigation.map((group) => <div className="nav-group" key={group.group}><span className="nav-group-label">{group.group}</span>{group.items.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => openPage(item.id)} title={collapsed ? item.label : undefined} aria-current={page === item.id ? 'page' : undefined}>{item.icon}<span>{item.label}</span>{item.id === 'responder' && pendingCount > 0 ? <small>{String(pendingCount).padStart(2, '0')}</small> : null}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-alert"><span><HeartPulse size={16}/></span><b>Care access<br/>needs a human.</b><small>Prototype · not an emergency service</small></div><button className="sidebar-demo-link" onClick={() => setPage('command')}><Command size={14}/> Back to operations</button><div className="profile-mini"><span className="profile-avatar">VG</span><span><b>Demo workspace</b><small>Local simulation</small></span><span className="online-dot"/></div></div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="topbar-left"><button className="mobile-menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={18}/></button><div className="top-breadcrumb"><span>SG</span><ChevronRight size={13}/><b>{navigation.flatMap((group) => group.items).find((item) => item.id === page)?.label}</b></div></div><div className="topbar-right"><span className="top-context"><span className="environment-dot"/>SIMULATION MODE</span><span className="top-divider"/><span className="operator-status"><i/> SYSTEM READY</span><button className="help-button" onClick={() => setToast('All locations, roads, facilities and incidents in this demo are illustrative.')}>?<span>About demo data</span></button></div></header>
      <main className="workspace">{page === 'command' && <CommandCentre stage={stage} setStage={setManualStage} playing={playing} togglePlaying={toggleSimulation} reset={resetSimulation} reports={reports} onNavigate={openPage} onApprove={approveRecommendation}/ >}{page === 'cutoff' && <CareCutoffPage stage={stage} setStage={setManualStage}/ >}{page === 'proofcam' && <ProofCamPage onReport={addReport}/ >}{page === 'voicesos' && <VoiceSOSPage onReport={addReport}/ >}{page === 'careroute' && <CareRoutePage stage={stage}/ >}{page === 'responder' && <ResponderPage reports={reports} onUpdate={updateReport}/ >}
        <footer className="workspace-footer"><span>AI recommends. Humans decide.</span><span>Prototype · simulated data · not an emergency service</span><button onClick={() => setPage('landing')}><Home size={13}/> Project overview</button></footer>
      </main>
    </div>
    <Assistant stage={stage} reports={reports}/>
    <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite"><span><ShieldCheck size={15}/></span>{toast}</div>
  </div>;
}
