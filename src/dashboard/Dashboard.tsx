import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { APP_NAME } from "../shared/brand";
import {
  clearHistory,
  exportHistory,
  getHistory,
  importHistory,
  onHistoryChanged,
  setRetired,
  type History,
  type ProblemRecord,
} from "../storage/history";
import { LADDER_DAYS, OUTCOME_LABEL, outcomeOf, relativeDays, type AttemptOutcome } from "../shared/review";
import {
  difficultyStats,
  dueProblems,
  flattenAttempts,
  lastSolved,
  summarize,
  titleOf,
  topicStats,
  upcomingProblems,
  type GroupStats,
} from "../shared/stats";
import { formatRemaining } from "../shared/timing";
import SupportCard from "./SupportCard";

const problemUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;

const OUTCOME_STYLE: Record<AttemptOutcome, { icon: string; className: string }> = {
  clean: { icon: "✓", className: "text-emerald-300" },
  assisted: { icon: "!", className: "text-amber-300" },
  "gave-up": { icon: "✕", className: "text-rose-300" },
  unfinished: { icon: "…", className: "text-slate-400" },
};

const DIFFICULTY_STYLE: Record<string, string> = {
  Easy: "text-emerald-300 bg-emerald-400/10",
  Medium: "text-amber-300 bg-amber-400/10",
  Hard: "text-rose-300 bg-rose-400/10",
};

function duration(ms: number | null | undefined): string {
  return ms ? formatRemaining(ms) : "–";
}

function percent(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : "–";
}

