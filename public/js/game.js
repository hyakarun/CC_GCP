// --- Game Configuration ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Configuration fallback
let API_BASE = "api";
if (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL) {
    API_BASE = CONFIG.API_BASE_URL;
}

let currentUserEmail = "";
let currentUserDisplayName = "";
// ★追加: アプリバージョン（キャッシュ制御用）
const APP_VERSION = "v1.1.0";
// ★最適化: 初回ロード時のデータを保持
let initialSaveData = null;
let lastSavedDataString = "";
let lastSaveTime = 0;
const SAVE_INTERVAL_MS = 60000; // 1分間隔

// プレイヤー情報
let player = {
    x: 25,
    lane: 1,
    lv: 1,
    hp: 100,
    maxHp: 100,
    exp: 0,
    nextExp: 50,
    sp: 0,
    skill_sp: 0,
    money: 0,
    stats: { str: 5, vit: 5, agi: 5, int: 5, dex: 5, luk: 5 },
    skills: {}, // { skillId: level }
    skill_cooldowns: {}, // { skillId: remainingFrames }
    battleStats: {
        atk: 0,
        matk: 0,
        def_div: 0,
        def_sub: 0,
        mdef_div: 0,
        mdef_sub: 0,
        hit: 0,
        eva: 0,
        cri: 0,
        res: 0
    },
    attackTimer: 0,
    baseAttackInterval: 60,
    range: 75,
    width: 30,
    height: 30,
    lastLogin: Date.now(),
    currentDungeonId: 1,
    currentWave: 1,
    killsInWave: 0,
    dungeonProgress: {},
    image: "player/player1.png", // Default image
    equipment: {
        head_top: null,
        head_mid: null,
        head_low: null,
        neck: null,
        ear: null,
        body: null,
        arm: null,
        waist: null,
        leg: null,
        foot: null,
        hand_r: null,
        hand_l: null,
        sub1: null,
        sub2: null
    },
    inventory: [],
    // 職業システム
    currentJob: "adventurer",
    jobData: {
        adventurer: { lv: 1, exp: 0, nextExp: 100 },
        miner: { lv: 1, exp: 0, nextExp: 100 },
        harvester: { lv: 1, exp: 0, nextExp: 100 },
        toolsmith: { lv: 1, exp: 0, nextExp: 100 },
        blacksmith: { lv: 1, exp: 0, nextExp: 100 },
        armorsmith: { lv: 1, exp: 0, nextExp: 100 },
        farmer: { lv: 1, exp: 0, nextExp: 100 },
        rancher: { lv: 1, exp: 0, nextExp: 100 },
        repairer: { lv: 1, exp: 0, nextExp: 100 }
    },
    // お知らせ
    lastSeenNewsTimestamp: 0
};

// 職業マスタデータ（補正倍率など）
// 職業マスタデータは job_data.js に移動しました

let enemies = [];
let damageTexts = [];
const lanes = [0.2, 0.45, 0.7];
let spawnTimer = 0;
let masterData = null;
const masterDataMap = {
    items: new Map(),
    skills: new Map(),
    enemies: new Map(),
    options: new Map(),
    dungeons: new Map(),
    exp_table: new Map()
};
const imageCache = {};
let saveTimer = 0;
let isPaused = false;

// --- 職業個別説明データ ---
// 職業個別説明データは job_data.js に移動しました

// --- ジョブミニゲーム用変数 ---
let bsGaugeValue = 0;
let bsIsPressing = false;
let bsTargetPos = 75; // 75%
let asCursorPos = 0;
let asCursorDir = 1;
let tsWords = [
    "HAMMER",
    "ANVIL",
    "SWORD",
    "SHIELD",
    "ARMOR",
    "PLATE",
    "CHAIN",
    "STEEL",
    "IRON",
    "BRONZE"
];
let tsCurrentWord = "";
let gatherProgress = 0;
let farmProgress = 0;
let farmStep = 0;
let jobUpdateTimer = 0;
let isGameRunning = false;
let gameSpeed = 1;

const DEFAULT_ENEMIES_PER_WAVE = 5;
let fade = {
    active: false,
    state: "none",
    alpha: 0,
    speed: 0.05,
    callback: null
};

// --- 初期化フロー ---
window.onload = async function () {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // ログイン確認
    try {
        const apiPath = API_BASE + "/check_session.php";
        console.log("[System] Checking session at:", apiPath);
        const res = await fetch(apiPath);
        if (!res.ok) throw new Error("Session request failed with status: " + res.status);
        const data = await res.json();
        console.log("[System] Session data:", data);

        if (data.status === "logged_in") {
            console.log("[System] Logged in as:", data.email);
            // 最適化: セッションチェック時に読み取ったデータを保持
            initialSaveData = data.save_data;
            showGameScreen(data.email, data.name);
        } else {
            console.log("[System] Not logged in. Showing login overlay.");
            document.getElementById("login-overlay").style.display = "flex";
        }
    } catch (e) {
        console.error("[System] Session check failed:", e);
        // 開発環境のみアラートを出す
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
            alert(
                "通信エラーが発生しました。\nURL: " +
                    (API_BASE + "/check_session.php") +
                    "\nエラー: " +
                    e.message
            );
        }
        document.getElementById("login-overlay").style.display = "flex";
    }
};

window.doLogin = async function () {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("login-error");
    errorEl.innerText = "";
    if (!email || !password) {
        errorEl.innerText = "入力してください";
        return;
    }
    const rememberMe = document.getElementById("remember_me").checked;
    try {
        const res = await fetch(API_BASE + "/login.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, remember_me: rememberMe })
        });
        const data = await res.json();
        if (data.status === "success") {
            showGameScreen(email, data.name || "");
        } else {
            errorEl.innerText = data.message;
        }
    } catch (e) {
        errorEl.innerText = "通信エラー";
    }
};

window.doRegister = async function () {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("login-error");
    errorEl.innerText = "";

    if (!name || !email || !password) {
        errorEl.innerText = "全ての項目を入力してください";
        return;
    }

    try {
        const res = await fetch(API_BASE + "/register.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (data.status === "success") {
            alert("登録しました！ログインします。");
            doLogin();
        } else {
            errorEl.innerText = data.message;
        }
    } catch (e) {
        errorEl.innerText = "通信エラー";
    }
};

window.doLogout = async function () {
    if (!confirm("ログアウトしますか？")) return;
    await fetch(API_BASE + "/logout.php");
    location.reload();
};

window.toggleMode = function () {
    document.getElementById("btn-group-login").classList.toggle("hidden");
    document.getElementById("btn-group-register").classList.toggle("hidden");
    document.getElementById("name").classList.toggle("hidden");

    const title = document.getElementById("login-title");
    title.innerText = title.innerText === "ログイン" ? "新規登録" : "ログイン";
    document.getElementById("login-error").innerText = "";
};

function showGameScreen(email, name) {
    currentUserEmail = email;
    currentUserDisplayName = name || "Guest";

    document.getElementById("login-overlay").style.display = "none";
    document.getElementById("game-container").style.display = "flex";

    // ★追加: 表示切替後にキャンバスサイズを再計算しないと、非表示時のサイズ(0など)になってしまうため
    resizeCanvas();

    const nameEl = document.getElementById("val-name");
    if (nameEl) nameEl.innerText = currentUserDisplayName;

    startGame();
}

async function startGame() {
    if (isGameRunning) return;

    try {
        // ★変更: Date.now() による強制リロードを廃止し、バージョン管理に切り替え（CDNキャッシュ有効化のため）
        console.log("[System] Loading master data...");
        const res = await fetch("data/master_data.json?v=" + APP_VERSION);
        if (!res.ok) throw new Error("Failed to load master_data.json");
        masterData = await res.json();
        console.log("[System] Master data loaded.");

        // ★最適化: マスタデータのインデックス作成
        indexMasterData();

        applyConfig();
        initDungeonList();
        checkNewsBadge();

        isGameRunning = true; // 正常にデータがロードされたらフラグを立てる
    } catch (e) {
        console.error("[System] Startup failed:", e);
        alert("データの読み込みに失敗しました。ページをリロードしてください。");
        return;
    }

    // ★変更: loadGame を待機してから UI 更新等を行う
    console.log("[System] Loading player save data...");
    await loadGame();

    syncExpTable();
    calcBattleStats();
    calculateOfflineProgress();

    updateUI();
    renderCombatSkills();
    requestAnimationFrame(gameLoop);
    document.addEventListener("visibilitychange", handleVisibilityChange);
}

// --- ゲームロジック ---

function startTransition(onDarkCallback) {
    if (fade.active) return;
    fade.active = true;
    fade.state = "out";
    fade.alpha = 0;
    fade.callback = onDarkCallback;
}

function getReqKills(dData) {
    if (!dData) return DEFAULT_ENEMIES_PER_WAVE;
    const maxWave = Number(dData.wave_count || 1);
    const hasBoss = Number(dData.boss_flag || 0) === 1;
    if (hasBoss && player.currentWave === maxWave) return 1;
    return Number(dData.enemies_per_wave) || DEFAULT_ENEMIES_PER_WAVE;
}

// ダンジョンタブ管理
let currentDungeonTab = "normal";

window.switchDungeonTab = function (tabName) {
    if (currentDungeonTab === tabName) return;
    currentDungeonTab = tabName;

    // タブの見た目更新
    document
        .querySelectorAll(".dungeon-tabs .tab-btn")
        .forEach((btn) => btn.classList.remove("active"));
    const activeBtn = document.getElementById("tab-" + tabName);
    if (activeBtn) activeBtn.classList.add("active");

    initDungeonList();
};

