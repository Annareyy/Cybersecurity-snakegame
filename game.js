const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const COLS = 20;
const ROWS = 20;
const CELL = 24;

let CURRICULUM = [];
fetch("lessons.json")
    .then(r => r.json())
    .then(data => { CURRICULUM = data; })
    .catch(err => console.warn("Could not load lessons.json:", err));

const state = {
    status: "idle",
    snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    food: null,
    score: 0,
    speed: 120,
    gameInterval: null,
    sessionSeconds: 0,
    sessionTimer: null,
    threat: null,
    defense: null,
    activeCurriculum: null,
    lessonsCompleted: 0,
    totalThreats: 0,
    totalDefenses: 0,
    totalPackets: 0,
    cardTimeLeft: 20,
    cardTimer: null
};

// ─── LESSON CARD ──────────────────────────────────────────────────────────────

function showCard(type) {
    const lesson = state.activeCurriculum;
    if (!lesson) return;

    document.getElementById("card-category").textContent = lesson.category;
    document.getElementById("card-title").textContent = lesson[type].name;
    document.querySelector(".threat-label").textContent = "THREAT: " + lesson.threat.name;
    document.getElementById("threat-desc").textContent = lesson.threat.description;
    document.querySelector(".defense-label").textContent = "DEFENSE: " + lesson.defense.name;
    document.getElementById("defense-desc").textContent = lesson.defense.description;

    const continueBtn = document.getElementById("continue-btn");
    continueBtn.classList.remove("defense-btn", "threat-btn");
    continueBtn.classList.add(type + "-btn");
    continueBtn.textContent = type === "defense"
        ? "CONTINUE (+500 PTS) [SPACE]"
        : "CONTINUE (-1000 PTS) [SPACE]";

    document.getElementById("lesson-overlay").classList.remove("hidden");
    state.status = "paused";
    clearInterval(state.gameInterval);
    startCardTimer();
}

function startCardTimer() {
    state.cardTimeLeft = 20;
    const timerBar = document.getElementById("card-timer-bar");
    const countdown = document.getElementById("card-countdown");

    clearInterval(state.cardTimer);
    state.cardTimer = setInterval(() => {
        state.cardTimeLeft -= 0.1;
        if (timerBar) timerBar.style.width = (state.cardTimeLeft / 20 * 100) + "%";
        if (countdown) countdown.textContent = Math.ceil(state.cardTimeLeft) + "s";
        if (state.cardTimeLeft <= 0) dismissCard();
    }, 100);
}

function extendTimer() {
    state.cardTimeLeft = Math.min(state.cardTimeLeft + 10, 30);
    const timerBar = document.getElementById("card-timer-bar");
    const countdown = document.getElementById("card-countdown");
    if (timerBar) timerBar.style.width = (state.cardTimeLeft / 20 * 100) + "%";
    if (countdown) countdown.textContent = Math.ceil(state.cardTimeLeft) + "s";
}

function dismissCard() {
    clearInterval(state.cardTimer);
    document.getElementById("lesson-overlay").classList.add("hidden");
    state.status = "playing";
    state.gameInterval = setInterval(move, state.speed);
}

// ─── SPAWN FOOD ───────────────────────────────────────────────────────────────

function spawnFood() {
    let pos;
    do {
        pos = {
            x: Math.floor(Math.random() * COLS),
            y: Math.floor(Math.random() * ROWS)
        };
    } while (state.snake.some(seg => seg.x === pos.x && seg.y === pos.y));
    state.food = pos;
}

// ─── SPAWN THREAT PAIR ────────────────────────────────────────────────────────

