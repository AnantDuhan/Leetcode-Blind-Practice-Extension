export interface UserSettings {
  /** Master switch. When false the extension does nothing on LeetCode. */
  enabled: boolean;
  /** When true there is no way to reveal solutions before the timer ends. */
  strictMode: boolean;
  /** Minutes you must spend on a problem before solutions unlock. */
  thinkTime: number;
  /**
   * When true, starting a fresh attempt replaces your saved code for that
   * problem with LeetCode's default template, like clicking Reset.
   */
  resetCode: boolean;
}

export const MIN_THINK_TIME = 1;
export const MAX_THINK_TIME = 180;

export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  strictMode: true,
  thinkTime: 30,
  resetCode: true,
};

interface SettingsStorage {
  settings?: Partial<UserSettings>;
}

export function clampThinkTime(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.thinkTime;
  return Math.min(MAX_THINK_TIME, Math.max(MIN_THINK_TIME, n));
}

/** Fills in missing fields and repairs invalid values from older versions. */
export function normalizeSettings(raw: Partial<UserSettings> | undefined): UserSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  return {
    enabled: Boolean(merged.enabled),
    strictMode: Boolean(merged.strictMode),
    thinkTime: clampThinkTime(merged.thinkTime),
    resetCode: Boolean(merged.resetCode),
  };
}

export async function loadSettings(): Promise<UserSettings> {
  const result = await chrome.storage.sync.get<SettingsStorage>("settings");
  return normalizeSettings(result.settings);
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await chrome.storage.sync.set<SettingsStorage>({
    settings: normalizeSettings(settings),
  });
}

/** Calls `listener` whenever settings change in any tab or in the popup. */
export function onSettingsChanged(listener: (settings: UserSettings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.settings) return;
    listener(normalizeSettings(changes.settings.newValue as Partial<UserSettings> | undefined));
  });
}
