// SVGアイコン
const icons = {
  star: '<svg class="w-4 h-4 fill-yellow-400 text-yellow-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  plus: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>',
  arrowUpRight: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17L17 7m0 0H7m10 0v10"/></svg>',
  print: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>',
  download: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>',
  upload: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>'
};

let currentSessionPhilosophy = null; // 今日のフィロソフィー固定用

// 状態管理
let state = {
  // 基本情報
  activeTab: 'dashboard',
  userName: 'バルニ 太郎',
  userStore: 'カフェ ガーブ',
  userPosition: '店長',

  // 給与・評価関連
  manualBasePay: null,    // 手動設定した基本給
  workLevels: {},         // 業務レベル (SEED/SPROUT/HARVEST)
  starsByHuman: {},       // 人間力ごとの星数
  workInProgress: {},     // 取り組み中の業務
  totalSpiritStars: 0,    // スピリット項目から得た星の合計

  // UI制御
  workDetailOpen: false,
  workDetailKey: null,
  resetModalOpen: false,
  humanDetailOpen: false,
  humanDetailKey: null,

  // 役職・役割給
  selectedRolePayType: 'manager',
  selectedRolePayAmount: 30000,

  // MY UNIQUE関連
  specialtyLevel: null,   // 'store', 'performance', 'brand'
  specialtyAmount: 0,     // スキル給金額
  myUniqueChallenge: 0,   // チャレンジ給金額
  challengeText: '',      // チャレンジ内容メモ
  skills: [],             // 登録されたスキル（マイユニーク用）
  challengeDialogChecked: false, // チャレンジ承認チェック

  // プロローグ関連
  prologueStep: 1,
  selectedPrologueType: null,
  selectedWorkId: null
};

