export type VillageId = 'riverbend' | 'sonapur' | 'hillview';
export type FacilityId = 'barak' | 'valley';

export interface Village {
  id: VillageId;
  name: string;
  population: number;
  lat: number;
  lng: number;
  vulnerability: number;
  status: 'stable' | 'watch' | 'at-risk' | 'isolated';
  accessMinutes: number;
}

export interface Facility {
  id: FacilityId;
  name: string;
  type: string;
  lat: number;
  lng: number;
  emergency: boolean;
  availability: 'available' | 'limited';
}

export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  lengthKm: number;
  risk: number;
  bridge?: boolean;
  path: [number, number][];
}

export interface IncidentReport {
  id: string;
  title: string;
  location: string;
  kind: 'Road hazard' | 'Emergency report' | 'Route recommendation';
  status: 'Pending review' | 'Verified' | 'Needs follow-up' | 'Approved';
  time: string;
  source: 'SIMULATION' | 'DEMO SEED' | 'LIVE';
  detail: string;
}

export const villages: Village[] = [
  { id: 'riverbend', name: 'Riverbend', population: 1240, lat: 26.182, lng: 92.688, vulnerability: 88, status: 'stable', accessMinutes: 23 },
  { id: 'sonapur', name: 'Sonapur', population: 860, lat: 26.218, lng: 92.742, vulnerability: 62, status: 'stable', accessMinutes: 31 },
  { id: 'hillview', name: 'Hillview', population: 640, lat: 26.266, lng: 92.648, vulnerability: 38, status: 'stable', accessMinutes: 19 },
];

export const facilities: Facility[] = [
  { id: 'barak', name: 'Barak Community Hospital', type: 'District hospital', lat: 26.112, lng: 92.750, emergency: true, availability: 'available' },
  { id: 'valley', name: 'Valley Primary Health Centre', type: 'Primary health centre', lat: 26.294, lng: 92.786, emergency: true, availability: 'available' },
];

// Fictional links and places for a deterministic demonstration; these are not live road observations.
export const roads: RoadEdge[] = [
  { id: 'bridge', from: 'riverbend', to: 'barak', lengthKm: 12, risk: 0.92, bridge: true, path: [[26.182, 92.688], [26.165, 92.714], [26.142, 92.728], [26.112, 92.750]] },
  { id: 'riverbend-sonapur', from: 'riverbend', to: 'sonapur', lengthKm: 8, risk: 0.48, path: [[26.182, 92.688], [26.198, 92.708], [26.218, 92.742]] },
  { id: 'sonapur-valley', from: 'sonapur', to: 'valley', lengthKm: 13, risk: 0.21, path: [[26.218, 92.742], [26.244, 92.756], [26.266, 92.774], [26.294, 92.786]] },
  { id: 'hillview-sonapur', from: 'hillview', to: 'sonapur', lengthKm: 10, risk: 0.15, path: [[26.266, 92.648], [26.247, 92.691], [26.218, 92.742]] },
  { id: 'hillview-valley', from: 'hillview', to: 'valley', lengthKm: 15, risk: 0.12, path: [[26.266, 92.648], [26.278, 92.698], [26.292, 92.741], [26.294, 92.786]] },
  { id: 'riverbend-hillview', from: 'riverbend', to: 'hillview', lengthKm: 14, risk: 0.28, path: [[26.182, 92.688], [26.209, 92.669], [26.238, 92.655], [26.266, 92.648]] },
];

export const reportSeed: IncidentReport[] = [
  { id: 'SG-204', title: 'Water rising near east bridge', location: 'Riverbend crossing', kind: 'Road hazard', status: 'Pending review', time: '4 min ago', source: 'DEMO SEED', detail: 'Illustrative citizen report. Road status needs responder confirmation.' },
  { id: 'SG-201', title: 'Clinic route status updated', location: 'Valley PHC approach', kind: 'Route recommendation', status: 'Verified', time: '18 min ago', source: 'DEMO SEED', detail: 'Seeded example route review; not a live facility feed.' },
];

export const stageLabels = [
  'Normal conditions',
  'Rising water',
  'Road hazard reported',
  'AI verification',
  'Access risk identified',
  'Alternative route found',
  'Responder review',
  'Recommendation approved',
];
