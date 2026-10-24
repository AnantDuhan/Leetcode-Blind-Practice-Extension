import { useEffect, useState } from "react";
import { getHistory, onHistoryChanged } from "../storage/history";
import { dueProblems } from "../shared/stats";
import { openDashboard } from "./openDashboard";


/** "3 problems due for a blind re-solve" plus the way into the dashboard. */
export default function DueSummary() {
  const [due, setDue] = useState<number | null>(null);

  useEffect(() => {
    const load = () => void getHistory().then((history) => setDue(dueProblems(history, Date.now()).length));
    load();
    return onHistoryChanged(load);
  }, []);

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800 p-3">
      <p className="text-sm">
        {due === null ? (
          " "
        ) : due > 0 ? (
          <>
            <span className="font-semibold text-violet-300">{due}</span> problem{due === 1 ? "" : "s"} due for a blind
            re-solve
          </>
        ) : (
          <span className="text-slate-300">No re-solves due</span>
        )}
      </p>
      <button
        className="shrink-0 rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
        onClick={() => openDashboard()}
      >
        Dashboard
      </button>
    </div>
  );
}
