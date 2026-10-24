import type { ExtensionMessage, GraphqlResult } from "../shared/messages";
import type { ProblemMeta } from "../storage/history";

/**
 * Reads problem details and your recent submissions from LeetCode's GraphQL
 * API. Queries run inside the page via the background worker, so they use
 * your LeetCode session exactly like the site does.
 *
 * Verified against leetcode.com in October 2026:
 * - question(titleSlug) returns questionFrontendId, title, difficulty, topicTags.
 * - questionSubmissionList(questionSlug) returns your submissions newest
 *   first, with statusDisplay ("Accepted", "Wrong Answer", ...) and a
 *   timestamp in seconds. It works for old submissions, unlike
 *   /submissions/detail/<id>/check/, which only answers for fresh ones.
 */

export type Send = (message: ExtensionMessage) => Promise<unknown>;

const META_QUERY =
  "query blindPracticeMeta($titleSlug: String!) {" +
  " question(titleSlug: $titleSlug) { questionFrontendId title difficulty topicTags { name } } }";

const SUBMISSIONS_QUERY =
  "query blindPracticeSubmissions($questionSlug: String!, $offset: Int!, $limit: Int!) {" +
  " questionSubmissionList(questionSlug: $questionSlug, offset: $offset, limit: $limit) {" +
  " submissions { id statusDisplay timestamp } } }";

/** Submissions this close before the attempt began still count (clock skew). */
const CLOCK_SKEW_MS = 30_000;
const NOT_JUDGED = /pending|judging/i;

async function graphql(send: Send, query: string, variables: Record<string, unknown>): Promise<unknown | null> {
  const result = (await send({ type: "graphql", query, variables })) as GraphqlResult | undefined;
  return result?.ok ? result.data : null;
}

export async function fetchMeta(send: Send, slug: string): Promise<ProblemMeta | null> {
  const data = (await graphql(send, META_QUERY, { titleSlug: slug })) as {
    question?: { questionFrontendId?: string; title?: string; difficulty?: string; topicTags?: { name: string }[] } | null;
  } | null;
  const q = data?.question;
  if (!q?.title) return null;
  return {
    title: q.title,
    frontendId: String(q.questionFrontendId ?? ""),
    difficulty: q.difficulty ?? "Unknown",
    topics: (q.topicTags ?? []).map((t) => t.name).filter(Boolean),
  };
}

export interface SubmissionScan {
  /** The first Accepted submission since the attempt began, if any. */
  accepted: { id: string; at: number } | null;
  /** Judged, non-accepted submissions since the attempt began (before the Accepted one). */
  wrong: number;
}

interface RawSubmission {
  id: string;
  statusDisplay: string;
  timestamp: string;
}

/** Pure part of scanSubmissions, exported for tests. */
export function analyzeSubmissions(submissions: RawSubmission[], sinceMs: number): SubmissionScan {
  const relevant = submissions
    .map((s) => ({ id: String(s.id), status: String(s.statusDisplay), at: Number(s.timestamp) * 1000 }))
    .filter((s) => Number.isFinite(s.at) && s.at >= sinceMs - CLOCK_SKEW_MS && !NOT_JUDGED.test(s.status))
    .sort((a, b) => a.at - b.at);
  const firstAccepted = relevant.find((s) => s.status === "Accepted") ?? null;
  const wrong = relevant.filter((s) => s.status !== "Accepted" && (!firstAccepted || s.at <= firstAccepted.at)).length;
  return { accepted: firstAccepted ? { id: firstAccepted.id, at: firstAccepted.at } : null, wrong };
}

export async function scanSubmissions(send: Send, slug: string, sinceMs: number): Promise<SubmissionScan | null> {
  const data = (await graphql(send, SUBMISSIONS_QUERY, { questionSlug: slug, offset: 0, limit: 20 })) as {
    questionSubmissionList?: { submissions?: RawSubmission[] } | null;
  } | null;
  const submissions = data?.questionSubmissionList?.submissions;
  if (!Array.isArray(submissions)) return null;
  return analyzeSubmissions(submissions, sinceMs);
}