function spawnThreatPair() {
    if (!CURRICULUM || CURRICULUM.length === 0) return;

    const lesson = CURRICULUM[Math.floor(Math.random() * CURRICULUM.length)];
    state.activeCurriculum = lesson;

    function randomFreePos(...occupied) {
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * COLS),
                y: Math.floor(Math.random() * ROWS)
            };
        } while (
            state.snake.some(seg => seg.x === pos.x && seg.y === pos.y) ||
            (state.food && state.food.x === pos.x && state.food.y === pos.y) ||
            occupied.some(o => o && o.x === pos.x && o.y === pos.y)
        );
        return pos;
    }

    const threatPos = randomFreePos();
    const defensePos = randomFreePos(threatPos);

    state.threat = { ...threatPos, name: lesson.threat.name };
    state.defense = { ...defensePos, name: lesson.defense.name };
}

// ─── DRAWING HELPERS ──────────────────────────────────────────────────────────

function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawChip(cx, cy, fillColor, strokeColor, symbol, symbolColor, label) {
    const size = 36;
    const half = size / 2;
    const px = cx * CELL + (CELL - size) / 2;
    const py = cy * CELL + (CELL - size) / 2;

    drawRoundedRect(px, py, size, size, 6);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = symbolColor;
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, px + half, py + half);

    const truncated = label.length > 12 ? label.slice(0, 12) : label;
    ctx.fillStyle = "#9ca3af";
    ctx.font = "8px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(truncated, px + half, py + size + 2);
}

// ─── MAIN DRAW ────────────────────────────────────────────────────────────────

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#f0faf0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = "rgba(0,166,81,0.08)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * CELL, 0);
        ctx.lineTo(c * CELL, canvas.height);
        ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL);
        ctx.lineTo(canvas.width, r * CELL);
        ctx.stroke();
    }

    // Snake
    state.snake.forEach((seg, i) => {
        const px = seg.x * CELL + 1;
        const py = seg.y * CELL + 1;
        const sz = CELL - 2;
        drawRoundedRect(px, py, sz, sz, 3);
        ctx.fillStyle = i === 0 ? "#00C261" : "#00A651";
        ctx.fill();
    });

    // Food
    if (state.food) {
        drawChip(
            state.food.x,
            state.food.y,
            "rgba(255,255,255,0.9)",
            "rgba(156,163,175,0.5)",
            "◈",
            "#9ca3af",
            "DATA_INT"
        );
    }

    // Threat chip
    if (state.threat) {
        const tName = state.threat.name || "UNKNOWN";
        drawChip(
            state.threat.x,
            state.threat.y,
            "rgba(239,68,68,0.1)",
            "rgba(239,68,68,0.5)",
            "✉",
            "rgba(239,68,68,0.8)",
            "THREAT: " + tName
        );
    }

    // Defense chip
    if (state.defense) {
        const dName = state.defense.name || "UNKNOWN";
        drawChip(
            state.defense.x,
            state.defense.y,
            "rgba(0,166,81,0.1)",
            "rgba(0,166,81,0.5)",
            "🛡",
            "rgba(0,166,81,0.8)",
            "DEFENSE: " + dName
        );
    }

    // Dashed tether between threat and defense
    if (state.threat && state.defense) {
        ctx.save();
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(state.threat.x * CELL + CELL / 2, state.threat.y * CELL + CELL / 2);
        ctx.lineTo(state.defense.x * CELL + CELL / 2, state.defense.y * CELL + CELL / 2);
        ctx.stroke();
        ctx.restore();
    }

    // Idle overlay
    if (state.status === "idle") {
        ctx.fillStyle = "rgba(248,250,251,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#6b7280";
        ctx.font = "600 16px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PRESS [SPACE] TO START", canvas.width / 2, canvas.height / 2);
    }

    // Game over overlay
    if (state.status === "gameover") {
        ctx.fillStyle = "rgba(248,250,251,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#E31937";
        ctx.font = "600 16px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("GAME OVER — PRESS [SPACE]", canvas.width / 2, canvas.height / 2);
    }

    // Coordinates display
    const head = state.snake[0];
    const coordEl = document.getElementById("coordinates");
    if (coordEl) {
        coordEl.textContent = `[X: ${head.x}, Y: ${head.y}]`;
    }
}

// ─── GAME LOOP ────────────────────────────────────────────────────────────────

