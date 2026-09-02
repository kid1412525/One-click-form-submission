// ============================================
// form-helper.js — GoogleフォームURL解析・生成
// ============================================

/**
 * GoogleフォームのURLからフォームIDを抽出する
 * 対応パターン:
 *   https://docs.google.com/forms/d/e/{ID}/viewform
 *   https://docs.google.com/forms/d/{ID}/edit
 *   https://docs.google.com/forms/d/{ID}/viewform?usp=...
 * @param {string} url - GoogleフォームのURL
 * @returns {string|null} フォームID、または無効な場合はnull
 */
function parseFormUrl(url) {
  try {
    // /forms/d/e/{ID}/ パターン（公開URL）
    let match = url.match(/\/forms\/d\/e\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // /forms/d/{ID}/ パターン（編集URL）
    match = url.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * GoogleフォームのURLが公開用（/e/付き）か編集用かを判定し、
 * viewform用の正しいベースURLを返す
 * @param {string} url - 元のGoogleフォームURL
 * @returns {string} viewform用のベースURL
 */
function getFormBaseUrl(url) {
  // /forms/d/e/{ID} 形式の場合
  const publicMatch = url.match(/(https:\/\/docs\.google\.com\/forms\/d\/e\/[a-zA-Z0-9_-]+)/);
  if (publicMatch) {
    return publicMatch[1] + '/viewform';
  }

  // /forms/d/{ID} 形式（編集URL）の場合
  const editMatch = url.match(/(https:\/\/docs\.google\.com\/forms\/d\/[a-zA-Z0-9_-]+)/);
  if (editMatch) {
    return editMatch[1] + '/viewform';
  }

  // そのままURLを返す（フォールバック）
  return url.split('?')[0];
}

/**
 * 事前入力パラメータ付きURLを生成する
 * @param {string} originalUrl - 元のGoogleフォームURL
 * @param {Array} entries - [{entryId: 'entry.123', value: '山田太郎'}]
 * @returns {string} 事前入力済みのURL
 */
function buildPrefilledUrl(originalUrl, entries) {
  const baseUrl = getFormBaseUrl(originalUrl);
  const params = new URLSearchParams();
  params.set('usp', 'pp_url');

  entries.forEach(entry => {
    if (entry.entryId && entry.value) {
      // entry.123456 の形式をそのまま使う
      params.set(entry.entryId, entry.value);
    }
  });

  return baseUrl + '?' + params.toString();
}

/**
 * GoogleフォームをバックグラウンドでPOST送信する
 * ※ CORSの制約によりGoogleフォームの種類によっては失敗する場合があります
 * @param {string} originalUrl - 元のGoogleフォームURL
 * @param {Array} entries - [{entryId: 'entry.123', value: '山田太郎'}]
 * @returns {Promise<boolean>} 送信成功したらtrue
 */
async function submitFormDirect(originalUrl, entries) {
  try {
    // フォームの送信先URLを構築
    const formId = parseFormUrl(originalUrl);
    if (!formId) throw new Error('無効なフォームURL');

    // 公開URLかどうかで送信先を切り替え
    let submitUrl;
    if (originalUrl.includes('/forms/d/e/')) {
      submitUrl = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
    } else {
      submitUrl = `https://docs.google.com/forms/d/${formId}/formResponse`;
    }

    // フォームデータを構築
    const formData = new URLSearchParams();
    entries.forEach(entry => {
      if (entry.entryId && entry.value) {
        formData.set(entry.entryId, entry.value);
      }
    });

    // no-corsモードで送信（レスポンス内容は読めないが送信はできる）
    await fetch(submitUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    // no-corsの場合、レスポンスは常にopaqueなので成功を仮定
    return true;
  } catch (error) {
    console.error('フォーム送信エラー:', error);
    return false;
  }
}