function initDungeonList() {
    if (!masterData || !masterData.dungeons) return;
    const listEl = document.querySelector(".dungeon-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const sortedDungeons = masterData.dungeons.sort((a, b) => Number(a.id) - Number(b.id));

    // 表示がない場合のメッセージ用フラグ
    let hasDungeon = false;

    sortedDungeons.forEach((d) => {
        // タブによるフィルタリング
        // typeプロパティがない場合は 'normal' とみなす
        const type = d.type || "normal";
        if (type !== currentDungeonTab) return;

        const id = Number(d.id);
        if (!player.dungeonProgress[id])
            player.dungeonProgress[id] = {
                clearCount: 0,
                killCount: 0,
                cleared: false
            };
        const progress = player.dungeonProgress[id];
        if (typeof progress.clearCount === "undefined") progress.clearCount = 0;

        let isUnlocked = id === 1;
        // 通常ダンジョン、イベントダンジョン問わず、解放条件は前のIDのクリア状況に依存する実装のまま
        // または unlocked_flag 等があればそれを見るが、現状はIDベース
        if (id > 1) {
            // イベントダンジョンの場合、解放条件が特殊な可能性があるが、
            // 一旦既存ロジック(前のIDクリア)を踏襲するか、あるいはイベントは最初から開放するか？
            // ユーザー指示は「出し分け」なので、解放ロジックは変えない。
            // ただし、Normalの最後 -> Eventの最初 という繋がりはおかしいかもしれない。
            // data側で制御すべきだが、ここでは簡易的に「イベントなら無条件解放」または「typeが同じ前のダンジョン」を見るべきか。
            // とりあえず既存ロジックそのままで、データ整合性はデータ側に委ねる。
            const prevProgress = player.dungeonProgress[id - 1];
            const prevClearCount = prevProgress ? prevProgress.clearCount || 0 : 0;
            const req = d.req_clears ? Number(d.req_clears) : 1;
            if (prevClearCount >= req) isUnlocked = true;
        }

        // イベントダンジョンは無条件で表示したい場合があるかもしれないが、
        // ここでは「ロックされていてもリストには出さない」既存仕様に従う。
        if (!isUnlocked) return;

        hasDungeon = true;
        let style = "";
        if (player.currentDungeonId == id) style = "border: 2px solid #3498db; background:#eaf2f8;";
        const btnText = player.currentDungeonId == id ? "探索中" : "移動";
        const btnDisabled = player.currentDungeonId == id ? "disabled" : "";
        const statusText = `<span style="color:#e67e22">Clear: ${progress.clearCount}</span>`;

        const div = document.createElement("div");
        div.className = "dungeon-item";
        div.style = style;
        div.innerHTML = `
            <div class="dungeon-header">
                <h4>${d.name}</h4>
                <span class="lv-label">Lv.${d.req_lv}</span>
            </div>
            <div class="dungeon-status">
                <div class="status-text">${statusText}</div>
            </div>
            <button onclick="changeDungeon(${id})" ${btnDisabled}>${btnText}</button>
        `;
        listEl.appendChild(div);
    });

    if (!hasDungeon) {
        listEl.innerHTML = `<div class="no-dungeon-message">表示できるダンジョンがありません。</div>`;
    }
}

window.changeDungeon = function (dungeonId) {
    if (player.currentDungeonId == dungeonId) return;
    startTransition(() => {
        player.currentDungeonId = dungeonId;
        player.currentWave = 1;
        player.killsInWave = 0;
        enemies = [];
        damageTexts = [];
        initDungeonList();
        saveGame();
        // 暗転明けにフィールド名を表示するための準備
        fade.showFieldTitle = true;
        checkStory("start");
    });
};

window.switchScreen = function (screenName) {
    // 画面リスト
    const screens = ["status", "skill", "story", "dungeon", "job", "equipment", "ranking"];
    screens.forEach((s) => {
        const el = document.getElementById("screen-" + s);
        if (el) el.style.display = "none";
        const menu = document.getElementById("menu-" + s);
        if (menu) menu.classList.remove("active");
    });

    const targetScreen = document.getElementById("screen-" + screenName);
    if (targetScreen) {
        if (screenName === "dungeon" || screenName === "job") {
            targetScreen.style.display = "flex";
        } else {
            targetScreen.style.display = "block";
        }
    }
    const targetMenu = document.getElementById("menu-" + screenName);
    if (targetMenu) targetMenu.classList.add("active");

    if (screenName === "status") {
        updateStatusDisplay();
    } else if (screenName === "dungeon") {
        initDungeonList();
    } else if (screenName === "equipment") {
        renderEquipmentScreen();
    } else if (screenName === "skill") {
        renderSkillScreen();
    } else if (screenName === "story") {
        // ストーリー画面初期表示
        switchStoryTab("main");
    } else if (screenName === "ranking") {
        loadAndRenderRanking();
    } else if (screenName === "job") {
        renderJobScreen();
    }
};

window.switchStoryTab = function (tabName) {
    // タブの見た目更新
    document
        .querySelectorAll(".story-tabs .tab-btn")
        .forEach((btn) => btn.classList.remove("active"));
    const activeBtn = document.getElementById("story-tab-" + tabName);
    if (activeBtn) activeBtn.classList.add("active");

    const contentEl = document.getElementById("story-placeholder-text");
    if (contentEl) {
        if (tabName === "main") {
            contentEl.innerText = "";
            const btn = document.createElement("button");
            btn.innerText = "ストーリー再生テスト (Start)";
            btn.onclick = () => checkStory("start");
            contentEl.appendChild(btn);
        } else if (tabName === "sub") {
            contentEl.innerText = "サブストーリーは現在準備中です。";
        }
    }
};

// アドベンチャー機能
let currentAdvScene = null;
let currentAdvIndex = 0;
let advTypeInterval = null;
let isAdvTyping = false;

window.checkStory = function (timing) {
    // Story disabled for now
    return;
    /*
    if (!masterData || !masterData.stories) return;
    const dId = player.currentDungeonId;

    // 該当するストーリーデータを抽出
    // timingが 'wave_N' の場合は wave 数もチェック
    let targetStories = masterData.stories.filter((s) => {
        // データ型の不一致を防ぐため Number 化して比較
        if (Number(s.dungeon_id) !== dId) return false;

        // waveクリア時の判定 (例: timing="wave_1", "wave_2"...)
        if (timing === "wave_clear") {
            return s.timing === `wave_${player.currentWave}`;
        }
        return s.timing === timing;
    });

    if (targetStories.length > 0) {
        // seq順にソート
        targetStories.sort((a, b) => Number(a.seq) - Number(b.seq));

        // データ形式を playAdventure 用に変換
        // CSV項目: speaker, message, left_image, right_image
        // playAdventure期待: name, text, left, right
        const scene = targetStories.map((s) => ({
            name: s.speaker,
            text: s.message,
            left: s.left_image, // "none" or "path" or ""
            right: s.right_image // "none" or "path" or ""
        }));

        playAdventure(scene);
    }
    */
};

window.startAdventureTest = function () {
    // テスト機能は削除またはデバッグ用に残す
    window.checkStory("start");
};

function playAdventure(scene) {
    currentAdvScene = scene;
    currentAdvIndex = 0;
    isAdvTyping = false; // Reset typing logic
    isPaused = true; // Pause game logic
    document.getElementById("adventure-overlay").style.display = "flex";
    showAdvMessage();
}

window.nextAdventureMsg = function () {
    if (isAdvTyping) {
        // タイピングスキップ処理
        if (advTypeInterval) clearInterval(advTypeInterval);
        const msg = currentAdvScene[currentAdvIndex];
        document.getElementById("adv-msg-text").innerText = msg.text;
        isAdvTyping = false;
        return;
    }

    currentAdvIndex++;
    if (currentAdvIndex >= currentAdvScene.length) {
        document.getElementById("adventure-overlay").style.display = "none";
        isPaused = false; // Resume game logic
        return;
    }
    showAdvMessage();
};

function showAdvMessage() {
    const msg = currentAdvScene[currentAdvIndex];
    document.getElementById("adv-name-tag").innerText = msg.name;

    const textEl = document.getElementById("adv-msg-text");
    textEl.innerText = "";

    // 以前のタイマーをクリア
    if (advTypeInterval) clearInterval(advTypeInterval);

    let charIndex = 0;
    isAdvTyping = true;

    advTypeInterval = setInterval(() => {
        if (charIndex < msg.text.length) {
            textEl.innerText += msg.text[charIndex];
            charIndex++;
        } else {
            clearInterval(advTypeInterval);
            advTypeInterval = null;
            isAdvTyping = false;
        }
    }, 50); // 0.05s 1文字

    // 画像表示制御
    // CSVルール: ""(空文字)=維持, "none"=消去, "path"=表示
    const leftImg = document.getElementById("adv-char-left");
    const rightImg = document.getElementById("adv-char-right");

    // Left
    if (msg.left) {
        if (msg.left === "none") {
            leftImg.style.display = "none";
        } else {
            leftImg.src = "images/" + msg.left;
            leftImg.style.display = "block";
        }
    }
    // Empty -> Keep current state

    // Right
    if (msg.right) {
        if (msg.right === "none") {
            rightImg.style.display = "none";
        } else {
            rightImg.src = "images/" + msg.right;
            rightImg.style.display = "block";
        }
    }
    // Empty -> Keep current state
}

let currentSelectedPart = null;
let currentSelectedCandidate = null; // Index in player.inventory
let currentHoveredCandidate = null; // Index in player.inventory (preview)

function renderEquipmentScreen() {
    const parts = {
        hand_r: "右手",
        hand_l: "左手",
        head_top: "頭上段",
        head_mid: "頭中段",
        head_low: "頭下段",
        neck: "首",
        ear: "耳",
        body: "体",
        arm: "腕",
        waist: "腰",
        leg: "足",
        foot: "靴",
        sub1: "その他1",
        sub2: "その他2"
    };

    // 1. スロットリスト (左列)
    const slotsList = document.getElementById("current-slots-list");
    slotsList.innerHTML = "";
    for (let key in parts) {
        const eqItem = player.equipment[key];
        const itemMaster = eqItem ? masterData.items.find((i) => i.id == eqItem.id) : null;

        // レアリティの決定 (既存アイテムへの対応: rarityがない場合はrankから推測)
        let rarity = eqItem && eqItem.rarity !== undefined ? eqItem.rarity : 0;
        if (eqItem && eqItem.rarity === undefined && itemMaster) {
            // rank 2以上ならそれっぽく色をつける (rank 2->1, rank 3+ ->2)
            rarity = Math.max(0, itemMaster.rank - 1);
        }

        const div = document.createElement("div");
        div.className = `equip-slot-row ${currentSelectedPart === key ? "selected" : ""}`;

        // 背景色と文字色の適用 (新デザイン: 左端から20%までグラデーション)
        const bgColor = getRarityBgColor(rarity);
        const textColor = getRarityTextColor(rarity);
        if (rarity > 0) {
            div.style.setProperty(
                "background",
                `linear-gradient(90deg, ${bgColor} 0%, #ffffff 20%)`,
                "important"
            );
        } else {
            div.style.setProperty("background", "#ffffff", "important");
        }
        div.style.setProperty("color", textColor, "important");
        if (rarity > 0) div.style.setProperty("border-color", "rgba(0,0,0,0.1)", "important");

        div.innerHTML = `
      <span class="slot-name-label" style="color: #2c3e50 !important; opacity: 0.7;">${parts[key]}</span>
      <span class="slot-item-name" style="color: #2c3e50 !important; font-weight: bold;">
        ${itemMaster ? itemMaster.name : "---"}
      </span>
    `;
        div.onclick = () => selectSlot(key);
        slotsList.appendChild(div);
    }

    // 2. 変更候補 (中央列)
    const candidateContainer = document.getElementById("candidate-items-container");
    const partNameEl = document.getElementById("selected-part-name");
    // 現在の候補リストをクリア
    candidateContainer.innerHTML = "";

    // 1. 現在装備を外す選択肢 (ボタンではなくデータ属性付きのDIV)
    if (player.equipment[currentSelectedPart]) {
        const removeDiv = document.createElement("div");
        removeDiv.className = "candidate-item-row unequip-action-btn";
        removeDiv.style.color = "#e74c3c";
        removeDiv.style.fontWeight = "bold";
        removeDiv.style.border = "2px solid #e74c3c";
        removeDiv.innerText = "選択解除 (外す)";
        removeDiv.dataset.action = "unequip";
        candidateContainer.appendChild(removeDiv);
    }

    // 2. 所持品アイテム
    const filtered = player.inventory
        .map((item, idx) => ({ item, idx }))
        .filter((entry) => {
            const master = masterData.items.find((i) => i.id == entry.item.id);
            if (!master) return false;
            if (currentSelectedPart === "hand_r" || currentSelectedPart === "hand_l") {
                return master.part === "hand";
            }
            return master.part === currentSelectedPart;
        });

    if (filtered.length === 0) {
        const p = document.createElement("p");
        p.className = "empty-msg";
        p.innerText = "候補アイテムがありません";
        candidateContainer.appendChild(p);
    }

    filtered.forEach((entry, i) => {
        const master = masterData.items.find((it) => Number(it.id) === Number(entry.item.id));
        const div = document.createElement("div");
        div.className = "candidate-item-row";
        div.dataset.action = "equip";
        div.dataset.idx = entry.idx;

        if (!master) {
            div.innerHTML = `<strong>不明なアイテム (ID:${entry.item.id})</strong>`;
        } else {
            const r = entry.item.rarity !== undefined ? entry.item.rarity : 0;
            let displayRarity = r;
            if (entry.item.rarity === undefined && master.rank > 1) {
                displayRarity = Math.max(0, master.rank - 1);
            }

            const bgColor = getRarityBgColor(displayRarity);
            const textColor = getRarityTextColor(displayRarity);

            if (displayRarity > 0) {
                div.style.setProperty(
                    "background",
                    `linear-gradient(90deg, ${bgColor} 0%, #ffffff 20%)`,
                    "important"
                );
            } else {
                div.style.setProperty("background", "#ffffff", "important");
            }
            div.style.setProperty("color", textColor, "important");
            if (displayRarity > 0)
                div.style.setProperty("border-color", "rgba(0,0,0,0.1)", "important");

            // 名称の決定
            let itemName = master.name || "（名称未設定）";

            let optHtml = "";
            if (entry.item.options && entry.item.options.length > 0) {
                const optColor = "#34495e";
                optHtml = `<div style="font-size:10px; color:${optColor}; margin-top:2px; opacity:0.9;">`;
                entry.item.options.forEach((o) => {
                    const optTitle = o.name || (o.stat ? o.stat.toUpperCase() : "ボーナス");
                    optHtml += `<div>• ${optTitle} (${o.stat.toUpperCase()} +${o.val})</div>`;
                });
                optHtml += "</div>";
            }
            div.innerHTML = `<strong style="color:#2c3e50">${itemName}</strong><br><small style="color:#34495e">${master.rank} / Lv.${master.req_lv}</small>${optHtml}`;
        }

        // ゴミ箱
        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.innerHTML = "🗑️";
        delBtn.onclick = (e) => {
            e.stopPropagation();
            confirmDeleteItem(entry.idx);
        };
        div.appendChild(delBtn);

        div.onmouseenter = () => {
            currentHoveredCandidate = entry.idx;
            updateStatComparison();
        };
        div.onmouseleave = () => {
            currentHoveredCandidate = null;
            updateStatComparison();
        };
        candidateContainer.appendChild(div);
    });

    // イベントデリゲーションの確立 (まだ無ければ)
    if (!candidateContainer.dataset.hasListener) {
        candidateContainer.addEventListener("mousedown", (e) => {
            const row = e.target.closest(".candidate-item-row");
            if (!row) return;

            if (row.dataset.action === "unequip") {
                console.log(`[Equip] Mousedown Unequip: Part=${currentSelectedPart}`);
                applySelectedEquip(null);
            } else if (row.dataset.action === "equip") {
                const idx = parseInt(row.dataset.idx);
                console.log(`[Equip] Mousedown Equip: Part=${currentSelectedPart}, Idx=${idx}`);
                applySelectedEquip(idx);
            }
        });
        candidateContainer.dataset.hasListener = "true";
    }
    updateStatComparison();
}

function getRarityBgColor(r) {
    // 0:Common(White), 1:Uncommon(SoftGreen), 2:Rare(SoftBlue), 3:Epic(SoftPurple)
    // 4:Legendary(SoftYellow), 5:Mythic(SoftRed), 6:Ultimate(SoftCyan), 7:Artifact(SoftBrown)
    const bgs = [
        "#ffffff",
        "#e2fcd4",
        "#d4f1ff",
        "#f3e2ff",
        "#fff5d4",
        "#ffd4d4",
        "#d4ffff",
        "#f5e6d3"
    ];
    return bgs[r] || "#ffffff";
}

function getRarityTextColor(r) {
    // 背景が淡い色になったので、基本すべて濃い色の文字にする
    return "#2c3e50";
}

// --- 装備削除機能 ---
let deleteTargetIndex = null;

function confirmDeleteItem(index) {
    if (index === null || index === undefined) return;
    deleteTargetIndex = index;
    const item = player.inventory[index];
    if (!item) return;

    // 15分スキップチェック
    const skipUntil = localStorage.getItem("cc_skip_delete_confirm_" + currentUserEmail);
    if (skipUntil && Number(skipUntil) > Date.now()) {
        executeDelete(true);
        return;
    }

    const master = masterData.items.find((i) => i.id == item.id);
    const name = master ? master.name : "不明なアイテム";

    const nameEl = document.getElementById("delete-target-name");
    const r = item.rarity || 0;
    nameEl.innerText = name;
    nameEl.style.backgroundColor = getRarityBgColor(r);
    nameEl.style.color = getRarityTextColor(r);
    nameEl.style.padding = "5px";
    nameEl.style.borderRadius = "4px";
    nameEl.style.textAlign = "center";

    document.getElementById("chk-skip-confirm").checked = false;
    document.getElementById("delete-confirm-overlay").style.display = "flex";
}

function closeDeleteDialog() {
    document.getElementById("delete-confirm-overlay").style.display = "none";
    deleteTargetIndex = null;
}

function executeDelete(skipConfirm) {
    if (deleteTargetIndex === null) return;

    const item = player.inventory[deleteTargetIndex];
    const master = masterData.items.find((i) => i.id == item.id);
    const name = master ? master.name : "アイテム";

    // インベントリから削除
    player.inventory.splice(deleteTargetIndex, 1);

    // 画面更新
    renderEquipmentScreen();
    saveGame();
    addCombatLog(`🗑️ ${name} を捨てました`, "#7f8c8d");

    // モーダル閉じる
    closeDeleteDialog();

    // 次回スキップ設定
    if (skipConfirm) {
        // 15分後
        const expireTime = Date.now() + 15 * 60 * 1000;
        localStorage.setItem("cc_skip_delete_confirm_" + currentUserEmail, expireTime);
    }
}

function selectSlot(partKey) {
    currentSelectedPart = partKey;
    currentHoveredCandidate = null;
    renderEquipmentScreen();
}

function updateStatComparison() {
    const diffs = {
        hp: 0,
        str: 0,
        vit: 0,
        agi: 0,
        int: 0,
        dex: 0,
        luk: 0,
        atk: 0,
        matk: 0,
        def: 0,
        mdef: 0,
        hit: 0,
        eva: 0,
        cri: 0,
        res: 0
    };

    // 1. 現在の装備による合計ボーナスを計算
    let currentBonus = {
        hp: 0,
        str: 0,
        vit: 0,
        agi: 0,
        int: 0,
        dex: 0,
        luk: 0,
        atk: 0,
        matk: 0,
        def: 0,
        mdef: 0,
        hit: 0,
        eva: 0,
        cri: 0,
        res: 0
    };
    if (masterData && masterData.items) {
        for (let part in player.equipment) {
            let eqItem = player.equipment[part];
            if (eqItem) {
                let master = masterData.items.find((i) => i.id == eqItem.id);
                if (master) {
                    for (let k in currentBonus) {
                        if (master[k]) currentBonus[k] += Number(master[k]);
                    }
                }
                if (eqItem.options) {
                    eqItem.options.forEach((o) => {
                        if (currentBonus[o.stat] !== undefined)
                            currentBonus[o.stat] += Number(o.val);
                    });
                }
            }
        }
    }

    // 2. 現在の合計ステータスを表示
    const keys = Object.keys(diffs);
    keys.forEach((key) => {
        let currentVal = 0;
        if (key === "hp") {
            currentVal = player.maxHp;
        } else if (["str", "vit", "agi", "int", "dex", "luk"].includes(key)) {
            currentVal = (player.stats[key] || 0) + (currentBonus[key] || 0);
        } else if (["def", "mdef"].includes(key)) {
            currentVal = player.battleStats[key + "_div"] || 0;
        } else {
            currentVal = player.battleStats[key] || 0;
        }
        const currEl = document.getElementById("curr-" + key);
        if (currEl) currEl.innerText = currentVal;
    });

    if (currentSelectedPart === null) {
        keys.forEach((key) => resetDiffColor(key));
        return;
    }

    // 現在の装備のステータスを取得
    const currentItem = player.equipment[currentSelectedPart];
    const currentMaster = currentItem ? masterData.items.find((i) => i.id == currentItem.id) : null;

    // 候補（ホバーを優先、なければ選択中）の装備のステータスを取得
    let nextMaster = null;
    const targetIdx =
        currentHoveredCandidate !== null ? currentHoveredCandidate : currentSelectedCandidate;
    if (targetIdx !== null) {
        const nextItem = player.inventory[targetIdx];
        nextMaster = nextItem ? masterData.items.find((i) => i.id == nextItem.id) : null;
    }

    // 差分計算
    keys.forEach((key) => {
        let currentVal = currentMaster ? Number(currentMaster[key] || 0) : 0;
        let nextVal = nextMaster ? Number(nextMaster[key] || 0) : 0;

        // オプション補正の加算
        if (currentItem && currentItem.options) {
            currentItem.options.forEach((o) => {
                if (o.stat === key) currentVal += Number(o.val);
            });
        }
        const nextItem = targetIdx !== null ? player.inventory[targetIdx] : null;
        if (nextItem && nextItem.options) {
            nextItem.options.forEach((o) => {
                if (o.stat === key) nextVal += Number(o.val);
            });
        }

        const diff = nextVal - currentVal;

        const el = document.getElementById("diff-" + key);
        if (el) {
            el.innerText = (diff > 0 ? "+" : "") + diff;
            el.className = diff > 0 ? "diff-plus" : diff < 0 ? "diff-minus" : "diff-zero";
        }
    });
}

function resetDiffColor(key) {
    const el = document.getElementById("diff-" + key);
    if (el) {
        el.innerText = "--";
        el.className = "diff-zero";
    }
}

function applySelectedEquip(invIdx) {
    if (!currentSelectedPart) {
        console.warn("[Equip] No part selected.");
        return;
    }

    // 明示的にインデックスがnull/undefinedであるかチェック
    const isUnequipOnly = invIdx === null || invIdx === undefined;
    console.log(
        `[Equip] applySelectedEquip: Part=${currentSelectedPart}, invIdx=${invIdx}, isUnequipOnly=${isUnequipOnly}`
    );

    // 1. 現在の装備を外してインベントリへ
    if (player.equipment[currentSelectedPart]) {
        const itemToOffset = player.equipment[currentSelectedPart];
        console.log("[Equip] Moving to inventory:", itemToOffset);
        player.inventory.push(itemToOffset);
        player.equipment[currentSelectedPart] = null;
    } else {
        console.log("[Equip] No item currently equipped in this slot.");
    }

    // 2. 候補を装備 (invIdxが有効な数値の場合)
    if (!isUnequipOnly) {
        const newItem = player.inventory[invIdx];
        if (newItem) {
            console.log("[Equip] Equipping new item:", newItem);
            player.equipment[currentSelectedPart] = newItem;
            player.inventory.splice(invIdx, 1);
        } else {
            console.error("[Equip] NEW item not found in inventory. Index:", invIdx);
        }
    } else {
        console.log("[Equip] Item unequipped successfully (No new item equipped).");
    }

    currentHoveredCandidate = null;
    calcBattleStats();
    renderEquipmentScreen();
    if (typeof updateUI === "function") updateUI();
    saveGame();
}

window.resetGame = function () {
    if (confirm("本当にデータを削除して最初からやり直しますか？\n（この操作は取り消せません）")) {
        // ★修正: 自分のデータだけを消す
        if (currentUserEmail) {
            localStorage.removeItem("cc_save_data_" + currentUserEmail);
        }
        location.reload();
    }
};

function getImage(fileName) {
    if (!fileName) return null;
    if (imageCache[fileName]) return imageCache[fileName];
    const img = new Image();
    img.src = "images/" + fileName;
    img.onload = () => {
        // console.log("Image loaded:", fileName);
    };
    img.onerror = () => {
        console.error("Image failed to load:", fileName, img.src);
    };
    imageCache[fileName] = img;
    return img;
}

// --- ログ・演出 ---
function addCombatLog(msg, color = "#fff") {
    const logContainer = document.getElementById("combat-log");
    if (!logContainer) return;

    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.style.color = color;
    entry.innerText = msg;

    logContainer.appendChild(entry);

    // 一定数を超えたら古いものを削除
    while (logContainer.childNodes.length > 5) {
        logContainer.removeChild(logContainer.firstChild);
    }

    // 数秒後に消す
    setTimeout(() => {
        if (entry.parentNode === logContainer) {
            entry.style.opacity = "0";
            entry.style.transition = "opacity 0.5s";
            setTimeout(() => {
                if (entry.parentNode === logContainer) {
                    logContainer.removeChild(entry);
                }
            }, 500);
        }
    }, 3000);
}

function spawnDamageText(x, y, damage, color, fontSize = 20, isRare = false, centerX = false) {
    damageTexts.push({
        x: x,
        y: y,
        text: damage,
        color: color,
        fontSize: fontSize,
        isRare: isRare,
        centerX: centerX,
        life: isRare || centerX ? 120 : 80, // レアやタイトルは長めに
        maxLife: isRare || centerX ? 120 : 80,
        vy: isRare || centerX ? -0.5 : -1.5
    });
}

function syncExpTable() {
    if (!masterData || !masterData.exp_table) return;
    const row = masterData.exp_table.find((r) => Number(r.lv) === player.lv);
    if (row) {
        player.nextExp = Number(row.next_exp);
        if (player.exp >= player.nextExp) gainExp(0);
    }
}

function handleVisibilityChange() {
    if (document.hidden) {
        saveGame();
        isPaused = true;
    } else {
        setTimeout(() => {
            calculateOfflineProgress();
            isPaused = false;
        }, 100);
    }
}

function applyConfig() {
    if (!masterData || !masterData.config) return;
    const c = masterData.config;
    if (c.base_atk_interval) player.baseAttackInterval = Number(c.base_atk_interval);
}
function getConfig(key, defVal) {
    if (masterData && masterData.config && masterData.config[key] !== undefined)
        return Number(masterData.config[key]);
    return defVal;
}

function resizeCanvas() {
    const combatArea = document.getElementById("combat-area");
    if (combatArea) {
        canvas.width = combatArea.clientWidth;
        canvas.height = combatArea.clientHeight;
    }
    if (canvas.width === 0) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight * 0.2;
    }
}

