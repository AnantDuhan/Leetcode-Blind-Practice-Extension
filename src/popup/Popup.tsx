import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  MAX_THINK_TIME,
  MIN_THINK_TIME,
  clampThinkTime,
  loadSettings,
  saveSettings,
  type UserSettings,
} from "../storage/settings";
import CurrentProblem from "./CurrentProblem";
import DueSummary from "./DueSummary";
import { openDashboard } from "./openDashboard";
import { hasSupportLinks } from "../shared/support";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function Popup() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  // What's actually stored; drives the live timer, unlike unsaved edits.
  const [savedSettings, setSavedSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  // Kept as text so the field can be cleared while typing.
  const [thinkTimeInput, setThinkTimeInput] = useState(String(DEFAULT_SETTINGS.thinkTime));
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    loadSettings().then((stored) => {
      setSettings(stored);
      setSavedSettings(stored);
      setThinkTimeInput(String(stored.thinkTime));
      setLoaded(true);
    });
  }, []);

  const update = (patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaveState("idle");
  };

  const handleSave = async () => {
    const thinkTime = clampThinkTime(thinkTimeInput);
    const next = { ...settings, thinkTime };
    setThinkTimeInput(String(thinkTime));
    setSettings(next);
    setSaveState("saving");
    try {
      await saveSettings(next);
      setSavedSettings(next);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  return (
    <div className="w-[350px] p-5 bg-slate-900 text-white">
      <h1 className="text-xl font-bold">No Peek: Solution Lock & Timer for LeetCode</h1>

      {loaded && <CurrentProblem settings={savedSettings} />}
      <DueSummary />

      <label className="mt-5 flex justify-between items-center">
        <span>Enabled</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={!loaded}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
      </label>

      <label className="mt-4 flex justify-between items-center">
        <span>Strict mode</span>
        <input
          type="checkbox"
          checked={settings.strictMode}
          disabled={!loaded || !settings.enabled}
          onChange={(e) => update({ strictMode: e.target.checked })}
        />
      </label>
      <p className="mt-1 text-xs text-slate-400">
        {settings.strictMode
          ? "No way to reveal solutions before the timer ends."
          : "A “Reveal anyway” button appears on locked sections."}
      </p>

      <label className="mt-4 flex justify-between items-center">
        <span>Reset code on start</span>
        <input
          type="checkbox"
          checked={settings.resetCode}
          disabled={!loaded || !settings.enabled}
          onChange={(e) => update({ resetCode: e.target.checked })}
        />
      </label>
      <p className="mt-1 text-xs text-slate-400">
        Starting a fresh attempt replaces your saved code with the default template, like the
        editor’s Reset button. Your submissions on LeetCode are not affected.
      </p>

      <label className="mt-4 block">
        <span>Think time (minutes)</span>
        <input
          className="w-full mt-2 p-2 text-black rounded bg-white"
          type="number"
          inputMode="numeric"
          min={MIN_THINK_TIME}
          max={MAX_THINK_TIME}
          value={thinkTimeInput}
          disabled={!loaded || !settings.enabled}
          onChange={(e) => {
            setThinkTimeInput(e.target.value);
            setSaveState("idle");
          }}
        />
      </label>
      <p className="mt-1 text-xs text-slate-400">
        Between {MIN_THINK_TIME} and {MAX_THINK_TIME}. Changes apply to open tabs immediately.
      </p>

      <button
        className="mt-6 w-full bg-green-600 p-2 rounded disabled:opacity-50"
        onClick={handleSave}
        disabled={!loaded || saveState === "saving"}
      >
        {saveState === "saved" ? "Saved ✓" : saveState === "saving" ? "Saving…" : "Save settings"}
      </button>
      {saveState === "error" && (
        <p className="mt-2 text-xs text-red-400">Couldn’t save. Try again.</p>
      )}

      {hasSupportLinks() && (
        <p className="mt-4 border-t border-slate-800 pt-3 text-center text-xs text-slate-400">
          Free and ad-free.{" "}
          <button className="text-violet-300 hover:underline" onClick={() => openDashboard("#support")}>
            ♥ Support this project
          </button>
        </p>
      )}
    </div>
  );
}
