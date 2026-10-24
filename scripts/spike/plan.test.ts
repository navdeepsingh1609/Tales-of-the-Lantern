import { describe, expect, it } from 'vitest';
import { createSpikePlan, estimateProviderDollars, parseSpikeArgs } from './plan.ts';

describe('offline spike plan', () => {
  it('bounds the future batch and computes provider-dollar estimates', () => {
    const plan = createSpikePlan();
    expect(plan.requestBudget).toEqual({
      httpRequests: 3,
      websocketSessions: 1,
      websocketMaxSeconds: 45,
    });
    expect(plan.estimatedProviderDollars.tts).toBeCloseTo(0.0018);
    expect(plan.estimatedProviderDollars.avatar).toBeCloseTo((8 * 0.07) / 60);
    expect(plan.estimatedProviderDollars.realtime).toBeCloseTo((45 * (0.0023 + 0.014)) / 60);
    expect(plan.budgetPolicy).toMatchObject({
      currency: 'CAD',
      projectCeiling: 30,
      demoReserve: 25,
      developmentCeiling: 5,
      paidCallsEnabled: false,
      conversion: 'unverified',
    });
    expect(plan.estimatedProviderDollars.secretRequestCharge).toContain('unknown');
    expect(plan.optionalDeferred).toHaveLength(4);
  });

  it('keeps default planning offline and refuses live flags', () => {
    expect(parseSpikeArgs([])).toBe('plan');
    expect(parseSpikeArgs(['--check'])).toBe('check');
    expect(() => parseSpikeArgs(['--run'])).toThrow(/offline-only/);
    expect(() => parseSpikeArgs(['--live'])).toThrow(/offline-only/);
    expect(() => parseSpikeArgs(['--anything'])).toThrow(/Unknown argument/);
    expect(() => parseSpikeArgs(['--check', '--plan'])).toThrow(/Choose either/);
  });

  it('uses pure capped-rate arithmetic', () => {
    expect(estimateProviderDollars(0, 0, 0)).toEqual({ tts: 0, avatar: 0, realtime: 0, total: 0 });
    expect(() => estimateProviderDollars(-1, 0, 0)).toThrow(RangeError);
    expect(() => estimateProviderDollars(121, 0, 0)).toThrow(RangeError);
    expect(() => estimateProviderDollars(120, 9, 0)).toThrow(RangeError);
    expect(() => estimateProviderDollars(120, 8, Infinity)).toThrow(RangeError);
  });
});
