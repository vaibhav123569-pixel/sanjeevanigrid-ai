export interface HazardAnalysis {
  hazard_type: string;
  severity: string;
  visual_evidence: string[];
  confidence: number;
  recommended_action: string;
  requires_human_verification: boolean;
}

export interface StructuredReport {
  description: string;
  affected_people: number | null;
  symptoms: string[];
  location: string | null;
  road_hazard: string | null;
  urgency: string;
  timestamp: string;
  source: 'GEMINI' | 'LOCAL DEMO';
  requires_human_review: true;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
  const headers = new Headers(init?.headers);
  if (auth?.currentUser) headers.set('Authorization', `Bearer ${await auth.currentUser.getIdToken()}`);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${base}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail || `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function analyzeImage(file: File): Promise<HazardAnalysis & { source: string }> {
  const body = new FormData();
  body.append('image', file);
  return api('/api/analyze-image', { method: 'POST', body });
}

export function extractEmergencyReport(transcript: string): Promise<StructuredReport> {
  return api('/api/extract-report', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }),
  });
}

export function askAssistant(question: string, applicationData: unknown): Promise<{ answer: string; evidence: string[]; source: string }> {
  return api('/api/assistant', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, application_data: applicationData }),
  });
}
import { auth } from './firebase';

