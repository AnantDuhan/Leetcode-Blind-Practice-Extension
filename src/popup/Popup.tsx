import { useEffect, useState } from "react";
import { loadSettings, saveSettings } from "../storage/settings";

export default function Popup() {
    const [strictMode, setStrictMode] = useState(true);
    const [thinkTime, setThinkTime] = useState(30);

    useEffect(() => {
        loadSettings().then(settings => {
            setStrictMode(settings.strictMode);
            setThinkTime(settings.thinkTime);
        });
    }, []);

    const handleSave = async () => {
        await saveSettings({
            enabled: true,
            strictMode,
            thinkTime,
        });
        alert("Settings saved");
    };

  return (
    <div className="w-[350px] p-5 bg-slate-900 text-white">

      <h1 className="text-xl font-bold">
        LeetCode Blind Practice
      </h1>

      <div className="mt-5">
        <label className="flex justify-between items-center">
          <span>Strict Mode</span>
          <input
            type="checkbox"
            checked={strictMode}
            onChange={(e) => setStrictMode(e.target.checked)}
          />
        </label>
      </div>

      <div className="mt-5">
        <label>
          Think Time (minutes)
        </label>

        <input
          className="w-full mt-2 p-2 text-black rounded"
          type="number"
          min={1}
          max={180}
          value={thinkTime}
          onChange={(e) => setThinkTime(Number(e.target.value))}
        />
      </div>
      <button className="mt-6 w-full bg-green-600 p-2 rounded" onClick={handleSave}>
        Save Settings
      </button>
    </div>
  );
}