function move() {
    state.direction = { ...state.nextDirection };
    const head = state.snake[0];
    const newHead = { x: head.x + state.direction.x, y: head.y + state.direction.y };

    // Wall collision
    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
        gameOver();
        return;
    }

    // Self collision
    if (state.snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
        gameOver();
        return;
    }

    state.snake.unshift(newHead);
    let ate = false;

    // Eat food
    if (state.food && newHead.x === state.food.x && newHead.y === state.food.y) {
        state.score += 1;
        state.totalPackets++;
        spawnFood();
        ate = true;
        addTelemetryLog("DATA PACKET COLLECTED +1", "success");
        addScoreEntry("Data Packet", 1, "#6b7280");
    }

    // Collect defense node
    if (state.defense && newHead.x === state.defense.x && newHead.y === state.defense.y) {
        state.score += 500;
        state.totalDefenses++;
        ate = true;
        addTelemetryLog("NODE SECURED — " + state.defense.name, "success");
        addScoreEntry("Defense: " + state.defense.name, 500, "#00A651");
        const curriculum = state.activeCurriculum;
        state.defense = null;
        if (state.threat) state.threat = null;
        if (curriculum) {
            if (typeof showCard === "function") showCard("defense");
            return;
        }
    }

    // Hit threat node
    if (state.threat && newHead.x === state.threat.x && newHead.y === state.threat.y) {
        state.score = Math.max(0, state.score - 1000);
        state.totalThreats++;
        addTelemetryLog("THREAT DETECTED — " + state.threat.name, "danger");
        addScoreEntry("Threat: " + state.threat.name, -1000, "#E31937");
        const curriculum = state.activeCurriculum;
        state.threat = null;
        if (state.defense) state.defense = null;
        if (curriculum) {
            if (typeof showCard === "function") showCard("threat");
            return;
        }
    }

    // Remove tail if nothing eaten
    if (!ate) state.snake.pop();

    // Randomly spawn threat pair
    if (
        state.threat === null &&
        typeof CURRICULUM !== "undefined" &&
        CURRICULUM.length > 0 &&
        Math.random() < 0.02
    ) {
        if (typeof spawnThreatPair === "function") spawnThreatPair();
    }

    draw();
    updateDashboard();
}

// ─── GAME CONTROL ─────────────────────────────────────────────────────────────

function startGame() {
    if (state.status !== "idle" && state.status !== "gameover") return;

    state.snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    state.direction = { x: 1, y: 0 };
    state.nextDirection = { x: 1, y: 0 };
    state.score = 0;
    state.status = "playing";
    state.threat = null;
    state.defense = null;
    state.activeCurriculum = null;
    state.totalThreats = 0;
    state.totalDefenses = 0;
    state.totalPackets = 0;
    state.lessonsCompleted = 0;

    const scoreLog = document.getElementById("score-log");
    if (scoreLog) scoreLog.innerHTML = "";
    const telemetryLog = document.getElementById("telemetry-log");
    if (telemetryLog) telemetryLog.innerHTML = "";

    spawnFood();

    if (state.gameInterval) clearInterval(state.gameInterval);
    state.gameInterval = setInterval(move, state.speed);

    if (state.sessionTimer) clearInterval(state.sessionTimer);
    state.sessionSeconds = 0;
    state.sessionTimer = setInterval(() => {
        state.sessionSeconds++;
        const h = String(Math.floor(state.sessionSeconds / 3600)).padStart(2, "0");
        const m = String(Math.floor((state.sessionSeconds % 3600) / 60)).padStart(2, "0");
        const s = String(state.sessionSeconds % 60).padStart(2, "0");
        const el = document.getElementById("session-timer");
        if (el) el.textContent = `[SESSION: ${h}:${m}:${s}]`;
    }, 1000);

    addTelemetryLog("SESSION INITIALIZED", "success");
    updateDashboard();
    draw();
}

