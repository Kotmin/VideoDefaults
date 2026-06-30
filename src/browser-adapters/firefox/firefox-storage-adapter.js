const STORAGE_KEY = 'videodefaults_settings';

export function createStorageAdapter(browser) {
  return {
    async getSettings() {
      const result = await browser.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] ?? {};
    },
    async saveSettings(settings) {
      await browser.storage.local.set({ [STORAGE_KEY]: settings });
    },
  };
}
