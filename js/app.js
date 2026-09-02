// ============================================
// app.js — メインアプリケーションロジック
// ============================================

// ── 状態 ──
let editingFormId = null; // 編集中のフォームID（nullなら新規追加）

// ── 初期化 ──
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initName();
  renderFormList();
  setupEventListeners();
});

/** イベントリスナーの設定 */
function setupEventListeners() {
  // 名前の保存
  document.getElementById('btn-save-name').addEventListener('click', handleSaveName);
  document.getElementById('input-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSaveName();
  });

  // フォーム追加ボタン
  document.getElementById('btn-show-add-form').addEventListener('click', () => {
    editingFormId = null;
    resetFormEditor();
    toggleFormEditor(true);
  });

  // フォーム登録/更新
  document.getElementById('btn-register-form').addEventListener('click', handleRegisterForm);

  // フォーム追加キャンセル
  document.getElementById('btn-cancel-form').addEventListener('click', () => {
    toggleFormEditor(false);
  });

  // フィールド追加ボタン
  document.getElementById('btn-add-field').addEventListener('click', addFieldRow);

  // テーマ切替
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // 履歴表示トグル
  document.getElementById('btn-toggle-history').addEventListener('click', toggleHistory);

  // 履歴クリア
  document.getElementById('btn-clear-history').addEventListener('click', () => {
    if (confirm('提出履歴をすべて削除しますか？')) {
      clearHistory();
      renderHistory();
      showToast('履歴を削除しました', 'info');
    }
  });

  // ヘルプ表示トグル
  document.getElementById('btn-toggle-help').addEventListener('click', toggleHelp);
}

// ── 名前の管理 ──

/** 保存済みの名前を読み込む */
function initName() {
  const name = getName();
  const input = document.getElementById('input-name');
  input.value = name;
  if (name) {
    document.getElementById('name-status').textContent = '✅ 保存済み';
  }
}

/** 名前を保存 */
function handleSaveName() {
  const input = document.getElementById('input-name');
  const name = input.value.trim();
  if (!name) {
    showToast('名前を入力してください', 'error');
    return;
  }
  saveName(name);
  document.getElementById('name-status').textContent = '✅ 保存済み';
  showToast('名前を保存しました', 'success');
}

// ── フォーム一覧の描画 ──

