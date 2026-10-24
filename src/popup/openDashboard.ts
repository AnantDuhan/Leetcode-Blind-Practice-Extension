/** Opens the dashboard in a new tab and closes the popup. */
export function openDashboard(hash = ""): void {
  void chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard.html${hash}`) });
  window.close();
}