// スキルによる補正合計を計算
function getSkillBonuses() {
    let skillBonus = {
        hp: 0,
        str: 0,
        vit: 0,
        agi: 0,
        int: 0,
        dex: 0,
        luk: 0,
        atk: 0,
        matk: 0,
        def: 0,
        mdef: 0,
        hit: 0,
        eva: 0,
        cri: 0,
        res: 0
    };

    if (!player.skills || !masterData || !masterData.skills) return skillBonus;

    for (let skillId in player.skills) {
        const level = player.skills[skillId];
        const master = masterDataMap.skills.get(Number(skillId));
        if (master && master.type === "passive" && master.stat) {
            const val = (master.val || 0) * level;
            if (skillBonus[master.stat] !== undefined) {
                skillBonus[master.stat] += val;
            }
        }
    }
    return skillBonus;
}

// [修正] 仕様書通りのステータス計算式
function calcBattleStats() {
    const s = player.stats;
    const b = player.battleStats;
    const lv = player.lv;

    // スキル補正
    const skillBonus = getSkillBonuses();

    // --- 装備補正の集計 ---
    let bonus = {
        hp: skillBonus.hp,
        str: skillBonus.str,
        vit: skillBonus.vit,
        agi: skillBonus.agi,
        int: skillBonus.int,
        dex: skillBonus.dex,
        luk: skillBonus.luk,
        atk: skillBonus.atk,
        matk: skillBonus.matk,
        def: skillBonus.def,
        mdef: skillBonus.mdef,
        hit: skillBonus.hit,
        eva: skillBonus.eva,
        cri: skillBonus.cri,
        res: skillBonus.res
    };

    if (masterData) {
        for (let part in player.equipment) {
            let eqItem = player.equipment[part];
            if (eqItem) {
                let master = masterDataMap.items.get(Number(eqItem.id));
                if (master) {
                    for (let key in bonus) {
                        if (master[key]) bonus[key] += Number(master[key]);
                    }
                }
                if (eqItem.options) {
                    eqItem.options.forEach((o) => {
                        if (bonus[o.stat] !== undefined) bonus[o.stat] += Number(o.val);
                    });
                }
            }
        }
    }

    // --- ジョブ補正 ---
    const currentJob = player.currentJob || "adventurer";
    const job = JOB_MASTER[currentJob] || JOB_MASTER.adventurer;
    const jb = job.bonus || { str: 1.0, vit: 1.0, agi: 1.0, int: 1.0, dex: 1.0, luk: 1.0 };

    if (!player.jobData) player.jobData = {};
    if (!player.jobData[currentJob]) {
        player.jobData[currentJob] = { lv: 1, exp: 0, nextExp: 100 };
    }
    const jlv = player.jobData[currentJob].lv;

    // --- 1. HP計算 ---
    const vitTotal = Math.floor(((s.vit || 0) + bonus.vit) * jb.vit);
    player.maxHp = 100 + (lv - 1) * 10 + vitTotal * 5 + bonus.hp;

    if (player.hp > player.maxHp) player.hp = player.maxHp;
    if (player.hp <= 0) player.hp = player.maxHp;

    // ステータス値の安全な取得 (ジョブ補正適用)
    const strTotal = Math.floor(((s.str || 0) + bonus.str) * jb.str);
    const intTotal = Math.floor(((s.int || 0) + bonus.int) * jb.int);
    const dexTotal = Math.floor(((s.dex || 0) + bonus.dex) * jb.dex);
    const agiTotal = Math.floor(((s.agi || 0) + bonus.agi) * jb.agi);
    const lukTotal = Math.floor(((s.luk || 0) + bonus.luk) * jb.luk);

    // --- ATK (物理攻撃力) ---
    b.atk = Math.floor(strTotal / 2 + lukTotal * 0.1) + bonus.atk;

    // --- MATK (魔法攻撃力) ---
    b.matk = Math.floor(intTotal / 2 + lukTotal * 0.1) + bonus.matk;

    // --- DEF (物理防御力) ---
    b.def_div = bonus.def; // 固定防御力として扱うか、割合にするか検討が必要だが一旦加算
    b.def_sub = Math.floor(vitTotal * 3);

    // --- MDEF (魔法防御力) ---
    b.mdef_div = bonus.mdef;
    b.mdef_sub = Math.floor(intTotal * 2 + vitTotal * 0.5);

    // --- HIT (命中力) ---
    b.hit = Math.floor(dexTotal * 1 + lukTotal * 0.2) + bonus.hit;

    // --- EVA (回避力) ---
    b.eva = Math.floor(agiTotal * 1 + lukTotal * 0.2) + bonus.eva;

    // --- CRI (クリティカル頻度) ---
    b.cri = Math.floor(lukTotal * 1) + bonus.cri;

    // --- RES (状態異常抵抗) ---
    b.res = Math.floor(vitTotal * 0.5 + lukTotal * 0.2) + bonus.res;

    // --- Range Calculation (射程計算) ---
    // ベース射程を150から75に変更
    let finalRange = 75;
    const rangeTargetParts = ["hand_r", "hand_l", "sub1", "sub2"];

    rangeTargetParts.forEach((part) => {
        const eqItem = player.equipment[part];
        if (eqItem) {
            const master = masterDataMap.items.get(Number(eqItem.id));
            // rangeが設定されており、かつ0より大きい場合のみ倍率として適用
            if (master && master.range && Number(master.range) > 0) {
                finalRange *= Number(master.range);
            }
        }
    });
    player.range = finalRange;
}

