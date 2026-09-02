// ページ読み込み完了時に実行
window.addEventListener('load', () => {
  console.log("【自動フォーム】コンテンツスクリプトが読み込まれました。");

  // メールアドレス記録のチェックボックスを自動的にチェックする
  const autoCheckEmail = () => {
    const checkboxes = document.querySelectorAll('div[role="checkbox"]');
    for (const checkbox of checkboxes) {
      if (checkbox.getAttribute('aria-checked') === 'false') {
        const text = checkbox.textContent || checkbox.innerText || '';
        if (text.includes('記録する') || text.includes('メールアドレス') || text.includes('Record')) {
          console.log("【自動フォーム】メールアドレスのチェックボックスを自動チェックします。");
          checkbox.click();
          return true; // チェックしたら終了
        }
      } else if (checkbox.getAttribute('aria-checked') === 'true') {
        const text = checkbox.textContent || checkbox.innerText || '';
        if (text.includes('記録する') || text.includes('メールアドレス') || text.includes('Record')) {
           return true; // すでにチェックされていれば終了
        }
      }
    }
    return false;
  };

  // フォーム描画完了を待つために複数回リトライする
  let attempts = 0;
  const emailInterval = setInterval(() => {
    if (autoCheckEmail() || attempts > 10) {
      clearInterval(emailInterval);
    }
    attempts++;
  }, 500);

  // URLに自動送信フラグ (autoSubmit=true) が含まれているかチェック
  if (window.location.href.includes('autoSubmit=true')) {
    console.log("【ワンクリック送信】自動送信フラグを検出しました。送信ボタンを探します...");
    
    // 少し待ってから送信ボタンを押す（フォームの描画完了とチェックボックスのクリックを待つため）
    setTimeout(() => {
      // フォームの送信ボタン（送信, Submit等）を探す
      // Googleフォームの送信ボタンは role="button" を持っていることが多い
      const buttons = document.querySelectorAll('div[role="button"]');
      let submitBtn = null;
      
      for (const btn of buttons) {
        const text = btn.textContent || btn.innerText;
        if (text.includes('送信') || text.includes('Submit')) {
          submitBtn = btn;
          break;
        }
      }
      
      // 見つからなければ、最後から1番目のボタン（大抵「送信」）をフォールバックとして試す
      if (!submitBtn && buttons.length > 0) {
        submitBtn = buttons[buttons.length - 1];
      }
      
      if (submitBtn) {
        console.log("【ワンクリック送信】送信ボタンを発見しました！クリックします。");
        submitBtn.click();
      } else {
        console.error("【ワンクリック送信】エラー: 送信ボタンが見つかりませんでした。");
      }
    }, 1500); // 1.5秒待機
  }
});