/** 登録済みフォーム一覧を描画 */
function renderFormList() {
  const forms = getForms();
  const container = document.getElementById('form-list');
  const history = getHistory();

  if (forms.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📋 フォームが登録されていません</p>
        <p class="empty-hint">下の「＋ 新しいフォームを追加」ボタンから登録してください</p>
      </div>
    `;
    return;
  }

  container.innerHTML = forms.map(form => {
    // このフォームの最新提出履歴を取得
    const lastSubmit = history.find(h => h.formId === form.id);
    const lastSubmitText = lastSubmit
      ? formatDate(lastSubmit.submittedAt)
      : 'まだ提出していません';

    return `
      <div class="form-card fade-in" data-id="${form.id}">
        <div class="form-card-header">
          <span class="form-label">📚 ${escapeHtml(form.label)}</span>
          <span class="form-last-submit">最終提出: ${lastSubmitText}</span>
        </div>
        <div class="form-card-fields">
          ${form.entries.map(e => `<span class="field-badge">${escapeHtml(e.fieldName)}: ${escapeHtml(e.value || getName())}</span>`).join('')}
        </div>
        <div class="form-card-actions">
          <button class="btn-submit" onclick="handleSubmit('${form.id}')">🚀 ワンクリック提出</button>
          <button class="btn-prefill" onclick="handleOpenPrefilled('${form.id}')">📝 入力済みで開く</button>
          <button class="btn-edit" onclick="handleEditForm('${form.id}')">⚙️ 編集</button>
          <button class="btn-delete" onclick="handleDeleteForm('${form.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── フォームの提出 ──

/**
 * ワンクリック提出（バックグラウンド送信）
 * no-corsモードのfetchで直接送信を試みる
 */
async function handleSubmit(formId) {
  const form = getFormById(formId);
  if (!form) return;

  const userName = getName();
  if (!userName) {
    showToast('先に名前を保存してください', 'error');
    return;
  }

  // フィールドの値を構築（空なら保存済みの名前を使う）
  const entries = form.entries.map(e => ({
    entryId: e.entryId,
    value: e.value || userName
  }));

  // ボタンの状態を変更
  const card = document.querySelector(`.form-card[data-id="${formId}"]`);
  const submitBtn = card ? card.querySelector('.btn-submit') : null;
  if (submitBtn) {
    submitBtn.textContent = '⏳ 送信中...';
    submitBtn.disabled = true;
  }

  const success = await submitFormDirect(form.formUrl, entries);

  if (success) {
    addHistory(formId, form.label);
    showToast(`✅ 「${form.label}」を提出しました！`, 'success');
    renderFormList();
  } else {
    showToast('送信に失敗しました。「入力済みで開く」をお試しください', 'error');
    if (submitBtn) {
      submitBtn.textContent = '🚀 ワンクリック提出';
      submitBtn.disabled = false;
    }
  }
}

/**
 * 事前入力済みURLで新しいタブを開く（フォールバック）
 */
function handleOpenPrefilled(formId) {
  const form = getFormById(formId);
  if (!form) return;

  const userName = getName();
  if (!userName) {
    showToast('先に名前を保存してください', 'error');
    return;
  }

  const entries = form.entries.map(e => ({
    entryId: e.entryId,
    value: e.value || userName
  }));

  const url = buildPrefilledUrl(form.formUrl, entries);
  window.open(url, '_blank');

  // 履歴に記録（実際にはユーザーが送信ボタンを押すまで未提出だが便宜上記録）
  addHistory(formId, form.label);
  renderFormList();
  showToast(`「${form.label}」を入力済みで開きました`, 'info');
}

// ── フォームの追加・編集・削除 ──

/** フォーム追加/編集エリアの表示切替 */
function toggleFormEditor(show) {
  const editor = document.getElementById('form-editor');
  if (show) {
    editor.classList.add('show');
    editor.scrollIntoView({ behavior: 'smooth' });
  } else {
    editor.classList.remove('show');
  }
}

/** フォームエディタをリセット */
function resetFormEditor() {
  document.getElementById('input-form-url').value = '';
  document.getElementById('input-form-label').value = '';
  document.getElementById('field-rows').innerHTML = '';
  addFieldRow(); // デフォルトで1行追加
  document.getElementById('btn-register-form').textContent = '📌 登録';
}

/** フィールド入力行を追加 */
function addFieldRow(fieldName = '', entryId = '', value = '') {
  const container = document.getElementById('field-rows');
  const row = document.createElement('div');
  row.className = 'field-row';
  row.innerHTML = `
    <input type="text" class="input-field-name" placeholder="フィールド名（例: 名前）" value="${escapeHtml(fieldName)}">
    <input type="text" class="input-entry-id" placeholder="entry.123456789" value="${escapeHtml(entryId)}">
    <input type="text" class="input-field-value" placeholder="値（空欄＝名前を使用）" value="${escapeHtml(value)}">
    <button class="btn-remove-field" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

/** フォームの登録処理 */
function handleRegisterForm() {
  const formUrl = document.getElementById('input-form-url').value.trim();
  const label = document.getElementById('input-form-label').value.trim();

  // バリデーション
  if (!formUrl) {
    showToast('フォームURLを入力してください', 'error');
    return;
  }
  if (!label) {
    showToast('ラベルを入力してください', 'error');
    return;
  }
  if (!parseFormUrl(formUrl)) {
    showToast('有効なGoogleフォームURLを入力してください', 'error');
    return;
  }

  // フィールド情報を収集
  const fieldRows = document.querySelectorAll('#field-rows .field-row');
  const entries = [];
  let hasValidField = false;

  fieldRows.forEach(row => {
    const fieldName = row.querySelector('.input-field-name').value.trim();
    const entryId = row.querySelector('.input-entry-id').value.trim();
    const value = row.querySelector('.input-field-value').value.trim();

    if (fieldName && entryId) {
      // entryIdが "entry." で始まっていなければ自動補完
      // ただし、emailAddress の場合はそのままにする
      hasValidField = true;
    }
  });

  if (!hasValidField) {
    showToast('少なくとも1つのフィールドを入力してください', 'error');
    return;
  }

  // 保存
  const formData = {
    id: editingFormId,
    label,
    formUrl,
    formId: parseFormUrl(formUrl),
    entries
  };

  saveForm(formData);
  toggleFormEditor(false);
  renderFormList();

  const action = editingFormId ? '更新' : '登録';
  showToast(`「${label}」を${action}しました`, 'success');
  editingFormId = null;
}

/** フォームの編集 */
function handleEditForm(formId) {
  const form = getFormById(formId);
  if (!form) return;

  editingFormId = formId;

  document.getElementById('input-form-url').value = form.formUrl;
  document.getElementById('input-form-label').value = form.label;

  // フィールド行をクリアして再構築
  const container = document.getElementById('field-rows');
  container.innerHTML = '';
  form.entries.forEach(e => addFieldRow(e.fieldName, e.entryId, e.value));

  document.getElementById('btn-register-form').textContent = '📌 更新';
  toggleFormEditor(true);
}

/** フォームの削除 */
function handleDeleteForm(formId) {
  const form = getFormById(formId);
  if (!form) return;

  if (confirm(`「${form.label}」を削除しますか？`)) {
    removeForm(formId);
    renderFormList();
    showToast(`「${form.label}」を削除しました`, 'info');
  }
}

// ── 提出履歴 ──

/** 履歴セクションの表示切替 */
function toggleHistory() {
  const section = document.getElementById('history-section');
  section.classList.toggle('show');
  if (section.classList.contains('show')) {
    renderHistory();
  }
}

/** 履歴を描画 */
function renderHistory() {
  const history = getHistory();
  const container = document.getElementById('history-list');

  if (history.length === 0) {
    container.innerHTML = '<p class="empty-hint">提出履歴はありません</p>';
    return;
  }

  container.innerHTML = history.map(h => `
    <div class="history-item">
      <span class="history-label">📚 ${escapeHtml(h.label)}</span>
      <span class="history-time">${formatDate(h.submittedAt)}</span>
    </div>
  `).join('');
}

// ── ヘルプ ──

/** ヘルプセクションの表示切替 */
function toggleHelp() {
  const section = document.getElementById('help-section');
  section.classList.toggle('show');
}

// ── テーマ ──

/** テーマの初期化 */
function initTheme() {
  const saved = localStorage.getItem('qf-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (saved === 'dark' || (!saved && prefersDark)) {
    document.body.classList.add('dark-mode');
    document.getElementById('theme-toggle').textContent = '☀️';
  }
}

/** テーマの切替 */
function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('qf-theme', isDark ? 'dark' : 'light');
  document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
}

// ── ユーティリティ ──

/** トースト通知を表示 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

/** HTMLエスケープ */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** 日時フォーマット */
function formatDate(isoString) {
  const d = new Date(isoString);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${min}`;
}

