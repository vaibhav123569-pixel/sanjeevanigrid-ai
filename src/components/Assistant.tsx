import { useState } from 'react';
import { Bot, ChevronDown, LoaderCircle, Send, Sparkles, X } from 'lucide-react';
import { askAssistant } from '../services/api';
import { estimateAccess, recommendRoute } from '../domain/access';
import { facilities, stageLabels, villages, type IncidentReport } from '../domain/scenario';

interface Answer { text: string; evidence: string[]; source: string }

export default function Assistant({ stage, reports }: { stage: number; reports: IncidentReport[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function localAnswer(question: string): Answer {
    const q = question.toLowerCase();
    const ranked = villages.map((village) => ({ village, estimate: estimateAccess(village, stage) })).sort((a, b) => b.estimate.score - a.estimate.score);
    const pending = reports.filter((report) => report.status === 'Pending review');
    if (/(highest|most|risk|at.risk|cutoff)/.test(q)) {
      const lead = ranked[0];
      return { text: `${lead.village.name} has the highest modeled access risk in the current sample scenario (${lead.estimate.risk.toLowerCase()}, score ${lead.estimate.score}/100). The estimate uses ${lead.estimate.factors.slice(0, 2).join(' and ').toLowerCase()}. This is a scenario calculation, not a real-world alert.`, evidence: [`VILLAGE-${lead.village.id.toUpperCase()}`, `STAGE-${stage}`, 'CARE-CUTOFF-BASELINE'], source: 'LOCAL DATA ANSWER' };
    }
    if (/(hospital|facility|reachable|route)/.test(q)) {
      const selected = recommendRoute('riverbend', stage);
      return selected ? { text: `${selected.facility.name} is the top reachable facility for Riverbend in the current sample road graph (${selected.distanceKm} km). The graph considers road risk and bridge closure; listed facility availability is seeded sample data. A responder must confirm current service and route status.`, evidence: [`ROUTE-${selected.facility.id.toUpperCase()}`, `ROAD-GRAPH-STAGE-${stage}`, `FACILITY-${selected.facility.id.toUpperCase()}`], source: 'LOCAL DATA ANSWER' } : { text: 'No reachable facility was found in the current sample graph. Confirm road and facility information with a responder.', evidence: [`ROAD-GRAPH-STAGE-${stage}`], source: 'LOCAL DATA ANSWER' };
    }
    if (/(pending|report|incident|queue|sos)/.test(q)) {
      const counts = pending.reduce<Record<string, number>>((groups, report) => { groups[report.kind] = (groups[report.kind] ?? 0) + 1; return groups; }, {});
      const summary = Object.entries(counts).map(([kind, count]) => `${count} ${kind.toLowerCase()}`).join(', ') || 'no reports';
      return { text: `There are ${pending.length} pending reports in the local queue (${summary}). Report text stays in this browser and is not sent to the assistant. Open the responder dashboard to inspect each item.`, evidence: pending.map((report) => report.id).slice(0, 5).concat(pending.length ? [] : ['QUEUE-EMPTY']), source: 'LOCAL DATA ANSWER' };
    }
    if (/(bridge|road|verify|water|why)/.test(q)) {
      return { text: `The critical bridge is the main access link flagged in this scenario. Its exposure increases as the simulated water stage rises; it is treated as blocked from “Alternative route found” onward. This state is part of the deterministic demo only.`, evidence: [`ROAD-BRIDGE`, `STAGE-${stage}`, `SCENARIO:${stageLabels[stage]}`], source: 'LOCAL DATA ANSWER' };
    }
    return { text: `I can answer from the current demo data: ${villages.length} sample villages, ${facilities.length} sample facilities, scenario stage “${stageLabels[stage]}”, and ${pending.length} pending reports. Ask which village is at highest risk, which facility is reachable, or how many reports need review.`, evidence: [`SCENARIO-STAGE-${stage}`, 'SAMPLE-VILLAGES', 'SAMPLE-FACILITIES'], source: 'LOCAL DATA ANSWER' };
  }

  async function submit(question = query) {
    const clean = question.trim();
    if (!clean) return;
    setBusy(true); setError(''); setQuery(clean);
    const applicationData = {
      scenario: { stage, label: stageLabels[stage], dataSource: 'SIMULATION' },
      villages: villages.map((village) => ({ id: village.id, name: village.name, risk: estimateAccess(village, stage).risk, riskScore: estimateAccess(village, stage).score, source: 'SAMPLE' })),
      facilities: facilities.map((facility) => ({ id: facility.id, name: facility.name, availability: facility.availability, emergency: facility.emergency, source: 'SAMPLE' })),
      reportSummary: { pending: reports.filter((report) => report.status === 'Pending review').length, verified: reports.filter((report) => report.status === 'Verified').length, approved: reports.filter((report) => report.status === 'Approved').length, byType: reports.reduce<Record<string, number>>((counts, report) => ({ ...counts, [report.kind]: (counts[report.kind] ?? 0) + 1 }), {}) },
    };
    try {
      const result = await askAssistant(clean, applicationData);
      setAnswer({ text: result.answer, evidence: result.evidence, source: result.source });
    } catch {
      setAnswer(localAnswer(clean));
    } finally { setBusy(false); }
  }

  return <>
    <button className={`assistant-launcher ${open ? 'active' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close Sanjeevani Assistant' : 'Open Sanjeevani Assistant'}>{open ? <X size={18}/> : <><span className="assistant-launcher-icon"><Sparkles size={15}/></span><span>Sanjeevani Assistant</span><ChevronDown size={14}/></>}</button>
    {open && <section className="assistant-panel" aria-label="Sanjeevani Assistant"><div className="assistant-head"><div className="assistant-avatar"><Bot size={17}/></div><div><b>Sanjeevani Assistant</b><span><i/> Grounded in current demo data</span></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={15}/></button></div><div className="assistant-context"><Sparkles size={13}/> {stageLabels[stage]} <span>·</span> {reports.filter((report) => report.status === 'Pending review').length} pending reports</div><div className="assistant-messages"><div className="assistant-greeting">I can explain the scenario, route choices and report totals. Answers use sample data and show their evidence IDs.</div>{answer && <div className="assistant-answer"><div>{answer.text}</div><span className="assistant-source">{answer.source}</span><div className="evidence-chips">{answer.evidence.map((item) => <span key={item}>{item}</span>)}</div></div>}{busy && <div className="assistant-thinking"><LoaderCircle className="spin" size={15}/> Checking application data…</div>}</div><div className="assistant-suggestions"><button onClick={() => void submit('Which village has the highest risk?')}>Highest village risk</button><button onClick={() => void submit('Which hospital is reachable?')}>Reachable facility</button><button onClick={() => void submit('Summarize pending reports')}>Pending reports</button></div>{error && <span className="assistant-error">{error}</span>}<form className="assistant-input" onSubmit={(event) => { event.preventDefault(); void submit(); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask about this scenario…" aria-label="Ask Sanjeevani Assistant"/><button disabled={busy || !query.trim()} aria-label="Send question"><Send size={15}/></button></form><div className="assistant-footnote">Gemini is used when configured. Otherwise, local rules answer from this screen’s sample data. No report text is sent.</div></section>}
  </>;
}
