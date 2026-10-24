import { describe, expect, it } from 'vitest';
import { createSpendGuard, SpendGuard } from '../src/guards/spend.js';

const limits = (enabled = true) => ({
  totalCapCents: 3000,
  developmentMaxCents: 500,
  demoReserveCents: 2500,
  enabled,
});

describe('SpendGuard', () => {
  it('rejects paid reservations while disabled', () => {
    const guard = createSpendGuard(limits(false));

    expect(guard.reserve('development', 1)).toEqual({ accepted: false, reason: 'disabled' });
    expect(guard.snapshot()).toMatchObject({
      pendingCents: 0,
      totalSpentCents: 0,
      overBudget: false,
    });
  });

  it('accounts synchronously for parallel in-flight reservations at both limits', () => {
    const guard = createSpendGuard(limits());
    const first = guard.reserve('development', 300);
    const second = guard.reserve('development', 200);

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);
    expect(guard.reserve('development', 1)).toEqual({
      accepted: false,
      reason: 'development_limit',
    });
    expect(guard.reserve('demo', 2501)).toEqual({ accepted: false, reason: 'total_limit' });

    if (first.accepted) guard.cancel(first.id);
    expect(guard.reserve('demo', 2500).accepted).toBe(true);
  });

  it('protects the demo reserve from development reservations', () => {
    const guard = createSpendGuard(limits());
    const dev = guard.reserve('development', 500);
    expect(dev.accepted).toBe(true);
    expect(guard.reserve('demo', 2500).accepted).toBe(true);
    expect(guard.snapshot()).toMatchObject({
      developmentPendingCents: 500,
      demoPendingCents: 2500,
      pendingCents: 3000,
      developmentAvailableCents: 0,
    });
  });

  it('releases a cancelled reservation and errors on reuse', () => {
    const guard = createSpendGuard(limits());
    const reservation = guard.reserve('development', 500);
    expect(reservation.accepted).toBe(true);
    if (!reservation.accepted) return;

    guard.cancel(reservation.id);
    expect(guard.snapshot().pendingCents).toBe(0);
    expect(() => guard.cancel(reservation.id)).toThrow(/already completed/);
    expect(guard.reserve('development', 500).accepted).toBe(true);
  });

  it('records charges above estimate and blocks later reservations when over budget', () => {
    const guard = createSpendGuard(limits());
    const reservation = guard.reserve('development', 400);
    expect(reservation.accepted).toBe(true);
    if (!reservation.accepted) return;

    guard.settle(reservation.id, 600);
    expect(guard.snapshot()).toMatchObject({
      developmentSpentCents: 600,
      totalSpentCents: 600,
      overBudget: true,
      developmentAvailableCents: 0,
    });
    expect(guard.reserve('development', 1)).toEqual({
      accepted: false,
      reason: 'over_budget',
    });
    expect(guard.reserve('demo', 1)).toEqual({ accepted: false, reason: 'over_budget' });
  });

  it('rejects every phase after total spend exceeds the total cap', () => {
    const guard = createSpendGuard(limits());
    const reservation = guard.reserve('demo', 2500);
    expect(reservation.accepted).toBe(true);
    if (!reservation.accepted) return;

    guard.settle(reservation.id, 3001);
    expect(guard.snapshot().overBudget).toBe(true);
    expect(guard.reserve('development', 1)).toEqual({ accepted: false, reason: 'over_budget' });
    expect(guard.reserve('demo', 1)).toEqual({ accepted: false, reason: 'over_budget' });
  });

  it('rejects invalid limits, phases, and amounts', () => {
    expect(() => new SpendGuard({ ...limits(), totalCapCents: 0 })).toThrow(RangeError);
    expect(() => new SpendGuard({ ...limits(), demoReserveCents: 2499 })).toThrow(RangeError);
    const guard = createSpendGuard(limits());
    expect(() => guard.reserve('development', 0)).toThrow(RangeError);
    expect(() => guard.reserve('demo', Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(() => guard.reserve('other' as 'demo', 1)).toThrow(TypeError);

    const reservation = guard.reserve('demo', 1);
    expect(reservation.accepted).toBe(true);
    if (reservation.accepted) {
      expect(() => guard.settle(reservation.id, -1)).toThrow(RangeError);
    }
  });

  it('copies limits so later caller mutation cannot enable or raise the caps', () => {
    const mutableLimits = limits(false);
    const guard = createSpendGuard(mutableLimits);
    mutableLimits.enabled = true;
    mutableLimits.totalCapCents = 9000;
    mutableLimits.developmentMaxCents = 6500;

    expect(guard.snapshot()).toMatchObject({
      enabled: false,
      totalCapCents: 3000,
      developmentMaxCents: 500,
    });
    expect(guard.reserve('demo', 1)).toEqual({ accepted: false, reason: 'disabled' });
  });
});