// ローカルストレージから読み込み
function loadState() {
  try {
    const saved = localStorage.getItem('hrEvalState');
    if (saved) {
      const parsed = JSON.parse(saved);
      // 保存データを読み込むが、タブだけは「ラウンジ(dashboard)」に強制リセットする
      state = { ...state, ...parsed, activeTab: 'dashboard' };
      // 保存データがあっても `workInProgress` が空（初期化されていない）なら
      // SPIRIT 項目をデフォルトで取り組み中にする
      try {
        const spiritWorks = (typeof WORKS !== 'undefined') ? WORKS.filter(w => w.isSpirit).map(w => w.key) : [];
        if (!state.workInProgress || Object.keys(state.workInProgress).length === 0) {
          state.workInProgress = state.workInProgress || {};
          spiritWorks.forEach(k => { state.workInProgress[k] = true; });
        }
      } catch (e) {
        console.warn('Failed to ensure default spirit checks from saved state', e);
      }
    } else {
      // 初回起動時（保存データなし）は、SPIRIT 項目を取り組み中にチェックする
      try {
        const spiritWorks = (typeof WORKS !== 'undefined') ? WORKS.filter(w => w.isSpirit).map(w => w.key) : [];
        if (!state.workInProgress) state.workInProgress = {};
        spiritWorks.forEach(k => { state.workInProgress[k] = true; });
        // 画面表示のために state に反映するが、自動保存は行わない（ユーザーが明示的に保存可）
      } catch (e) {
        console.warn('Failed to initialize default spirit checks', e);
      }
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
}

function calculateStars() {
  const stars = {};
  HUMAN_POWERS.forEach(h => stars[h.key] = 0);
  let totalSpiritStars = 0;
  let spiritCheckCount = 0;

  // 1. SPIRIT項目のチェック数を確認
  const spiritWorks = WORKS.filter(w => w.isSpirit);
  spiritWorks.forEach(w => {
    if (state.workLevels[w.key] === 'HARVEST') {
      spiritCheckCount++;
      totalSpiritStars += 1.0;
    }
  });

  // 2. 達成判定（警告表示用フラグとして使用）
  const isSpiritComplete = (spiritCheckCount === spiritWorks.length);
  state.isSpiritComplete = isSpiritComplete;
  state.totalSpiritStars = totalSpiritStars;

  // 3. 他の星の計算（★修正：ロックせず常に計算する）
  Object.entries(state.workLevels).forEach(([workKey, level]) => {
    if (level && level !== 'SEED') {
      const work = WORKS.find(w => w.key === workKey);
      // SPIRIT以外を計算
      if (work && !work.isSpirit) {
        const starValue = level === 'SPROUT' ? 0.5 : level === 'HARVEST' ? 1.0 : 0;
        const relatedHumans = WORK_TO_HUMAN[workKey] || [];
        relatedHumans.forEach(humanKey => {
          if (stars[humanKey] !== undefined) {
            // Determine effective max for this human power:
            // - If the number of related works >= 4, cap at 4
            // - Otherwise use the declared max from HUMAN_POWERS (fall back to 4)
            const humanDef = HUMAN_POWERS.find(h => h.key === humanKey) || {};
            const relatedCount = (HUMAN_TO_WORK[humanKey] || []).length;
            const declaredMax = humanDef.max || 4;
            const effectiveMax = (relatedCount >= 4) ? 4 : declaredMax;
            stars[humanKey] = Math.min((stars[humanKey] || 0) + starValue, effectiveMax);
          }
        });
      }
    }
  });

  state.starsByHuman = stars;
}

// ---- セーフティ: saveState と manualSave のフォールバック
// 他のファイルで定義されている場合は上書きしない
if (typeof window.saveState !== 'function') {
  window.saveState = function () {
    try {
      localStorage.setItem('hrEvalState', JSON.stringify(state));
      const st = document.getElementById('save-status');
      if (st) {
        st.textContent = '保存しました';
        st.classList.remove('hidden');
        setTimeout(() => st.classList.add('hidden'), 1500);
      }
    } catch (e) {
      console.warn('saveState fallback failed', e);
    }
  };
}

if (typeof window.manualSave !== 'function') {
  window.manualSave = function () {
    try {
      window.saveState();
    } catch (e) {
      console.warn('manualSave fallback failed', e);
    }
  };
}

// 合計星数
function getTotalStars() {
  const humanPowerStars = Object.values(state.starsByHuman).reduce((sum, val) => sum + val, 0);
  const total = humanPowerStars + (state.totalSpiritStars || 0);
  return total;
}

// 基本給レンジ
function getBaseRange() {
  const total = getTotalStars();
  const range = STAR_RANGES.find(r => total >= r.min && total <= r.max) || STAR_RANGES[STAR_RANGES.length - 1];
  return range;
}

// スキル給合計（登録された全スキルの金額を合算）
function getSkillTotal() {
  if (!state.skills || !Array.isArray(state.skills)) return 0;
  return state.skills.reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);
}

// 数値フォーマット
function formatNumber(num) {
  return parseInt(num).toLocaleString('ja-JP');
}

// レベルバッジ取得
function getLevelBadge(level, isSpirit = false) {
  if (isSpirit && level !== 'SEED') {
    return `<span class="px-2 py-1 text-xs rounded-full bg-red-200 text-red-800">🔥 SPIRIT（★1.0）</span>`;
  }
  const badges = {
    SEED: '<span class="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-700">SEED（★0）</span>',
    SPROUT: '<span class="px-2 py-1 text-xs rounded-full bg-yellow-200 text-yellow-800">🌱 SPROUT（★0.5）</span>',
    HARVEST: '<span class="px-2 py-1 text-xs rounded-full bg-green-200 text-green-800">🌾 HARVEST（★1）</span>'
  };
  return badges[level] || badges.SEED;
}

// タブ切り替え
function switchTab(tab) {
  state.activeTab = tab;
  render();
  if (tab === 'dashboard') {
    setTimeout(() => drawRadarChart(), 100);
  }
  // スイッチ後に該当タブを見やすい位置へスクロール
  setTimeout(() => {
    try {
      const el = document.getElementById(`tab-${tab}`);
      if (el && el.scrollIntoView) {
        // 横スクロール領域内で左寄せにして次のタブが見えるようにする
        el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      }
    } catch (e) {
      // ignore
    }
    // ページ自体は先頭へ
    window.scrollTo(0, 0);
  }, 80);
}

// 業務レベル変更
function changeWorkLevel(workKey, level) {
  const work = WORKS.find(w => w.key === workKey);
  if (work && work.isSpirit) {
    state.workLevels[workKey] = level === 'SEED' ? 'SEED' : 'HARVEST';
    if (level !== 'SEED' && state.workInProgress[workKey]) {
      delete state.workInProgress[workKey];
    }
  } else {
    state.workLevels[workKey] = level;
    if (level !== 'SEED' && state.workInProgress[workKey]) {
      delete state.workInProgress[workKey];
    }
  }
  calculateStars();
  saveState();
  render();
  if (state.activeTab === 'dashboard') {
    setTimeout(() => drawRadarChart(), 100);
  }
}

// 取り組み状況の切り替え
function toggleWorkInProgress(workKey) {
  if (!state.workInProgress) state.workInProgress = {};
  if (state.workInProgress[workKey]) {
    delete state.workInProgress[workKey];
  } else {
    state.workInProgress[workKey] = true;
  }
  saveState();
  render();
}

// 取り組み中の業務リスト取得
function getInProgressWorks() {
  if (!state.workInProgress) return [];
  return Object.keys(state.workInProgress).filter(key => {
    if (!state.workInProgress[key]) return false;
    const work = WORKS.find(w => w.key === key);
    return !!work;
  });
}

// ユーザー情報更新
function updateUserInfo() {
  const nameInput = document.getElementById('userName');
  const storeInput = document.getElementById('userStore');
  const positionInput = document.getElementById('userPosition');

  if (nameInput) state.userName = nameInput.value;
  if (storeInput) state.userStore = storeInput.value;
  if (positionInput) state.userPosition = positionInput.value;

  saveState();
}

// ラウンジ：給与表示（基本給・合計）を即時反映
// Safari等で innerHTML 再描画後に input の見た目が更新されないケースがあるため、
// 基本給変更時は DOM を直接更新して「操作直後に反映」を保証する。
function syncDashboardPayUI() {
  // このUI要素が無い（＝表示中のタブが違う/まだ描画されていない）場合は何もしない
  const hasAny =
    document.getElementById('basePayValue') ||
    document.getElementById('basePayLine') ||
    document.getElementById('totalPayLine') ||
    document.getElementById('basePayInput');

  if (!hasAny) return false;

  const rangeInfo = getBaseRange();

  // 基本給（空の場合はレンジ下限 / 範囲外はクランプ）
  let basePay = parseInt(state.manualBasePay);
  if (isNaN(basePay)) basePay = rangeInfo.minPay;
  if (basePay < rangeInfo.minPay) basePay = rangeInfo.minPay;
  if (basePay > rangeInfo.maxPay) basePay = rangeInfo.maxPay;
  state.manualBasePay = basePay;

  // 役職給
  const roleType = state.selectedRolePayType || 'none';
  const roleRange = ROLE_PAY_RANGES[roleType] || { min: 0 };
  let rolePayValue = parseInt(state.selectedRolePayAmount);
  if (isNaN(rolePayValue)) rolePayValue = roleRange.min;

  // スキル・ユニーク給
  const skillTotal = parseInt(getSkillTotal()) || 0;
  const challengePay = parseInt(state.myUniqueChallenge) || 0;
  const totalPay = basePay + rolePayValue + skillTotal + challengePay;

  // 反映先（input版/表示div版の両対応）
  const inputEl = document.getElementById('basePayInput');
  if (inputEl) inputEl.value = formatNumber(basePay);

  const valueEl = document.getElementById('basePayValue');
  if (valueEl) valueEl.textContent = formatNumber(basePay);

  const basePayLineEl = document.getElementById('basePayLine');
  if (basePayLineEl) basePayLineEl.textContent = `${formatNumber(basePay)} 円`;

  const totalPayEl = document.getElementById('totalPayLine');
  if (totalPayEl) totalPayEl.textContent = `${formatNumber(totalPay)} 円`;

  const minusBtn = document.getElementById('basePayMinusBtn');
  if (minusBtn) minusBtn.disabled = basePay <= rangeInfo.minPay;

  const plusBtn = document.getElementById('basePayPlusBtn');
  if (plusBtn) plusBtn.disabled = basePay >= rangeInfo.maxPay;

  return true;
}



// 基本給の手動更新
function updateManualBasePay(value) {
  let amount = parseInt(value);
  if (!isNaN(amount)) {
    const rangeInfo = getBaseRange();
    amount = Math.round(amount / 5000) * 5000;
    if (amount < rangeInfo.minPay) amount = rangeInfo.minPay;
    if (amount > rangeInfo.maxPay) amount = rangeInfo.maxPay;
    state.manualBasePay = amount;
    saveState();
    render();
  }
}

// 役職タイプの変更処理
function updateRoleSelection(type) {
  // 状態を更新
  state.selectedRolePayType = type;

  // 選択された役職のレンジ情報を取得
  const range = ROLE_PAY_RANGES[type] || { min: 0, max: 0 };

  // その役職の「下限金額」を自動セット（これがないと金額が0や前のままになる）
  state.selectedRolePayAmount = range.min;

  // 確実に保存して再描画
  saveState();
  render();
}

// 役職給の金額更新（レンジ制限付き・5000円単位）
function updateRoleAmount(val) {
  const type = state.selectedRolePayType || 'none';
  const range = ROLE_PAY_RANGES[type] || { min: 0, max: 0 };
  let amount = parseInt(val);

  if (isNaN(amount)) return;

  // 5000円単位に丸める
  amount = Math.round(amount / 5000) * 5000;

  // レンジ外なら補正
  if (amount < range.min) amount = range.min;
  if (amount > range.max) amount = range.max;

  state.selectedRolePayAmount = amount;
  saveState();
  render();
}

// スキル追加（マイユニーク：スペシャリティ給）
function addSkill() {
  // 1. 最大数チェック
  if (state.skills.length >= 5) {
    alert('スキルは最大5つまでしか登録できません');
    return;
  }

  const nameInput = document.getElementById('skillName');
  const amtInput = document.getElementById('skillAmt');
  const tierSelect = document.getElementById('skillTier');
  const condCheck = document.getElementById('skillCondition');

  const name = nameInput.value.trim();
  const amt = Number(amtInput.value);
  const tier = tierSelect.value;

  // 2. 基本入力チェック
  if (!name) {
    alert('スキル名を入力してください');
    return;
  }
  if (!amt || amt <= 0) {
    alert('金額を入力してください');
    return;
  }

  // 3. 条件チェック
  if (condCheck && !condCheck.checked) {
    alert('登録条件（Harvestまたは星MAX）の確認チェックが必要です。');
    return;
  }

  // 4. 上限額チェック
  const limits = {
    'store': 30000,
    'performance': 50000,
    'brand': 100000
  };
  const maxLimit = limits[tier];

  if (amt > maxLimit) {
    alert(`選択されたレベルの上限額は ${formatNumber(maxLimit)}円 です。`);
    return;
  }

  // 5. 5000円単位チェック
  if (amt % 5000 !== 0) {
    alert('金額は5,000円単位で入力してください');
    return;
  }
  if (amt < 5000) {
    alert('金額は最低5,000円からです');
    return;
  }

  // 6. 登録処理
  state.skills.push({
    id: Date.now(),
    name,
    tier,
    amount: amt
  });

  saveState();
  render();
}

// チャレンジ内容更新
function updateChallengeText(text) {
  state.challengeText = text;
  saveState();
}

// チャレンジ給額更新
function updateChallengePay(val) {
  let amount = parseInt(val);
  if (amount < 0) amount = 0;
  state.myUniqueChallenge = amount;
  saveState();
  render();
}

// スペシャリティレベル選択
function setSpecialtyLevel(level) {
  state.specialtyLevel = level;
  state.specialtyAmount = 0; // レベル変更時はリセット
  saveState();
  render();
}

// スペシャリティ給額更新
function updateSpecialtyAmount(val) {
  const levels = { 'store': 30000, 'performance': 50000, 'brand': 100000 };
  const max = state.specialtyLevel ? levels[state.specialtyLevel] : 0;
  let amount = parseInt(val);
  if (amount > max) amount = max;
  if (amount < 0) amount = 0;
  state.specialtyAmount = amount;
  saveState();
  // render()を呼ぶとフォーカスが外れるため、DOM直接更新推奨だが簡易実装でrender
  render();
}

// モーダル制御系
function openWorkDetail(workKey) {
  state.workDetailOpen = true;
  state.workDetailKey = workKey;
  render();
}
function closeWorkDetail() {
  state.workDetailOpen = false;
  state.workDetailKey = null;
  render();
}
function openHumanDetail(humanKey) {
  state.humanDetailOpen = true;
  state.humanDetailKey = humanKey;
  render();
}
function closeHumanDetail() {
  state.humanDetailOpen = false;
  state.humanDetailKey = null;
  render();
}
function openResetModal() {
  state.resetModalOpen = true;
  render();
}
function closeResetModal() {
  state.resetModalOpen = false;
  render();
}
function executeReset() {
  WORKS.forEach(w => state.workLevels[w.key] = 'SEED');
  state.workInProgress = {};
  state.resetModalOpen = false;
  calculateStars();
  saveState();
  render();
}

// ジャンプ機能
function jumpToWork(workKey) {
  closeHumanDetail();
  switchTab('works');
  // 描画待ち
  setTimeout(() => {
    // 簡易検索（ID振っていないので詳細を開く）
    openWorkDetail(workKey);
  }, 300);
}
function jumpToHuman(humanKey) {
  closeWorkDetail();
  switchTab('humanpower');
  setTimeout(() => {
    openHumanDetail(humanKey);
  }, 300);
}

// --- プロローグ制御 ---
function setPrologueType(type) {
  state.selectedPrologueType = type;
  state.prologueStep = 2;
  render();
  window.scrollTo(0, 0);
}
function setPrologueWork(workId) {
  state.selectedWorkId = workId;
  state.prologueStep = 3;
  render();
  window.scrollTo(0, 0);
}
function backToPrologueScene2() {
  state.prologueStep = 2;
  render();
}
function resetPrologueSelection() {
  state.selectedPrologueType = null;
  state.selectedWorkId = null;
  state.prologueStep = 1;
  render();
}
function nextPrologueStep() {
  state.prologueStep++;
  render();
  window.scrollTo(0, 0);
}
function finishPrologue() {
  switchTab('dashboard');
  state.prologueStep = 1;
  state.selectedPrologueType = null;
  state.selectedWorkId = null;
}

// ----------------------------------------------------
// 各タブのレンダリング
// ----------------------------------------------------

function renderRole() {
  return `
    <div class="space-y-8 max-w-5xl mx-auto pb-20">
      
      <div class="bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-xl shadow-xl p-8">
        <h2 class="text-3xl font-bold mb-2">👔 役職・役割給</h2>
        <p class="text-blue-100">組織における責任と期待に対する報酬制度</p>
      </div>

      <div class="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
        <h3 class="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
          <span>📝</span> 1. 定義
        </h3>
        <p class="text-gray-700 leading-relaxed mb-4">
          役職・役割給とは、組織の中で<strong>一定以上の責任や影響力を担っている状態</strong>に対して支給される報酬です。<br>
          肩書そのものに支払われるものではなく、以下の基準に基づいて決定されます。
        </p>
        <div class="bg-blue-50 text-blue-900 font-bold p-4 rounded-lg text-center">
          「今どんな役割を担っているか」<br>
          「どんな責任を果たしているか」
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-md p-6">
        <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>💡</span> 2. 支給の考え方
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 class="font-bold text-blue-700 mb-2">役職給</h4>
            <p class="text-sm text-gray-600">店長・SVなど、明確な役職に任命された場合に支給。</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 class="font-bold text-green-700 mb-2">役割給</h4>
            <p class="text-sm text-gray-600">育成・PJ推進・新店立ち上げなど、役職と同等の役割を担う場合に支給。</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 class="font-bold text-red-700 mb-2">停止・見直し</h4>
            <p class="text-sm text-gray-600">役職や役割が終了した場合は、該当する給与が停止または見直しとなります。</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-md p-6">
        <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>⚙️</span> 3. 運用ルール
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead class="bg-gray-100 text-gray-600">
              <tr>
                <th class="border p-3 text-left w-1/3">状況</th>
                <th class="border p-3 text-left w-1/4">支給の扱い</th>
                <th class="border p-3 text-left">説明</th>
              </tr>
            </thead>
            <tbody class="text-gray-700">
              <tr>
                <td class="border p-3">店長やSVに昇格した場合</td>
                <td class="border p-3 font-bold text-blue-600">役職給を新たに支給</td>
                <td class="border p-3">責任範囲の拡大に伴う報酬</td>
              </tr>
              <tr>
                <td class="border p-3">店長を卒業し、他店の育成やPJに関わる場合</td>
                <td class="border p-3 font-bold text-green-600">役職給から役割給に移行</td>
                <td class="border p-3">役職は外れるが、同等の責任を担っているため継続支給</td>
              </tr>
              <tr>
                <td class="border p-3">役職を離れ、特定の役割もなくなった場合</td>
                <td class="border p-3 font-bold text-red-600">役職・役割給を終了</td>
                <td class="border p-3">責任の終了に伴う見直し</td>
              </tr>
              <tr>
                <td class="border p-3">新たなPJ・育成・開発に参画した場合</td>
                <td class="border p-3 font-bold text-green-600">役割給を新設または加算</td>
                <td class="border p-3">期間・ミッションを定めたうえで付与</td>
              </tr>
              <tr>
                <td class="border p-3">同時に複数の役割を担う場合</td>
                <td class="border p-3 font-bold text-purple-600">役割給を合算（上限あり）</td>
                <td class="border p-3">全体のバランスと影響度をもとに判断</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-md p-6">
        <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>💰</span> 4. 支給金額の目安 (例)
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead class="bg-purple-50 text-purple-800">
              <tr>
                <th class="border border-purple-200 p-3 text-left">区分</th>
                <th class="border border-purple-200 p-3 text-left">想定される範囲</th>
                <th class="border border-purple-200 p-3 text-left">金額目安</th>
              </tr>
            </thead>
            <tbody class="text-gray-700">
              <tr>
                <td class="border border-gray-100 p-3 font-bold">SV・統括</td>
                <td class="border border-gray-100 p-3">複数店舗の統括責任</td>
                <td class="border border-gray-100 p-3 font-bold text-lg">70,000 〜 90,000円</td>
              </tr>
              <tr>
                <td class="border border-gray-100 p-3 font-bold">店長・シェフ</td>
                <td class="border border-gray-100 p-3">店舗全体の責任者</td>
                <td class="border border-gray-100 p-3 font-bold text-lg">30,000 〜 50,000円</td>
              </tr>
              <tr>
                <td class="border border-gray-100 p-3 font-bold">副店長・副料理長</td>
                <td class="border border-gray-100 p-3">店長・副店長を育てる／PJ推進</td>
                <td class="border border-gray-100 p-3 font-bold text-lg">15,000 〜 25,000円</td>
              </tr>
              <tr>
                <td class="border border-gray-100 p-3 font-bold">セクションリーダー</td>
                <td class="border border-gray-100 p-3">セクション運営</td>
                <td class="border border-gray-100 p-3 font-bold text-lg">5,000 〜 10,000円</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-gray-500 mt-2 text-right">※ 金額は責任範囲・影響度・発揮度によって決定します。</p>
      </div>

      <div class="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl shadow-md p-6 border-l-4 border-orange-400">
        <h3 class="text-xl font-bold text-orange-800 mb-4 flex items-center gap-2">
          <span>🌟</span> 5. 人間力（星）との関係
        </h3>
        <div class="flex flex-col md:flex-row gap-6 items-center">
          <div class="flex-1 space-y-3">
            <div class="bg-white p-3 rounded shadow-sm">
              <span class="font-bold text-blue-600">役職・役割給</span> は <span class="font-bold">「責任」</span> への報酬<br>
              <span class="text-xs text-gray-500">→ 変動する（役割が変われば見直し）</span>
            </div>
            <div class="bg-white p-3 rounded shadow-sm">
              <span class="font-bold text-orange-600">人間力（星）</span> は <span class="font-bold">「成長」</span> への報酬<br>
              <span class="text-xs text-gray-500">→ 積み上がる（身につけた力は減らない）</span>
            </div>
          </div>
          <div class="flex-1 text-center md:text-left">
            <p class="text-gray-700 font-bold leading-relaxed">
              「役職を離れても星は残る。<br>
              人間力を磨くほど、次の役割へのチャンスが広がる。」
            </p>
            <p class="text-sm text-gray-600 mt-2">
              この成長循環を制度の軸としています。
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <h3 class="text-2xl font-bold text-gray-800 border-b pb-2">🎯 役職ごとの必須条件</h3>

        <div class="bg-white rounded-lg border border-green-200 shadow-sm overflow-hidden">
          <div class="bg-green-50 px-4 py-3 flex justify-between items-center">
            <h4 class="font-bold text-green-800">🔹 セクションリーダー</h4>
            <span class="bg-green-200 text-green-800 text-xs font-bold px-2 py-1 rounded">目安: +0.5万円</span>
          </div>
          <div class="p-4">
            <p class="text-gray-600 text-sm mb-2">必須条件はありません。</p>
            <p class="text-xs text-green-600 font-bold">👉 小さなリーダーシップを経験する登竜門として位置づけます。</p>
          </div>
        </div>

        <div class="bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
          <div class="bg-blue-50 px-4 py-3 flex justify-between items-center">
            <h4 class="font-bold text-blue-800">🔹 副店長・料理長</h4>
            <span class="bg-blue-200 text-blue-800 text-xs font-bold px-2 py-1 rounded">目安: +1.5万円</span>
          </div>
          <div class="p-4">
            <ul class="space-y-2 mb-3">
              ${['原価・利益管理', 'コンプライアンス・ガバナンス', '互いを思うチームワーク'].map(k => {
    const w = WORKS.find(w => w.key === k) || { key: k }; // 簡易検索
    const level = state.workLevels[k] || 'SEED';
    const ok = level === 'SPROUT' || level === 'HARVEST';
    return `<li class="flex items-center gap-2 text-sm ${ok ? 'text-blue-700 font-bold' : 'text-gray-400'}">
                  <span>${ok ? '✅' : '⬜'}</span> ${k} (Sprout以上)
                </li>`;
  }).join('')}
            </ul>
            <p class="text-xs text-blue-600 font-bold">👉 店長を補佐する立場として、数字・規律・チームに最低限関与できることが必須です。</p>
          </div>
        </div>

        <div class="bg-white rounded-lg border border-purple-200 shadow-sm overflow-hidden">
          <div class="bg-purple-50 px-4 py-3 flex justify-between items-center">
            <h4 class="font-bold text-purple-800">🔹 店長・シェフ</h4>
            <span class="bg-purple-200 text-purple-800 text-xs font-bold px-2 py-1 rounded">目安: +3.0万円</span>
          </div>
          <div class="p-4">
            <ul class="space-y-2 mb-3">
              ${['原価・利益管理', 'コンプライアンス・ガバナンス', '互いを思うチームワーク', '未来につなぐ人材評価', '衛生・安全管理'].map(k => {
    const level = state.workLevels[k] || 'SEED';
    // 店長の必須条件を Harvest -> Sprout に変更
    const ok = level === 'SPROUT' || level === 'HARVEST';
    return `<li class="flex items-center gap-2 text-sm ${ok ? 'text-purple-700 font-bold' : 'text-gray-400'}">
                  <span>${ok ? '✅' : '⬜'}</span> ${k} (Sprout必須)
                </li>`;
  }).join('')}
            </ul>
            <p class="text-xs text-purple-600 font-bold">👉 店舗の責任者として、人・数字・規律・環境のすべてを高水準で担うことを条件とします。</p>
          </div>
        </div>

        <div class="bg-white rounded-lg border border-orange-200 shadow-sm overflow-hidden">
          <div class="bg-orange-50 px-4 py-3 flex justify-between items-center">
            <h4 class="font-bold text-orange-800">🔹 SV・統括</h4>
            <span class="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-1 rounded">目安: +7.0万円〜</span>
          </div>
          <div class="p-4">
            <div class="mb-4">
              <p class="text-xs font-bold text-gray-500 mb-2">業務内容 (Harvest必須)</p>
              <ul class="space-y-1 mb-3">
                ${['原価・利益管理', 'コンプライアンス・ガバナンス', '互いを思うチームワーク', '未来につなぐ人材評価', '衛生・安全管理'].map(k => {
    const level = state.workLevels[k] || 'SEED';
    const ok = level === 'HARVEST';
    return `<li class="flex items-center gap-2 text-sm ${ok ? 'text-orange-700 font-bold' : 'text-gray-400'}">
                      <span>${ok ? '✅' : '⬜'}</span> ${k} ${k === 'コンプライアンス・ガバナンス' ? '(労務・会社法含む)' : ''}
                    </li>`;
  }).join('')}
              </ul>
            </div>
            
            <div class="bg-orange-50 p-3 rounded mb-3">
              <p class="text-xs font-bold text-orange-800 mb-2">📚 研修 (必須修了)</p>
              <ul class="space-y-1 text-sm text-gray-700">
                <li>• 財務研修 <span class="text-xs text-gray-500">(PLに加えBSを理解)</span></li>
                <li>• 会社法・ガバナンス研修 <span class="text-xs text-gray-500">(役員の責任)</span></li>
                <li>• 市場分析・戦略研修 <span class="text-xs text-gray-500">(データ経営)</span></li>
              </ul>
            </div>
            <p class="text-xs text-orange-600 font-bold">👉 SVは店舗責任者としての基盤に加え、経営に参画する基礎知識を修めることを必須条件とします。</p>
          </div>
        </div>

      </div>

      <div class="bg-gray-800 text-white rounded-xl p-8 text-center shadow-lg">
        <h3 class="text-xl font-bold mb-4">制度メッセージ</h3>
        <p class="leading-relaxed mb-4">
          役職給は「責任を担える力の証」として支給されます。<br>
          副店長までは成長段階として <strong>Sprout</strong> 到達を条件とし、<br>
          店長・シェフからは全領域で <strong>Sprout</strong> 到達を必須とします。
        </p>
        <p class="text-orange-300 font-bold">
          SVは店舗責任の上に、必須研修修了をもって<br>会社経営の一員として認められます。
        </p>
      </div>

    </div>
  `;
}

function renderMyUnique() {
  const skillTotal = getSkillTotal();
  const challengePay = state.myUniqueChallenge || 0;
  const totalUnique = skillTotal + challengePay;

  // レベル定義のマスタ
  const levels = {
    'store': { label: '① 店舗内活躍', max: 30000, color: 'blue' },
    'performance': { label: '② 業績貢献', max: 50000, color: 'orange' },
    'brand': { label: '③ 会社貢献', max: 100000, color: 'purple' }
  };

  return `
    <div class="space-y-8 max-w-4xl mx-auto pb-20">
      
      <div class="bg-gradient-to-br from-purple-700 to-indigo-800 text-white rounded-xl shadow-xl p-8 relative overflow-hidden">
        <div class="relative z-10">
          <h2 class="text-3xl font-bold mb-2 flex items-center gap-3">
            <span>✨</span> MY UNIQUE
          </h2>
          <p class="text-indigo-100 opacity-90">スペシャリティ給は6ヶ月に1度見直しを行い、スキルを持っていることではなく、活かしていることを評価します。</p>
          
          <div class="mt-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-6 py-3 inline-block">
            <div class="text-xs text-indigo-200 font-bold tracking-wider uppercase mb-1">Total Unique Pay</div>
            <div class="text-4xl font-extrabold text-white tracking-tight">${formatNumber(totalUnique)}<span class="text-lg font-medium ml-1">円</span></div>
          </div>
        </div>
        <div class="absolute right-0 top-0 text-9xl opacity-10 transform translate-x-1/3 -translate-y-1/3">💎</div>
      </div>

      <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div class="bg-pink-50 px-6 py-4 border-b border-pink-100 flex justify-between items-center">
          <h3 class="font-bold text-pink-800 flex items-center gap-2">
             <span class="bg-pink-200 text-pink-700 p-1 rounded text-lg">🔥</span> 
             チャレンジ目標 (One Challenge)
          </h3>
          <span class="text-xs font-bold bg-pink-100 text-pink-600 px-2 py-1 rounded">達成時 5,000円</span>
        </div>
        
        <div class="p-6">
           <p class="text-sm text-gray-600 mb-4">
             個人的な目標を設定し、上長と合意・達成することで支給されます。<br>
             <span class="text-xs text-gray-400">例：半年で資格取得、毎日ブログ更新、ダイエット目標達成など</span>
           </p>
           
           <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-pink-200 transition-all">
             <label class="block text-xs font-bold text-gray-500 mb-1">目標内容</label>
             <textarea id="challengeTextInput" onchange="updateChallengeText()" 
               class="w-full border-none bg-transparent text-gray-800 text-sm focus:ring-0 resize-none" 
               rows="2" placeholder="ここに目標を入力してください...">${state.challengeText}</textarea>
           </div>
           
           <div class="mt-4 flex items-center gap-3 bg-white p-3 rounded border border-pink-100">
             <div class="flex items-center h-5">
               <input type="checkbox" id="chkChallenge" ${state.challengeDialogChecked ? 'checked' : ''} onchange="toggleChallengeDialog()" class="w-5 h-5 text-pink-600 border-gray-300 rounded focus:ring-pink-500 cursor-pointer">
             </div>
             <div class="ml-2">
               <label for="chkChallenge" class="font-bold text-gray-700 cursor-pointer select-none text-sm">上長承認済み（達成）</label>
               <p class="text-xs text-gray-500">チェックを入れると <span class="font-bold text-pink-600">+5,000円</span> が加算されます</p>
             </div>
             
           </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div class="bg-purple-50 px-6 py-4 border-b border-purple-100 flex justify-between items-center">
          <h3 class="font-bold text-purple-800 flex items-center gap-2">
             <span class="bg-purple-200 text-purple-700 p-1 rounded text-lg">🏆</span> 
             スペシャリティ給 (Specialty Pay)
          </h3>
          <span class="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-1 rounded">最大5つ / Max 10万円</span>
        </div>

        <div class="p-6">
          <details class="mb-6 group border rounded-lg bg-white overflow-hidden">
            <summary class="list-none cursor-pointer bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-4 font-bold text-sm flex justify-between items-center transition-colors">
              <span>📖 評価レベルの定義と目安（登録前に確認）</span>
              <span class="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div class="p-4 space-y-4 text-sm text-gray-700 border-t">
              <div class="border-l-4 border-blue-400 pl-4">
                <h4 class="font-bold text-blue-800">① 店舗内活躍レベル（〜30,000円）</h4>
                <p class="text-xs mt-1">定義：スキルを活かして店舗内で成果を出している。</p>
                <p class="text-xs text-gray-500 mt-1">例：ソムリエ資格でワイン提案、DIY改善、顧客体験(Harvest)</p>
              </div>
              <div class="border-l-4 border-orange-400 pl-4">
                <h4 class="font-bold text-orange-800">② 業績貢献レベル（〜50,000円）</h4>
                <p class="text-xs mt-1">定義：スキルを活かして店舗や事業の業績に大きく貢献している。</p>
                <p class="text-xs text-gray-500 mt-1">例：メーカーズディナー開催、新商品開発、原価管理(Harvest)</p>
              </div>
              <div class="border-l-4 border-purple-400 pl-4">
                <h4 class="font-bold text-purple-800">③ 会社貢献・ブランディングレベル（〜100,000円）</h4>
                <p class="text-xs mt-1">定義：会社全体のブランドや価値向上に貢献している。</p>
                <p class="text-xs text-gray-500 mt-1">例：外部講師、メディア出演、全社PJTリード</p>
              </div>
              <div class="bg-gray-100 p-3 rounded text-xs text-gray-600 mt-2">
                <strong>※ 登録条件：</strong><br>
                関連する業務が「HARVEST」であるか、または人間力の獲得星数が「MAX」になっている必要があります。
              </div>
            </div>
          </details>

          <div class="space-y-3 mb-8">
            ${state.skills.length > 0 ? state.skills.map(s => `
              <div class="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex-1 w-full">
                   <div class="flex items-center gap-2 mb-1">
                     <span class="text-xs font-bold text-white px-2 py-0.5 rounded ${s.tier === 'store' ? 'bg-blue-500' : s.tier === 'performance' ? 'bg-orange-500' : 'bg-purple-600'}">
                       ${(levels[s.tier] || levels.store).label}
                     </span>
                   </div>
                   <div class="font-bold text-gray-800 text-lg">${s.name}</div>
                </div>
                <div class="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end mt-3 sm:mt-0">
                  <span class="font-bold text-purple-700 text-xl">${formatNumber(s.amount || 0)}円</span>
                  <button onclick="removeSkill(${s.id})" class="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors" title="削除">
                    🗑️
                  </button>
                </div>
              </div>
            `).join('') : `
              <div class="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p class="text-gray-400 text-sm font-bold">登録されたスキルはありません</p>
              </div>
            `}
          </div>

          ${state.skills.length < 5 ? `
            <div class="bg-purple-50 p-5 rounded-xl border border-purple-100 shadow-inner">
              <h4 class="font-bold text-purple-900 mb-4 flex items-center gap-2">
                <span>➕</span> 新しいスキルを追加
              </h4>
              
              <div class="grid grid-cols-1 gap-4 mb-4">
                <div>
                   <label class="block text-xs font-bold text-purple-700 mb-1">スキル名称</label>
                   <input id="skillName" placeholder="例: ワインソムリエ、語学力、調理技術" class="w-full border border-purple-200 p-3 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none">
                </div>

                <div>
                   <label class="block text-xs font-bold text-purple-700 mb-1">評価レベル（上限額）</label>
                   <select id="skillTier" class="w-full border border-purple-200 p-3 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none bg-white cursor-pointer" onchange="const limit=this.options[this.selectedIndex].dataset.limit; document.getElementById('limitDisplay').innerText = parseInt(limit).toLocaleString();">
                     <option value="store" data-limit="30000">① 店舗内活躍レベル (上限 30,000円)</option>
                     <option value="performance" data-limit="50000">② 業績貢献レベル (上限 50,000円)</option>
                     <option value="brand" data-limit="100000">③ 会社貢献レベル (上限 100,000円)</option>
                   </select>
                </div>

                <div>
                   <label class="block text-xs font-bold text-purple-700 mb-1">
                     評価金額 (5,000円単位 / 上限 <span id="limitDisplay">30,000</span>円)
                   </label>
                   <div class="relative">
                     <input id="skillAmt" type="number" placeholder="0" step="5000" min="5000" class="w-full border border-purple-200 p-3 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none font-bold text-right pr-10">
                     <span class="absolute right-4 top-3 text-gray-500 font-bold">円</span>
                   </div>
                </div>
              </div>

              <div class="bg-white p-3 rounded border border-purple-200 mb-4 shadow-sm">
                <label class="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" id="skillCondition" class="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500">
                  <div class="text-sm text-gray-700">
                    <span class="font-bold text-purple-800">登録条件の確認</span><br>
                    <span class="text-xs text-gray-500">
                      関連業務が「HARVEST」である、または関連人間力が「MAX」であることを確認しました。
                    </span>
                  </div>
                </label>
              </div>

              <button onclick="addSkill()" class="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold shadow-md transition-transform transform active:scale-95 flex items-center justify-center gap-2">
                <span>🏆</span> この内容で登録する
              </button>
            </div>
          ` : `
            <div class="text-center text-sm text-red-500 font-bold bg-red-50 p-3 rounded-lg border border-red-100">
              🚫 最大登録数（5つ）に達しました
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderEvaluation() {
  return `
    <div class="max-w-4xl mx-auto pb-20 fade-in space-y-16">
      
      <div class="text-center py-10">
        <span class="text-indigo-600 font-bold tracking-widest text-xs uppercase mb-3 block">SALARY FORMULA</span>
        <h1 class="text-3xl md:text-4xl font-bold text-gray-800 font-serif leading-tight mb-4">
          あなたの給料は、<br>
          <span class="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">3つの要素</span>で決まる。
        </h1>
      </div>

      <section class="relative">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          <div class="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-yellow-400 flex flex-col items-center text-center relative group hover:-translate-y-1 transition-transform">
            <div class="absolute -top-4 bg-yellow-400 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">1</div>
            <div class="text-4xl mb-3">⭐</div>
            <h3 class="text-xl font-bold text-gray-800 mb-2">基本給</h3>
            <p class="text-sm text-gray-700 font-medium">あなたの<br><strong class="text-yellow-600 text-lg">「人間力」</strong><br>の成長を評価</p>
          </div>
          <div class="hidden md:flex absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 text-gray-300 text-4xl font-bold">＋</div>
          <div class="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-pink-500 flex flex-col items-center text-center relative group hover:-translate-y-1 transition-transform">
            <div class="absolute -top-4 bg-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">2</div>
            <div class="text-4xl mb-3">🚀</div>
            <h3 class="text-xl font-bold text-gray-800 mb-2">MY Unique</h3>
            <p class="text-sm text-gray-700 font-medium">あなたの<br><strong class="text-pink-600 text-lg">「個性・挑戦」</strong><br>を評価</p>
          </div>
          <div class="hidden md:flex absolute top-1/2 left-2/3 -translate-x-1/2 -translate-y-1/2 text-gray-300 text-4xl font-bold">＋</div>
          <div class="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-blue-600 flex flex-col items-center text-center relative group hover:-translate-y-1 transition-transform">
            <div class="absolute -top-4 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">3</div>
            <div class="text-4xl mb-3">👔</div>
            <h3 class="text-xl font-bold text-gray-800 mb-2">役職給</h3>
            <p class="text-sm text-gray-700 font-medium">あなたが背負う<br><strong class="text-blue-600 text-lg">「責任」</strong><br>を評価</p>
          </div>
        </div>
      </section>

      <section class="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div class="bg-gradient-to-r from-gray-800 to-gray-700 text-white p-6 border-b border-gray-600 flex items-center gap-3">
          <span class="text-3xl">⭐</span>
          <div>
            <h2 class="text-xl font-bold">星付与の基本ルール</h2>
            <p class="text-gray-300 text-xs mt-1">Basic Rules of Star Allocation</p>
          </div>
        </div>
        
        <div class="p-8 space-y-12">

          <div>
            <h3 class="text-lg font-bold text-gray-800 mb-4 border-l-4 border-yellow-400 pl-3">1. 星は何を表しているのか</h3>
            <div class="bg-yellow-50 p-6 rounded-xl border border-yellow-100">
              <p class="text-gray-800 font-bold text-lg mb-2 text-center">星は「人間力」が磨かれた証です。</p>
              <p class="text-gray-600 text-sm leading-relaxed mb-4 text-center">
                星（★）は業務の「完了マーク」ではありません。<br>
                その仕事に取り組むプロセスで育まれた<br>
                <strong class="text-yellow-600 text-lg">「人間としての力（Human Power）」</strong>を可視化したものです。
              </p>
              <div class="bg-white p-4 rounded-lg text-center text-sm text-gray-700 border border-yellow-200">
                技術だけでなく、<span class="font-bold text-gray-900">心と姿勢の成長</span>。<br>
                それが、私たちの考える本当の評価です。
              </div>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-bold text-gray-800 mb-4 border-l-4 border-yellow-400 pl-3">2. 成長の3つのステップ</h3>
            <p class="text-sm text-gray-600 mb-4">評価には、植物が育つように3つの段階があります。</p>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="bg-gray-50 p-5 rounded-xl border border-gray-300 relative">
                <div class="absolute top-0 right-0 bg-gray-400 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">START</div>
                <div class="text-3xl mb-2">🟤</div>
                <h4 class="font-bold text-gray-700 text-lg mb-1">SEED <span class="text-xs font-normal">（種）</span></h4>
                <p class="text-xs font-bold text-gray-500 mb-3">プロとしての約束</p>
                <div class="text-sm text-gray-600 space-y-2">
                  <p><strong>状態：</strong>挨拶、時間厳守など「当たり前」ができている。</p>
                  <p><strong>星：</strong>なし</p>
                  <p class="text-xs text-gray-500 border-t border-gray-200 pt-2">成長の評価以前の「信頼の土台」です。</p>
                </div>
              </div>

              <div class="bg-white p-5 rounded-xl border-2 border-green-200 relative shadow-sm">
                <div class="text-3xl mb-2">🌱</div>
                <h4 class="font-bold text-green-700 text-lg mb-1">SPROUT <span class="text-xs font-normal">（芽生え）</span></h4>
                <p class="text-xs font-bold text-green-600 mb-3">可能性の発見</p>
                <div class="text-sm text-gray-600 space-y-2">
                  <p><strong>状態：</strong>その業務に「取り組めるようになった」。</p>
                  <div class="bg-green-50 text-green-800 font-bold px-2 py-1 rounded inline-block">星：0.5個</div>
                  <p class="text-xs text-gray-500 border-t border-green-100 pt-2">色々な業務に触れ、可能性を広げる時期。</p>
                </div>
              </div>

              <div class="bg-gradient-to-br from-yellow-50 to-orange-50 p-5 rounded-xl border-2 border-orange-300 relative shadow-md transform md:-translate-y-2">
                <div class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">GOAL</div>
                <div class="text-3xl mb-2">🌾</div>
                <h4 class="font-bold text-orange-700 text-lg mb-1">HARVEST <span class="text-xs font-normal">（収穫）</span></h4>
                <p class="text-xs font-bold text-orange-600 mb-3">実力の証明</p>
                <div class="text-sm text-gray-600 space-y-2">
                  <p><strong>状態：</strong>極めた。他者に教え、良い影響を与えられる。</p>
                  <div class="bg-orange-100 text-orange-800 font-bold px-2 py-1 rounded inline-block">星：1.0個</div>
                  <p class="text-xs text-gray-500 border-t border-orange-200 pt-2">あなただけの「強み」として定着した証。</p>
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2 text-right">※SproutからHarvestへは「置き換え（進化）」です（0.5+1=1.5にはなりません）</p>
          </div>

          <div>
            <h3 class="text-lg font-bold text-gray-800 mb-4 border-l-4 border-yellow-400 pl-3">3. 星が増える仕組み（広がりと深まり）</h3>
            <div class="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
              <p class="text-center font-bold text-indigo-900 mb-6">一つの仕事は、いくつもの人間力を育てます。</p>
              
              <div class="flex flex-col md:flex-row items-center justify-center gap-4">
                <div class="bg-white p-4 rounded-lg shadow text-center border border-gray-200 w-full md:w-1/3">
                  <div class="text-2xl mb-1">🧹</div>
                  <div class="font-bold text-gray-800">業務</div>
                  <div class="text-xs text-gray-500">例：衛生・安全管理</div>
                </div>
                
                <div class="text-2xl text-indigo-300 hidden md:block">➔</div>
                <div class="text-2xl text-indigo-300 md:hidden">⬇</div>

                <div class="flex flex-col gap-2 w-full md:w-1/2">
                  <div class="bg-white px-3 py-2 rounded shadow-sm border-l-4 border-yellow-400 flex items-center gap-2">
                    <span class="text-yellow-500">✨</span>
                    <span class="text-sm font-bold text-gray-700">倫理観</span>
                    <span class="text-xs text-gray-400 ml-auto">正しくある心</span>
                  </div>
                  <div class="bg-white px-3 py-2 rounded shadow-sm border-l-4 border-blue-400 flex items-center gap-2">
                    <span class="text-blue-500">✨</span>
                    <span class="text-sm font-bold text-gray-700">継続力</span>
                    <span class="text-xs text-gray-400 ml-auto">続ける強さ</span>
                  </div>
                  <div class="bg-white px-3 py-2 rounded shadow-sm border-l-4 border-pink-400 flex items-center gap-2">
                    <span class="text-pink-500">✨</span>
                    <span class="text-sm font-bold text-gray-700">美意識</span>
                    <span class="text-xs text-gray-400 ml-auto">感じる感性</span>
                  </div>
                </div>
              </div>
              
              <p class="text-xs text-indigo-800 mt-6 text-center">
                業務をクリアするたびに、関連する複数の「人間力」に星が灯ります。<br>
                仕事を頑張るほど、人間としての魅力が多面的に輝きだす仕組みです。
              </p>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-bold text-gray-800 mb-4 border-l-4 border-yellow-400 pl-3">4. 星の上限とキャリア</h3>
            <div class="flex flex-col md:flex-row gap-6">
              <div class="flex-1">
                <p class="text-sm text-gray-700 mb-3">
                  人間力は全20項目。1項目につき最大4星。<br>
                  <strong>満点は80星</strong>です。あなたらしい形を描いてください。
                </p>
                <div class="space-y-3">
                  <div class="bg-blue-50 p-3 rounded border border-blue-100">
                    <span class="text-xs font-bold text-blue-600 block mb-1">新人〜中堅期</span>
                    <p class="text-sm text-blue-900">多くの業務でSprout(0.5)を集め、<br>器を<strong>「広く」</strong>する。</p>
                  </div>
                  <div class="bg-purple-50 p-3 rounded border border-purple-100">
                    <span class="text-xs font-bold text-purple-600 block mb-1">店長・シェフ期</span>
                    <p class="text-sm text-purple-900">得意分野でHarvest(1.0)を増やし、<br>器を<strong>「深く」</strong>満たす。</p>
                  </div>
                </div>
              </div>
              
              <div class="flex-1">
                <div class="bg-gray-800 text-white text-xs font-bold px-3 py-2 rounded-t-lg">星の数と基本給レンジ</div>
                <table class="w-full text-xs border-collapse bg-white shadow-sm">
                  <tbody class="divide-y divide-gray-200">
                    <tr><td class="p-2">0~10</td><td class="p-2">ルーキー</td><td class="p-2 font-bold text-right">25~27万</td></tr>
                    <tr><td class="p-2">10~24</td><td class="p-2">コアスタッフ</td><td class="p-2 font-bold text-right">27~33万</td></tr>
                    <tr><td class="p-2">25~34</td><td class="p-2">店長・熟練</td><td class="p-2 font-bold text-right">33~40万</td></tr>
                    <tr><td class="p-2">35~45</td><td class="p-2">SV・統括</td><td class="p-2 font-bold text-right">40~55万</td></tr>
                    <tr><td class="p-2 text-red-600 font-bold">45〜</td><td class="p-2">上限なし</td><td class="p-2 font-bold text-right text-red-600">55万〜</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-bold text-gray-800 mb-4 border-l-4 border-yellow-400 pl-3">5. その先のステージへ（スペシャリティ）</h3>
            <div class="bg-gradient-to-r from-gray-100 to-gray-50 p-6 rounded-xl border border-gray-200 relative overflow-hidden">
              <div class="absolute right-0 top-0 text-6xl opacity-10 grayscale">💎</div>
              <p class="text-sm text-gray-700 leading-relaxed mb-4">
                星が満ちた時、それは<strong>「あなただけの武器」</strong>に変わります。<br>
                その領域に達したスキルは、基本給（星）の枠組みを超え、<br>
                <strong class="text-indigo-600">「スペシャリティ給（MY Unique）」</strong>として評価されます。
                <br>
                <strong class="text-sm text-gray-700">スペシャリティ給は6ヶ月に1度見直しを行い、単にスキルを保有しているかではなく、そのスキルを実際に活かしているかを評価します。</strong>
              </p>
              <div class="flex gap-2 justify-center text-xs font-bold text-gray-500">
                <span class="bg-white px-2 py-1 rounded shadow-sm">店舗貢献</span>
                <span class="bg-white px-2 py-1 rounded shadow-sm">業績貢献</span>
                <span class="bg-white px-2 py-1 rounded shadow-sm">会社貢献</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white p-6 rounded-xl shadow-md border-t-4 border-pink-500">
          <h3 class="font-bold text-gray-800 mb-2">MY Unique（ユニーク給）</h3>
          <p class="text-sm text-gray-600 mb-4">「個性」と「挑戦」を評価。チャレンジ給とスペシャリティ給。</p>
          <button onclick="switchTab('myunique')" class="text-pink-600 text-sm font-bold hover:underline">詳細を見る →</button>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-600">
          <h3 class="font-bold text-gray-800 mb-2">役職給</h3>
          <p class="text-sm text-gray-600 mb-4">チームを率いる「責任」への対価。店長＋3万円など。</p>
          <button onclick="switchTab('role')" class="text-blue-600 text-sm font-bold hover:underline">詳細を見る →</button>
        </div>
      </section>

      <section class="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl shadow-xl overflow-hidden border-2 border-red-200">
        <div class="bg-red-600 text-white p-6 flex items-center gap-3">
          <span class="text-3xl">⚠️</span>
          <div>
            <h2 class="text-xl font-bold">就業規則・服務規律に関する重要ルール</h2>
            <p class="text-red-100 text-xs mt-1">信頼・安全・成長を守るための約束</p>
          </div>
        </div>

        <div class="p-8 space-y-8">
          
          <div>
            <h3 class="text-lg font-bold text-gray-800 border-l-4 border-red-500 pl-3 mb-3">1. 基本方針</h3>
            <p class="text-gray-700 text-sm leading-relaxed">
              バルニバービのスタッフは「なりたい自分になる」という理念のもと、誠実で責任ある行動が求められます。<br>
              ルールは縛るためではなく、信頼を守るためにあります。<br>
              <strong class="text-red-700">人間力が育まれていても、ルールを守れない状態が続く場合は、給与査定・ランク評価に影響します。</strong>
            </p>
          </div>

          <div>
            <h3 class="text-lg font-bold text-gray-800 border-l-4 border-red-500 pl-3 mb-3">2. 違反時の対応と給与への影響</h3>
            
            <div class="space-y-4">
              <div class="bg-white p-4 rounded-lg border border-red-100 shadow-sm">
                <h4 class="font-bold text-red-800 mb-2 flex items-center gap-2"><span class="text-lg">📉</span> コンプライアンス要件（評価への反映）</h4>
                <p class="text-sm text-gray-600 mb-3">「規律遵守」は評価の前提条件です。高い成果を上げていても、規律違反が継続する場合は以下の通り反映します。</p>
                <ul class="text-sm space-y-2">
                  <li class="flex items-start gap-2">
                    <span class="text-red-500 font-bold">●</span>
                    <span class="text-gray-700"><strong>改善が見られない場合（半年経過）：</strong><br>獲得した星の数にかかわらず、評価ランクは自動的に<strong class="text-red-600 bg-red-50 px-1">現在等級の「下限」</strong>とみなされます。</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="text-red-500 font-bold">●</span>
                    <span class="text-gray-700"><strong>改善が見られない場合（1年経過）：</strong><br>適格性を欠くと判断し、<strong class="text-red-600 bg-red-50 px-1">1ランク下の等級へ降格</strong>となります。基本給も改定されます。</span>
                  </li>
                </ul>
              </div>

              <div class="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 class="font-bold text-red-900 mb-2 flex items-center gap-2"><span class="text-lg">🚫</span> 重大な違反時の対応（処分）</h4>
                <ul class="text-sm space-y-2">
                  <li class="flex items-start gap-2">
                    <span class="text-red-700 font-bold">・</span>
                    <span class="text-gray-800"><strong>役職の即時解任：</strong>店長・リーダー等の適格性を喪失したとみなし、即時に解任・手当停止となります。</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="text-red-700 font-bold">・</span>
                    <span class="text-gray-800"><strong>懲戒処分：</strong>就業規則に基づき、減給・出勤停止・懲戒解雇等の処分を決定します。</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-bold text-gray-800 border-l-4 border-red-500 pl-3 mb-3">3. 対象となる違反例（抜粋）</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div class="flex items-center gap-2 p-2 bg-gray-100 rounded text-gray-700"><span class="text-red-500">⚠</span> 遅刻・無断欠勤・報告義務違反の常習化</div>
              <div class="flex items-center gap-2 p-2 bg-gray-100 rounded text-gray-700"><span class="text-red-500">⚠</span> コンプライアンス違反（労務・衛生・情報漏洩等）</div>
              <div class="flex items-center gap-2 p-2 bg-gray-100 rounded text-gray-700"><span class="text-red-500">⚠</span> 本部業務の提出遅延・連絡不通（役職者の不履行）</div>
              <div class="flex items-center gap-2 p-2 bg-gray-100 rounded text-gray-700"><span class="text-red-500">⚠</span> ハラスメント行為、金銭・備品の不正利用</div>
            </div>
          </div>

          <div class="bg-green-50 p-5 rounded-xl border border-green-200">
            <h3 class="text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
              <span class="text-xl">🔄</span> 4. 回復・再評価のプロセス
            </h3>
            <p class="text-sm text-gray-700 mb-2">
              違反や怠慢が改善され、<strong class="text-green-700">半年間の安定した実績と誠実な行動</strong>が確認できた場合、元のレンジ・役職給を回復可能とします。
            </p>
            <p class="text-xs text-gray-500">
              「失敗を成長に変える姿勢」も評価対象とし、再スタートを正当に支援します。
            </p>
          </div>

          <div class="text-center pt-4">
            <p class="text-gray-800 font-bold mb-2">人間力が高い人ほど、誠実さ・規律・信頼が伴う。</p>
            <p class="text-sm text-gray-600">
              この制度は、罰ではなく信頼を守る仕組みです。<br>
              ルールを守り、成長と信頼のバランスを大切にした人にこそ、評価と報酬が還元されます。
            </p>
          </div>

        </div>
      </section>

    </div>
  `;
}
function renderWorks() {
  const groupedWorks = {};
  WORKS.forEach(w => {
    if (!groupedWorks[w.group]) groupedWorks[w.group] = [];
    groupedWorks[w.group].push(w);
  });

  return `
    <div class="space-y-6 relative">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-lg shadow p-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">業務チェックリスト</h2>
          <p class="text-sm text-gray-500">あなたの現在の習熟度をチェックしてください</p>
        </div>
        <button onclick="openResetModal()" class="flex items-center gap-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold">
          🗑️ 全てリセット
        </button>
      </div>

      ${Object.entries(groupedWorks).map(([groupName, works]) => `
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-xl font-bold text-blue-700 mb-4 border-b pb-2">${groupName}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${works.map(w => {
    const level = state.workLevels[w.key] || 'SEED';
    const isInProgress = state.workInProgress[w.key];
    const isSpirit = w.isSpirit || false;
    return `
                <div class="bg-white rounded-lg shadow-md border ${level !== 'SEED' ? (isSpirit ? 'border-l-4 border-red-500' : 'border-l-4 border-yellow-500') : isInProgress ? 'border-l-4 border-blue-500' : 'border-gray-200'} p-4 flex flex-col h-full">
                  <div class="flex-1">
                    <div class="flex justify-between items-start mb-2">
                      <div class="font-semibold text-gray-800">${w.key}</div>
                      ${getLevelBadge(level, isSpirit)}
                    </div>
                    <button onclick="openWorkDetail('${w.key}')" class="text-xs text-blue-600 hover:text-blue-800 font-medium mb-3">📖 定義を見る</button>
                  </div>
                  <div class="border-t pt-3 bg-gray-50 -mx-4 -mb-4 px-4 pb-3 rounded-b-lg mt-2">
                    <div class="flex items-center gap-2 mb-3">
                      <input type="checkbox" id="chk_${w.key}" ${isInProgress ? 'checked' : ''} onchange="toggleWorkInProgress('${w.key}')" class="w-4 h-4 text-blue-600 rounded">
                      <label for="chk_${w.key}" class="text-xs font-bold text-blue-700 cursor-pointer">取り組む業務に設定</label>
                    </div>
                    ${isSpirit ? `
                      <div class="flex items-center gap-2 p-2 bg-white rounded border border-red-100">
                        <input type="checkbox" ${level !== 'SEED' ? 'checked' : ''} onchange="changeWorkLevel('${w.key}', this.checked ? 'SPROUT' : 'SEED')" class="w-5 h-5 text-red-600 rounded">
                        <span class="font-bold text-red-700 text-sm">達成チェック</span>
                      </div>
                    ` : `
                      <select class="w-full text-sm border border-gray-300 rounded p-1 bg-white" onchange="changeWorkLevel('${w.key}', this.value)">
                        <option value="SEED" ${level === 'SEED' ? 'selected' : ''}>⚪️ SEED (未達成)</option>
                        <option value="SPROUT" ${level === 'SPROUT' ? 'selected' : ''}>🌱 SPROUT (★0.5)</option>
                        <option value="HARVEST" ${level === 'HARVEST' ? 'selected' : ''}>🌾 HARVEST (★1.0)</option>
                      </select>
                    `}
                  </div>
                </div>
              `;
  }).join('')}
          </div>
        </div>
      `).join('')}

      ${state.resetModalOpen ? `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div class="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
            <h3 class="text-xl font-bold text-gray-800 mb-2">リセットしますか？</h3>
            <p class="text-gray-600 mb-6 text-sm">全てのチェックが未達成に戻ります。</p>
            <div class="flex gap-3 justify-center">
              <button onclick="closeResetModal()" class="flex-1 bg-gray-100 py-2 rounded font-bold text-gray-700">キャンセル</button>
              <button onclick="executeReset()" class="flex-1 bg-red-600 py-2 rounded font-bold text-white">リセット</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// 他の単純なレンダリング関数 (Philosophy, Resources, FAQ) は省略せず記述
