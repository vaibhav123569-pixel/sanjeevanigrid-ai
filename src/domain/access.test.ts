import { describe, expect, it } from 'vitest';
import { estimateAccess, recommendRoute, stageVillage } from './access';

describe('SanjeevaniGrid demo access model', () => {
  it('labels every result as a deterministic scenario estimate with contributing factors', () => {
    const estimate = estimateAccess(stageVillage('riverbend', 4), 4);
    expect(estimate.risk).toBe('Critical');
    expect(estimate.minutesToDisruption).toBe(16);
    expect(estimate.factors.length).toBeGreaterThanOrEqual(3);
    expect(estimate.confidence).toBeGreaterThan(0);
    expect(estimate.confidence).toBeLessThan(1);
  });

  it('recommends the primary hospital in normal conditions and reroutes when the bridge is closed', () => {
    const normal = recommendRoute('riverbend', 0);
    const flooded = recommendRoute('riverbend', 5);
    expect(normal?.facility.id).toBe('barak');
    expect(flooded?.facility.id).toBe('valley');
    expect(flooded?.roads.some((edge) => edge.bridge)).toBe(false);
    expect(flooded?.distanceKm).toBeGreaterThan(normal?.distanceKm ?? 0);
  });

  it('keeps village state stable until the bridge closure stage', () => {
    expect(stageVillage('riverbend', 0).status).toBe('stable');
    expect(stageVillage('riverbend', 1).status).toBe('watch');
    expect(stageVillage('riverbend', 4).status).toBe('at-risk');
    expect(stageVillage('sonapur', 5).status).toBe('stable');
  });
});
