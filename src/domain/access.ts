import { facilities, roads, villages, type Facility, type RoadEdge, type Village, type VillageId } from './scenario';

export interface AccessEstimate {
  risk: 'Low' | 'Moderate' | 'High' | 'Critical';
  score: number;
  minutesToDisruption: number | null;
  confidence: number;
  factors: string[];
}

export interface RouteResult {
  facility: Facility;
  distanceKm: number;
  roads: RoadEdge[];
  alternatives: { facility: Facility; distanceKm: number; reachable: boolean }[];
}

export function estimateAccess(village: Village, stage: number): AccessEstimate {
  const floodLevel = Math.min(0.96, [0.12, 0.38, 0.55, 0.67, 0.76, 0.84, 0.84, 0.84][stage] ?? 0.12);
  const bridgeExposure = village.id === 'riverbend' ? floodLevel * village.vulnerability / 100 : floodLevel * 0.42;
  const score = Math.min(100, Math.round(bridgeExposure * 68 + (village.vulnerability / 100) * 27 + (stage >= 4 && village.id === 'riverbend' ? 12 : 0)));
  const risk: AccessEstimate['risk'] = score >= 78 ? 'Critical' : score >= 58 ? 'High' : score >= 37 ? 'Moderate' : 'Low';
  const minutesToDisruption = stage >= 4 && village.id === 'riverbend' ? 16 : stage >= 2 && village.id === 'riverbend' ? 23 : stage === 1 && village.id === 'riverbend' ? 37 : stage >= 3 ? 48 : 58;
  const factors = [
    `${Math.round(floodLevel * 100)}% simulated flood progression`,
    village.id === 'riverbend' ? 'Single bridge is the primary care connection' : 'More than one road connection in this sample graph',
    `Road vulnerability input: ${village.vulnerability}/100`,
    stage >= 5 && village.id === 'riverbend' ? 'Primary bridge treated as impassable in this scenario stage' : 'Alternative route availability included in the baseline estimate',
  ];
  return { risk, score, minutesToDisruption, confidence: stage >= 4 ? 0.72 : 0.61, factors };
}

function shortestPath(source: string, target: string, stage: number): { distance: number; edges: RoadEdge[] } | null {
  const distances = new Map<string, number>([[source, 0]]);
  const previous = new Map<string, { node: string; edge: RoadEdge }>();
  const pending = new Set<string>([source, ...roads.flatMap((road) => [road.from, road.to])]);
  while (pending.size) {
    let current: string | undefined;
    let best = Infinity;
    for (const node of pending) {
      const distance = distances.get(node) ?? Infinity;
      if (distance < best) { best = distance; current = node; }
    }
    if (!current || best === Infinity) break;
    pending.delete(current);
    if (current === target) break;
    for (const edge of roads.filter((road) => road.from === current || road.to === current)) {
      const blocked = edge.bridge && stage >= 5;
      if (blocked) continue;
      const neighbor = edge.from === current ? edge.to : edge.from;
      if (!pending.has(neighbor)) continue;
      const floodPenalty = stage >= 1 ? edge.risk * (stage >= 4 ? 18 : 9) : 0;
      const cost = best + edge.lengthKm * (1 + edge.risk * 0.35) + floodPenalty;
      if (cost < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, cost);
        previous.set(neighbor, { node: current, edge });
      }
    }
  }
  if (!distances.has(target)) return null;
  const selected: RoadEdge[] = [];
  let cursor = target;
  while (cursor !== source) {
    const item = previous.get(cursor);
    if (!item) return null;
    selected.unshift(item.edge);
    cursor = item.node;
  }
  return { distance: Number(selected.reduce((sum, edge) => sum + edge.lengthKm, 0).toFixed(1)), edges: selected };
}

export function recommendRoute(villageId: VillageId, stage: number): RouteResult | null {
  const options = facilities.map((facility) => ({ facility, path: shortestPath(villageId, facility.id, stage) }));
  const available = options.filter((option) => option.facility.emergency && option.facility.availability === 'available' && option.path);
  if (!available.length) return null;
  available.sort((a, b) => (a.path?.distance ?? Infinity) - (b.path?.distance ?? Infinity));
  const selected = available[0];
  if (!selected.path) return null;
  return {
    facility: selected.facility,
    distanceKm: selected.path.distance,
    roads: selected.path.edges,
    alternatives: options.map(({ facility, path }) => ({ facility, distanceKm: path?.distance ?? 0, reachable: Boolean(path) })),
  };
}

export function stageVillage(id: VillageId, stage: number): Village {
  const source = villages.find((village) => village.id === id)!;
  const estimate = estimateAccess(source, stage);
  const status: Village['status'] = stage >= 4 && id === 'riverbend' ? 'at-risk' : stage >= 1 && id === 'riverbend' ? 'watch' : 'stable';
  return { ...source, status, accessMinutes: estimate.minutesToDisruption ?? source.accessMinutes };
}