// [修正] ダメージ計算関数
function calculateDamage(atk, divDef, subDef) {
    let reductionPercent = 0;
    if (divDef > 0) {
        let root1 = Math.sqrt(divDef);
        let root2 = Math.sqrt(root1);
        reductionPercent = Math.floor(root2 * 100) / 100;
    }

    let reducedAtk = (atk * (100 - reductionPercent)) / 100;
    let finalDmg = reducedAtk - subDef;

    return Math.max(1, Math.floor(finalDmg));
}

async function saveGame(force = false) {
    if (!currentUserEmail) return;

    player.lastLogin = Date.now();
    const currentDataString = JSON.stringify(player);

    // ★最適化: 変更がない場合は通信しない
    if (!force && currentDataString === lastSavedDataString) {
        return;
    }

    // ★最適化: 指定間隔（1分）以内の場合は、強制保存でない限り通信しない
    const now = Date.now();
    if (!force && now - lastSaveTime < SAVE_INTERVAL_MS) {
        return;
    }

    lastSaveTime = now;
    lastSavedDataString = currentDataString;

    // ★変更: サーバーに保存
    if (currentUserEmail) {
        try {
            console.log("[System] Throttled save to server...");
            await fetch(API_BASE + "/save_game.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ save_data: currentDataString }),
                keepalive: true // ページを閉じても送信を継続
            });
            console.log("[System] Game saved to server.");
            localStorage.setItem("cc_save_data_" + currentUserEmail, currentDataString);
        } catch (e) {
            console.error("[System] Save failed", e);
            localStorage.setItem("cc_save_data_" + currentUserEmail, currentDataString);
        }
    }
}

// ページを閉じる直前に強制保存
window.addEventListener("beforeunload", () => {
    if (currentUserEmail && isGameRunning) {
        // 同期的に送る必要があるため、現代のブラウザでは keepalive または navigator.sendBeacon が推奨されますが、
        // ここでは簡易的に saveGame(true) を呼び出します（asyncなので完了前に閉じられる可能性はあります）
        saveGame(true);
    }
});

async function loadGame() {
    if (!currentUserEmail) return;

    // ★最適化: セッションチェック時に取得済みのデータがあればそれを使う
    if (initialSaveData) {
        console.log("[System] Using pre-fetched save data.");
        applySaveData(initialSaveData);
        initialSaveData = null; // 使い終わったらクリア
        return;
    }

    // ★変更: サーバーから読み込み
    try {
        const res = await fetch(API_BASE + "/load_game.php");
        const data = await res.json();
        if (data.status === "success" && data.save_data) {
            applySaveData(data.save_data);
        }
    } catch (e) {
        console.error("[System] Load failed", e);
    }
}

// セーブデータの適用ロジックを分離
function applySaveData(saveDataString) {
    if (!saveDataString || saveDataString === "{}") {
        // サーバーにデータがない場合はlocalStorageをチェック（移行用）
        const localData = localStorage.getItem("cc_save_data_" + currentUserEmail);
        if (localData) {
            console.log("[System] No server data, using local storage backup.");
            saveDataString = localData;
        } else {
            console.log("[System] No save data found.");
            return;
        }
    }

    try {
        const loadedPlayer = JSON.parse(saveDataString);
        lastSavedDataString = saveDataString; // 初期状態として保持

        const defaultProps = {
            image: player.image,
            x: player.x,
            y: player.y,
            lane: player.lane || 1,
            width: player.width,
            height: player.height
        };

        player = { ...player, ...loadedPlayer };

        // フィールド補完
        if (!player.skills) player.skills = {};
        if (player.skill_sp == null) player.skill_sp = 0;
        if (!player.skill_cooldowns) player.skill_cooldowns = {};
        if (!player.currentJob) player.currentJob = "adventurer";
        if (!player.jobData) {
            player.jobData = { adventurer: { lv: 1, exp: 0, nextExp: 100 } };
        }
        if (!player.currentDungeonId) player.currentDungeonId = 1;
        if (!player.dungeonProgress) player.dungeonProgress = {};
        if (typeof player.money === "undefined") player.money = 0;

        // 定義値を強制適用
        Object.assign(player, defaultProps);

        // ステータス計算とレベルアップ補正
        calcBattleStats();
        checkLevelUp();

        console.log("[System] Save data applied successfully.");
    } catch (e) {
        console.error("[System] Failed to parse save data", e);
    }
}

function calculateOfflineProgress() {
    const now = Date.now();
    const last = player.lastLogin || now;
    const diffSeconds = (now - last) / 1000;

    if (diffSeconds > 10) {
        let agiRed = getConfig("agi_reduction", 0.2);
        let agiVal = player.stats.agi || 5;
        let atkInterval = Math.max(20, player.baseAttackInterval - agiVal * agiRed);

        let attacksPerSec = 60 / atkInterval;
        let avgEnemyHp = 20 + player.lv * 5;
        let avgEnemyExp = 10 + player.lv * 2;
        let myAtk = Math.max(1, player.battleStats.atk);
        let hitsToKill = Math.ceil(avgEnemyHp / myAtk);
        // 固定の移動ペナルティ(1.2)はそのままに、別途効率係数を掛けられるように変更
        let secondsPerKill = (hitsToKill / attacksPerSec) * 1.2;

        // Configから効率係数を取得 (デフォルト: 1.0 = 今まで通り)
        let efficiency = getConfig("offline_efficiency", 1.0);

        let killCount = Math.floor((diffSeconds / secondsPerKill) * efficiency);
        if (killCount > 0) {
            let totalGainedExp = killCount * avgEnemyExp;
            console.log(`Offline: ${diffSeconds} s, ${killCount} kills, ${totalGainedExp} exp`);
            gainExp(totalGainedExp);

            // オフライン成果ダイアログ表示
            const dialog = document.getElementById("offline-result-overlay");
            if (dialog) {
                document.getElementById("offline-time").innerText = Math.floor(diffSeconds);
                document.getElementById("offline-kills").innerText = killCount;
                document.getElementById("offline-exp").innerText = totalGainedExp;
                dialog.style.display = "flex";
            }
        }
    }
    player.lastLogin = now;
}

function closeOfflineDialog() {
    document.getElementById("offline-result-overlay").style.display = "none";
}

// デバッグ機能：インベントリ全削除 (Dev環境のみ)
window.addEventListener("DOMContentLoaded", () => {
    const isDev =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.pathname.includes("/dev/");
    const btn = document.getElementById("btn-debug-clear-inv");
    if (btn && isDev) {
        btn.style.display = "inline-block";
        btn.addEventListener("click", () => {
            if (confirm("インベントリを全削除しますか？(Dev)")) {
                player.inventory = [];
                saveGame();
                updateUI();
                // 装備画面の表示更新
                if (document.getElementById("screen-equipment").style.display !== "none") {
                    renderEquipmentScreen();
                }
                alert("インベントリを削除しました");
            }
        });
    }
});

function gameLoop() {
    requestAnimationFrame(gameLoop);
    if (fade.active) updateFade();
    if (isPaused) return;
    try {
        if (!fade.active || fade.state === "in") {
            for (let i = 0; i < gameSpeed; i++) {
                update();
                updateJobMiniGames(); // ジョブ画面の更新
            }
        }
        draw();
        updateCombatSkillUI(); // Update skill CD visuals every frame
    } catch (e) {
        console.error(e);
    }
}

function updateFade() {
    if (fade.state === "out") {
        fade.alpha += fade.speed;
        if (fade.alpha >= 1) {
            fade.alpha = 1;
            if (fade.callback) {
                fade.callback();
                fade.callback = null;
            }
            fade.state = "wait";
            setTimeout(() => {
                fade.state = "in";
            }, 300);
        }
    } else if (fade.state === "in") {
        fade.alpha -= fade.speed;
        if (fade.alpha <= 0) {
            fade.alpha = 0;

            // 暗転明けのフィールド名表示
            if (fade.showFieldTitle) {
                const dData = getDungeonData(player.currentDungeonId);
                if (dData) {
                    spawnDamageText(
                        0,
                        canvas.height / 2,
                        `- ${dData.name} -`,
                        "#ffffff",
                        32,
                        false,
                        true
                    );
                }
                fade.showFieldTitle = false;
            }

            fade.active = false;
            fade.state = "none";
        }
    }
}