function gameOver() {
    state.status = "gameover";
    clearInterval(state.gameInterval);
    clearInterval(state.sessionTimer);
    addTelemetryLog("SESSION TERMINATED", "danger");
    updateDashboard();
    draw();
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function updateDashboard() {
    const scoreEl = document.getElementById("score-value");
    if (scoreEl) scoreEl.textContent = state.score;

    const fillEl = document.getElementById("progress-fill");
    if (fillEl) fillEl.style.width = Math.min((state.score / 50) * 100, 100) + "%";

    const percentEl = document.getElementById("rank-percent");
    if (percentEl) percentEl.textContent = Math.min(state.score, 100) + "%";

    const threatsEl = document.getElementById("threats-count");
    if (threatsEl) threatsEl.textContent = state.totalThreats;

    const defenseEl = document.getElementById("defense-count");
    if (defenseEl) defenseEl.textContent = state.totalDefenses;

    const packetsEl = document.getElementById("packets-count");
    if (packetsEl) packetsEl.textContent = state.totalPackets;
}

function addTelemetryLog(message, type) {
    const log = document.getElementById("telemetry-log");
    if (!log) return;

    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");

    const entry = document.createElement("div");
    entry.className = "log-entry";

    const timeSpan = document.createElement("span");
    timeSpan.className = "log-time";
    timeSpan.textContent = `${h}:${m}:${s}`;

    const msgSpan = document.createElement("span");
    msgSpan.className = type === "success" ? "log-success" : "log-danger";
    msgSpan.textContent = message;

    entry.appendChild(timeSpan);
    entry.appendChild(msgSpan);
    log.prepend(entry);
}

function addScoreEntry(label, points, color) {
    const log = document.getElementById("score-log");
    if (!log) return;

    if (log.textContent.trim() === "No recent activity...") {
        log.innerHTML = "";
    }

    const entry = document.createElement("div");
    entry.className = "score-entry";

    const labelSpan = document.createElement("span");
    labelSpan.className = "event-label";
    labelSpan.style.color = color;
    labelSpan.textContent = label;

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "event-score";
    scoreSpan.style.color = color;
    scoreSpan.textContent = (points >= 0 ? "+" : "") + points;

    entry.appendChild(labelSpan);
    entry.appendChild(scoreSpan);
    log.prepend(entry);
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        e.preventDefault();
        if (state.status === "idle" || state.status === "gameover") {
            startGame();
        } else if (state.status === "paused") {
            if (typeof dismissCard === "function") dismissCard();
        }
        return;
    }

    if (state.status !== "playing") return;

    const keyMap = {
        ArrowUp: { x: 0, y: -1 },
        KeyW: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        KeyS: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        KeyA: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        KeyD: { x: 1, y: 0 }
    };

    const newDir = keyMap[e.code];
    if (newDir) {
        if (newDir.x !== -state.direction.x || newDir.y !== -state.direction.y) {
            state.nextDirection = newDir;
        }
        e.preventDefault();
    }
});

const extendBtn = document.getElementById("extend-btn");
if (extendBtn) extendBtn.addEventListener("click", extendTimer);

const continueBtn = document.getElementById("continue-btn");
if (continueBtn) continueBtn.addEventListener("click", dismissCard);

document.querySelectorAll(".diff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.speed = parseInt(btn.dataset.speed);
        if (state.status === "playing") {
            clearInterval(state.gameInterval);
            state.gameInterval = setInterval(move, state.speed);
        }
    });
});

document.querySelectorAll(".ctrl-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        if (state.status !== "playing") return;

        const dirMap = {
            up: { x: 0, y: -1 },
            down: { x: 0, y: 1 },
            left: { x: -1, y: 0 },
            right: { x: 1, y: 0 }
        };

        const newDir = dirMap[btn.dataset.dir];
        if (newDir) {
            if (newDir.x !== -state.direction.x || newDir.y !== -state.direction.y) {
                state.nextDirection = newDir;
            }
        }
    });
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

spawnFood();
draw();