import { useEffect, useState } from "react";
import { parseRoute } from "../content/route";
import {
  getSession,
  isPaused,
  onSessionsChanged,
  pauseSession,
  restartSession,
  resumeSession,
  type ProblemSession,
} from "../storage/sessions";
import type { UserSettings } from "../storage/settings";
import { formatRemaining, remainingMs } from "../shared/timing";

interface ActiveProblem {
  slug: string;
  title: string;
}

/** Live countdown and controls for the problem open in the active tab. */
export default function CurrentProblem({ settings }: { settings: UserSettings }) {
  const [problem, setProblem] = useState<ActiveProblem | null | undefined>(undefined);
  const [session, setSession] = useState<ProblemSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      // tab.url is readable for leetcode.com tabs thanks to the host permission.
      const url = tab?.url ? new URL(tab.url) : null;
      const route = url?.hostname === "leetcode.com" ? parseRoute(url.pathname) : null;
      setProblem(
        route
          ? { slug: route.slug, title: tab?.title?.replace(/\s*-\s*LeetCode\s*$/, "") || route.slug }
          : null,
      );
    });
  }, []);

  useEffect(() => {
    if (!problem) return;
    const load = () => void getSession(problem.slug).then(setSession);
    load();
    const unsubscribe = onSessionsChanged(load);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [problem]);

  useEffect(() => {
    if (!confirmRestart) return;
    const timeout = setTimeout(() => setConfirmRestart(false), 4000);
    return () => clearTimeout(timeout);
  }, [confirmRestart]);

  if (problem === undefined) return null;

  const ms = session ? remainingMs(session, settings, now) : 0;
  const locked = !!session && ms > 0;
  const paused = !!session && isPaused(session);

  let status: string;
  if (!problem) status = "Open a LeetCode problem to see its timer here.";
  else if (!settings.enabled) status = "The extension is turned off.";
  else if (!session) status = "Not started. Click “Start solving” on the problem page.";
  else if (!locked) status = session.revealedEarly ? "Solutions revealed early" : "Solutions unlocked";
  else if (paused) status = session.pausedBy === "auto" ? "Paused while the tab was hidden" : "Paused";
  else status = "until solutions unlock";

  const togglePause = () => {
    if (!problem) return;
    void (paused ? resumeSession(problem.slug) : pauseSession(problem.slug, "user"));
  };

  const restart = () => {
    if (!problem) return;
    if (!confirmRestart) {
      setConfirmRestart(true);
      return;
    }
    setConfirmRestart(false);
    void restartSession(problem.slug);
  };

  return (
    <div
      className={`mt-4 rounded-lg border bg-slate-800 p-3 ${
        paused && locked ? "border-amber-500" : "border-slate-700"
      }`}
    >
      {problem && <p className="truncate text-sm font-semibold">{problem.title}</p>}
      {settings.enabled && locked && (
        <p className={`mt-1 text-3xl font-bold tabular-nums ${paused ? "text-amber-300" : ""}`}>
          {formatRemaining(ms)}
        </p>
      )}
      <p className={`text-xs ${locked ? "text-slate-400" : "mt-1 text-slate-300"}`}>{status}</p>

      {settings.enabled && locked && (
        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded bg-slate-700 p-1.5 text-sm hover:bg-slate-600" onClick={togglePause}>
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                {paused ? (
                  <path d="M4.5 2.8v10.4a.8.8 0 0 0 1.2.7l8.3-5.2a.8.8 0 0 0 0-1.4L5.7 2.1a.8.8 0 0 0-1.2.7z" fill="currentColor" />
                ) : (
                  <>
                    <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
                    <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
                  </>
                )}
              </svg>
              {paused ? "Resume" : "Pause"}
            </span>
          </button>
          <button
            className={`flex-1 rounded p-1.5 text-sm ${
              confirmRestart ? "bg-red-900 text-red-200" : "bg-slate-700 hover:bg-slate-600"
            }`}
            onClick={restart}
            title="Put the full think time back. Your code is not touched."
          >
            {confirmRestart ? "Click to confirm" : "↺ Restart"}
          </button>
        </div>
      )}
    </div>
  );
}
