/**
 * Spaced-repetition rules for blind re-solves. Pure functions, no Chrome APIs.
 *
 * Each problem sits on a ladder of intervals. A clean solve (Accepted without
 * opening any solution section first) moves it up one rung; peeking, whether
 * you then solved it or gave up, drops it to the bottom so it comes back
 * tomorrow.
 */

export const LADDER_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AttemptOutcome = "clean" | "assisted" | "gave-up" | "unfinished";

export interface Attempt {
  /** Same as the session's attemptId: epoch ms the attempt began. */
  id: number;
  /** True when the problem was due for a re-solve when this attempt began. */
  review: boolean;
  /** Epoch ms a solution section was first opened before solving. */
  peekedAt?: number;
  /** Epoch ms of the first Accepted submission. */
  solvedAt?: number;
  /** Active solving time until Accepted, pauses excluded. */
  solveMs?: number;
  /** Non-accepted submissions made during the attempt. */
  wrongSubmissions?: number;
}

export interface ReviewState {
  /** Index into LADDER_DAYS of the interval last scheduled. */
  step: number;
  /** Epoch ms the problem is due again; null when not scheduled. */
  dueAt: number | null;
  /** True when the user chose "Stop reviewing". */
  retired?: boolean;
}

export function outcomeOf(attempt: Attempt): AttemptOutcome {
  if (attempt.solvedAt !== undefined) {
    return attempt.peekedAt !== undefined && attempt.peekedAt <= attempt.solvedAt ? "assisted" : "clean";
  }
  return attempt.peekedAt !== undefined ? "gave-up" : "unfinished";
}

export const OUTCOME_LABEL: Record<AttemptOutcome, string> = {
  clean: "Solved blind",
  assisted: "Solved after peeking",
  "gave-up": "Peeked, not solved",
  unfinished: "Not finished",
};

/** The review state after an attempt reaches an outcome. */
export function scheduleAfter(
  review: ReviewState | undefined,
  outcome: AttemptOutcome,
  now: number,
): ReviewState {
  const current = review ?? { step: -1, dueAt: null };
  if (outcome === "unfinished") return { ...current, step: Math.max(0, current.step), dueAt: current.dueAt };

  // Peeking always brings it back tomorrow.
  const step = outcome === "clean" ? Math.min(current.step + 1, LADDER_DAYS.length - 1) : 0;
  // A first-ever clean solve skips the 1-day rung: you already did it blind.
  const effective = outcome === "clean" && current.step < 0 ? 1 : step;
  return {
    step: effective,
    dueAt: now + LADDER_DAYS[effective] * DAY_MS,
    ...(current.retired ? { retired: true } : {}),
  };
}

export function isDue(review: ReviewState | undefined, now: number): boolean {
  return !!review && !review.retired && review.dueAt !== null && review.dueAt <= now;
}

/** "today", "tomorrow", "in 3 days", "2 days ago". */
export function relativeDays(at: number, now: number): string {
  const startOfDay = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY_MS);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
