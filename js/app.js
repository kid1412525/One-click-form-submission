// ============================================
// app.js — メインアプリケーションロジック
// ============================================

// ── 状態 ──
let editingFormId = null; // 編集中のフォームID（nullなら新規追加）

// ── 初期化 ──
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initName();
  initSettings();
  renderTimetable();
  setupEventListeners();
});

/** イベントリスナーの設定 */
function setupEventListeners() {
  // 名前の保存
  document.getElementById('btn-save-name').addEventListener('click', handleSaveName);
  document.getElementById('input-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSaveName();
  });

  // 設定パネルのトグル
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  if (btnToggleSettings) {
    btnToggleSettings.addEventListener('click', () => {
      const panel = document.getElementById('settings-panel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
  }

  // 設定の保存
  const btnSaveSettings = document.getElementById('btn-save-settings');
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', handleSaveSettings);
  }

  // フォーム追加ボタン
  document.getElementById('btn-toggle-editor').addEventListener('click', () => {
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

  // URL自動取得ボタン
  document.getElementById('btn-auto-fetch').addEventListener('click', handleAutoFetch);
  // 貼り付け時にも自動検出
  document.getElementById('input-auto-url').addEventListener('paste', () => {
    setTimeout(handleAutoFetch, 100);
  });

  // ブックマークレットデータの適用
  document.getElementById('btn-apply-bookmark').addEventListener('click', handleApplyBookmarkData);
  document.getElementById('input-bookmark-data').addEventListener('paste', () => {
    setTimeout(handleApplyBookmarkData, 100);
  });

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

// ── 設定の管理 ──
function initSettings() {
  const settings = getSettings();
  
  // 曜日のチェックボックス
  document.querySelectorAll('.chk-day').forEach(chk => {
    chk.checked = settings.visibleDays.includes(chk.value);
  });
  
  // 時限の開始・終了時間
  const timeContainer = document.getElementById('settings-period-times');
  if (timeContainer) {
    let timeHtml = '';
    for (let i = 1; i <= 6; i++) {
      const times = settings.periodTimes[i] || { start: '', end: '' };
      timeHtml += `
        <div class="period-time-row">
          <span style="font-weight: 600; width: 40px;">${i}限:</span>
          <input type="time" id="time-start-${i}" value="${times.start}">
          <span>〜</span>
          <input type="time" id="time-end-${i}" value="${times.end}">
        </div>
      `;
    }
    timeContainer.innerHTML = timeHtml;
  }
}

function handleSaveSettings() {
  const visibleDays = [];
  document.querySelectorAll('.chk-day:checked').forEach(chk => {
    visibleDays.push(chk.value);
  });
  
  const periodTimes = {};
  for (let i = 1; i <= 6; i++) {
    periodTimes[i] = {
      start: document.getElementById(`time-start-${i}`).value,
      end: document.getElementById(`time-end-${i}`).value
    };
  }
  
  saveSettings({ visibleDays, periodTimes });
  document.getElementById('settings-panel').style.display = 'none';
  
  // CSS変数に行数をセット
  document.documentElement.style.setProperty('--days-count', visibleDays.length || 1);
  
  renderTimetable();
  showToast('設定を保存しました', 'success');
}

// ── 名前の管理 ──

/** 保存済みの名前とメールを読み込む */
function initName() {
  const name = getName();
  const email = getEmail();
  document.getElementById('input-name').value = name;
  document.getElementById('input-email').value = email;
  if (name || email) {
    document.getElementById('name-status').textContent = '✅ 保存済み';
  }
}

/** 名前とメールを保存 */
function handleSaveName() {
  const name = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email').value.trim();

  if (!name) {
    showToast('名前を入力してください', 'error');
    return;
  }
  saveName(name);
  saveEmail(email);
  document.getElementById('name-status').textContent = '✅ 保存済み';
  showToast('情報を保存しました', 'success');
}

// ── 時間割の描画 ──

const DAY_MAP = { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日' };

function renderTimetable() {
  const forms = getForms();
  const history = getHistory();
  const settings = getSettings();
  const visibleDays = settings.visibleDays || ['mon', 'tue', 'wed', 'thu', 'fri'];
  
  document.documentElement.style.setProperty('--days-count', visibleDays.length || 1);
  
  const maxPeriod = 6;
  const matrix = Array.from({ length: maxPeriod + 1 }, () => ({}));
  const otherForms = [];
  
  forms.forEach(form => {
    if (!form.dayOfWeek || form.dayOfWeek === 'other' || !visibleDays.includes(form.dayOfWeek)) {
      otherForms.push(form);
      return;
    }
    
    // startPeriodとendPeriodをサポート。古いperiodプロパティにもフォールバック
    const start = parseInt(form.startPeriod || form.period || 0, 10);
    let end = parseInt(form.endPeriod || form.period || 0, 10);
    
    if (start === 0 || start > maxPeriod) {
      otherForms.push(form);
      return;
    }
    
    if (end < start) end = start;
    if (end > maxPeriod) end = maxPeriod;
    
    if (!matrix[start][form.dayOfWeek]) {
       matrix[start][form.dayOfWeek] = [];
    }
    matrix[start][form.dayOfWeek].push({ form, rowSpan: end - start + 1 });
    
    for (let p = start + 1; p <= end; p++) {
       matrix[p][form.dayOfWeek] = 'spanned';
    }
  });

  // 時間割テーブルの構築
  const table = document.getElementById('timetable');
  let html = '<thead><tr><th class="period-col"></th>';
  visibleDays.forEach(day => {
    html += `<th>${DAY_MAP[day]}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  for (let p = 1; p <= maxPeriod; p++) {
    const timeInfo = settings.periodTimes[p] || { start: '', end: '' };
    html += `<tr>`;
    html += `<th class="period-col">${p}限<br><span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: normal; display: block; margin-top: 4px;">${timeInfo.start}<br>〜<br>${timeInfo.end}</span></th>`;
    
    visibleDays.forEach(day => {
      const cell = matrix[p][day];
      if (cell === 'spanned') {
        // 何も描画しない（rowspanで埋まっているため）
      } else if (Array.isArray(cell) && cell.length > 0) {
        const item = cell[0]; // 複数あっても最初のみ表示
        const form = item.form;
        html += `<td rowspan="${item.rowSpan}">`;
        html += renderFormCardSmall(form, history);
        html += `</td>`;
      } else {
        html += `<td></td>`;
      }
    });
    html += `</tr>`;
  }
  html += '</tbody>';
  table.innerHTML = html;
  
  // その他の授業
  const otherContainer = document.getElementById('other-forms-list');
  if (otherForms.length === 0) {
    otherContainer.innerHTML = '<p class="empty-hint" style="text-align: left;">登録されていません</p>';
  } else {
    otherContainer.innerHTML = otherForms.map(f => renderFormCardSmall(f, history, true)).join('');
  }
}

/** 時間割用の小さなカードを描画 */
function renderFormCardSmall(form, history, isOther = false) {
  const lastSubmit = history.find(h => h.formId === form.id);
  const style = isOther ? 'margin-bottom: 8px;' : '';
  
  return `
    <div class="tt-card fade-in" data-id="${form.id}" style="${style}">
      <div class="tt-card-title">${escapeHtml(form.label)}</div>
      <div class="tt-actions">
        <button class="tt-btn" title="ワンクリック提出" onclick="handleSubmit('${form.id}')">🚀</button>
        <button class="tt-btn" title="入力済みで開く" onclick="handleOpenPrefilled('${form.id}')">📝</button>
        <button class="tt-btn" title="編集" onclick="handleEditForm('${form.id}')">⚙️</button>
        <button class="tt-btn" title="削除" onclick="handleDeleteForm('${form.id}')" style="color: var(--error)">🗑️</button>
      </div>
    </div>
  `;
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
  const userEmail = getEmail();
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
  const card = document.querySelector(`.tt-card[data-id="${formId}"]`);
  const submitBtn = card ? card.querySelector('.tt-btn[title="ワンクリック提出"]') : null;
  if (submitBtn) {
    submitBtn.textContent = '⏳';
    submitBtn.disabled = true;
  }

  const success = await submitFormDirect(form.formUrl, entries, userEmail);

  if (success) {
    addHistory(formId, form.label);
    showToast(`✅ 「${form.label}」を提出しました！`, 'success');
    renderTimetable();
  } else {
    showToast('送信に失敗しました。「入力済みで開く」をお試しください', 'error');
    if (submitBtn) {
      submitBtn.textContent = '🚀';
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
  const userEmail = getEmail();
  if (!userName) {
    showToast('先に名前を保存してください', 'error');
    return;
  }

  const entries = form.entries.map(e => ({
    entryId: e.entryId,
    value: e.value || userName
  }));

  const url = buildPrefilledUrl(form.formUrl, entries, userEmail);
  window.open(url, '_blank');

  // 履歴に記録（実際にはユーザーが送信ボタンを押すまで未提出だが便宜上記録）
  addHistory(formId, form.label);
  renderTimetable();
  showToast(`「${form.label}」を入力済みで開きました`, 'info');
}

// ── フォームの追加・編集・削除 ──

/**
 * ブックマークレットからコピーしたJSONデータを適用する
 */
function handleApplyBookmarkData() {
  const input = document.getElementById('input-bookmark-data');
  const status = document.getElementById('auto-parse-status');
  const raw = input.value.trim();

  if (!raw) {
    status.innerHTML = '<span class="status-error">データを貼り付けてください</span>';
    return;
  }

  try {
    const data = JSON.parse(raw);

    if (!data.entries || data.entries.length === 0) {
      status.innerHTML = '<span class="status-error">❌ フィールド情報が含まれていません</span>';
      return;
    }

    // フォームURLを自動入力
    if (data.url) {
      const viewUrl = data.url.split('?')[0];
      document.getElementById('input-form-url').value = viewUrl;
    }

    // ラベルにフォームタイトルを自動入力
    const labelInput = document.getElementById('input-form-label');
    if (!labelInput.value && data.title) {
      labelInput.value = data.title;
    }

    // フィールド行をクリアして自動入力
    const container = document.getElementById('field-rows');
    container.innerHTML = '';
    data.entries.forEach(entry => {
      addFieldRow(entry.fieldName || 'フィールド', entry.entryId, '');
    });

    status.innerHTML = `<span class="status-success">✅ ${data.entries.length}個のフィールドを設定しました！</span>`;
    showToast(`${data.entries.length}個のフィールドを自動設定しました`, 'success');

    if (!labelInput.value) labelInput.focus();
  } catch (e) {
    status.innerHTML = '<span class="status-error">❌ データの形式が正しくありません。ブックマークレットで取得したデータを貼り付けてください</span>';
  }
}

/**
 * GoogleフォームURLからフィールド情報を自動取得する
 */
async function handleAutoFetch() {
  const input = document.getElementById('input-auto-url');
  const status = document.getElementById('auto-parse-status');
  const url = input.value.trim();

  if (!url) {
    status.innerHTML = '<span class="status-error">URLを貼り付けてください</span>';
    return;
  }

  if (!url.includes('docs.google.com/forms')) {
    status.innerHTML = '<span class="status-error">❌ GoogleフォームのURLではないようです</span>';
    return;
  }

  status.innerHTML = '<span class="status-loading">⏳ フォーム情報を取得中...</span>';
  document.getElementById('btn-auto-fetch').disabled = true;

  const result = await fetchFormFields(url);

  if (result && result.entries.length > 0) {
    const viewUrl = url.split('?')[0].replace(/\/(edit|formResponse)\s*$/, '/viewform');
    document.getElementById('input-form-url').value = viewUrl.includes('/viewform') ? viewUrl : viewUrl + '/viewform';

    const labelInput = document.getElementById('input-form-label');
    if (!labelInput.value && result.title) {
      labelInput.value = result.title;
    }

    const container = document.getElementById('field-rows');
    container.innerHTML = '';
    result.entries.forEach(entry => {
      addFieldRow(entry.fieldName, entry.entryId, '');
    });

    status.innerHTML = `<span class="status-success">✅ ${result.entries.length}個のフィールドを自動検出しました！</span>`;
    showToast(`${result.entries.length}個のフィールドを自動取得しました`, 'success');

    document.getElementById('btn-auto-fetch').disabled = false;
    if (!labelInput.value) labelInput.focus();
    return;
  }

  const prefilledResult = parsePrefilledUrl(url);
  if (prefilledResult && prefilledResult.entries.length > 0) {
    document.getElementById('input-form-url').value = prefilledResult.formUrl;

    const container = document.getElementById('field-rows');
    container.innerHTML = '';
    prefilledResult.entries.forEach(entry => {
      addFieldRow(entry.fieldName, entry.entryId, entry.value);
    });

    status.innerHTML = `<span class="status-success">✅ ${prefilledResult.entries.length}個のフィールドを検出しました（事前入力リンクから）</span>`;
    showToast(`${prefilledResult.entries.length}個のフィールドを設定しました`, 'success');

    document.getElementById('btn-auto-fetch').disabled = false;
    document.getElementById('input-form-label').focus();
    return;
  }

  status.innerHTML = '<span class="status-error">❌ フィールドを自動取得できませんでした。フォームが非公開の可能性があります。手動で入力してください</span>';
  document.getElementById('btn-auto-fetch').disabled = false;
}

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
  document.getElementById('input-auto-url').value = '';
  document.getElementById('input-bookmark-data').value = '';
  document.getElementById('auto-parse-status').innerHTML = '';
  document.getElementById('input-form-url').value = '';
  document.getElementById('input-form-label').value = '';
  document.getElementById('select-day').value = 'other';
  document.getElementById('select-start-period').value = '0';
  document.getElementById('select-end-period').value = '0';
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
  const formId = parseFormUrl(formUrl);
  if (!formId) {
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
      const normalizedEntryId = entryId.startsWith('entry.') ? entryId : 'entry.' + entryId;
      entries.push({ fieldName, entryId: normalizedEntryId, value });
      hasValidField = true;
    }
  });

  if (!hasValidField) {
    showToast('少なくとも1つのフィールドを入力してください', 'error');
    return;
  }

  const dayOfWeek = document.getElementById('select-day').value;
  const startPeriod = parseInt(document.getElementById('select-start-period').value, 10);
  const endPeriod = parseInt(document.getElementById('select-end-period').value, 10);

  // 開始と終了が逆転している場合は修正
  const finalStart = startPeriod;
  const finalEnd = (endPeriod > 0 && endPeriod < startPeriod) ? startPeriod : (endPeriod || startPeriod);

  // 保存
  const formData = {
    id: editingFormId || undefined,
    label,
    formUrl,
    formId,
    entries,
    dayOfWeek,
    startPeriod: finalStart,
    endPeriod: finalEnd,
    period: finalStart // 互換性のため
  };

  saveForm(formData);
  toggleFormEditor(false);
  renderTimetable();

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
  document.getElementById('select-day').value = form.dayOfWeek || 'other';
  document.getElementById('select-start-period').value = form.startPeriod || form.period || '0';
  document.getElementById('select-end-period').value = form.endPeriod || form.period || '0';

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
    renderTimetable();
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