function update() {
    saveTimer++;
    if (saveTimer > 600) {
        saveGame();
        saveTimer = 0;
    }

    // スキルクールダウンの更新
    updateSkillCooldowns();

    spawnTimer++;
    const rate = getConfig("spawn_rate", 100);
    const dData = getDungeonData(player.currentDungeonId);

    // 敵スポーン
    if (dData) {
        const maxWave = Number(dData.wave_count || 1);
        const hasBoss = Number(dData.boss_flag || 0) === 1;
        const reqKills = getReqKills(dData);
        const spawnedCount = player.killsInWave + enemies.length;
        if (hasBoss && player.currentWave === maxWave) {
            if (spawnedCount < 1 && enemies.length === 0) {
                spawnEnemy();
                spawnTimer = 0;
            }
        } else {
            if (spawnedCount < reqKills && spawnTimer > rate) {
                spawnEnemy();
                spawnTimer = 0;
            }
        }
    }

    // 敵の行動
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        let dist = e.x - (player.x + player.width);

        if (dist <= e.range && dist > -100) {
            e.state = "attack";
            e.attackTimer++;
            if (e.attackTimer > e.attackInterval) {
                let dmg = calculateDamage(
                    e.damage,
                    player.battleStats.def_div,
                    player.battleStats.def_sub
                );
                player.hp -= dmg;
                e.attackTimer = 0;
                let py = canvas.height * 0.5;
                spawnDamageText(player.x, py - 20, dmg, "#e74c3c");
                updateUI();
            }
        } else {
            e.state = "move";
            e.x -= e.speed;
        }
        if (e.x < -50) enemies.splice(i, 1);
    }

    // プレイヤー攻撃速度
    let agiRed = getConfig("agi_reduction", 0.2);
    let agiVal = player.stats.agi || 5;
    let currentInterval = Math.max(20, player.baseAttackInterval - agiVal * agiRed);
    player.attackTimer++;

    // プレイヤーの攻撃
    if (player.attackTimer > currentInterval) {
        let target = null;
        let minDist = 9999;
        for (let e of enemies) {
            let dist = e.x - player.x;
            if (dist > -100 && dist < player.range && dist < minDist) {
                target = e;
                minDist = dist;
            }
        }

        if (target) {
            // スキルのチェック
            let activeSkill = null;
            if (masterData && masterData.skills) {
                for (let skillId in player.skills) {
                    const master = masterDataMap.skills.get(Number(skillId));
                    if (
                        master &&
                        (!player.skill_cooldowns[skillId] || player.skill_cooldowns[skillId] <= 0)
                    ) {
                        activeSkill = master;
                        break;
                    }
                }
            }

            let dmg = calculateDamage(player.battleStats.atk, 0, 0);
            let isSkill = false;
            let hitCount = 1;

            if (activeSkill) {
                const lv = player.skills[activeSkill.id] || 0;
                const maxLv = activeSkill.max_lv || 1;
                const pMin = activeSkill.power_min || 0;
                const pMax = activeSkill.power_max || pMin;

                let actualPower = pMin;
                if (maxLv > 1 && lv > 0) {
                    actualPower = pMin + ((pMax - pMin) * (lv - 1)) / (maxLv - 1);
                }

                dmg = Math.floor(dmg * (actualPower / 100));
                hitCount = activeSkill.hit_count || 1;
                player.skill_cooldowns[activeSkill.id] = (activeSkill.cooldown || 5) * 60;
                isSkill = true;
            }

            // 攻撃実行 (ヒット回数分)
            for (let h = 0; h < hitCount; h++) {
                target.hp -= dmg;
                let ey = canvas.height * target.yRatio;
                // 複数ヒットの場合は少しずつずらして表示
                spawnDamageText(
                    target.x + h * 5,
                    ey - 20 - h * 15,
                    dmg,
                    isSkill ? "#f1c40f" : "#ffffff",
                    isSkill ? 24 : 20,
                    isSkill
                );
            }

            player.attackTimer = 0;

            if (target.hp <= 0) {
                let index = enemies.indexOf(target);
                if (index > -1) {
                    enemies.splice(index, 1);
                    gainExp(target.exp);

                    if (target.money > 0) {
                        player.money += target.money;
                        let ey = canvas.height * target.yRatio;
                        spawnDamageText(
                            target.x,
                            ey - 40,
                            `+${target.money} Mumel`,
                            "#f1c40f",
                            24,
                            false
                        );
                        updateUI();
                    }

                    checkEnemyDrops(target);
                    handleEnemyKill(target);
                }
            }
        }
    }

    for (let i = damageTexts.length - 1; i >= 0; i--) {
        let dt = damageTexts[i];
        dt.y += dt.vy;
        dt.life--;
        if (dt.life <= 0) damageTexts.splice(i, 1);
    }

    if (player.hp <= 0) {
        player.hp = 0; // Prevent negative HP
        startTransition(() => {
            // Game Over Logic: Reset Wave and Progress
            player.hp = player.maxHp;
            player.currentWave = 1;
            player.killsInWave = 0;
            enemies = [];
            damageTexts = [];

            saveGame();
            updateUI();

            // Optional: Show a message or just rely on the fade effect
            spawnDamageText(
                canvas.width / 2,
                canvas.height / 2,
                "RETRY...",
                "#e74c3c",
                40,
                false,
                true
            );
        });
    }
}

function handleEnemyKill(enemy) {
    // Mumel獲得
    const mAmount = Number(enemy.money) || 0;
    if (mAmount > 0) {
        player.money = (player.money || 0) + mAmount;
        addCombatLog(`+${mAmount} Mumel`, "#f1c40f");
    }

    if (enemy.isBoss) {
        startTransition(() => {
            dungeonClearLogic();
        });
        return;
    }
    player.killsInWave++;
    const dData = getDungeonData(player.currentDungeonId);
    if (!dData) return;
    const reqKills = getReqKills(dData);
    if (player.killsInWave >= reqKills) {
        player.currentWave++;
        player.killsInWave = 0;
        enemies = [];
        damageTexts = [];
        const maxWave = Number(dData.wave_count || 1);
        const hasBoss = Number(dData.boss_flag || 0) === 1;
        if (!hasBoss && player.currentWave > maxWave) {
            // ダンジョンクリア判定の前等にストーリーを入れることも可能だが、
            // ここではクリア演出前に 'end' ストーリーを入れるフローにする
            // ストーリーがある場合は再生後にクリアロジックを走らせたいが、
            // 簡易実装として並列あるいは再生開始だけ行う。
            // 本格的にはストーリー再生終了コールバックが必要。

            // 一旦 checkStory('end') を呼ぶ
            checkStory("end");

            startTransition(() => {
                dungeonClearLogic();
            });
        } else {
            spawnDamageText(
                canvas.width / 2,
                canvas.height / 2,
                "NEXT WAVE!",
                "#3498db",
                32,
                false,
                true
            );
        }
    }
}

function dungeonClearLogic() {
    spawnDamageText(
        canvas.width / 2,
        canvas.height / 2,
        "DUNGEON CLEAR!",
        "#f1c40f",
        40,
        false,
        true
    );
    const dId = player.currentDungeonId;
    if (!player.dungeonProgress[dId]) {
        player.dungeonProgress[dId] = {
            clearCount: 0,
            killCount: 0,
            cleared: false
        };
    }
    player.dungeonProgress[dId].clearCount++;
    player.dungeonProgress[dId].cleared = true;
    player.currentWave = 1;
    player.killsInWave = 0;
    enemies = [];
    saveGame();
    initDungeonList();
}

function getDungeonData(id) {
    if (masterData && masterData.dungeons)
        return masterDataMap.dungeons.get(Number(id));
    return null;
}

function spawnEnemy() {
    const dData = getDungeonData(player.currentDungeonId);
    if (!dData) return;
    const maxWave = Number(dData.wave_count || 1);
    const hasBoss = Number(dData.boss_flag || 0) === 1;
    if (hasBoss && player.currentWave === maxWave) {
        spawnBoss(dData);
    } else {
        spawnNormalEnemy(dData);
    }
}

function spawnBoss(dData) {
    if (enemies.length > 0) return;
    const bossId = Number(dData.boss_id);
    let enemyData = null;
    if (masterData && masterData.enemies)
        enemyData = masterDataMap.enemies.get(Number(bossId));
    if (!enemyData)
        enemyData = {
            name: "Boss",
            hp: 100,
            atk: 20,
            exp: 50,
            speed: 1.0,
            color: "purple",
            width: 60
        };
    let laneIdx = 1;
    enemies.push({
        x: canvas.width,
        yRatio: lanes[laneIdx],
        hp: Number(enemyData.hp) * 2 || 100,
        maxHp: Number(enemyData.hp) * 2 || 100,
        damage: Number(enemyData.atk) || 5,
        exp: Number(enemyData.exp) * 5 || 50,
        money: (Number(enemyData.money) || 0) * 5,
        speed: Number(enemyData.speed) || 1.0,
        color: enemyData.color || "purple",
        width: (Number(enemyData.width) || 30) * 1.5,
        image: enemyData.image || null,
        range: 40,
        attackTimer: 0,
        attackInterval: 100,
        state: "move",
        isBoss: true,
        drop: enemyData.drop || null
    });
    spawnDamageText(
        canvas.width / 2,
        canvas.height / 2,
        "BOSS BATTLE!!",
        "#e74c3c",
        40,
        false,
        true
    );
}

function spawnNormalEnemy(dData) {
    let laneIdx = Math.floor(Math.random() * 3);
    let allowedEnemyIds = [];
    if (dData.enemy_ids)
        allowedEnemyIds = String(dData.enemy_ids)
            .split(",")
            .map((s) => Number(s));
    else if (masterData && masterData.enemies)
        allowedEnemyIds = masterData.enemies.map((e) => Number(e.id));
    let targetId = allowedEnemyIds[Math.floor(Math.random() * allowedEnemyIds.length)];
    let enemyData = masterDataMap.enemies.get(Number(targetId));
    if (!enemyData)
        enemyData = {
            name: "Slime",
            hp: 20,
            atk: 5,
            exp: 10,
            speed: 1.0,
            color: "red",
            width: 30
        };
    enemies.push({
        x: canvas.width,
        yRatio: lanes[laneIdx],
        hp: Number(enemyData.hp) || 10,
        maxHp: Number(enemyData.hp) || 10,
        damage: Number(enemyData.atk) || 1,
        exp: Number(enemyData.exp) || 1,
        money: Number(enemyData.money) || 0,
        speed: Number(enemyData.speed) || 1.0,
        color: enemyData.color || "red",
        width: Number(enemyData.width) || 30,
        image: enemyData.image || null,
        range: 40,
        attackTimer: 0,
        attackInterval: 80,
        state: "move",
        isBoss: false,
        drop: enemyData.drop || null
    });
}

function checkEnemyDrops(enemy) {
    if (!enemy.drop) return;

    // 重みベースのドロップ判定 (分母: 10000)
    // 独立して抽選を行うため、複数のアイテムがドロップする可能性がある。
    const DENOMINATOR = 10000;

    for (let i = 1; i <= 5; i++) {
        const id = enemy.drop[`id${i}`];
        const weight = enemy.drop[`rate${i}`];

        if (id > 0 && weight > 0) {
            // 毎回個別に乱数を生成
            let pick = Math.random() * DENOMINATOR;

            if (pick < weight) {
                // ドロップ成功
                const itemMaster = masterDataMap.items.get(Number(id));

                if (!itemMaster) {
                    console.error(`[DropCheck] Item Master NOT FOUND for ID: ${id}`);
                }

                if (itemMaster) {
                    // ★変更: レアリティはマスタの rank を参照する (rank 1ならレアリティ0)
                    const rank = Number(itemMaster.rank) || 1;
                    const rarity = Math.max(0, rank - 1);

                    // オプション生成
                    const opts = generateOptions(rarity);

                    const newItem = {
                        id: id,
                        exp: 0,
                        rarity: rarity,
                        options: opts
                    };
                    player.inventory.push(newItem);

                    // Weightに応じたレア度判定 (仮: 100以下=1%以下ならレア演出)
                    let isRare = weight < 100;
                    let ey = canvas.height * enemy.yRatio;

                    if (isRare) {
                        // レアドロップ演出
                        spawnDamageText(
                            enemy.x,
                            ey - 60,
                            `🌟RARE GET!!🌟\n${itemMaster.name}`,
                            "#ff00ff",
                            28,
                            true
                        );
                        addCombatLog(`🌟GET: ${itemMaster.name}`, "#ff00ff");
                    } else {
                        // 通常ドロップ演出
                        // 複数ドロップ時に重ならないように少しずらすなどの工夫があっても良いが、一旦位置は固定
                        spawnDamageText(
                            enemy.x,
                            ey - 50,
                            `GET: ${itemMaster.name}`,
                            "#f1c40f",
                            20,
                            false
                        );
                        addCombatLog(`GET: ${itemMaster.name}`, "#f1c40f");
                    }

                    // 装備画面が開いている場合はリストを即時更新
                    if (document.getElementById("screen-equipment").style.display !== "none") {
                        renderEquipmentScreen();
                    }

                    if (isRare) {
                        console.log(`Dropped RARE item: ${itemMaster.name}`);
                    }
                }
                // 複数ドロップ可能にするため break しない
            }
        }
    }
}

