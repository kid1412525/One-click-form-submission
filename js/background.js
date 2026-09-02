chrome.action.onClicked.addListener(() => {
  // 拡張機能のアイコンがクリックされたら、index.htmlを新しいタブでフル画面で開く
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
