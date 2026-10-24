import type { History, ProblemRecord } from "../storage/history";
import { isDue, outcomeOf, type Attempt, type AttemptOutcome } from "./review";

/** Aggregates for the dashboard. Pure functions over the stored history. */

export interface FlatAttempt extends Attempt {
  slug: string;
  title: string;
  difficulty: string;
  topics: string[];
  outcome: AttemptOutcome;
}

export interface GroupStats {
  name: string;
  solved: number;
  clean: number;
  /** Peeked before solving, whether or not it was then solved. */
  peeked: number;
  medianMs: number | null;
}

export interface Summary {
  problemsSolved: number;
  attemptsSolved: number;
  cleanRate: number | null;
  medianSolveMs: number | null;
  dueNow: number;
}

export function titleOf(record: ProblemRecord): string {
  return record.meta ? `${record.meta.frontendId}. ${record.meta.title}` : record.slug;
}

export function flattenAttempts(history: History): FlatAttempt[] {
  const out: FlatAttempt[] = [];
  for (const record of Object.values(history)) {
    for (const attempt of record.attempts) {
      out.push({
        ...attempt,
        slug: record.slug,
        title: titleOf(record),
        difficulty: record.meta?.difficulty ?? "Unknown",
        topics: record.meta?.topics ?? [],
        outcome: outcomeOf(attempt),
      });
    }
  }
  return out.sort((a, b) => b.id - a.id);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function groupStats(name: string, attempts: FlatAttempt[]): GroupStats {
  const solved = attempts.filter((a) => a.solvedAt !== undefined);
  return {
    name,
    solved: solved.length,
    clean: solved.filter((a) => a.outcome === "clean").length,
    peeked: attempts.filter((a) => a.outcome === "assisted" || a.outcome === "gave-up").length,
    medianMs: median(solved.map((a) => a.solveMs ?? 0).filter((ms) => ms > 0)),
  };
}

export function summarize(history: History, now: number): Summary {
  const attempts = flattenAttempts(history);
  const solved = attempts.filter((a) => a.solvedAt !== undefined);
  return {
    problemsSolved: new Set(solved.map((a) => a.slug)).size,
    attemptsSolved: solved.length,
    cleanRate: solved.length ? solved.filter((a) => a.outcome === "clean").length / solved.length : null,
    medianSolveMs: median(solved.map((a) => a.solveMs ?? 0).filter((ms) => ms > 0)),
    dueNow: dueProblems(history, now).length,
  };
}

/** Per topic, slowest first. Topics with no solved attempt sort last. */
export function topicStats(history: History): GroupStats[] {
  const byTopic = new Map<string, FlatAttempt[]>();
  for (const attempt of flattenAttempts(history)) {
    for (const topic of attempt.topics) {
      if (!byTopic.has(topic)) byTopic.set(topic, []);
      byTopic.get(topic)!.push(attempt);
    }
  }
  return [...byTopic.entries()]
    .map(([topic, attempts]) => groupStats(topic, attempts))
    .sort((a, b) => (b.medianMs ?? -1) - (a.medianMs ?? -1) || b.solved - a.solved);
}

const DIFFICULTY_ORDER = ["Easy", "Medium", "Hard"];

export function difficultyStats(history: History): GroupStats[] {
  const attempts = flattenAttempts(history);
  return DIFFICULTY_ORDER.map((d) => groupStats(d, attempts.filter((a) => a.difficulty === d))).filter(
    (g) => g.solved > 0 || g.peeked > 0,
  );
}

export function dueProblems(history: History, now: number): ProblemRecord[] {
  return Object.values(history)
    .filter((r) => isDue(r.review, now))
    .sort((a, b) => (a.review!.dueAt ?? 0) - (b.review!.dueAt ?? 0));
}

export function upcomingProblems(history: History, now: number, withinDays = 7): ProblemRecord[] {
  const limit = now + withinDays * 24 * 60 * 60 * 1000;
  return Object.values(history)
    .filter((r) => r.review && !r.review.retired && r.review.dueAt !== null && r.review.dueAt > now && r.review.dueAt <= limit)
    .sort((a, b) => (a.review!.dueAt ?? 0) - (b.review!.dueAt ?? 0));
}

/** The latest solved attempt, for "last solved N days ago in 12:30". */
export function lastSolved(record: ProblemRecord | undefined): Attempt | null {
  if (!record) return null;
  for (let i = record.attempts.length - 1; i >= 0; i--) {
    if (record.attempts[i].solvedAt !== undefined) return record.attempts[i];
  }
  return null;
}
