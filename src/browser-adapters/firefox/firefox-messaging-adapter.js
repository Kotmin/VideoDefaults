export function createMessagingAdapter(browser) {
  return {
    async sendToActiveTab(msg) {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) throw new Error('no active tab');
      return browser.tabs.sendMessage(tabs[0].id, msg);
    },
    addMessageListener(handler) {
      browser.runtime.onMessage.addListener(handler);
    },
    removeMessageListener(handler) {
      browser.runtime.onMessage.removeListener(handler);
    },
  };
}
