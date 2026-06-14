export interface UserSettings {
  enabled: boolean;
  strictMode: boolean;
  thinkTime: number;
}

const defaults: UserSettings = {
  enabled: true,
  strictMode: true,
  thinkTime: 30
};

interface SettingsStorage {
  settings?: UserSettings;
}

export async function loadSettings(): Promise<UserSettings> {
  const result = await chrome.storage.sync.get<SettingsStorage>("settings");

    return (
        result.settings ??
        defaults
    );
}

export async function saveSettings(
  settings: UserSettings
) {
  await chrome.storage.sync.set<SettingsStorage>({
    settings
  });
}