function Card({ title, note, children, id }: { title: string; note?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Difficulty({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_STYLE[value] ?? "bg-slate-800 text-slate-300"}`}>
      {value}
    </span>
  );
}

function Outcome({ outcome }: { outcome: AttemptOutcome }) {
  const style = OUTCOME_STYLE[outcome];
  return (
    <span className={`inline-flex items-center gap-1.5 ${style.className}`}>
      <span aria-hidden="true" className="inline-block w-3 text-center font-bold">{style.icon}</span>
      <span>{OUTCOME_LABEL[outcome]}</span>
    </span>
  );
}

/** Topic or difficulty rows with a thin single-hue bar for median solve time. */
function GroupTable({ rows, label }: { rows: GroupStats[]; label: string }) {
  const max = Math.max(...rows.map((r) => r.medianMs ?? 0), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400">
            <th className="pb-2 font-medium">{label}</th>
            <th className="pb-2 text-right font-medium">Solved</th>
            <th className="pb-2 text-right font-medium">Solved blind</th>
            <th className="pb-2 text-right font-medium">Peeked</th>
            <th className="w-[38%] pb-2 pl-6 font-medium">Median solve time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-slate-800">
              <td className="py-2 pr-3">{row.name}</td>
              <td className="py-2 text-right tabular-nums">{row.solved}</td>
              <td className="py-2 text-right tabular-nums">{percent(row.clean, row.solved)}</td>
              <td className="py-2 text-right tabular-nums">{row.peeked}</td>
              <td className="py-2 pl-6">
                <div className="flex items-center gap-3" title={`${row.name}: median ${duration(row.medianMs)}`}>
                  <div className="h-2 flex-1">
                    {row.medianMs ? (
                      <div
                        className="h-2 rounded-r bg-violet-400"
                        style={{ width: `${Math.max(4, (row.medianMs / max) * 100)}%` }}
                      />
                    ) : null}
                  </div>
                  <span className="w-14 text-right tabular-nums text-slate-200">{duration(row.medianMs)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewRow({ record, now, action }: { record: ProblemRecord; now: number; action: ReactNode }) {
  const solved = lastSolved(record);
  const last = record.attempts.at(-1);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a href={problemUrl(record.slug)} target="_blank" rel="noreferrer" className="font-medium hover:underline">
            {titleOf(record)}
          </a>
          <Difficulty value={record.meta?.difficulty} />
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {solved?.solvedAt
            ? `Last solved ${relativeDays(solved.solvedAt, now)} in ${duration(solved.solveMs)}`
            : "Not solved yet"}
          {last && ` · last attempt: ${OUTCOME_LABEL[outcomeOf(last)].toLowerCase()}`}
        </p>
      </div>
      {action}
    </li>
  );
}

function DataControls() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const timeout = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(timeout);
  }, [confirmDelete]);

  const doExport = async () => {
    const json = await exportHistory();
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `no-peek-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Exported.");
  };

  const doImport = async (file: File) => {
    try {
      const count = await importHistory(JSON.parse(await file.text()));
      setMessage(`Imported ${count} problem${count === 1 ? "" : "s"}. Existing history was kept.`);
    } catch {
      setMessage(`That file isn't a ${APP_NAME} history export.`);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
    await clearHistory();
    setMessage("History deleted.");
  };

  const button = "rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500 hover:text-white";
  return (
    <div>
      <p className="max-w-prose text-sm text-slate-400">
        Your history is stored only in this browser. Export it to keep a backup or move it to another computer.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={button} onClick={doExport}>Export</button>
        <button className={button} onClick={() => fileInput.current?.click()}>Import</button>
        <button
          className={confirmDelete ? "rounded-lg border border-rose-500 px-3 py-1.5 text-sm text-rose-300" : button}
          onClick={doDelete}
        >
          {confirmDelete ? "Click again to delete everything" : "Delete history"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void doImport(file);
            e.target.value = "";
          }}
        />
      </div>
      {message && <p className="mt-2 text-xs text-slate-400" role="status">{message}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [history, setHistory] = useState<History | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [highlightSupport, setHighlightSupport] = useState(() => location.hash === "#support");

  useEffect(() => {
    const load = () => void getHistory().then(setHistory);
    load();
    const unsubscribe = onHistoryChanged(load);
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!history || location.hash !== "#support") return;
    document.getElementById("support")?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = setTimeout(() => setHighlightSupport(false), 2500);
    return () => clearTimeout(timeout);
  }, [history]);

  const view = useMemo(() => {
    if (!history) return null;
    return {
      summary: summarize(history, now),
      due: dueProblems(history, now),
      upcoming: upcomingProblems(history, now),
      retired: Object.values(history).filter((r) => r.review?.retired),
      topics: topicStats(history),
      difficulties: difficultyStats(history),
      recent: flattenAttempts(history).slice(0, 25),
    };
  }, [history, now]);

  if (!view) return <div className="p-8 text-slate-400">Loading…</div>;
  const empty = view.recent.length === 0;
  const { summary } = view;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
      <header className="flex items-center gap-3">
        <img src="/icon48.png" alt="" className="h-10 w-10" />
        <div>
          <h1 className="text-xl font-bold">{APP_NAME}</h1>
          <p className="text-sm text-slate-400">Your practice history and re-solve queue.</p>
        </div>
      </header>

      {empty ? (
        <Card title="Nothing here yet">
          <p className="max-w-prose text-sm text-slate-300">
            Open a problem on LeetCode and click <strong>Start solving</strong>. Every attempt is recorded here: how long
            you took, whether you peeked at a solution first, and when to solve it again blind.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Problems solved" value={String(summary.problemsSolved)} hint={`${summary.attemptsSolved} solves in total`} />
            <StatTile
              label="Solved blind"
              value={summary.cleanRate === null ? "–" : `${Math.round(summary.cleanRate * 100)}%`}
              hint="without opening a solution first"
            />
            <StatTile label="Median solve time" value={duration(summary.medianSolveMs)} hint="active time, pauses excluded" />
            <StatTile label="Due for re-solve" value={String(summary.dueNow)} hint={`${view.upcoming.length} more this week`} />
          </div>

          <Card
            title="Due for a blind re-solve"
            note={`Blind solves come back after ${LADDER_DAYS.slice(1).join(", ")} days; peeking brings a problem back tomorrow.`}
          >
            {view.due.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing due. Nice.</p>
            ) : (
              <ul>
                {view.due.map((record) => (
                  <ReviewRow
                    key={record.slug}
                    record={record}
                    now={now}
                    action={
                      <div className="flex items-center gap-2">
                        <span className="whitespace-nowrap text-xs text-amber-300">due {relativeDays(record.review!.dueAt!, now)}</span>
                        <a
                          href={problemUrl(record.slug)}
                          target="_blank"
                          rel="noreferrer"
                          className="whitespace-nowrap rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
                        >
                          Solve now
                        </a>
                        <button
                          className="whitespace-nowrap rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500"
                          onClick={() => void setRetired(record.slug, true)}
                          title="Don't schedule this problem again"
                        >
                          Stop reviewing
                        </button>
                      </div>
                    }
                  />
                ))}
              </ul>
            )}
            {view.upcoming.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-slate-400">Coming up this week ({view.upcoming.length})</summary>
                <ul className="mt-2">
                  {view.upcoming.map((record) => (
                    <ReviewRow
                      key={record.slug}
                      record={record}
                      now={now}
                      action={<span className="text-xs text-slate-400">due {relativeDays(record.review!.dueAt!, now)}</span>}
                    />
                  ))}
                </ul>
              </details>
            )}
            {view.retired.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-slate-400">Not reviewing ({view.retired.length})</summary>
                <ul className="mt-2">
                  {view.retired.map((record) => (
                    <ReviewRow
                      key={record.slug}
                      record={record}
                      now={now}
                      action={
                        <button
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500"
                          onClick={() => void setRetired(record.slug, false)}
                        >
                          Review again
                        </button>
                      }
                    />
                  ))}
                </ul>
              </details>
            )}
          </Card>

          {view.topics.length > 0 && (
            <Card title="Topics" note="Slowest first, by median time to Accepted">
              <GroupTable rows={view.topics} label="Topic" />
            </Card>
          )}

          {view.difficulties.length > 0 && (
            <Card title="By difficulty">
              <GroupTable rows={view.difficulties} label="Difficulty" />
            </Card>
          )}

          <Card title="Recent attempts">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="pb-2 font-medium">Started</th>
                    <th className="pb-2 font-medium">Problem</th>
                    <th className="pb-2 font-medium">Result</th>
                    <th className="pb-2 text-right font-medium">Time</th>
                    <th className="pb-2 text-right font-medium">Wrong submissions</th>
                  </tr>
                </thead>
                <tbody>
                  {view.recent.map((attempt) => (
                    <tr key={`${attempt.slug}-${attempt.id}`} className="border-t border-slate-800">
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-400">
                        {new Date(attempt.id).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        {attempt.review && <span className="ml-1.5 text-xs text-violet-300" title="Scheduled re-solve">↻</span>}
                      </td>
                      <td className="py-2 pr-3">
                        <a href={problemUrl(attempt.slug)} target="_blank" rel="noreferrer" className="hover:underline">
                          {attempt.title}
                        </a>
                      </td>
                      <td className="py-2 pr-3">
                        <Outcome outcome={attempt.outcome} />
                      </td>
                      <td className="py-2 text-right tabular-nums">{duration(attempt.solveMs)}</td>
                      <td className="py-2 text-right tabular-nums">{attempt.wrongSubmissions ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <SupportCard highlight={highlightSupport} />

      <Card title="Your data">
        <DataControls />
      </Card>
    </div>
  );
}