// 共通のレベルアップ判定ロジック
function checkLevelUp() {
    let levelledUp = false;
    while (player.exp >= player.nextExp) {
        let nextReq = 50;
        let rewardSp = 3;
        let rewardSkillSp = 1;
        if (masterData && masterData.exp_table) {
            const row = masterDataMap.exp_table.get(Number(player.lv));
            if (row) {
                nextReq = Number(row.next_exp);
                rewardSp = Number(row.reward_sp);
                rewardSkillSp = Number(row.reward_skillp) || 0;
            } else {
                nextReq = Math.floor(player.nextExp * 1.2);
            }
        }
        player.nextExp = nextReq;

        // 再チェック (nextReq更新後)
        if (player.exp >= player.nextExp) {
            player.lv++;
            player.skill_sp += rewardSkillSp;
            player.maxHp += 10;
            player.exp -= player.nextExp;
            player.sp += rewardSp;

            // 次のレベルのEXPテーブルを読み込む
            if (masterData && masterData.exp_table) {
                const nr = masterDataMap.exp_table.get(Number(player.lv));
                if (nr) player.nextExp = Number(nr.next_exp);
            }
            levelledUp = true;
        }
    }

    if (levelledUp) {
        calcBattleStats();
        player.hp = player.maxHp;
        updateUI();
    }
}

function gainExp(amount) {
    player.exp += amount;
    checkLevelUp();
    // ジョブ経験値も獲得 (通常の半分+α)
    gainJExp(Math.floor(amount / 2) + 1);
    addCombatLog(`+${amount} EXP`, "#2ecc71");
    updateUI();
}

window.addStat = function (statName) {
    if (player.sp > 0) {
        player.stats[statName]++;
        player.sp--;
        calcBattleStats();
        updateUI();
        saveGame();
    }
};

// --- Option Logic ---
const RARITY_MAX_LEVEL = [1, 2, 3, 4, 5, 7, 9, 10]; // 0:Common to 7:Artifact

function rollRarity() {
    const r = Math.random() * 100;
    if (r < 0.01) return 7;
    if (r < 0.1) return 6;
    if (r < 1.0) return 5;
    if (r < 5.0) return 4;
    if (r < 15.0) return 3;
    if (r < 30.0) return 2;
    if (r < 60.0) return 1;
    return 0;
}

