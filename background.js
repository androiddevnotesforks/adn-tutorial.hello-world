chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createTabs') {
    request.urls.forEach(url => {
      chrome.tabs.create({ url });
    });
  }
}); 