// ============================================
// form-helper.js — GoogleフォームURL解析・生成
// ============================================

/**
 * 事前入力済みURL（Pre-filled URL）からフィールドIDと値を自動抽出する
 * 例: https://docs.google.com/forms/d/e/xxx/viewform?usp=pp_url&entry.123=太郎&entry.456=出席
 * → [{ entryId: 'entry.123', value: '太郎', fieldName: 'フィールド1' }, ...]
 * @param {string} url - 事前入力済みGoogleフォームURL
 * @returns {{ formUrl: string, entries: Array<{entryId: string, value: string, fieldName: string}> } | null}
 */
function parsePrefilledUrl(url) {
  try {
    const urlObj = new URL(url);
    const entries = [];
    let fieldCount = 0;

    // URLパラメータからentry.で始まるものを全て抽出
    for (const [key, value] of urlObj.searchParams) {
      if (key.startsWith('entry.')) {
        fieldCount++;
        entries.push({
          entryId: key,
          value: decodeURIComponent(value),
          fieldName: `フィールド${fieldCount}`
        });
      }
    }

    if (entries.length === 0) return null;

    // ベースURL（パラメータなし）を構築
    const formUrl = urlObj.origin + urlObj.pathname;

    return { formUrl, entries };
  } catch (e) {
    return null;
  }
}

/**
 * GoogleフォームのURLから直接フィールド情報を自動取得する
 * CORSプロキシ経由でフォームのHTMLを取得し、
 * 埋め込まれた FB_PUBLIC_LOAD_DATA_ からフィールドIDとラベルを抽出
 * @param {string} url - GoogleフォームのURL
 * @returns {Promise<{ title: string, entries: Array<{entryId: string, fieldName: string, fieldType: string}> } | null>}
 */
async function fetchFormFields(url) {
  // viewform URLに正規化
  const baseUrl = url.split('?')[0].replace(/\/(edit|formResponse)\s*$/, '/viewform');
  const viewUrl = baseUrl.includes('/viewform') ? baseUrl : baseUrl + '/viewform';

  // 複数のCORSプロキシを試行
  const proxies = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];

  let html = null;

  for (const proxy of proxies) {
    try {
      const proxyUrl = proxy(viewUrl);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        html = await res.text();
        if (html.includes('FB_PUBLIC_LOAD_DATA_')) break;
        html = null; // データが無い場合は次のプロキシへ
      }
    } catch (e) {
      console.warn('プロキシ失敗、次を試行:', e.message);
      continue;
    }
  }

  if (!html) return null;

  try {
    // FB_PUBLIC_LOAD_DATA_ を抽出
    const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);\s*<\/script>/);
    if (!match) return null;

    const data = JSON.parse(match[1]);

    // フォームタイトルを取得
    const title = (data[1] && data[1][8]) || (data[3] || '');

    // フィールド情報を取得（data[1][1] にフィールド配列がある）
    const fields = data[1] && data[1][1];
    if (!fields || !Array.isArray(fields)) return null;

    const entries = [];
    const typeMap = {
      0: 'テキスト（短文）', 1: 'テキスト（長文）',
      2: 'ラジオボタン', 3: 'プルダウン', 4: 'チェックボックス',
      5: 'スケール', 7: 'グリッド', 9: '日付', 10: '時刻',
    };

    for (const field of fields) {
      if (!field || !Array.isArray(field)) continue;
      const fieldLabel = field[1] || 'ラベルなし';

      if (field[4] && Array.isArray(field[4])) {
        for (const sub of field[4]) {
          if (sub && Array.isArray(sub) && sub[0] !== undefined) {
            entries.push({
              entryId: `entry.${sub[0]}`,
              fieldName: fieldLabel,
              fieldType: typeMap[field[3]] || `タイプ${field[3]}`,
            });
          }
        }
      }
    }

    return entries.length > 0 ? { title, entries } : null;
  } catch (e) {
    console.error('フォームデータの解析エラー:', e);
    return null;
  }
}

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
 * @param {string} originalUrl - 元のGoogleフォームURL
 * @param {Array} entries - [{entryId: 'entry.123', value: '山田太郎'}]
 * @param {string} [email] - メールアドレス（記録する場合）
 * @returns {string} 事前入力済みのURL
 */
function buildPrefilledUrl(originalUrl, entries, email) {
  const baseUrl = getFormBaseUrl(originalUrl);
  const params = new URLSearchParams();
  params.set('usp', 'pp_url');

  entries.forEach(entry => {
    if (entry.entryId && entry.value) {
      params.set(entry.entryId, entry.value);
    }
  });

  // メールアドレスの記録
  if (email) {
    params.set('emailAddress', email);
  }

  return baseUrl + '?' + params.toString();
}

/**
 * GoogleフォームをバックグラウンドでPOST送信する
 * ※ CORSの制約によりGoogleフォームの種類によっては失敗する場合があります
 * @param {string} originalUrl - 元のGoogleフォームURL
 * @param {Array} entries - [{entryId: 'entry.123', value: '山田太郎'}]
 * @param {string} [email] - メールアドレス（記録する場合）
 * @returns {Promise<boolean>} 送信成功したらtrue
 */
async function submitFormDirect(originalUrl, entries, email) {
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

    // メールアドレスの記録
    if (email) {
      formData.set('emailAddress', email);
    }

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