// フィロソフィー画面の描画
function renderPhilosophy() {
  // PHILOSOPHIES配列の中身を1つずつ取り出してHTMLにする
  const listHtml = PHILOSOPHIES.map(item => `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <h3 class="text-lg font-bold text-gray-800 mb-3 border-l-4 border-amber-400 pl-3 leading-relaxed">
        ${item.title}
      </h3>
      <p class="text-gray-600 text-sm leading-7">
        ${item.desc}
      </p>
    </div>
  `).join('');

  return `
    <div class="max-w-4xl mx-auto pb-20 fade-in">
      <div class="text-center mb-10">
        <h2 class="text-3xl font-bold text-gray-800 mb-4 font-serif">Philosophy</h2>
        <p class="text-gray-500">私たちの行動指針と価値観</p>
      </div>
      
      <div class="space-y-4">
        ${listHtml}
      </div>
      
      <div class="mt-12 p-8 bg-gray-800 text-white rounded-xl text-center shadow-lg">
        <p class="text-lg leading-relaxed font-medium">
          これらのフィロソフィーは、<br>
          私たちが日々の仕事を通じて<br>
          「なりたい自分になる」ための道しるべです。
        </p>
      </div>
    </div>
  `;
}

// プロローグ画面 (完全版)
// プロローグ画面 (ストーリーモード)
function renderStory() {
  // マスタデータ
  const archetypes = {
    'CHARMING': { label: '人に愛される人', desc: '相手の心に響く表現を持ち、ファンや仲間を惹きつける存在。', icon: '💖', color: 'pink', relatedPowers: [{ name: '表現力', quote: '共鳴を生む表現者', definition: '自分や他者の思いを届く形に変えて共鳴を生む力。', outcomes: ['相手に合わせて想いを届ける', '信頼を築く'] }], workIds: ['heart_fill', 'space_design', 'marketing'] },
    'LEADER': { label: '人を育てるリーダー', desc: '未来を描き、周囲を巻き込んで新しい道を切り拓く存在。', icon: '🤝', color: 'blue', relatedPowers: [{ name: 'ビジョン構築力', quote: '未来を描く人', definition: '未来の姿を描き、道を見出す力。', outcomes: ['先を見据えて行動', '人を導く'] }], workIds: ['agency_leader', 'evaluation', 'cost_profit_leader', 'negotiation'] },
    'SPECIALIST': { label: '道を極めるプロ', desc: 'あらゆる経験を糧にし、本質を突き詰める存在。', icon: '🔥', color: 'orange', relatedPowers: [{ name: '探究・意味づけ力', quote: '成長に変える力', definition: '本質を探求し、価値や学びを見出す力。', outcomes: ['失敗を糧にする', '価値観で判断する'] }], workIds: ['agency_pro', 'quality_heart', 'cost_profit_pro', 'menu_planning', 'market_analysis'] }
  };

  const worksData = {
    'heart_fill': { title: '心を満たす体験', powerTag: '表現力', seed: { desc: '笑顔・声のトーン・姿勢の基準を守れている。' }, sprout: { desc: '“心地よさ”を自分の言動でつくる意識がある。' }, harvest: { desc: '忙しいときほど空気を整え、感動を生んでいる。' } },
    'space_design': { title: '空間と空気のデザイン', powerTag: '表現力', seed: { desc: '清潔感を保てている。' }, sprout: { desc: 'お客様に合わせて場の流れをつくれる。' }, harvest: { desc: '店全体の空気の乱れを察知し整えられる。' } },
    'marketing': { title: 'マーケティング領域', powerTag: '表現力', seed: { desc: '情報を正しく伝えられている。' }, sprout: { desc: '相手に応じた販促を実行できている。' }, harvest: { desc: '店舗全体の販促を企画し成果を出している。' } },
    'agency_leader': { title: '主体性の発揮', powerTag: 'ビジョン構築力', seed: { desc: '役割を理解して行動している。' }, sprout: { desc: '自ら考え改善行動ができている。' }, harvest: { desc: 'チームの課題を解決し組織に貢献している。' } },
    'evaluation': { title: '未来につなぐ人材評価', powerTag: 'ビジョン構築力', seed: { desc: '人の変化を見逃さない。' }, sprout: { desc: '公平に評価し次のチャンスを示せる。' }, harvest: { desc: 'チームの強みを最大化し部下を導ける。' } },
    'cost_profit_leader': { title: '原価・利益管理', powerTag: 'ビジョン構築力', seed: { desc: 'ルール通り管理できている。' }, sprout: { desc: '数値をオペレーションに反映できる。' }, harvest: { desc: '利益設計をリードし戦略に活かせる。' } },
    'negotiation': { title: '取引先対応・交渉', powerTag: 'ビジョン構築力', seed: { desc: '礼儀正しく対応できている。' }, sprout: { desc: '双方に良い条件を調整できる。' }, harvest: { desc: '取引先と新しい価値を共創できる。' } },
    'agency_pro': { title: '主体性の発揮', powerTag: '探究力', seed: { desc: '役割を遂行している。' }, sprout: { desc: '工夫を加え質を高めている。' }, harvest: { desc: '独自の仕事術で成果を出している。' } },
    'quality_heart': { title: '心を込めたクオリティ', powerTag: '探究力', seed: { desc: '基準通り実行できる。' }, sprout: { desc: 'ベストな状態に調整できる。' }, harvest: { desc: '期待を超える感動を生んでいる。' } },
    'cost_profit_pro': { title: '原価・利益管理', powerTag: '探求力', seed: { desc: '正確に管理できている。' }, sprout: { desc: 'ロス等の原因を解決できる。' }, harvest: { desc: '独自の管理手法で利益を生んでいる。' } },
    'menu_planning': { title: 'メニュー開発', powerTag: '探求力', seed: { desc: '商品の狙いを理解している。' }, sprout: { desc: '誰のために何を提供するか設計できる。' }, harvest: { desc: 'PL視点を持ちヒット商品を作れる。' } },
    'market_analysis': { title: '市場分析', powerTag: '探求力', seed: { desc: '競合観察ができている。' }, sprout: { desc: 'トレンドを店舗に反映できる。' }, harvest: { desc: '分析を戦略に落とし込める。' } }
  };

  const currentArchetype = state.selectedPrologueType ? archetypes[state.selectedPrologueType] : null;
  const currentWork = state.selectedWorkId ? worksData[state.selectedWorkId] : null;
  let content = '';

  if (state.prologueStep === 1) {
    content = `
      <div class="text-center mb-10 fade-in"><h2 class="text-2xl font-bold mb-4">あなたの<br>「これからどうなりたいか」を教えてください</h2></div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 fade-in px-4">
        ${Object.entries(archetypes).map(([key, data]) => `
          <button onclick="setPrologueType('${key}')" class="bg-white rounded-xl p-6 shadow-md border-b-4 border-transparent hover:border-${data.color}-500 text-left">
            <div class="text-5xl mb-4">${data.icon}</div><h3 class="text-xl font-bold text-gray-800 mb-2">${data.label}</h3><p class="text-sm text-gray-500 mb-4">${data.desc}</p>
            <div class="text-${data.color}-600 font-bold text-sm">これを目指す →</div>
          </button>
        `).join('')}
      </div>`;
  } else if (state.prologueStep === 2 && currentArchetype) {
    const power = currentArchetype.relatedPowers[0];
    content = `
      <div class="max-w-3xl mx-auto text-center fade-in">
        <div class="mb-10"><div class="inline-block p-4 rounded-full bg-${currentArchetype.color}-50 text-5xl mb-4">${currentArchetype.icon}</div><h2 class="text-2xl font-bold">「${currentArchetype.label}」に必要な人間力</h2>
          <div class="bg-white rounded-xl shadow p-6 text-left mt-6 border-l-4 border-${currentArchetype.color}-500">
            <h3 class="text-xl font-bold mb-2">${power.name}</h3><p class="text-gray-600 text-sm mb-4">${power.definition}</p>
            <ul class="text-sm space-y-1">${power.outcomes.map(o => `<li>✓ ${o}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="text-left bg-gray-50 p-6 rounded-2xl border border-gray-200">
          <p class="text-sm font-bold text-center mb-4">この力を磨くための「関連業務」</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${currentArchetype.workIds.map(workId => {
      const work = worksData[workId];
      return `<button onclick="setPrologueWork('${workId}')" class="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 hover:border-${currentArchetype.color}-400 text-left w-full"><span class="bg-gray-100 text-xs font-bold px-2 py-1 rounded">${work.powerTag}</span><span class="font-bold text-sm flex-1">${work.title}</span></button>`;
    }).join('')}
          </div>
        </div>
        <button onclick="resetPrologueSelection()" class="mt-8 text-xs text-gray-400 underline">選び直す</button>
      </div>`;
  } else if (state.prologueStep === 3 && currentWork) {
    content = `
      <div class="max-w-5xl mx-auto text-center fade-in">
        <div class="mb-2 inline-block px-3 py-1 rounded bg-gray-200 text-xs font-bold">${currentWork.powerTag}を磨く業務</div>
        <h2 class="text-2xl font-bold mb-6">${currentWork.title}</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 text-left">
          <div class="bg-gray-50 p-5 rounded border"><div class="font-bold text-gray-500 mb-2">SEED (未熟)</div><p class="text-sm text-gray-600">${currentWork.seed.desc}</p></div>
          <div class="bg-white p-5 rounded border-2 border-yellow-300"><div class="font-bold text-yellow-600 mb-2">🌱 SPROUT (芽)</div><p class="text-sm text-gray-800">${currentWork.sprout.desc}</p></div>
          <div class="bg-green-50 p-5 rounded border-2 border-green-500 shadow-lg transform md:scale-105"><div class="font-bold text-green-700 mb-2">🌾 HARVEST (実り)</div><p class="text-sm text-gray-900 font-medium">${currentWork.harvest.desc}</p></div>
        </div>
        <button onclick="nextPrologueStep()" class="bg-green-600 text-white px-10 py-3 rounded-full font-bold shadow-lg hover:bg-green-700">🌾 HARVEST達成！（次へ）</button>
        <div class="mt-4"><button onclick="backToPrologueScene2()" class="text-xs text-gray-400 underline">業務を選び直す</button></div>
      </div>`;
  } else if (state.prologueStep === 4 && currentWork) {
    const relatedPowers = WORK_TO_HUMAN[currentWork.title] || [];
    const mainPower = currentWork.powerTag;
    const bonusPowers = relatedPowers.filter(p => p !== mainPower);

    content = `
      <div class="max-w-xl mx-auto text-center fade-in">
        <div class="text-6xl mb-4 animate-bounce">🚀</div>
        
        <h2 class="text-3xl font-bold mb-2">素晴らしい成果です！</h2>
        <p class="text-gray-600 mb-8 text-sm">
          「${currentWork.title}」をやり遂げたことで、<br>
          あなたの人間力が大きくアップデートされました。
        </p>

        <div class="bg-white border-2 border-yellow-400 rounded-xl p-6 shadow-lg mb-6 relative overflow-hidden">
          <div class="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg">Main Level Up</div>
          <div class="text-sm text-gray-500 mb-1">あなたが目指した力</div>
          <div class="text-2xl font-bold text-gray-800 mb-2">【 ${mainPower} 】</div>
          <div class="flex justify-center items-center gap-2">
             <span class="text-yellow-500 text-4xl">★</span>
             <span class="text-gray-700 font-extrabold text-2xl">1.0</span>
             <span class="text-red-500 font-bold text-sm animate-pulse ml-1">UP!</span>
          </div>
        </div>

        ${bonusPowers.length > 0 ? `
          <div class="bg-gradient-to-br from-indigo-50 to-blue-100 rounded-xl p-6 border border-blue-200 mb-8 text-left relative">
            <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold shadow-sm whitespace-nowrap">
              😲 同時にこれらの力も磨かれました！
            </div>
            <div class="mt-2 flex flex-wrap justify-center gap-2">
              ${bonusPowers.map(p => `
                <div class="bg-white text-blue-800 px-3 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 border border-blue-100">
                  <span class="text-yellow-400">✨</span> ${p}
                </div>
              `).join('')}
            </div>
            <p class="text-center text-xs text-blue-500 mt-4">
              一つの業務を極めることは、<br>複合的な人間力を高めることに繋がっています。
            </p>
          </div>
        ` : ''}

        <button onclick="finishPrologue()" class="bg-indigo-600 text-white px-10 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-105">
          📖 物語を始める（ダッシュボードへ）
        </button>
      </div>`;
  }

  return `<div class="min-h-[600px] flex flex-col justify-center py-10 relative">${content}</div>`;
}
// renderDashboard

function renderDashboard() {
  // 1. 現在のデータの計算
  const totalStars = getTotalStars();
  const humanPowerStars = Object.values(state.starsByHuman).reduce((sum, val) => sum + val, 0);
  const spiritStars = state.totalSpiritStars || 0;

  // 2. 予測値の計算
  const potentialStats = { ...state.starsByHuman };
  let potentialSpiritStars = spiritStars;
  const inProgressList = getInProgressWorks();

  inProgressList.forEach(workKey => {
    const work = WORKS.find(w => w.key === workKey);
    if (!work) return;
    if (work.isSpirit) {
      const level = state.workLevels[workKey];
      if (!level || level === 'SEED') potentialSpiritStars += 1.0;
    } else {
      const related = WORK_TO_HUMAN[workKey] || [];
      related.forEach(humanKey => {
        potentialStats[humanKey] = Math.min((potentialStats[humanKey] || 0) + 0.5, 4.0);
      });
    }
  });

  const potentialHumanStars = Object.values(potentialStats).reduce((sum, val) => sum + val, 0);
  const potentialTotalStars = potentialHumanStars + potentialSpiritStars;
  const increaseStars = potentialTotalStars - totalStars;

  // 3. 給与・レンジ情報の取得
  const rangeInfo = getBaseRange();
  let currentBasePay = state.manualBasePay;
  if (!currentBasePay || currentBasePay < rangeInfo.minPay || currentBasePay > rangeInfo.maxPay) {
    currentBasePay = rangeInfo.minPay;
    state.manualBasePay = currentBasePay;
  }

  // 役職給
  const currentRoleType = state.selectedRolePayType || 'none';
  const roleRange = ROLE_PAY_RANGES[currentRoleType] || { min: 0, max: 0, label: 'なし' };
  let rolePayValue = state.selectedRolePayAmount || roleRange.min;

  // スキル・ユニーク給
  const skillTotal = getSkillTotal();
  const challengePay = state.myUniqueChallenge || 0;
  const totalPay = currentBasePay + skillTotal + rolePayValue + challengePay;

  // 次のランクまでの星
  const nextRangeIndex = STAR_RANGES.findIndex(r => totalStars >= r.min && totalStars <= r.max);
  const nextRange = nextRangeIndex >= 0 && nextRangeIndex < STAR_RANGES.length - 1 ? STAR_RANGES[nextRangeIndex + 1] : null;
  const starsToNext = nextRange ? nextRange.min - totalStars : 0;

  // 今日の言葉
  // 今日の言葉（セッション中に1つをランダム選択して固定）
  if (!currentSessionPhilosophy) {
    try {
      if (typeof PHILOSOPHIES !== 'undefined' && Array.isArray(PHILOSOPHIES) && PHILOSOPHIES.length > 0) {
        const idx = Math.floor(Math.random() * PHILOSOPHIES.length);
        currentSessionPhilosophy = PHILOSOPHIES[idx];
      }
    } catch (e) {
      console.warn('Failed to select random philosophy', e);
    }
  }
  const todayPhilo = currentSessionPhilosophy || { title: "笑顔で元気に", desc: "全ては笑顔と元気から。" };

  // レンジ表データ
  const rangeTable = [
    { stars: "0～10", label: "新人・ルーキー", pay: "25～27万円", min: 0, max: 10 },
    { stars: "10～24", label: "コアスタッフ", pay: "27～33万円", min: 10, max: 25 },
    { stars: "25～34", label: "店長・料理長", pay: "33～40万円", min: 25, max: 35 },
    { stars: "35～45", label: "SV・統括", pay: "40～55万円", min: 35, max: 45 },
    { stars: "45以上", label: "ノーレーティング", pay: "55万円超", min: 45, max: 999 }
  ];

  // アラートバナー
  const alertBanner = !state.isSpiritComplete ? `
    <div class="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 rounded shadow-sm mb-6 flex items-start gap-3">
      <span class="text-2xl mt-1">⚠️</span>
      <div>
        <h3 class="font-bold">SPIRITが未達成です</h3>
        <p class="text-sm">シミュレーションモードです。実際の評価にはSPIRIT達成が必要です。</p>
      </div>
    </div>
  ` : '';

  return `
    <div class="space-y-6 relative">
      <div class="absolute top-0 right-0 z-10">
        <button onclick="openPrintMode()" class="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 px-3 py-1.5 rounded-lg shadow-sm font-bold text-xs flex items-center gap-2 transition-colors">
          <span>🖨️</span> 印刷
        </button>
      </div>

      ${alertBanner}

      <div class="bg-white rounded-lg shadow-lg p-6 flex flex-wrap items-center gap-4 pt-10 md:pt-6">
        <div class="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          ${state.userName.charAt(0)}
        </div>
        <div class="flex-1 min-w-[200px]">
          <div class="flex items-center gap-3 mb-2">
            <input type="text" id="userName" value="${state.userName}" onchange="updateUserInfo()" 
              class="text-2xl font-bold text-gray-800 border-b-2 border-transparent hover:border-amber-300 focus:border-amber-500 focus:outline-none px-2 py-1 bg-transparent placeholder-gray-400 w-full transition-colors" 
              placeholder="名前を入力">
          </div>
          
          <div class="flex flex-wrap items-center gap-2">
            <input type="text" id="userStore" value="${state.userStore}" onchange="updateUserInfo()" 
              class="text-sm text-gray-600 font-bold border-b border-transparent hover:border-gray-300 focus:border-amber-500 focus:outline-none bg-transparent w-40 px-2 py-1 transition-colors" 
              placeholder="店舗名を入力">
            
            <span class="text-gray-300">｜</span>
            
            <input type="text" id="userPosition" value="${state.userPosition}" onchange="updateUserInfo()" 
              class="text-sm text-gray-600 font-bold border-b border-transparent hover:border-gray-300 focus:border-amber-500 focus:outline-none bg-transparent w-32 px-2 py-1 transition-colors" 
              placeholder="役職を入力">
            
            <span class="text-gray-300">｜</span>

            <span class="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-full text-sm">
              ⭐ ${totalStars.toFixed(1)} <span class="text-xs font-normal text-gray-500">(${humanPowerStars.toFixed(1)} + ${spiritStars.toFixed(1)}*)</span>
            </span>
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-md p-4 text-white relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="absolute top-0 right-0 p-2 opacity-10 text-5xl font-serif">”</div>
        <div class="flex-1 z-10">
          <div class="flex items-center gap-2 mb-1">
            <span class="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">Today's Philosophy</span>
          </div>
          <h3 class="text-lg font-bold leading-tight" style="font-family: 'Zen Old Mincho', serif;">
            ${todayPhilo.title}
          </h3>
        </div>
        <div class="md:w-1/2 text-sm text-indigo-50 opacity-90 z-10 leading-snug border-l-2 border-white/20 pl-3 md:pl-4">
          ${todayPhilo.desc}
        </div>
      </div>

      <div class="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg shadow-xl p-6 border-l-4 border-amber-600">
        <div class="flex flex-wrap items-start justify-between gap-6 mb-6 pb-4 border-b border-amber-200/50">
          
          <div class="flex-1 min-w-[280px]">
            <h2 class="text-xl font-bold text-amber-900 mb-1 flex items-center gap-2">💫 給与シミュレーション</h2>
            <div class="text-sm text-amber-800 opacity-80 mb-3">${rangeInfo.stage}</div>
            
            <div class="flex flex-col gap-2">
              ${nextRange ? `
                <div class="inline-flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm w-fit">
                  <span class="text-xs text-amber-800 font-bold">次のレンジまであと</span>
                  <span class="text-lg font-bold text-orange-600">⭐ ${starsToNext.toFixed(1)}</span>
                </div>` :
      `<div class="inline-flex items-center gap-2 bg-green-100 px-3 py-1 rounded-lg text-green-700 font-bold text-sm w-fit">🎉 最高ランク到達！</div>`
    }
              <div class="inline-flex items-center gap-2 text-xs font-medium bg-amber-100/50 px-3 py-1.5 rounded-lg border border-amber-200 w-fit">
                <span class="text-gray-600">現在: <b>${totalStars.toFixed(1)}</b></span>
                <span class="text-amber-400">＋</span>
                <span class="text-emerald-600" title="取り組み中獲得予定">予定: <b>${increaseStars.toFixed(1)}</b></span>
                <span class="text-amber-400">＝</span>
                <span class="text-amber-900 font-bold">合計: ${potentialTotalStars.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div class="w-full md:w-auto bg-white/60 p-4 rounded-lg border border-amber-200 shadow-sm">
            <details class="mb-4 bg-white rounded border border-gray-200 w-full md:w-80">
              <summary class="px-3 py-2 text-xs font-bold text-gray-600 cursor-pointer hover:bg-gray-50 list-none flex justify-between items-center">
                <span>📊 基本給レンジ表（目安）</span>
                <span class="text-gray-400 text-[10px]">▼</span>
              </summary>
              <div class="border-t border-gray-200">
                <table class="w-full text-[10px] text-left">
                  <thead class="bg-gray-50 text-gray-500">
                    <tr><th class="px-2 py-1 font-normal">星数</th><th class="px-2 py-1 font-normal">ステージ</th><th class="px-2 py-1 font-normal text-right">レンジ</th></tr>
                  </thead>
                  <tbody class="text-gray-700 divide-y divide-gray-100">
                    ${rangeTable.map(row => `<tr class="${totalStars >= row.min && totalStars < row.max ? 'bg-amber-100 font-bold text-amber-900' : ''}"><td class="px-2 py-1">★ ${row.stars}</td><td class="px-2 py-1">${row.label}</td><td class="px-2 py-1 text-right">${row.pay}</td></tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </details>

            <label class="block text-xs text-amber-800 font-bold mb-1">基本給設定 (5,000円刻み)</label>
            <div class="flex items-center gap-1 bg-white border border-amber-300 rounded-lg p-1 shadow-inner">
              <button id="basePayMinusBtn" onclick="stepBasePay(-5000)" class="w-8 h-8 flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-bold text-lg" ${currentBasePay <= rangeInfo.minPay ? 'disabled' : ''}>－</button>
              <div class="flex-1 text-center border-l border-r border-amber-100 px-2">
                <div id="basePayValue" class="text-2xl font-bold text-amber-700 tracking-tight">${formatNumber(currentBasePay)}</div>
                <div class="text-[10px] text-gray-400">円</div>
              </div>
              <button id="basePayPlusBtn" onclick="stepBasePay(5000)" class="w-8 h-8 flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-bold text-lg" ${currentBasePay >= rangeInfo.maxPay ? 'disabled' : ''}>＋</button>
            </div>
            <div class="flex justify-between text-[10px] text-amber-600 mt-1 font-medium px-1">
              <span>Min: ${formatNumber(rangeInfo.minPay)}</span><span>Max: ${formatNumber(rangeInfo.maxPay)}</span>
            </div>
          </div>
        </div>

        <div class="bg-white/80 rounded-lg p-5 shadow-sm">
          <div class="space-y-4">
            <div class="flex justify-between items-center px-2"><span class="text-gray-600">基本給</span><span id="basePayLine" class="font-bold text-gray-800">${formatNumber(currentBasePay)} 円</span></div>
            <div class="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div class="flex justify-between items-center mb-2"><span class="text-xs font-bold text-blue-700">＋ 役職・役割給</span><span class="font-bold text-blue-800">${formatNumber(rolePayValue)} 円</span></div>
              <div class="flex flex-col gap-2">
                <select onchange="updateRoleSelection(this.value)" class="w-full text-xs border border-blue-200 rounded p-1.5 bg-white cursor-pointer focus:outline-none focus:border-blue-400">
                   ${Object.entries(ROLE_PAY_RANGES).map(([k, v]) => `<option value="${k}" ${state.selectedRolePayType === k ? 'selected' : ''}>${v.label}</option>`).join('')}
                </select>
                ${currentRoleType !== 'none' ? `
                  <div class="flex items-center gap-1 bg-white border border-blue-200 rounded p-1">
                    <button onclick="stepRolePay(-5000)" class="w-6 h-6 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-800 rounded font-bold" ${rolePayValue <= roleRange.min ? 'disabled' : ''}>－</button>
                    <div class="flex-1 text-center border-l border-r border-blue-50 px-1"><div class="text-sm font-bold text-blue-700">${formatNumber(rolePayValue)}</div></div>
                    <button onclick="stepRolePay(5000)" class="w-6 h-6 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-800 rounded font-bold" ${rolePayValue >= roleRange.max ? 'disabled' : ''}>＋</button>
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="flex justify-between items-center px-2"><span class="text-gray-600">＋ スキル給</span><span class="font-medium">${formatNumber(skillTotal)} 円</span></div>
            <div class="flex justify-between items-center px-2"><span class="text-gray-600">＋ ユニーク給</span><span class="font-medium">${formatNumber(challengePay)} 円</span></div>
            <div class="border-t-2 border-dashed border-gray-300 pt-3 mt-2 flex justify-between items-center">
              <span class="text-xl font-bold text-gray-800">支給合計</span><span id="totalPayLine" class="text-3xl font-bold text-amber-700">${formatNumber(totalPay)} 円</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">📊 人間力チャート</h2>
            <div class="flex items-center gap-3 text-xs">
               <div class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-amber-600"></span><span>現在</span></div>
               <div class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-emerald-400 opacity-50"></span><span>予測</span></div>
            </div>
          </div>
          <div class="flex justify-center"><div class="radar-container w-full aspect-square"><canvas id="radarChart"></canvas></div></div>
        </div>

        <div class="space-y-6">
           <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-bold text-green-700 mb-4 flex items-center gap-2">🪴 現在の活動</h2>
            <div class="bg-green-50 rounded-lg p-4 border-l-4 border-green-500 mb-4">
              ${inProgressList.length > 0 ? `
                <div class="space-y-2">
                  ${inProgressList.map(workKey => {
      const work = WORKS.find(w => w.key === workKey);
      const level = state.workLevels[workKey] || 'SEED';
      const isSpirit = work ? work.isSpirit : false;
      return `
                      <div class="flex items-center justify-between bg-white rounded p-3 shadow-sm">
                        <div class="flex-1">
                          <div class="font-semibold text-gray-800 text-sm">${workKey}</div>
                          <div class="text-xs mt-1">${getLevelBadge(level, isSpirit)}</div>
                        </div>
                        <button onclick="switchTab('works')" class="text-xs text-blue-600 hover:text-blue-800 font-semibold ml-2">詳細</button>
                      </div>`;
    }).join('')}
                </div>` : '<p class="text-gray-600 text-sm">現在取り組み中の業務はありません</p>'
    }
            </div>
            
            <div class="bg-pink-50 rounded-lg p-4 border-l-4 border-pink-500">
              <div class="flex justify-between items-start mb-2">
                <h3 class="font-semibold text-pink-800 text-sm">🔥 マイユニークチャレンジ</h3>
                <button onclick="switchTab('myunique')" class="text-xs text-pink-600 font-bold hover:underline">編集</button>
              </div>
              <div class="bg-white/60 p-3 rounded text-gray-700 text-xs whitespace-pre-wrap leading-relaxed">
                ${state.challengeText ? state.challengeText : '<span class="text-gray-400">目標未設定</span>'}
              </div>
            </div>
           </div>
        </div>
      </div>
    </div>
  `;
}



function renderHumanPower() {
  // グループごとに表示
  const groups = [
    { name: "① 個人（自己認識・自己管理）", color: "text-pink-600", bg: "bg-pink-50" },
    { name: "② 対人（社会的認識）", color: "text-blue-600", bg: "bg-blue-50" },
    { name: "③ チーム（関係管理）", color: "text-green-600", bg: "bg-green-50" }
  ];

  return `
    <div class="space-y-8 fade-in relative">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-gray-800">人間力ステータス</h2>
        <p class="text-gray-500">業務の達成度から算出された、あなたの基礎能力</p>
      </div>

      ${groups.map(g => {
    const powers = HUMAN_POWERS.filter(hp => hp.group === g.name);
    return `
          <div class="bg-white rounded-xl shadow-md overflow-hidden">
            <div class="${g.bg} px-6 py-3 border-b border-gray-100">
              <h3 class="font-bold ${g.color}">${g.name}</h3>
            </div>
            <div class="divide-y divide-gray-50">
              ${powers.map(hp => {
      const score = state.starsByHuman[hp.key] || 0;
      const percent = (score / hp.max) * 100;
      return `
                  <div class="p-4 hover:bg-gray-50 transition-colors cursor-pointer" onclick="openHumanDetail('${hp.key}')">
                    <div class="flex justify-between items-center mb-2">
                      <div class="font-bold text-gray-700">${hp.key}</div>
                      <div class="text-sm font-bold ${score >= hp.max ? 'text-yellow-500' : 'text-gray-400'}">
                        ★ ${score.toFixed(1)} <span class="text-xs font-normal text-gray-300">/ ${hp.max}</span>
                      </div>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2.5">
                      <div class="bg-gradient-to-r from-blue-400 to-blue-600 h-2.5 rounded-full transition-all duration-1000" style="width: ${percent}%"></div>
                    </div>
                    <div class="mt-2 text-xs text-gray-400 text-right">関連業務: ${WORK_TO_HUMAN[hp.key] ? WORK_TO_HUMAN[hp.key].length : 0}個</div>
                  </div>
                `;
    }).join('')}
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

function renderWorkDetailModal() {
  if (!state.workDetailOpen || !state.workDetailKey) return '';
  const w = WORKS.find(work => work.key === state.workDetailKey);
  if (!w) return '';

  // 関連する人間力
  const related = WORK_TO_HUMAN[w.key] || [];

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onclick="closeWorkDetail()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
             <div class="text-xs font-bold text-blue-600 mb-1">${w.group}</div>
             <h3 class="text-xl font-bold text-gray-800 leading-tight">${w.key}</h3>
          </div>
          <button onclick="closeWorkDetail()" class="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100">✕</button>
        </div>
        
        <div class="p-6 space-y-6">
          <div class="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm leading-relaxed border border-gray-200">
            ${w.definition}
          </div>

          <div class="space-y-4">
            ${w.levels && w.levels.SEED ? `
             <div class="border-l-4 border-gray-300 pl-4 py-1">
               <div class="font-bold text-gray-500 text-sm mb-1">⚪️ SEED (目標)</div>
               <ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
                 ${w.levels.SEED.behaviors.map(b => `<li>${b}</li>`).join('')}
               </ul>
             </div>
            ` : ''}

            ${w.levels && w.levels.SPROUT ? `
             <div class="border-l-4 border-yellow-400 pl-4 py-1 bg-yellow-50/50 rounded-r">
               <div class="font-bold text-yellow-700 text-sm mb-1">🌱 SPROUT (実践中)</div>
               <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
                 ${w.levels.SPROUT.behaviors.map(b => `<li>${b}</li>`).join('')}
               </ul>
             </div>
            ` : ''}

            ${w.levels && w.levels.HARVEST ? `
             <div class="border-l-4 border-green-500 pl-4 py-1 bg-green-50/50 rounded-r">
               <div class="font-bold text-green-700 text-sm mb-1">🌾 HARVEST (達成・貢献)</div>
               <ul class="list-disc list-inside text-sm text-gray-800 space-y-1">
                 ${w.levels.HARVEST.behaviors.map(b => `<li>${b}</li>`).join('')}
               </ul>
             </div>
            ` : ''}
          </div>

          <div class="pt-4 border-t">
            <h4 class="font-bold text-gray-800 mb-3 text-sm">この業務で磨かれる人間力</h4>
            <div class="flex flex-wrap gap-2">
              ${related.map(r => `
                <button onclick="jumpToHuman('${r}')" class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors">
                  ${r} &rarr;
                </button>
              `).join('')}
            </div>
          </div>
        </div>
        
        <div class="p-4 border-t bg-gray-50 text-center sticky bottom-0">
          <button onclick="closeWorkDetail()" class="bg-gray-800 text-white px-8 py-2 rounded-lg font-bold hover:bg-gray-700 transition-colors">閉じる</button>
        </div>
      </div>
    </div>
  `;
}

function renderHumanDetailModal() {
  if (!state.humanDetailOpen || !state.humanDetailKey) return '';
  const h = HUMAN_POWERS.find(hp => hp.key === state.humanDetailKey);
  if (!h) return '';

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onclick="closeHumanDetail()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white sticky top-0 z-10">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-xs font-bold opacity-80 mb-1">${h.group}</div>
              <h3 class="text-2xl font-bold mb-2">${h.key}</h3>
              <div class="text-sm opacity-90">${h.definition}</div>
            </div>
            <button onclick="closeHumanDetail()" class="text-white opacity-70 hover:opacity-100 p-1">✕</button>
          </div>
        </div>
        
        <div class="p-6 space-y-6">
          <div>
            <h4 class="font-bold text-gray-800 mb-2 border-b pb-1">具体例</h4>
            <ul class="space-y-2">
              ${h.examples.map(ex => `
                <li class="flex items-start gap-3 text-sm text-gray-700">
                  <span class="text-blue-500 mt-1">✔</span>
                  <span>${ex}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="bg-blue-50 rounded-xl p-5">
            <h4 class="font-bold text-blue-800 mb-3 text-sm">この力を高めるための業務</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${h.relatedWorks.map(wkKey => {
    const wk = WORKS.find(w => w.key === wkKey);
    const level = state.workLevels[wkKey] || 'SEED';
    const badge = level === 'HARVEST' ? '🌾' : level === 'SPROUT' ? '🌱' : '⚪️';
    return `
                  <button onclick="jumpToWork('${wkKey}')" class="text-left bg-white p-3 rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all">
                    <div class="text-xs text-gray-400 mb-1">${badge} 現在: ${level}</div>
                    <div class="font-bold text-gray-800 text-sm">${wkKey}</div>
                  </button>
                `;
  }).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
// ============================================================================
// データ管理機能（インポート・エクスポート）
// ============================================================================

// レーダーチャート描画 (Chart.jsを使わずCanvas APIで描画)
function drawRadarChart() {
  const canvas = document.getElementById('radarChart');
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  const dpr = window.devicePixelRatio || 1;
  const widthCss = container.clientWidth || 300;
  const heightCss = container.clientHeight || 300;

  canvas.width = Math.round(widthCss * dpr);
  canvas.height = Math.round(heightCss * dpr);
  canvas.style.width = widthCss + 'px';
  canvas.style.height = heightCss + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const centerX = widthCss / 2;
  const centerY = heightCss / 2;
  // ラベル表示エリア確保のため少し小さめに
  const radius = Math.min(centerX, centerY) - 40;

  // 現在のデータ
  const currentStats = { ...state.starsByHuman };

  // 予測データ（取り組み中の業務があれば+0.5と仮定）
  const potentialStats = { ...state.starsByHuman };
  const inProgressList = getInProgressWorks();

  inProgressList.forEach(workKey => {
    const work = WORKS.find(w => w.key === workKey);
    if (!work || work.isSpirit) return;
    const related = WORK_TO_HUMAN[workKey] || [];
    related.forEach(humanKey => {
      potentialStats[humanKey] = Math.min((potentialStats[humanKey] || 0) + 0.5, 4.0);
    });
  });

  // 全20項目のデータを準備
  const humanData = HUMAN_POWERS.map(h => ({
    name: h.key,
    current: currentStats[h.key] || 0,
    potential: potentialStats[h.key] || 0,
    max: h.max,
    group: h.group
  }));

  ctx.clearRect(0, 0, widthCss, heightCss);

  // 1. 背景グリッド（4段階）
  for (let i = 4; i > 0; i--) {
    ctx.beginPath();
    for (let j = 0; j < humanData.length; j++) {
      const angle = (Math.PI * 2 * j) / humanData.length - Math.PI / 2;
      const r = (radius * i) / 4;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = i === 4 ? '#D1D5DB' : '#F3F4F6';
    ctx.lineWidth = 1;
    // 一番外側だけ白塗りして背景と区別
    if (i === 4) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    }
    ctx.stroke();
  }

  // 2. 軸線
  humanData.forEach((_, i) => {
    const angle = (Math.PI * 2 * i) / humanData.length - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#E5E7EB';
    ctx.stroke();
  });

  // 3. 予測エリア（緑・破線）
  ctx.beginPath();
  humanData.forEach((d, i) => {
    const angle = (Math.PI * 2 * i) / humanData.length - Math.PI / 2;
    const val = d.max > 0 ? d.potential / d.max : 0;
    const r = radius * val;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(52, 211, 153, 0.2)'; // 薄いエメラルド
  ctx.fill();
  ctx.strokeStyle = '#34D399';
  ctx.setLineDash([3, 3]); // 破線
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]); // 実線に戻す

  // 4. 現在エリア（オレンジ・実線）
  ctx.beginPath();
  humanData.forEach((d, i) => {
    const angle = (Math.PI * 2 * i) / humanData.length - Math.PI / 2;
    const val = d.max > 0 ? d.current / d.max : 0;
    const r = radius * val;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(245, 158, 11, 0.5)'; // アンバー
  ctx.fill();
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 5. ラベル（項目名）
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  humanData.forEach((d, i) => {
    const angle = (Math.PI * 2 * i) / humanData.length - Math.PI / 2;
    const labelR = radius + 20;
    const x = centerX + Math.cos(angle) * labelR;
    const y = centerY + Math.sin(angle) * labelR;

    // ラベル色分け（グループごと）
    if (d.group.includes('個人')) ctx.fillStyle = '#DB2777'; // ピンク
    else if (d.group.includes('対人')) ctx.fillStyle = '#2563EB'; // 青
    else ctx.fillStyle = '#059669'; // 緑

    // 文字数制限（長いと重なるため）
    let label = d.name;
    if (label.length > 4) label = label.substring(0, 4);

    ctx.fillText(label, x, y);
  });
}
// render の上書き（ヘッダー含む）

function render() {
  const app = document.getElementById('app');

  // 常に表示するメニュータブの定義
  const tabs = [
    { id: 'overview', label: 'コンセプト' },
    { id: 'prologue', label: 'プロローグ' },
    { id: 'evaluation', label: '評価方法' },
    { id: 'flow', label: '評価フロー' },
    { id: 'dashboard', label: 'ラウンジ' },
    { id: 'philosophy', label: 'フィロソフィー' },
    { id: 'works', label: '業務' },
    { id: 'humanpower', label: '人間力' },
    { id: 'myunique', label: 'MY UNIQUE' },
    { id: 'role', label: '役職・役割給' },
    { id: 'resources', label: '資料' },
    { id: 'faq', label: 'FAQ' }
  ];

  app.innerHTML = `
    <div class="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20">
      <header class="bg-white shadow-sm sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <!-- タイトルエリア -->
          <div class="py-3 md:py-4">
             <!-- モバイルでは文字サイズを小さく、改行を許容して高さを抑える -->
            <h1 class="text-base md:text-2xl font-bold text-gray-800 tracking-tight leading-tight">
              G.E.M.S. <span class="hidden sm:inline">（Growth Evaluation and Mapping System）</span>
            </h1>
          </div>
          
          <!-- タブナビゲーションエリア -->
          <!-- h-16固定を削除し、パディングで高さを確保。wrapさせずにスクロールさせる -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-0 md:pb-0">
            <div class="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto no-scrollbar mask-gradient-right">
              <nav class="flex flex-nowrap gap-2 md:gap-1 border-b md:border-b-0 border-gray-100 pb-1 md:pb-0">
                ${tabs.map(tab => `
                  <button
                    id="tab-${tab.id}"
                    onclick="switchTab('${tab.id}')"
                    class="${state.activeTab === tab.id
      ? 'bg-amber-100 text-amber-900 border-amber-500'
      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-transparent'} 
                      whitespace-nowrap px-3 py-2 md:py-2 rounded-t-md md:rounded-md text-sm font-medium transition-colors border-b-2"
                  >
                    ${tab.label}
                  </button>
                `).join('')}
              </nav>
            </div>
            
            <!-- 保存ボタンエリア（モバイルではタブの下、または右端に配置したいが、タブが多いので横スクロール外に置くのが吉）-->
            <div class="hidden md:flex items-center ml-4 flex-shrink-0">
               <div id="save-status" class="text-xs text-gray-400 mr-2"></div>
               <button onclick="manualSave()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold shadow transition-colors">
                 保存
               </button>
            </div>
          </div>
        </div>
        <!-- モバイル用保存ボタン（フローティングまたはヘッダー内調整）-->
        <!-- 今回はシンプルにPCと同じ位置だが、タブ行の右端に固定表示させるCSS工夫も可。
             現状はデスクトップのみ表示になっていたので、モバイルでもアクセスできるように戻す -->
        <div class="md:hidden absolute top-3 right-4">
           <button onclick="manualSave()" class="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold shadow">
             保存
           </button>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 fade-in">
        ${renderTabContent()}
      </main>
      
      <footer class="bg-white border-t mt-12 py-8 text-center text-gray-500 text-xs">
        <p>&copy; 2024 BALNIBARBI. All rights reserved.</p>
      </footer>

      ${renderWorkDetailModal()}
      ${renderHumanDetailModal()}
    </div>
  `;
}
// スキル削除（ゴミ箱ボタンの機能）
function removeSkill(id) {
  // スキルリストが空、または未定義の場合は何もしない
  if (!state.skills) return;

  // 指定されたIDと一致しないものだけを残す（＝指定したIDを削除する）
  state.skills = state.skills.filter(s => s.id !== id);

  // データを保存して、画面を再描画
  saveState();
  render();
}
// チャレンジ目標のチェック切り替え（承認＝5000円、未承認＝0円）
function toggleChallengeDialog() {
  // 1. チェック状態を反転させる
  state.challengeDialogChecked = !state.challengeDialogChecked;

  // 2. チェックが入っていれば5000、外れていれば0をセット
  if (state.challengeDialogChecked) {
    state.myUniqueChallenge = 5000;
  } else {
    state.myUniqueChallenge = 0;
  }

  // 3. 保存して画面を再描画
  saveState();
  render();
}

// ==========================================
// 給与シミュレーション制御用関数 (矢印ボタンなど)
// ==========================================

// 1. 基本給をステップ単位で増減
// ----------------------------------------------------
// 給与計算・更新ロジック (レンジ制限付き)
// ----------------------------------------------------
// 基本給：ボタンで増減 (+/- 5000円)
function stepBasePay(amount) {
  const rangeInfo = getBaseRange();

  let current = parseInt(state.manualBasePay);
  if (isNaN(current)) current = rangeInfo.minPay;

  let nextVal = current + amount;
  if (nextVal < rangeInfo.minPay) nextVal = rangeInfo.minPay;
  if (nextVal > rangeInfo.maxPay) nextVal = rangeInfo.maxPay;

  state.manualBasePay = nextVal;
  saveState();

  // まずはDOMの数値を即時更新（存在しない場合は false が返る）
  const updated = syncDashboardPayUI();

  // それでも表示が更新できない場合（タブが違う/描画タイミング問題）に備え、最終的に再描画で保証
  if (!updated && typeof render === 'function') {
    render();
  }
}


// 基本給：直接入力時の更新
function updateBasePayInput(val) {
  const rangeInfo = getBaseRange();
  let amount = parseInt(val);
  if (isNaN(amount)) return;

  if (amount < rangeInfo.minPay) amount = rangeInfo.minPay;
  if (amount > rangeInfo.maxPay) amount = rangeInfo.maxPay;

  // 5000円単位に丸める
  amount = Math.round(amount / 5000) * 5000;

  state.manualBasePay = amount;
  saveState();

  const updated = syncDashboardPayUI();
  if (!updated && typeof render === 'function') {
    render();
  }
}



// 役職給：ボタンで増減
function stepRolePay(amount) {
  const type = state.selectedRolePayType || 'none';
  const range = ROLE_PAY_RANGES[type];
  if (!range) return;

  let current = parseInt(state.selectedRolePayAmount) || 0;
  let nextVal = current + amount;

  // 範囲制限
  if (nextVal < range.min) nextVal = range.min;
  if (nextVal > range.max) nextVal = range.max;

  state.selectedRolePayAmount = nextVal;
  saveState();
  render();
}

// 役職給：直接入力時の更新
function updateRolePayInput(val) {
  const type = state.selectedRolePayType || 'none';
  const range = ROLE_PAY_RANGES[type];
  if (!range) return;

  let amount = parseInt(val);
  if (isNaN(amount)) return;

  // 範囲制限
  if (amount < range.min) amount = range.min;
  if (amount > range.max) amount = range.max;

  // 5000円単位に丸める
  amount = Math.round(amount / 5000) * 5000;

  state.selectedRolePayAmount = amount;
  saveState();
  render();
}

// 合計金額の計算ヘルパー
function calcTotalPay() {
  const base = parseInt(state.manualBasePay) || 0;
  const role = parseInt(state.selectedRolePayAmount) || 0;
  const skill = getSkillTotal();
  const challenge = state.myUniqueChallenge || 0;
  return base + role + skill + challenge;
}

function renderOverview() {
  return `
    <div class="max-w-3xl mx-auto pb-20 fade-in space-y-16">
      
      <div class="text-center py-10 relative">
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-100 rounded-full blur-3xl opacity-50 -z-10"></div>
        <span class="text-amber-600 font-bold tracking-[0.2em] text-xs uppercase mb-3 block">CONCEPT</span>
        <h1 class="text-2xl md:text-4xl font-bold text-gray-800 font-serif leading-tight">
          評価制度、それは<br>
          <span class="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">「なりたい自分」</span>になるための地図。
        </h1>
      </div>

      <section class="bg-white rounded-2xl shadow-xl overflow-hidden relative border-t-4 border-amber-400">
        <div class="p-8 md:p-10">
          <h2 class="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span class="text-2xl">🌱</span>
            <span>はじめに</span>
          </h2>
          
          <div class="space-y-6 text-gray-700 leading-relaxed font-medium">
            <p>
              バルニバービの評価制度は、あなたを査定するためのものではありません。<br>
              私たちの理念である、
            </p>
            
            <div class="bg-amber-50 p-6 rounded-xl text-center border border-amber-100">
              <p class="text-lg md:text-xl font-bold text-gray-800 font-serif">
                「食べる、食べていただく仕事を通して、<br>なりたい自分になる」
              </p>
            </div>

            <p>
              これを実現するための仕組みです。
            </p>
          </div>

          <hr class="my-8 border-gray-100">

          <h3 class="text-lg font-bold text-gray-800 mb-4">なぜ、制度が必要なのか？</h3>
          <div class="space-y-4 text-gray-600 leading-relaxed text-sm md:text-base">
            <p>
              仕事ができるようになる。目標を達成する。<br>
              それらはもちろん大切です。
            </p>
            <p>
              しかし、本当に大切なのは、その過程で<br>
              <strong class="text-amber-600 text-lg border-b border-amber-300">「あなた自身がどう成長したか」</strong>です。
            </p>
            <p>
              10年後、飲食の世界は変わっているかもしれません。<br>
              あなた自身も、別の道にいるかもしれません。
            </p>
            <p>
              だからこそ、どんな時代でも、どんな環境でも、<br>
              自分の足で立ち、元気に生きていける人であってほしい。
            </p>
            <div class="bg-gray-800 text-white p-4 rounded-lg text-center mt-6">
              この制度は、あなたの<br>
              <span class="text-xl font-bold text-amber-300">「生きる力」「活きる力」</span><br>
              を育むために存在します。
            </div>
          </div>
        </div>
      </section>

      <section class="relative">
        <div class="absolute inset-0 bg-gradient-to-b from-transparent via-gray-100 to-transparent -z-10 rounded-3xl"></div>
        
        <div class="text-center mb-8">
          <h2 class="text-2xl font-bold text-gray-800 font-serif">評価のモノサシ</h2>
          <p class="text-sm text-gray-500 mt-2">普通の評価と、何が違う？</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-100 rounded-xl p-6 border-2 border-white opacity-70 grayscale hover:grayscale-0 transition-all">
            <div class="text-center mb-4">
              <h3 class="font-bold text-gray-600">多くの会社の基準</h3>
            </div>
            <ul class="space-y-3 text-sm text-gray-600">
              <li class="flex items-center gap-2">
                <span class="text-xl">❌</span> 売上目標を達成したか
              </li>
              <li class="flex items-center gap-2">
                <span class="text-xl">❌</span> 効率よく作業できたか
              </li>
            </ul>
            <div class="mt-4 pt-4 border-t border-gray-200 text-center text-xs font-bold text-gray-500">
              「結果」や「作業効率」で給料が決まる
            </div>
          </div>

          <div class="bg-white rounded-xl p-6 border-2 border-indigo-500 shadow-xl relative overflow-hidden">
            <div class="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">US</div>
            <div class="text-center mb-4">
              <h3 class="font-bold text-indigo-700">私たちが評価するもの</h3>
            </div>
            <div class="text-center mb-4">
              <span class="text-3xl md:text-4xl font-bold text-gray-800 font-serif border-b-4 border-indigo-200 inline-block pb-1">人間力</span>
            </div>
            <ul class="space-y-2 text-sm text-gray-700">
              <li class="flex items-start gap-2">
                <span class="text-indigo-500 mt-1">✓</span>
                人としてどう成長したか
              </li>
              <li class="flex items-start gap-2">
                <span class="text-indigo-500 mt-1">✓</span>
                周囲にどんな良い影響を与えたか
              </li>
              <li class="flex items-start gap-2">
                <span class="text-indigo-500 mt-1">✓</span>
                ユニークな輝きを放っているか
              </li>
            </ul>
          </div>
        </div>
        
        <div class="mt-6 text-center">
          <p class="text-gray-700 font-medium">
            「仕事ができる」の、その先へ。<br>
            人間としての魅力を高めることが、そのまま評価につながります。
          </p>
        </div>
      </section>

      <section class="bg-gradient-to-br from-white to-amber-50 rounded-2xl shadow-xl p-8 md:p-10 border border-amber-100">
        <h2 class="text-xl font-bold text-gray-800 mb-6 text-center">毎日の仕事は「作業」ではありません</h2>
        
        <p class="text-center text-gray-600 mb-8 text-sm">
          日々の業務一つひとつが、<br>あなたの人間力を磨く「舞台」です。
        </p>

        <div class="space-y-4 mb-10">
          <div class="bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row items-center gap-3 border-l-4 border-pink-400">
            <div class="font-bold text-gray-800 w-24 text-center md:text-left">接客</div>
            <div class="text-gray-300 rotate-90 md:rotate-0">➔</div>
            <div class="text-sm text-gray-600 flex-1 text-center md:text-left">感性を磨き、感謝を伝える<span class="font-bold text-pink-600">「表現力」</span>の舞台</div>
          </div>
          
          <div class="bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row items-center gap-3 border-l-4 border-blue-400">
            <div class="font-bold text-gray-800 w-24 text-center md:text-left">商品管理</div>
            <div class="text-gray-300 rotate-90 md:rotate-0">➔</div>
            <div class="text-sm text-gray-600 flex-1 text-center md:text-left">美意識を養い、自分を信じる<span class="font-bold text-blue-600">「自信」</span>を育てる舞台</div>
          </div>

          <div class="bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row items-center gap-3 border-l-4 border-green-400">
            <div class="font-bold text-gray-800 w-24 text-center md:text-left">チーム協働</div>
            <div class="text-gray-300 rotate-90 md:rotate-0">➔</div>
            <div class="text-sm text-gray-600 flex-1 text-center md:text-left">信頼を築き、他者に共感する<span class="font-bold text-green-600">「信頼」</span>を高める舞台</div>
          </div>
        </div>

        <div class="mt-12 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="bg-gray-800 text-white p-4 text-center">
            <h3 class="font-bold text-lg flex items-center justify-center gap-2">
              <span class="text-2xl">🔄</span> 3. 学びの入口（双方向）
            </h3>
          </div>
          <div class="p-6">
            <p class="text-center text-gray-600 text-sm mb-6">
              成長へのアプローチは自由です。<br>
              今のあなたの気持ちに合う「入口」を選んでください。
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="bg-pink-50 p-5 rounded-lg border border-pink-100 flex flex-col h-full">
                <div class="flex items-center gap-2 mb-3">
                  <span class="bg-pink-100 text-pink-600 w-8 h-8 flex items-center justify-center rounded-full font-bold">1</span>
                  <h4 class="font-bold text-pink-800">人間力から選ぶ</h4>
                </div>
                <div class="text-sm text-gray-700 flex-1">
                  <p class="mb-2 font-bold">「こんな人になりたい！」</p>
                  <p class="text-xs text-gray-500 bg-white p-2 rounded border border-pink-100 mb-2">
                    例：「共感力を伸ばしたい」<br>
                    　↓<br>
                    「お客様体験」「スタッフケア」などの業務に挑戦する
                  </p>
                </div>
              </div>

              <div class="bg-blue-50 p-5 rounded-lg border border-blue-100 flex flex-col h-full">
                <div class="flex items-center gap-2 mb-3">
                  <span class="bg-blue-100 text-blue-600 w-8 h-8 flex items-center justify-center rounded-full font-bold">2</span>
                  <h4 class="font-bold text-blue-800">業務から育てる</h4>
                </div>
                <div class="text-sm text-gray-700 flex-1">
                  <p class="mb-2 font-bold">「この仕事を極めたい！」</p>
                  <p class="text-xs text-gray-500 bg-white p-2 rounded border border-blue-100 mb-2">
                    例：「商品力を伸ばしたい」<br>
                    　↓<br>
                    「探究・意味づけ力」「自己信頼」などが自然に育つ
                  </p>
                </div>
              </div>
            </div>

            <div class="mt-6 text-center bg-gray-100 p-3 rounded-lg">
              <p class="text-sm font-bold text-gray-700">
                👉 どちらの入口も正解です。<br>
                <span class="font-normal">本人と店長の対話で、柔軟に成長目標を設定しましょう。</span>
              </p>
            </div>
          </div>
        </div>

      </section>

      <section class="bg-gray-900 text-white rounded-xl p-8 md:p-12 text-center relative overflow-hidden">
        <div class="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        <div class="relative z-10">
          <h3 class="text-lg font-bold mb-4 text-amber-400">あなたへのメッセージ</h3>
          <p class="text-sm md:text-base leading-relaxed mb-6 text-gray-300">
            「なりたい自分」になるために必要なのは、<br>
            単にお客様を喜ばせることだけではありません。<br>
            喜んでいただくプロセスの中で、<br>
            <span class="text-white font-bold">あなた自身の心がどう動き、どう育ったか</span>です。
          </p>
          <p class="text-sm md:text-base leading-relaxed mb-8">
            この制度は、会社があなたを縛るルールではありません。<br>
            あなたが「なりたい自分」へ向かうための<br>
            <strong class="text-2xl text-white font-serif mt-2 block">「伴走者」</strong>です。
          </p>
          
          <button onclick="switchTab('prologue')" class="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105">
            さあ、新しい自分に出会う物語へ
          </button>
        </div>
      </section>

    </div>
  `;
}

function renderTabContent() {
  switch (state.activeTab) {
    case 'dashboard':
      return renderDashboard();
    case 'overview':
      return renderOverview();
    case 'flow': return renderFlow();
    case 'philosophy':
      return renderPhilosophy();
    case 'prologue':
      return renderStory();
    case 'works':
      return renderWorks();
    case 'humanpower':
      return renderHumanPower();
    case 'myunique':
      return renderMyUnique();
    case 'role':
      return renderRole();
    case 'evaluation':
      return renderEvaluation();
    case 'resources':
      return renderResources();
    case 'faq':
      return renderFaq();
    default:
      return renderDashboard();
  }
}

function renderFaq() {
  const faqCategories = [
    {
      title: "🔰 制度・評価の基本",
      color: "green",
      questions: [
        {
          q: "なぜ評価制度が変わったのですか？",
          a: "「作業ができるかどうか」だけでなく、理念である「なりたい自分になる」を応援する仕組みにするためです。<br>業務を通じて人間力がどう磨かれたか、その成長プロセス自体を評価し、給与に反映させることを目的としています。"
        },
        {
          q: "「星」は何を表していますか？",
          a: "あなたの「人間力」の獲得状況を可視化したものです。<br>業務ができるようになる（Doing）と、その過程で人間力（Being）が磨かれます。星の総数が、そのまま基本給のランクに直結します。"
        },
        {
          q: "なぜ「バルニバービ・スピリッツ」が必須なのですか？",
          a: "これらは私たちの土台（ベース）だからです。<br>どんなに高いスキルがあっても、挨拶や感謝、プロ意識といった土台がなければ、お客様や仲間を幸せにすることはできないと考えています。"
        },
        {
          q: "一度獲得した「星」が減ることはありますか？",
          a: "<strong>原則として、星が減ることはありません。</strong><br>一度身につけた技術や人間力はあなたの財産だからです。ただし、長期間その業務を行わず実力が著しく低下した場合などは、Sproutに戻る（再認定が必要になる）可能性があります。"
        }
      ]
    },
    {
      title: "💰 給与・ランクについて",
      color: "amber",
      questions: [
        {
          q: "給料はどうすれば上がりますか？",
          a: "大きく分けて3つの方法があります。<br>1. <strong>星を増やす</strong>（基本給UP）<br>2. <strong>役職・役割を担う</strong>（役職給UP）<br>3. <strong>独自の強みを発揮する</strong>（ユニーク給UP）"
        },
        {
          q: "SproutとHarvestの違いは何ですか？",
          a: "<strong>Sprout（芽生え/0.5星）：</strong>その業務を一人称で「できる」状態。<br><strong>Harvest（実り/1.0星）：</strong>その業務を極め、成果を出し、他者に教えたり良い影響を与えられる状態です。"
        },
        {
          q: "給与や評価が下がることはありますか？",
          a: "<strong>はい、あります。</strong><br>人間力（星）が高くても、遅刻や無断欠勤、ハラスメントなどの<strong>「就業規則・服務規律違反」</strong>が続く場合は、評価ランクの降格や、役職手当の停止対象となります。"
        },
        {
          q: "役職を降りたら、給料は下がりますか？",
          a: "「役職給」は責任に対する対価なので、役職を離れればその分はなくなります。<br>しかし、積み上げた<strong>「基本給（星）」はそのまま維持されます。</strong>"
        }
      ]
    },
    {
      title: "🚀 MY Unique（ユニーク給）",
      color: "purple",
      questions: [
        {
          q: "チャレンジ目標はプライベートなことでもいいですか？",
          a: "<strong>はい、大歓迎です！</strong><br>ダイエットや読書、資格勉強など、あなたが「なりたい自分」に近づくための努力であれば、仕事に直接関係なくても応援金（5,000円）を支給します。"
        },
        {
          q: "スキル給の金額はどう決まりますか？",
          a: "「資格を持っているか」ではなく<strong>「どう活かして貢献しているか」</strong>で決まります。<br>店舗内での活躍なら〜3万円、業績への貢献なら〜5万円など、上長との対話を通じて貢献度を見積もります。"
        }
      ]
    },
    {
      title: "⚙️ 運用・その他",
      color: "blue",
      questions: [
        {
          q: "自己評価と店長の評価が合わない場合は？",
          a: "<strong>対話（すり合わせ）</strong>を行います。<br>このアプリを見ながら「なぜ自分はHarvestだと思うか」「店長はどう見ているか」を話し合ってください。その認識のズレを埋める作業こそが成長につながります。"
        },
      ]
    }
  ];

  return `
    <div class="max-w-3xl mx-auto pb-20 fade-in space-y-8">
      
      <div class="text-center py-8">
        <h2 class="text-3xl font-bold text-gray-800 mb-2">よくある質問 (FAQ)</h2>
        <p class="text-gray-500">制度に関する疑問にお答えします</p>
      </div>

      <div class="space-y-6">
        ${faqCategories.map(cat => `
          <div class="bg-white rounded-xl shadow-md overflow-hidden border-t-4 border-${cat.color}-500">
            <div class="bg-${cat.color}-50 px-6 py-4 flex items-center gap-3">
              <h3 class="font-bold text-${cat.color}-800 text-lg">${cat.title}</h3>
            </div>
            <div class="divide-y divide-gray-100">
              ${cat.questions.map(item => `
                <details class="group">
                  <summary class="flex justify-between items-center font-medium cursor-pointer list-none p-5 hover:bg-gray-50 transition-colors">
                    <span class="text-gray-800 font-bold text-sm md:text-base flex items-start gap-3">
                      <span class="text-${cat.color}-500 min-w-[20px]">Q.</span>
                      ${item.q}
                    </span>
                    <span class="transition group-open:rotate-180 text-gray-400">
                      <svg fill="none" height="24" shape-rendering="geometricPrecision" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div class="text-gray-600 text-sm leading-relaxed px-5 pb-5 pl-12 animate-fade-in bg-gray-50/30">
                    <div class="flex gap-2">
                      <span class="font-bold text-gray-400">A.</span>
                      <div>${item.a}</div>
                    </div>
                  </div>
                </details>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="bg-gray-100 p-6 rounded-xl text-center mt-12">
        <p class="text-gray-600 text-sm mb-4">制度に関する不明な点があれば、HCM部に<br>いつでも相談してください。</p>
        <button onclick="window.location.href='mailto:hcm@garb.co.jp'" class="text-blue-600 font-bold text-sm hover:underline flex items-center justify-center gap-2">
          <span>📧</span> HCM部に問い合わせる
        </button>
      </div>

    </div>
  `;
}

function renderFlow() {
  return `
    <div class="max-w-5xl mx-auto pb-20 fade-in space-y-16">
      
      <div class="text-center py-8">
        <span class="text-indigo-600 font-bold tracking-widest text-xs uppercase mb-2 block">PROCESS & SCHEDULE</span>
        <h2 class="text-3xl font-bold text-gray-800 mb-4 font-serif">評価運用フロー</h2>
        <p class="text-gray-500">
          半年に一度の成長確認。<br>
          「対話」の質を高め、期限を守るためのガイドラインです。
        </p>
      </div>

      <section class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div class="bg-gray-800 text-white p-4 text-center">
          <h3 class="font-bold text-lg flex items-center justify-center gap-2">
            <span>📅</span> 運用スケジュール（全体）
          </h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
              <tr>
                <th class="p-4 w-24 text-center">夏</th>
                <th class="p-4 w-24 text-center border-l border-gray-200">冬</th>
                <th class="p-4 w-24 text-center border-l border-gray-200">誰が</th>
                <th class="p-4 border-l border-gray-200">アクション内容</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr class="hover:bg-gray-50">
                <td class="p-4 text-center text-gray-500">6/1〜</td>
                <td class="p-4 text-center text-gray-500 border-l">12/1〜</td>
                <td class="p-4 text-center font-bold text-gray-600 border-l">HCM部</td>
                <td class="p-4 border-l">
                  <div class="font-bold">スタッフリスト作成</div>
                  <div class="text-xs text-gray-500">所属店舗、担当店舗を整理する</div>
                </td>
              </tr>
              <tr class="hover:bg-gray-50">
                <td class="p-4 text-center font-bold text-blue-600">7/15</td>
                <td class="p-4 text-center font-bold text-blue-600 border-l">1/15</td>
                <td class="p-4 text-center font-bold text-blue-700 border-l">HCM部</td>
                <td class="p-4 border-l">
                  <div class="font-bold text-blue-600">【評価開始】</div>
                  <div class="text-xs text-gray-500">システム入力期間＆（面談スタート） / 対象者リスト配布</div>
                </td>
              </tr>
              <tr class="bg-blue-50/50 hover:bg-blue-50">
                <td class="p-4 text-center font-bold text-blue-800">7/20<br>~7/31</td>
                <td class="p-4 text-center font-bold text-blue-800 border-l">1/20<br>~1/31</td>
                <td class="p-4 text-center font-bold text-gray-800 border-l">本人</td>
                <td class="p-4 border-l">
                  <div class="font-bold text-blue-800">【自己評価】</div>
                  <div class="text-xs text-gray-600">自己評価を入力し、1on1日程を確保。<br><span class="text-red-500">※未入力者はシステムアラート表示</span></div>
                </td>
              </tr>
              <tr class="bg-orange-50/50 hover:bg-orange-50">
                <td class="p-4 text-center font-bold text-orange-800">8/1<br>~8/20</td>
                <td class="p-4 text-center font-bold text-orange-800 border-l">2/1<br>~2/20</td>
                <td class="p-4 text-center font-bold text-gray-800 border-l">評価者</td>
                <td class="p-4 border-l">
                  <div class="font-bold text-orange-800">【1on1・評価入力】</div>
                  <div class="text-xs text-gray-600">面談終了次第、その場で入力。<br>（一般→店長確定 / 店長→役員確定）</div>
                </td>
              </tr>
              <tr class="bg-red-50 border-t-2 border-b-2 border-red-200">
                <td class="p-4 text-center font-extrabold text-red-600 text-lg">8/20</td>
                <td class="p-4 text-center font-extrabold text-red-600 text-lg border-l border-red-200">2/20</td>
                <td class="p-4 text-center font-bold text-red-800 border-l border-red-200">全評価者</td>
                <td class="p-4 border-l border-red-200">
                  <div class="font-bold text-red-700">🚨 データ入力締切（厳守）</div>
                  <div class="text-xs text-red-800 font-bold mt-1">
                    この日までにステータスを「完了」にする。<br>
                    間に合わない場合、昇給は翌月回しとなります。
                  </div>
                </td>
              </tr>
              <tr class="hover:bg-gray-50">
                <td class="p-4 text-center text-gray-500">8/21~</td>
                <td class="p-4 text-center text-gray-500 border-l">2/21~</td>
                <td class="p-4 text-center font-bold text-gray-600 border-l">HCM/LR</td>
                <td class="p-4 border-l">
                  <div class="font-bold">検品・契約書発行</div>
                  <div class="text-xs text-gray-500">SmartHR連携・同意取得</div>
                </td>
              </tr>
              <tr class="bg-green-50 text-green-900">
                <td class="p-4 text-center font-bold">9/1</td>
                <td class="p-4 text-center font-bold border-l border-green-200">3/1</td>
                <td class="p-4 text-center font-bold border-l border-green-200">全社</td>
                <td class="p-4 border-l border-green-200 font-bold">🎉 新給与スタート</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl shadow-lg border-t-4 border-red-500 p-6 relative overflow-hidden">
          <div class="absolute -right-4 -top-4 bg-red-100 w-24 h-24 rounded-full opacity-50"></div>
          <h3 class="text-lg font-bold text-red-800 mb-3 flex items-center gap-2">
            <span class="text-2xl">⚡</span> 対策①：評価者への責任
          </h3>
          <p class="text-sm text-gray-700 leading-relaxed mb-4">
            「部下の評価を期日（20日）までに出す」ことは、<br>
            <strong>店長自身の管理能力（コンプライアンス・事務処理）の評価対象</strong>です。
          </p>
          <div class="bg-red-50 p-3 rounded border border-red-100 text-xs text-red-900 font-bold">
            提出遅れ ＝ 店長自身の「コンプライアンス・ガバナンス」評価が<br>
            <span class="text-red-600 text-sm">SEED（評価なし）</span> となり、自身の賞与・給与に影響します。
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-lg border-t-4 border-orange-500 p-6 relative overflow-hidden">
          <div class="absolute -right-4 -top-4 bg-orange-100 w-24 h-24 rounded-full opacity-50"></div>
          <h3 class="text-lg font-bold text-orange-800 mb-3 flex items-center gap-2">
            <span class="text-2xl">📅</span> 対策②：昇給の翌月スライド
          </h3>
          <p class="text-sm text-gray-700 leading-relaxed mb-4">
            20日までにデータが揃わなかったスタッフは、事務処理が間に合わないため、
            <strong>昇給時期を翌月にずらします。</strong>
          </p>
          <div class="bg-orange-50 p-3 rounded border border-orange-100 text-xs text-orange-900 font-bold">
            ※遡及支給（後からまとめて払うこと）はしません。<br>
            <span class="text-orange-600">「店長の提出遅れで、部下の昇給が1ヶ月遅れる」</span><br>
            という事態にならないよう、必ず期限を守ってください。
          </div>
        </div>
      </section>

      <section class="bg-blue-50 rounded-2xl shadow-xl border border-blue-200 p-8">
        <h3 class="text-2xl font-bold text-blue-800 mb-6 flex items-center gap-2">
          <span class="bg-white p-2 rounded-lg shadow-sm">🐣</span> スタッフの事前準備
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div class="space-y-6">
            <div class="bg-white p-5 rounded-xl shadow-sm">
              <h4 class="font-bold text-gray-800 mb-3 border-b pb-2">この6ヶ月の振り返り</h4>
              <ul class="space-y-3 text-sm text-gray-600">
                <li class="flex items-start gap-2">
                  <span class="text-blue-500">●</span>
                  印象に残っている出来事や経験は？
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-blue-500">●</span>
                  「うまくいった」「やり切れなかった」と思う業務は？
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-blue-500">●</span>
                  <span class="font-bold text-blue-700">次の6ヶ月で取り組みたい業務は？</span><br>
                  <span class="text-xs text-gray-400">（例：商品管理、イベント企画、人材育成など）</span>
                </li>
              </ul>
            </div>

            <div class="bg-white p-5 rounded-xl shadow-sm">
              <h4 class="font-bold text-gray-800 mb-3 border-b pb-2">未来への視点</h4>
              <ul class="space-y-3 text-sm text-gray-600">
                <li class="flex items-start gap-2">
                  <span class="text-purple-500">●</span>
                  <span class="font-bold text-purple-700">今、磨きたい「人間力」は？</span><br>
                  <span class="text-xs text-gray-400">（例：共感力、探究心、指導力など）</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-purple-500">●</span>
                  上司に相談したいこと、欲しいサポートは？
                </li>
              </ul>
            </div>
          </div>

          <div class="bg-white p-5 rounded-xl shadow-sm border-2 border-blue-100">
            <h4 class="font-bold text-gray-800 mb-4 text-center">📝 事前入力フォーマット（例）</h4>
            <div class="text-xs text-gray-500 mb-2 text-center">前期に握った「重点テーマ」について入力</div>
            
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left border-collapse">
                <thead class="bg-gray-100 text-gray-700">
                  <tr>
                    <th class="p-2 border">重点業務</th>
                    <th class="p-2 border">自己評価</th>
                    <th class="p-2 border">振り返りコメント</th>
                  </tr>
                </thead>
                <tbody class="text-gray-600">
                  <tr>
                    <td class="p-2 border font-bold">衛生・安全管理</td>
                    <td class="p-2 border">
                      <div class="space-y-1">
                        <label class="block text-gray-400">□ 🌱 Sprout</label>
                        <label class="block text-green-700 font-bold">☑ 🌾 Harvest</label>
                      </div>
                    </td>
                    <td class="p-2 border">
                      毎日の清掃チェックを徹底し、保健所検査も指摘ゼロでした。
                    </td>
                  </tr>
                  <tr>
                    <td class="p-2 border font-bold">★チャレンジ</td>
                    <td class="p-2 border">
                      <label class="block text-pink-600 font-bold">☑ 達成！</label>
                    </td>
                    <td class="p-2 border">
                      半年で-10kg達成。自己管理に自信がついた。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="mt-4 text-center">
              <span class="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">店長判定欄は面談時に記入</span>
            </div>
          </div>
        </div>
      </section>

      <section class="bg-white rounded-2xl shadow-xl border-t-4 border-orange-400 p-8">
        <h3 class="text-2xl font-bold text-orange-800 mb-6 flex items-center gap-2">
          <span class="bg-orange-100 p-2 rounded-lg">🧢</span> 評価者の役割（責任者）
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div class="bg-orange-50 p-4 rounded-lg text-center">
            <div class="text-2xl mb-1">👂</div>
            <div class="font-bold text-gray-800">聞く役</div>
            <div class="text-xs text-gray-600">スタッフの「語り」を引き出す</div>
          </div>
          <div class="bg-orange-50 p-4 rounded-lg text-center">
            <div class="text-2xl mb-1">🧩</div>
            <div class="font-bold text-gray-800">補う役</div>
            <div class="text-xs text-gray-600">言葉足らずや曖昧さを明確にする</div>
          </div>
          <div class="bg-orange-50 p-4 rounded-lg text-center">
            <div class="text-2xl mb-1">🧭</div>
            <div class="font-bold text-gray-800">責任者の役</div>
            <div class="text-xs text-gray-600">方向性・期待を明確に示す</div>
          </div>
        </div>

        <div class="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h4 class="font-bold text-gray-800 mb-4 text-center">面談の流れ（推奨フロー）</h4>
          
          <div class="space-y-4">
            <div class="flex gap-4">
              <div class="flex-none flex flex-col items-center">
                <div class="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">1</div>
                <div class="h-full w-0.5 bg-gray-300 my-1"></div>
              </div>
              <div class="pb-4">
                <h5 class="font-bold text-gray-800">自己語り</h5>
                <p class="text-sm text-gray-600">スタッフが「６ヶ月取り組んできたこと」「次の６ヶ月で挑戦したいこと」を語る。評価者は丁寧に聞く。</p>
              </div>
            </div>

            <div class="flex gap-4">
              <div class="flex-none flex flex-col items-center">
                <div class="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">2</div>
                <div class="h-full w-0.5 bg-gray-300 my-1"></div>
              </div>
              <div class="pb-4">
                <h5 class="font-bold text-gray-800">掘り下げ</h5>
                <p class="text-sm text-gray-600">「具体的にどうだったのか」「なぜ次はそれを目指すのか」と質問し、本音を引き出す。</p>
              </div>
            </div>

            <div class="flex gap-4">
              <div class="flex-none flex flex-col items-center">
                <div class="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">3</div>
                <div class="h-full w-0.5 bg-gray-300 my-1"></div>
              </div>
              <div class="pb-4">
                <h5 class="font-bold text-gray-800">期待提示 & すり合わせ</h5>
                <p class="text-sm text-gray-600">本人の目指したいことと、責任者として「こう成長してほしい」を伝え、双方の言葉で合意をつくる。</p>
              </div>
            </div>

            <div class="flex gap-4">
              <div class="flex-none flex flex-col items-center">
                <div class="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center font-bold text-sm">4</div>
              </div>
              <div>
                <h5 class="font-bold text-gray-800">締め</h5>
                <p class="text-sm text-gray-600">次の6ヶ月に向けた一言宣言。</p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 text-center text-sm text-orange-800 font-bold bg-orange-50 p-3 rounded-lg">
          👉 面談は「過去の査定」ではなく、<br>
          “次の6ヶ月をどう生きるか” を握る時間です。
        <section class="bg-gradient-to-br from-gray-900 to-indigo-900 rounded-xl p-10 text-white text-center relative overflow-hidden shadow-2xl">
        <div class="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        <div class="relative z-10">
          <h3 class="text-indigo-400 font-bold tracking-widest text-sm uppercase mb-6">INSTITUTIONAL MESSAGE</h3>
          
          <p class="text-2xl md:text-3xl font-serif font-bold leading-relaxed mb-8">
            評価とは、<br>
            <span class="text-yellow-400">“語れる力”</span>を育てること。
          </p>

          <div class="space-y-4 text-gray-300 font-medium leading-loose mb-10">
            <p>
              スタッフは<span class="text-white border-b border-indigo-500">「自分の成長」</span>を語り、<br>
              責任者は<span class="text-white border-b border-indigo-500">「未来の期待」</span>を語る。
            </p>
            <p>
              その対話を通して、<br>
              「なりたい自分になる」半年を積み重ねていく。
            </p>
          </div>

          <div class="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20 inline-block max-w-2xl">
            <div class="flex flex-col md:flex-row items-center gap-4 text-left">
              <div class="text-4xl">🗣️</div>
              <div>
                <h4 class="font-bold text-white mb-2 text-lg">なぜ「話す」ではなく「語る」なのか</h4>
                <p class="text-sm text-indigo-100 leading-relaxed">
                  それは、本当に身についた経験しか、人は熱を持って語れないからです。<br>
                  浮かんでくる情景、言葉に乗る熱量。<br>
                  それこそが、あなたが本気で取り組んだ何よりの証明です。
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  `;
}

// 初期化実行 (Safe Mode)
function initApp() {
  try {
    // 1. Data check
    if (typeof HUMAN_POWERS === 'undefined' || typeof WORKS === 'undefined') {
      throw new Error('Data definitions (HUMAN_POWERS/WORKS) are missing. Check data.js loading.');
    }

    // 2. Element check
    const app = document.getElementById('app');
    if (!app) {
      throw new Error('#app element not found.');
    }

    // 3. Start
    loadState();
    calculateStars();
    render();

    // 4. Post-render actions
    if (state.activeTab === 'dashboard') {
      setTimeout(() => drawRadarChart(), 100);
    }

    console.log('App Initialized successfully');

  } catch (e) {
    console.error('Initialization Failed:', e);
    // Explicitly show error on screen if not caught by window.onerror
    const app = document.getElementById('app') || document.body;
    app.innerHTML = `
      <div style="padding: 2rem; color: #7f1d1d; background: #fef2f2; font-family: sans-serif;">
        <h2 style="font-weight: bold; margin-bottom: 1rem;">Failed to load application</h2>
        <p>${e.message}</p>
        <pre style="background: #fff; padding: 1rem; margin-top: 1rem; overflow: auto;">${e.stack}</pre>
      </div>
    `;
  }
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
