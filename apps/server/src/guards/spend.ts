/**
 * Process-local reservation accounting for future paid provider calls.
 *
 * Callers must supply a conservative cost estimate in CAD cents before making
 * a provider request, and reconcile it with the provider's actual charge.
 * Estimates are only as accurate as the caller's pricing/token assumptions;
 * a provider-side spending cap is still required for a hard external limit.
 * This in-memory ledger resets on restart and is not yet bound to routes, so it
 * does not claim universal enforcement of the application's budget.
 */

export type SpendPhase = 'development' | 'demo';

export interface SpendGuardLimits {
  totalCapCents: number;
  developmentMaxCents: number;
  demoReserveCents: number;
  enabled: boolean;
}

export interface SpendSnapshot {
  enabled: boolean;
  totalCapCents: number;
  developmentMaxCents: number;
  demoReserveCents: number;
  developmentSpentCents: number;
  demoSpentCents: number;
  totalSpentCents: number;
  pendingCents: number;
  developmentPendingCents: number;
  demoPendingCents: number;
  availableCents: number;
  developmentAvailableCents: number;
  overBudget: boolean;
}

export type ReservationResult =
  | { accepted: true; id: string }
  | { accepted: false; reason: 'disabled' | 'over_budget' | 'development_limit' | 'total_limit' };

interface Reservation {
  phase: SpendPhase;
  expectedCostCents: number;
}

const isPositiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
const isNonNegativeSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

export class SpendGuard {
  private readonly limits: Readonly<SpendGuardLimits>;
  private readonly reservations = new Map<string, Reservation>();
  private readonly settledIds = new Set<string>();
  private nextId = 1;
  private developmentSpentCents = 0;
  private demoSpentCents = 0;

  constructor(limits: SpendGuardLimits) {
    if (!isPositiveSafeInteger(limits.totalCapCents)) {
      throw new RangeError('totalCapCents must be a positive safe integer');
    }
    if (!isPositiveSafeInteger(limits.developmentMaxCents)) {
      throw new RangeError('developmentMaxCents must be a positive safe integer');
    }
    if (!isPositiveSafeInteger(limits.demoReserveCents)) {
      throw new RangeError('demoReserveCents must be a positive safe integer');
    }
    if (limits.developmentMaxCents + limits.demoReserveCents !== limits.totalCapCents) {
      throw new RangeError('developmentMaxCents plus demoReserveCents must equal totalCapCents');
    }
    if (typeof limits.enabled !== 'boolean') {
      throw new TypeError('enabled must be a boolean');
    }
    this.limits = Object.freeze({ ...limits });
  }

  reserve(phase: SpendPhase, expectedCostCents: number): ReservationResult {
    if (phase !== 'development' && phase !== 'demo') {
      throw new TypeError('phase must be development or demo');
    }
    if (!isPositiveSafeInteger(expectedCostCents)) {
      throw new RangeError('expectedCostCents must be a positive safe integer');
    }
    if (!this.limits.enabled) return { accepted: false, reason: 'disabled' };
    if (this.snapshot().overBudget) return { accepted: false, reason: 'over_budget' };

    const pending = this.pendingTotals();
    const totalCommitted = this.developmentSpentCents + this.demoSpentCents + pending.total;
    if (totalCommitted + expectedCostCents > this.limits.totalCapCents) {
      return { accepted: false, reason: 'total_limit' };
    }
    if (
      phase === 'development' &&
      this.developmentSpentCents + pending.development + expectedCostCents >
        this.limits.developmentMaxCents
    ) {
      return { accepted: false, reason: 'development_limit' };
    }

    const id = `spend-${this.nextId++}`;
    this.reservations.set(id, { phase, expectedCostCents });
    return { accepted: true, id };
  }

  settle(id: string, actualCostCents: number): void {
    if (!isNonNegativeSafeInteger(actualCostCents)) {
      throw new RangeError('actualCostCents must be a non-negative safe integer');
    }
    const reservation = this.reservations.get(id);
    if (!reservation) this.throwUnknownOrCompleted(id);

    const nextPhaseSpend =
      (reservation.phase === 'development' ? this.developmentSpentCents : this.demoSpentCents) +
      actualCostCents;
    if (!Number.isSafeInteger(nextPhaseSpend)) {
      throw new RangeError('settled spend would exceed safe integer precision');
    }
    if (!Number.isSafeInteger(this.developmentSpentCents + this.demoSpentCents + actualCostCents)) {
      throw new RangeError('settled spend would exceed safe integer precision');
    }

    this.reservations.delete(id);
    this.settledIds.add(id);
    if (reservation.phase === 'development') {
      this.developmentSpentCents += actualCostCents;
    } else {
      this.demoSpentCents += actualCostCents;
    }
  }

  cancel(id: string): void {
    if (!this.reservations.delete(id)) this.throwUnknownOrCompleted(id);
    this.settledIds.add(id);
  }

  snapshot(): SpendSnapshot {
    const pending = this.pendingTotals();
    const totalSpentCents = this.developmentSpentCents + this.demoSpentCents;
    const totalCommitted = totalSpentCents + pending.total;
    const developmentCommitted = this.developmentSpentCents + pending.development;
    const overBudget =
      totalSpentCents > this.limits.totalCapCents ||
      totalCommitted > this.limits.totalCapCents ||
      this.developmentSpentCents > this.limits.developmentMaxCents ||
      developmentCommitted > this.limits.developmentMaxCents;

    return {
      enabled: this.limits.enabled,
      totalCapCents: this.limits.totalCapCents,
      developmentMaxCents: this.limits.developmentMaxCents,
      demoReserveCents: this.limits.demoReserveCents,
      developmentSpentCents: this.developmentSpentCents,
      demoSpentCents: this.demoSpentCents,
      totalSpentCents,
      pendingCents: pending.total,
      developmentPendingCents: pending.development,
      demoPendingCents: pending.demo,
      availableCents: Math.max(0, this.limits.totalCapCents - totalCommitted),
      developmentAvailableCents: Math.max(
        0,
        this.limits.developmentMaxCents - developmentCommitted,
      ),
      overBudget,
    };
  }

  private pendingTotals(): { total: number; development: number; demo: number } {
    let total = 0;
    let development = 0;
    let demo = 0;
    for (const reservation of this.reservations.values()) {
      total += reservation.expectedCostCents;
      if (reservation.phase === 'development') development += reservation.expectedCostCents;
      else demo += reservation.expectedCostCents;
    }
    return { total, development, demo };
  }

  private throwUnknownOrCompleted(id: string): never {
    if (this.settledIds.has(id)) throw new Error(`reservation ${id} is already completed`);
    throw new Error(`unknown reservation ${id}`);
  }
}

export function createSpendGuard(limits: SpendGuardLimits): SpendGuard {
  return new SpendGuard(limits);
}
