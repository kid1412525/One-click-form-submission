// ============================================
// storage.js — localStorage管理モジュール
// ============================================

const STORAGE_KEYS = {
  NAME: 'qf-user-name',
  EMAIL: 'qf-user-email',
  FORMS: 'qf-forms',
  HISTORY: 'qf-history',
  SETTINGS: 'qf-settings'
};

// ── ユーザー設定の管理 ──

const DEFAULT_SETTINGS = {
  visibleDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  periodTimes: {
    1: { start: '09:45', end: '10:35' },
    2: { start: '10:45', end: '11:35' },
    3: { start: '11:45', end: '12:35' },
    4: { start: '13:15', end: '14:05' },
    5: { start: '14:15', end: '15:05' },
    6: { start: '15:15', end: '16:05' }
  }
};

/** 設定を取得 */
function getSettings() {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  let settings = data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
  
  // バージョン管理による強制アップデート（確実にN高の時間を反映させる）
  // バージョン3に上げることで古い設定を完全に上書き
  if (settings.version !== 3) {
    settings.periodTimes = DEFAULT_SETTINGS.periodTimes;
    settings.version = 3;
    saveSettings(settings); 
  }
  
  return settings;
}

/** 設定を保存 */
function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// ── ユーザー情報の管理 ──

/** 名前を保存 */
function saveName(name) {
  localStorage.setItem(STORAGE_KEYS.NAME, name.trim());
}

/** 保存済みの名前を取得 */
function getName() {
  return localStorage.getItem(STORAGE_KEYS.NAME) || '';
}

/** メールアドレスを保存 */
function saveEmail(email) {
  localStorage.setItem(STORAGE_KEYS.EMAIL, email.trim());
}

/** 保存済みのメールアドレスを取得 */
function getEmail() {
  return localStorage.getItem(STORAGE_KEYS.EMAIL) || '';
}

// ── フォーム情報の管理 ──

/** 登録済みフォーム一覧を取得 */
function getForms() {
  const data = localStorage.getItem(STORAGE_KEYS.FORMS);
  return data ? JSON.parse(data) : [];
}

/**
 * フォームを保存
 * @param {Object} form - { id, label, formUrl, formId, entries: [{fieldName, entryId}], dayOfWeek, period }
 * @returns {string} 保存したフォームのID
 */
function saveForm(form) {
  const forms = getForms();
  if (form.id) {
    // 既存フォームの更新
    const index = forms.findIndex(f => f.id === form.id);
    if (index !== -1) {
      forms[index] = form;
    }
  } else {
    // 新規追加
    form.id = 'form-' + Date.now();
    forms.push(form);
  }
  localStorage.setItem(STORAGE_KEYS.FORMS, JSON.stringify(forms));
  return form.id;
}

/** フォームを削除 */
function removeForm(id) {
  const forms = getForms().filter(f => f.id !== id);
  localStorage.setItem(STORAGE_KEYS.FORMS, JSON.stringify(forms));
}

/** IDでフォームを取得 */
function getFormById(id) {
  return getForms().find(f => f.id === id) || null;
}

// ── 提出履歴の管理 ──

/** 提出履歴を取得 */
function getHistory() {
  const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
  return data ? JSON.parse(data) : [];
}

/**
 * 提出履歴を追加
 * @param {string} formId - フォームID
 * @param {string} label - フォームのラベル
 */
function addHistory(formId, label) {
  const history = getHistory();
  history.unshift({
    formId,
    label,
    submittedAt: new Date().toISOString()
  });
  // 最大100件まで保持
  if (history.length > 100) history.pop();
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

/** 履歴をクリア */
function clearHistory() {
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
}