function generateOptions(rarity) {
    if (!masterData || !masterData.options || masterData.options.length === 0) return [];

    // スロット数決定: 0-3の均等ランダム
    const count = Math.floor(Math.random() * 4);
    if (count <= 0) return [];

    // レアリティによるフィルタリング
    // 指定されたレアリティ「以下」のオプションが付く、あるいは等しいもの？
    // ユーザー指示「rareで設定したレアリティの装備に付く可能性があります」
    // -> そのレアリティ"専用"とも読めるが、通常は下位互換性がある。
    // ここでは「そのレアリティのオプション」だけを抽選対象とする（なければ下位を検索）
    // 必須: CSVに rare カラムがあること
    let candidates = masterData.options.filter((o) => (Number(o.rare) || 0) === rarity);

    // もしそのレアリティのオプションが定義されていなければ、下位のレアリティも含める（安全策）
    if (candidates.length === 0) {
        candidates = masterData.options.filter((o) => (Number(o.rare) || 0) <= rarity);
    }

    if (candidates.length === 0) return [];

    let result = [];

    for (let i = 0; i < count; i++) {
        // 均等確率で選出
        const selected = candidates[Math.floor(Math.random() * candidates.length)];

        if (selected) {
            const minV = Number(selected.min_val) || 1;
            const maxV = Number(selected.max_val) || 1;
            // minからmaxまで1刻みで均等ランダム
            const val = Math.floor(Math.random() * (maxV - minV + 1)) + minV;

            // 名前生成（CSVにnameが無い場合）
            let optName = selected.name || "";
            if (!optName) {
                const statMap = {
                    str: "力",
                    vit: "体力",
                    agi: "素早さ",
                    int: "知力",
                    dex: "器用さ",
                    luk: "運"
                };
                const sName = statMap[selected.stat] || selected.stat;
                optName = `${sName}の`;
            }

            result.push({
                id: selected.id,
                name: optName,
                stat: selected.stat,
                val: val,
                level: level
            });
        }
    }
    return result;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#ccc";
    ctx.beginPath();
    lanes.forEach((y) => {
        let h = canvas.height * y;
        ctx.moveTo(0, h);
        ctx.lineTo(canvas.width, h);
    });
    ctx.stroke();
    // Player rendering
    let pImg = getImage(player.image);
    if (pImg && pImg.complete && (pImg.naturalHeight !== 0 || pImg.naturalWidth !== 0)) {
        ctx.drawImage(
            pImg,
            player.x,
            canvas.height * 0.5 - player.height / 2,
            player.width,
            player.height
        );
    } else {
        // console.warn("Player image not ready or invalid:", player.image, pImg);
        ctx.fillRect(
            player.x,
            canvas.height * 0.5 - player.height / 2,
            player.width,
            player.height
        );
    }

    // ★デバッグ用: 射程範囲の表示（テスト用）
    ctx.save();
    ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, canvas.height * 0.5, player.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    enemies.forEach((e) => {
        let y = canvas.height * e.yRatio;
        let w = e.width || 30;
        let h = w;
        let img = getImage(e.image);
        if (img && img.complete && (img.naturalHeight !== 0 || img.naturalWidth !== 0))
            ctx.drawImage(img, e.x, y - h / 2, w, h);
        else {
            ctx.fillStyle = e.color;
            ctx.fillRect(e.x, y - h / 2, w, h);
        }
        let hpPer = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "black";
        ctx.fillRect(e.x, y + h / 2 + 5, w, 5);
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(e.x, y + h / 2 + 5, w * hpPer, 5);
        if (e.isBoss) {
            ctx.fillStyle = "red";
            ctx.font = "bold 14px Arial";
            ctx.fillText("BOSS", e.x - 5, y - h / 2 - 5);
        }
    });
    damageTexts.forEach((dt) => {
        ctx.globalAlpha = Math.max(0, dt.life / dt.maxLife);
        ctx.fillStyle = dt.color;

        let fSize = dt.fontSize || 20;

        // 中央表示フラグがある場合は中央揃え
        let drawX = dt.x;
        if (dt.centerX) {
            ctx.textAlign = "center";
            drawX = canvas.width / 2;
        } else {
            ctx.textAlign = "left";
        }

        if (dt.isRare) {
            // レア演出：縁取りを太く、少し小刻みに揺らす
            ctx.font = `bold ${fSize}px 'Arial Black', sans-serif`;
            ctx.strokeStyle = "white";
            ctx.lineWidth = 4;
            let shakeX = (Math.random() - 0.5) * 2;
            ctx.strokeText(dt.text, drawX + shakeX, dt.y);
            ctx.fillText(dt.text, drawX + shakeX, dt.y);
        } else {
            ctx.font = `bold ${fSize}px Arial`;
            ctx.strokeStyle = "black";
            ctx.lineWidth = 3;
            ctx.strokeText(dt.text, drawX, dt.y);
            ctx.fillText(dt.text, drawX, dt.y);
        }

        // 描画設定を戻す
        ctx.textAlign = "left";
        ctx.globalAlpha = 1.0;
    });
    const dData = getDungeonData(player.currentDungeonId);
    if (dData) {
        ctx.fillStyle = "black";
        ctx.font = "16px Arial";
        const maxWave = Number(dData.wave_count || 1);
        const reqKills = getReqKills(dData);
        let progressText = `Next: ${Math.max(0, reqKills - player.killsInWave)} `;
        if (Number(dData.boss_flag) === 1 && player.currentWave === maxWave) {
            progressText = "BOSS";
        }
        ctx.fillText(`Wave: ${player.currentWave}/${maxWave} (${progressText})`, 10, 30);
    }
    if (fade.active) {
        ctx.fillStyle = `rgba(0, 0, 0, ${fade.alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}
function safeWidth(id, percent) {
    const el = document.getElementById(id);
    if (el) el.style.width = percent + "%";
}

// 画面UIを更新
function updateUI() {
    safeText("val-lv", player.lv);
    safeText("val-hp", Math.floor(player.hp));
    safeText("val-max-hp", player.maxHp);
    safeWidth("bar-hp", (player.hp / player.maxHp) * 100);
    safeText("val-exp", Math.floor(player.exp));
    safeText("val-next-exp", player.nextExp);
    safeWidth("bar-exp", (player.exp / player.nextExp) * 100);
    safeText("val-sp", player.sp);
    safeText("val-money", player.money);

    // 職業ボタンの名称更新
    const currentJobId = player.currentJob || "adventurer";
    const jobName = JOB_MASTER[currentJobId] ? JOB_MASTER[currentJobId].name : "職業";
    safeText("menu-job", jobName);

    // 装備ボーナスの集計 (表示用)
    let bonus = { str: 0, vit: 0, agi: 0, int: 0, dex: 0, luk: 0 };
    if (masterData) {
        for (let part in player.equipment) {
            let eqItem = player.equipment[part];
            if (eqItem) {
                let master = masterDataMap.items.get(Number(eqItem.id));
                if (master) {
                    for (let k in bonus) {
                        if (master[k]) bonus[k] += Number(master[k]);
                    }
                }
            }
        }
    }

    for (let key in bonus) {
        const total = (player.stats[key] || 0) + bonus[key];
        safeText(`val-${key}`, total);
    }

    safeText("val-atk", player.battleStats.atk);
    safeText("val-matk", player.battleStats.matk);
    safeText("val-def", `${player.battleStats.def_div} + ${player.battleStats.def_sub}`);
    safeText("val-mdef", `${player.battleStats.mdef_div} + ${player.battleStats.mdef_sub}`);
    safeText("val-hit", player.battleStats.hit);
    safeText("val-eva", player.battleStats.eva);
    safeText("val-cri", player.battleStats.cri);
    safeText("val-res", player.battleStats.res);

    const btns = document.querySelectorAll(".btn-plus");
    btns.forEach((btn) => {
        if (player.sp > 0) btn.classList.add("active");
        else btn.classList.remove("active");
    });
}

window.toggleSpeed = function () {
    gameSpeed = gameSpeed === 1 ? 10 : 1;
    const btn = document.getElementById("debug-speed-btn");
    if (btn) btn.innerText = "x" + gameSpeed;
};

window.confirmReset = function () {
    if (confirm("本当に最初からやり直しますか？\n全てのレベル、装備、進捗が失われます。")) {
        resetGame();
    }
};

async function resetGame() {
    try {
        // サーバーデータの消去（空のデータで上書き）
        const initialPlayer = {
            level: 1,
            exp: 0,
            inventory: [],
            equipment: {},
            dungeonProgress: {}
        };

        // 簡易的に全削除のリクエストを送るか、ログアウトして初期化するか。
        // ここでは localStorage を消してリロードするのが最も確実（loadGame時に初期化されるため）
        localStorage.removeItem("cc_save_data_" + currentUserEmail);

        // サーバー側のデータもリセットするために、一度空のデータでセーブ
        // ただし、今の save_game.php は player オブジェクトをまるごと送るので、
        // location.reload() するのが手っ取り早い
        alert("データをリセットしました。タイトルに戻ります。");
        location.reload();
    } catch (e) {
        console.error("Reset failed", e);
    }
}

// スキルクールダウンの更新 (毎フレーム)
function updateSkillCooldowns() {
    if (!player.skill_cooldowns) player.skill_cooldowns = {};
    for (let id in player.skill_cooldowns) {
        if (player.skill_cooldowns[id] > 0) {
            player.skill_cooldowns[id]--;
        }
    }
}

// --------------------------------------------------------------------------------------
// renderSkillScreen: 3 slots supported
// --------------------------------------------------------------------------------------
window.renderSkillScreen = function () {
    const container = document.getElementById("screen-skill");
    if (!container) return;

    if (!masterData || !masterData.skills) {
        container.innerHTML = "<h3>スキル</h3><p>データ読み込み中...</p>";
        return;
    }

    // --- Data Migration (Single -> Array) with deduplication check ---
    if (!Array.isArray(player.equippedSkills)) {
        player.equippedSkills = [null, null, null];
        // Migrate legacy single skill if exists
        if (player.equippedSkill) {
            player.equippedSkills[0] = player.equippedSkill;
            delete player.equippedSkill;
        }
    }
    // Ensure we always have 3 slots
    while (player.equippedSkills.length < 3) {
        player.equippedSkills.push(null);
    }

    // Header
    // * Added "Dev: SP+10" button for testing
    let html = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>スキル設定</h3>
        <button onclick="player.skill_sp = (player.skill_sp || 0) + 10; saveGame(); renderSkillScreen();" 
            style="font-size:10px; padding:2px 5px; background:#e67e22; color:white; border:none; border-radius:3px; cursor:pointer;">
            Dev: SP+10
        </button>
    </div>
  `;

    // --- Skill Slots UI (Loop 3 times) ---
    html += `
    <div class="skill-container" style="flex-direction:column; align-items:flex-start;">
        <div class="skill-slots-label" style="font-weight:bold; margin-bottom:5px;">装備スロット (最大3つ)</div>
        <div class="skill-slots-area" style="display:flex; gap:10px;">
  `;

    for (let i = 0; i < 3; i++) {
        const equippedId = player.equippedSkills[i];
        let slotContent = '<div class="plus-mark">＋</div>';
        let slotClass = "skill-slot empty";

        if (equippedId) {
            const skill = masterDataMap.skills.get(Number(equippedId));
            const skillName = skill ? skill.name : "Unknown";
            const iconUrl = `images/${skill && skill.image ? skill.image : "skill/default.png"}`;
            slotClass = "skill-slot filled";
            // click to remove logic uses index 'i'
            slotContent = `
            <div class="skill-slot-content" title="${skillName}" onclick="removeEquippedSkill(event, ${i})" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                <img src="${iconUrl}" onerror="this.src='https://placehold.jp/24/34495e/ffffff/64x64.png?text=Skill'" style="width:100%; height:100%; object-fit:cover; border-radius:4px;">
            </div>
          `;
        }

        // ondrop passes 'i' via dataset or we handle it in drop handler by ID
        html += `
        <div class="${slotClass}" id="skill-slot-${i}" data-slot-index="${i}" 
             ondrop="dropSkill(event)" ondragover="allowDrop(event)">
            ${slotContent}
        </div>
      `;
    }

    html += `
        </div>
    </div>
    <hr style="margin:20px 0;">
    <div style="padding: 0 15px; margin-bottom: 15px; font-weight: bold; font-size: 16px;">
        残りスキルポイント: <span style="color:#e67e22; font-size: 20px;">${player.skill_sp}</span>
    </div>
  `;

    html += `<div class="skill-list" style="margin-top:10px;">`;

    masterData.skills.forEach((skill) => {
        const currentLv = (player.skills && player.skills[skill.id]) || 0;
        const isMax = currentLv >= (skill.max_lv || 10);
        const canLearn = !isMax && player.skill_sp >= (skill.cost_sp || 1);
        const reqLvMet = player.lv >= (skill.req_lv || 1);
        const isLearned = (player.skills && player.skills[skill.id]) > 0;

        // Hide if req_lv not met (unless already learned - defensive)
        if (!reqLvMet && !isLearned) return;

        const pMin = skill.power_min || 0;
        const pMax = skill.power_max || pMin;
        let currentPower = pMin;
        if ((skill.max_lv || 1) > 1 && currentLv > 0) {
            currentPower = pMin + ((pMax - pMin) * (currentLv - 1)) / ((skill.max_lv || 1) - 1);
        }

        // Draggable logic
        const draggableAttr = isLearned ? 'draggable="true"' : "";
        const dragHandlers = isLearned ? 'ondragstart="dragSkill(event)"' : "";

        // Check if equipped in ANY slot
        const isEquipped = player.equippedSkills.includes(skill.id);
        const equippedClass = isEquipped ? "equipped" : "";
        const opacityStyle = isEquipped ? "opacity:0.5;" : "";
        const cursorStyle = isLearned ? "cursor:grab;" : "cursor:default;";

        html += `
        <div class="skill-item ${equippedClass}" ${draggableAttr} ${dragHandlers}
          data-skill-id="${skill.id}" data-skill-name="${skill.name}"
          style="display:flex; align-items:stretch; width:100%; max-width:500px; border:1px solid #ccc; border-radius:8px; margin-bottom:10px; overflow:hidden; ${opacityStyle} ${cursorStyle} ${isMax ? "background:#f9f9f9;" : "background:#fff;"}">

          <div class="skill-icon-box" style="width:80px; min-height:80px; background:#f1f2f6; display:flex; align-items:center; justify-content:center; flex-shrink:0; border-right:1px solid #eee;">
            <img src="images/${skill.image || "skill/default.png"}" onerror="this.src='https://placehold.jp/24/34495e/ffffff/64x64.png?text=Skill'" style="width:100%; height:100%; object-fit:cover;">
          </div>

          <div class="skill-details" style="flex:1; padding:10px 15px; display:flex; flex-direction:column; min-height:80px; box-sizing:border-box;">
            <div class="skill-item-header">
              <div class="skill-name" style="font-weight:bold;">
                ${skill.name} <span style="font-size:12px; color:#666; margin-left:8px;">Lv.${currentLv} / ${skill.max_lv}</span>
              </div>
              <div class="skill-action">
                <button class="btn-skill-enhance" onclick="learnSkill(${skill.id})" ${!canLearn || !reqLvMet ? "disabled" : ""}
                  style="width:auto; padding:5px 15px; font-size:12px; ${isMax ? "background:#ccc;" : ""}">
                  ${isMax ? "MAX" : "強化"}
                </button>
              </div>
            </div>

            <div class="skill-desc" style="font-size:12px; color:#444; margin-top:2px;">${skill.description}</div>

            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:auto; padding-top:5px;">
              <div class="skill-stats" style="font-size:11px; color:#27ae60;">
                威力: ${pMin}-${pMax}% ${currentLv > 0 ? `(現在: ${Math.floor(currentPower)}%)` : ""}<br>
                  回数: ${skill.hit_count}回 | CT: ${skill.cooldown}s
              </div>
              <div class="skill-req" style="font-size:11px; color:#888;">
                必要Lv: ${skill.req_lv} | 消費SP: ${skill.cost_sp}
              </div>
            </div>
          </div>
        </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
};

// Helper for removing skill directly from slot click
window.removeEquippedSkill = function (e, slotIndex) {
    e.stopPropagation();
    // Ensure array exists
    if (!player.equippedSkills) return;

    // Remove at index
    player.equippedSkills[slotIndex] = null;

    saveGame();
    renderSkillScreen();
    renderCombatSkills();
};

window.learnSkill = function (skillId) {
    const skill = masterData.skills.find((s) => s.id == skillId);
    if (!skill) return;

    if (!player.skills) player.skills = {};
    const currentLv = player.skills[skillId] || 0;
    if (currentLv >= (skill.max_lv || 10)) return;
    if (player.skill_sp < (skill.cost_sp || 1)) return;
    if (player.lv < (skill.req_lv || 1)) return;

    // ポイント消費
    player.skill_sp -= skill.cost_sp || 1;
    // レベルアップ
    player.skills[skillId] = currentLv + 1;

    // ステータス再計算
    calcBattleStats();
    // 画面更新
    renderSkillScreen();
    updateStatusDisplay();
    saveGame();
};

// --- Skill Drag & Drop Logic ---

window.allowDrop = function (ev) {
    ev.preventDefault();
};

window.dragSkill = function (ev) {
    // Transfer the skill ID
    ev.dataTransfer.setData("text/plain", ev.currentTarget.dataset.skillId);
    ev.dataTransfer.setData("skillName", ev.currentTarget.dataset.skillName);
    // Custom type or global fallback
    window.draggingSkillId = ev.currentTarget.dataset.skillId;
    window.draggingSkillName = ev.currentTarget.dataset.skillName;
};

window.dropSkill = function (ev) {
    ev.preventDefault();
    const skillId = ev.dataTransfer.getData("text/plain") || window.draggingSkillId;
    if (!skillId) return;

    const slot = ev.currentTarget;
    // Get slot index from dataset
    const slotIndex = parseInt(slot.dataset.slotIndex);
    if (isNaN(slotIndex)) return;

    // Initialize array if needed (though render should have done it)
    if (!player.equippedSkills) player.equippedSkills = [null, null, null];

    // Check for duplicates
    // allow duplicates? user request didn't specify, but usually unique.
    // Let's remove if it exists in another slot to avoid confusion (Move behavior)
    const existingIdx = player.equippedSkills.findIndex((id) => id == skillId);
    if (existingIdx !== -1 && existingIdx !== slotIndex) {
        player.equippedSkills[existingIdx] = null;
    }

    // Set new skill to this slot
    player.equippedSkills[slotIndex] = parseInt(skillId); // Ensure number if IDs are numbers

    saveGame();
    renderSkillScreen();
    renderCombatSkills();
};

// --------------------------------------------------------------------------------------
// Combat Skill UI: Render icons
// --------------------------------------------------------------------------------------
window.renderCombatSkills = function () {
    const container = document.getElementById("combat-skill-container");
    if (!container) return;

    // 常に3スロット表示
    let html = "";
    for (let i = 0; i < 3; i++) {
        const skillId =
            player.equippedSkills && player.equippedSkills[i] ? player.equippedSkills[i] : null;

        let content = "";
        let overlayHeight = "0%";

        if (skillId) {
            const skill =
                masterData && masterData.skills
                    ? masterDataMap.skills.get(Number(skillId))
                    : null;
            const iconUrl = `images/${skill && skill.image ? skill.image : "skill/default.png"}`;

            if (skill && player.skill_cooldowns && player.skill_cooldowns[skillId] > 0) {
                const maxCD = (skill.cooldown || 0) * 60;
                const current = player.skill_cooldowns[skillId];
                const pct = Math.min(100, Math.max(0, (current / maxCD) * 100));
                overlayHeight = `${pct}%`;
            }

            content = `
      <div class="combat-skill-content" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
        <img src="${iconUrl}" onerror="this.src='https://placehold.jp/24/34495e/ffffff/64x64.png?text=Skill'" style="width:100%; height:100%; object-fit:cover; border-radius:4px;">
      </div>
      <div class="cooldown-overlay" style="height:${overlayHeight};" id="cd-overlay-${skillId}"></div>
      `;
        } else {
            content = `<div style="opacity:0.2; font-size:12px;">空</div>`;
        }

        html += `
      <div class="combat-skill-icon" id="combat-skill-icon-${i}">
        ${content}
      </div>
      `;
    }

    container.innerHTML = html;
};

window.updateCombatSkillUI = function () {
    if (!player.equippedSkills || !Array.isArray(player.equippedSkills)) return;

    player.equippedSkills.forEach((skillId) => {
        if (!skillId) return;

        const overlay = document.getElementById(`cd-overlay-${skillId}`);
        if (overlay) {
            let height = "0%";
            if (player.skill_cooldowns && player.skill_cooldowns[skillId] > 0) {
                const skill = masterDataMap.skills.get(Number(skillId));
                if (skill) {
                    const maxCD = (skill.cooldown || 0) * 60;
                    const current = player.skill_cooldowns[skillId];
                    const pct = Math.min(100, Math.max(0, (current / maxCD) * 100));
                    height = `${pct}%`;
                }
            }
            overlay.style.height = height;
        }
    });
};

window.renderJobScreen = function () {
    console.log("Rendering Job Screen...");
    const currentJob = player.currentJob || "adventurer";

    if (currentJob === "adventurer") {
        showJobSelection();
    } else {
        renderSpecificJobScreen(currentJob);
    }
};

window.renderSpecificJobScreen = function (jobId) {
    const selectionView = document.getElementById("job-selection-view");
    const specificView = document.getElementById("job-specific-view");
    if (selectionView) selectionView.style.display = "none";
    if (specificView) {
        specificView.style.display = "flex";

        // 職業名の反映
        const jobInfo = JOB_MASTER[jobId];
        const specTitle = document.getElementById("job-spec-title");
        const specName = document.getElementById("job-spec-name");

        if (specTitle) specTitle.innerText = jobInfo ? jobInfo.name : jobId;
        if (specName) specName.innerText = jobInfo ? jobInfo.name : jobId;

        // 全UIを一度非表示
        const ids = ["blacksmith-ui", "armorsmith-ui", "toolsmith-ui", "gatherer-ui", "farmer-ui"];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        });

        // 職業に応じたUI表示と初期化
        if (jobId === "blacksmith") {
            document.getElementById("blacksmith-ui").style.display = "block";
            resetBsGame();
        } else if (jobId === "armorsmith") {
            document.getElementById("armorsmith-ui").style.display = "block";
        } else if (jobId === "toolsmith" || jobId === "repairer") {
            document.getElementById("toolsmith-ui").style.display = "block";
            initTsGame();
        } else if (jobId === "miner" || jobId === "harvester") {
            document.getElementById("gatherer-ui").style.display = "block";
            document.getElementById("gather-title").innerText =
                jobId === "miner" ? "採掘中..." : "採取中...";
            gatherProgress = 0;
        } else if (jobId === "farmer" || jobId === "rancher") {
            document.getElementById("farmer-ui").style.display = "block";
            document.getElementById("farm-title").innerText =
                jobId === "farmer" ? "作物の育成" : "家畜の世話";
            document.getElementById("farm-emoji").innerText = jobId === "farmer" ? "🌱" : "🐣";
            farmProgress = 0;
            farmStep = 0;
        }

        // 個別説明の表示
        const descArea = document.getElementById("job-description-area");
        const descText = document.getElementById("job-description-text");
        if (descArea && descText) {
            const description = JOB_DESCRIPTIONS[jobId];
            if (description) {
                descText.innerText = description;
                descArea.style.display = "block";
            } else {
                descArea.style.display = "none";
            }
        }
    }
};

window.showJobSelection = function () {
    const selectionView = document.getElementById("job-selection-view");
    const specificView = document.getElementById("job-specific-view");
    if (specificView) specificView.style.display = "none";
    if (selectionView) {
        selectionView.style.display = "flex";
        // デフォルトでクラフターを選択表示
        switchJobCategory("crafter");
    }
};

window.changeJob = function (jobId) {
    if (!JOB_MASTER[jobId]) return;
    if (player.currentJob === jobId) {
        alert("既にその職業に就いています。");
        return;
    }

    if (confirm(`${JOB_MASTER[jobId].name}に転職しますか？`)) {
        player.currentJob = jobId;
        calcBattleStats();
        updateStatusDisplay();
        renderJobScreen();
        saveGame();
        addCombatLog(`${JOB_MASTER[jobId].name}に転職しました！`, "#3498db");
    }
};

window.gainJExp = function (amount) {
    const currentJobId = player.currentJob || "adventurer";
    if (!player.jobData) player.jobData = {};
    if (!player.jobData[currentJobId]) {
        player.jobData[currentJobId] = { lv: 1, exp: 0, nextExp: 100 };
    }

    const jd = player.jobData[currentJobId];
    if (!jd) return; // 本来ありえないが念のため
    jd.exp += amount;

    while (jd.exp >= jd.nextExp) {
        jd.exp -= jd.nextExp;
        jd.lv++;
        jd.nextExp = Math.floor(jd.nextExp * 1.2) + 50;
        addCombatLog(
            `ジョブレベルアップ！ ${JOB_MASTER[currentJobId] ? JOB_MASTER[currentJobId].name : currentJobId} Lv${jd.lv}`,
            "#f1c40f"
        );

        calcBattleStats();
        updateStatusDisplay();
    }

    const jobScreen = document.getElementById("screen-job");
    if (jobScreen && jobScreen.style.display !== "none") {
        updateJobUI();
    }
};

function updateJobUI() {
    if (!player.jobData) return;
    const jd = player.jobData[player.currentJob];
    const currentJobNameEl = document.getElementById("current-job-name");
    const currentJobLevelEl = document.getElementById("current-job-level");

    if (currentJobNameEl && JOB_MASTER[player.currentJob]) {
        currentJobNameEl.innerText = JOB_MASTER[player.currentJob].name;
    }
    if (currentJobLevelEl && jd) {
        currentJobLevelEl.innerText = jd.lv;
    }
}

window.switchJobCategory = function (category) {
    const categories = {
        crafter: {
            title: "クラフター",
            text: "素材を精製・加工し、武具や道具を創り出す職人たちのカテゴリー。経済の循環を支える中心的な役割を担います。",
            jobs: [
                { id: "blacksmith", name: "武器職人", desc: "強力な武器を鍛え上げる" },
                { id: "armorsmith", name: "防具職人", desc: "鉄壁の防具を製造する" },
                { id: "toolsmith", name: "道具職人", desc: "便利な冒険道具を作る" },
                { id: "repairer", name: "修繕屋", desc: "壊れた装備を修理する" }
            ]
        },
        gatherer: {
            title: "ギャザラー",
            text: "自然界から鉱石や植物などの原資材を採取するカテゴリー。すべての製造の起点となる素材を市場に供給します。",
            jobs: [
                { id: "miner", name: "炭鉱夫", desc: "地下資源を採掘する" },
                { id: "harvester", name: "採取家", desc: "植物や薬草を採集する" }
            ]
        },
        farmer: {
            title: "ファーマー",
            text: "土地を耕し、食料品や家畜素材を生産するカテゴリー。スタミナ回復やバフ効果を持つ食料の原料を供給します。",
            jobs: [
                { id: "farmer", name: "農家", desc: "穀物や野菜を育てる" },
                { id: "rancher", name: "酪農家", desc: "畜産素材を入手する" }
            ]
        }
    };

    const data = categories[category];
    if (!data) return;

    const titleEl = document.getElementById("job-cat-title");
    const textEl = document.getElementById("job-cat-text");
    if (titleEl) titleEl.innerText = data.title;
    if (textEl) textEl.innerText = data.text;

    const buttons = document.querySelectorAll(".job-cat-btn");
    buttons.forEach((btn) => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`job-cat-${category}`);
    if (activeBtn) activeBtn.classList.add("active");

    const jobListEl = document.getElementById("job-list");
    if (!jobListEl) return;
    jobListEl.innerHTML = "";

    data.jobs.forEach((job) => {
        const jd =
            player.jobData && player.jobData[job.id]
                ? player.jobData[job.id]
                : { lv: 1, exp: 0, nextExp: 100 };
        const isCurrent = player.currentJob === job.id;

        const card = document.createElement("div");
        card.className = "job-card";
        card.style.border = isCurrent ? "2px solid #3498db" : "1px solid #ddd";
        card.style.position = "relative";
        // カード自体もFlex化して中身を上下配置
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.justifyContent = "space-between";
        card.style.padding = "10px";
        card.style.backgroundColor = "#fff";
        card.style.borderRadius = "6px";
        card.style.minHeight = "300px";
        // 最大幅制限 (伸縮対策)
        card.style.width = "100%";
        card.style.maxWidth = "300px";

        const expPercent = Math.min(100, (jd.exp / jd.nextExp) * 100);

        card.innerHTML = `
      ${isCurrent ? '<span style="position:absolute; top:-10px; right:10px; background:#3498db; color:white; font-size:10px; padding:2px 6px; border-radius:10px;">就業中</span>' : ""}
      <div>
        <p style="font-weight:bold; margin:0 0 5px 0;">${job.name}</p>
        <p style="font-size:11px; color:#666; margin:0 0 10px 0;">Lv.${jd.lv}</p>
        <div style="width:100%; height:4px; background:#eee; border-radius:2px; margin-bottom:10px; overflow:hidden;">
          <div style="width:${expPercent}%; height:100%; background:#f1c40f;"></div>
        </div>
        <p style="font-size:12px; color:#444; margin:0;">${job.desc}</p>
      </div>
      <div style="margin-top: 15px;">
      ${
          isCurrent
              ? '<button disabled style="width:100%; font-size:12px; padding:6px; background:#bdc3c7; color:white; border:none; border-radius:4px;">就業中</button>'
              : `<button onclick="changeJob('${job.id}')" style="width:100%; font-size:12px; padding:6px; background:#3498db; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">転職する</button>`
      }
      </div>
    `;
        jobListEl.appendChild(card);
    });
};
// エイリアス定義 (後方互換性のため)
window.updateStatusDisplay = function () {
    if (typeof updateUI === "function") {
        updateUI();
    }
};

// --- ジョブミニゲームロジック実体 ---

function updateJobMiniGames() {
    const jobId = player.currentJob;
    if (!jobId || jobId === "adventurer") return;

    // 共通の進捗更新（表示されている場合）
    jobUpdateTimer++;

    // 1. 武器職人
    if (jobId === "blacksmith" && bsIsPressing) {
        bsGaugeValue += 1.5;
        if (bsGaugeValue > 100) bsGaugeValue = 0;
        const cur = document.getElementById("bs-current-gauge");
        if (cur) cur.style.width = bsGaugeValue + "%";
    }

    // 2. 防具職人
    if (jobId === "armorsmith") {
        asCursorPos += 2 * asCursorDir;
        if (asCursorPos >= 100) asCursorDir = -1;
        if (asCursorPos <= 0) asCursorDir = 1;
        const cur = document.getElementById("as-cursor");
        if (cur) cur.style.left = asCursorPos + "%";
    }

    // 4. ギャザラー (放置)
    if (jobId === "miner" || jobId === "harvester") {
        if (jobUpdateTimer % 2 === 0) {
            gatherProgress += 0.5;
            if (gatherProgress >= 100) {
                gatherProgress = 0;
                handleJobSuccess(jobId, jobId === "miner" ? "鉱石" : "薬草");
            }
            const bar = document.getElementById("gather-progress");
            if (bar) bar.style.width = gatherProgress + "%";
        }
    }

    // 5. ファーマー (育成・徐々に進行)
    if (jobId === "farmer" || jobId === "rancher") {
        if (jobUpdateTimer % 5 === 0) {
            farmProgress += 0.2;
            if (farmProgress >= 100) {
                farmProgress = 0;
                handleJobSuccess(jobId, jobId === "farmer" ? "野菜" : "ミルク");
                farmStep = 0;
                updateFarmEmoji(jobId);
            }
            const bar = document.getElementById("farm-progress");
            if (bar) bar.style.width = farmProgress + "%";
        }
    }
}

// 武器職人
window.startBsGauge = function () {
    bsIsPressing = true;
};
window.endBsGauge = function () {
    bsIsPressing = false;
    const diff = Math.abs(bsGaugeValue - (bsTargetPos + 7)); // 中心点
    if (diff < 10) {
        handleJobSuccess("blacksmith", "名剣", 20);
    } else {
        setJobMessage("失敗... ゲージを合わせましょう", "#e74c3c");
    }
    resetBsGame();
};
function resetBsGame() {
    bsGaugeValue = 0;
    bsTargetPos = 20 + Math.random() * 60;
    const zone = document.getElementById("bs-target-zone");
    if (zone) zone.style.left = bsTargetPos + "%";
    const cur = document.getElementById("bs-current-gauge");
    if (cur) cur.style.width = "0%";
}

// 防具職人
window.handleAsClick = function () {
    const diff = Math.abs(asCursorPos - 50);
    if (diff < 10) {
        handleJobSuccess("armorsmith", "堅牢な鎧", 20);
    } else {
        setJobMessage("ズレています！中心を狙って！", "#e74c3c");
    }
};

// 道具職人
function initTsGame() {
    tsCurrentWord = tsWords[Math.floor(Math.random() * tsWords.length)];
    const disp = document.getElementById("ts-word-display");
    if (disp) disp.innerText = tsCurrentWord;
    const input = document.getElementById("ts-input");
    if (input) {
        input.value = "";
        input.focus();
    }
}
window.checkTsInput = function () {
    const input = document.getElementById("ts-input");
    if (input && input.value.toUpperCase() === tsCurrentWord) {
        const itemName = player.currentJob === "repairer" ? "修繕依頼" : "便利ツール";
        handleJobSuccess(player.currentJob, itemName, 15);
        initTsGame();
    }
};

// ファーマー
window.handleFarmAction = function () {
    farmProgress += 10;
    if (farmProgress > 100) farmProgress = 100;
    setJobMessage("お世話しました！ (+10%)", "#27ae60");

    // 進捗に応じて絵文字変化
    if (farmProgress > 70) farmStep = 2;
    else if (farmProgress > 30) farmStep = 1;
    updateFarmEmoji(player.currentJob);
};

function updateFarmEmoji(jobId) {
    const emojiEl = document.getElementById("farm-emoji");
    if (!emojiEl) return;
    if (jobId === "farmer") {
        const icons = ["🌱", "🌿", "🍎"];
        emojiEl.innerText = icons[farmStep];
    } else {
        const icons = ["🐣", "🐥", "🐔"];
        emojiEl.innerText = icons[farmStep];
    }
}

// 成功処理共通
function handleJobSuccess(jobId, itemName, exp = 10) {
    gainJExp(exp);
    setJobMessage(`${itemName} を作成/取得しました！ (EXP+${exp})`, "#27ae60");

    // ギャザラーの場合はログ追記
    if (jobId === "miner" || jobId === "harvester") {
        const log = document.getElementById("gather-log");
        if (log) {
            const p = document.createElement("p");
            p.innerText = `[${new Date().toLocaleTimeString()}] ${itemName} を入手`;
            p.style.margin = "2px 0";
            log.prepend(p);
        }
    }
}

function setJobMessage(msg, color) {
    const msgEl = document.getElementById("job-result-msg");
    if (msgEl) {
        msgEl.innerText = msg;
        msgEl.style.color = color;
    }
}

// --- お知らせ機能 ---
function openNews() {
    console.log("Opening news...");
    // noteなどの特定のURLへ遷移
    window.open("https://note.com/tsukuro_team/m/maad6f21433fd", "_blank");

    // 既読状態を更新
    if (masterData && masterData.config && masterData.config.last_news_timestamp) {
        player.lastSeenNewsTimestamp = masterData.config.last_news_timestamp;
        const badge = document.getElementById("news-badge");
        if (badge) badge.style.display = "none";
        saveGame();
    }
};

function checkNewsBadge() {
    if (!masterData || !masterData.config || !masterData.config.last_news_timestamp) return;

    const lastNews = masterData.config.last_news_timestamp;
    const playerSeen = player.lastSeenNewsTimestamp || 0;

    if (lastNews > playerSeen) {
        const badge = document.getElementById("news-badge");
        if (badge) badge.style.display = "block";
    }
}

// --- ユーティリティ ---
function indexMasterData() {
    if (!masterData) return;
    const collections = ["items", "skills", "enemies", "options", "dungeons", "exp_table"];
    collections.forEach((key) => {
        if (masterData[key]) {
            masterData[key].forEach((item) => {
                masterDataMap[key].set(Number(item.id || item.lv), item);
            });
        }
    });
    console.log("[System] Master data indexed.");
}
