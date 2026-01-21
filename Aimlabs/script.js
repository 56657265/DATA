// Game Configuration & State
const CONFIG = {
    targetBaseSize: 300, // Base pixel size of the target image at default scale
    targetImageSrc: 'assets/target.png',
    gameDuration: 90, // seconds
    fov: 110,
    autoDespawnTime: 675, // ms
    headshotRadius: 40, // Relative to target size
    bodyRadius: 60, // Relative to target size
};

const STATE = {
    currentPage: 'page-main-mode',
    mainMode: null, // 'hit-to-remove' | 'auto-despawn'
    subMode: null, // 'headshot' | 'random-weakpoint' | 'moving'
    score: 0,
    timeLeft: 0,
    isPlaying: false,
    targets: [], // Array of active target objects
    particles: [], // Array of visual particles
    stats: {
        shots: 0,
        hits: 0
    },
    canvas: null,
    ctx: null,
    lastTime: 0,
    targetImage: new Image(),
    audioCtx: null, // Web Audio Context
};

// DOM Elements
const pages = {
    main: document.getElementById('page-main-mode'),
    sub: document.getElementById('page-sub-mode'),
    game: document.getElementById('page-game')
};

const ui = {
    score: document.getElementById('score-display'),
    time: document.getElementById('time-display'),
    modal: document.getElementById('game-over-modal'),
    finalScore: document.getElementById('final-score-val'),
    finalAcc: document.getElementById('final-accuracy'),
    finalHits: document.getElementById('final-hits'),
    finalMisses: document.getElementById('final-misses')
};

// Audio System
const AUDIO = {
    init: () => {
        if (!STATE.audioCtx) {
            STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playHit: () => {
        if (!STATE.audioCtx) return;
        const osc = STATE.audioCtx.createOscillator();
        const gain = STATE.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(STATE.audioCtx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, STATE.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, STATE.audioCtx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.3, STATE.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, STATE.audioCtx.currentTime + 0.1);

        osc.start();
        osc.stop(STATE.audioCtx.currentTime + 0.1);
    },
    playMiss: () => {
        if (!STATE.audioCtx) return;
        const osc = STATE.audioCtx.createOscillator();
        const gain = STATE.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(STATE.audioCtx.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(150, STATE.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, STATE.audioCtx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.1, STATE.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, STATE.audioCtx.currentTime + 0.15);

        osc.start();
        osc.stop(STATE.audioCtx.currentTime + 0.15);
    }
};

// Initialization
window.onload = () => {
    STATE.targetImage.src = CONFIG.targetImageSrc;
    initCanvas();
    showPage('page-main-mode');

    // Resize listener
    window.addEventListener('resize', resizeCanvas);
};

function initCanvas() {
    STATE.canvas = document.getElementById('game-canvas');
    STATE.ctx = STATE.canvas.getContext('2d');
    resizeCanvas();

    // Input handling
    STATE.canvas.addEventListener('mousedown', handleInput);
}

function resizeCanvas() {
    if (!STATE.canvas) return;
    STATE.canvas.width = window.innerWidth;
    STATE.canvas.height = window.innerHeight;
}

// Navigation
function showPage(pageId) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    STATE.currentPage = pageId;
}

function selectMainMode(mode) {
    STATE.mainMode = mode;
    showPage('page-sub-mode');
    AUDIO.init(); // Init audio context on user interaction
}

function selectSubMode(mode) {
    STATE.subMode = mode;
    startGame();
}

function goBack() {
    if (STATE.currentPage === 'page-sub-mode') {
        showPage('page-main-mode');
    }
}

function goHome() {
    ui.modal.classList.add('hidden');
    showPage('page-main-mode');
}

// Game Logic
function startGame() {
    showPage('page-game');

    // Reset State
    STATE.score = 0;
    STATE.timeLeft = CONFIG.gameDuration;
    STATE.isPlaying = true;
    STATE.targets = [];
    STATE.particles = [];
    STATE.stats = { shots: 0, hits: 0 };
    STATE.lastTime = performance.now();

    updateHUD();
    spawnTarget();

    // Start Loop
    requestAnimationFrame(gameLoop);
}

function stopGame() {
    STATE.isPlaying = false;
    showGameOver();
}

function restartGame() {
    ui.modal.classList.add('hidden');
    startGame();
}

function spawnTarget() {
    // Remove old targets logic mainly for single target modes
    if (STATE.targets.length > 0) return;

    const padding = 200;
    const x = padding + Math.random() * (STATE.canvas.width - padding * 2);
    const y = padding + Math.random() * (STATE.canvas.height - padding * 2);

    let redDotPos = { x: 0, y: -80 }; // Default head pos

    // Weakpoint logic
    if (STATE.subMode === 'headshot') {
        redDotPos = { x: 0, y: -90 };
    } else if (STATE.subMode === 'random-weakpoint') {
        const isHead = Math.random() > 0.5;
        if (isHead) {
            redDotPos = { x: (Math.random() - 0.5) * 30, y: -90 + (Math.random() - 0.5) * 30 };
        } else {
            redDotPos = { x: (Math.random() - 0.5) * 60, y: 20 + (Math.random() - 0.5) * 80 };
        }
    }

    const target = {
        x: x,
        y: y,
        spawnTime: performance.now(),
        redDotOffset: redDotPos,
        scale: 1,
        velocity: { x: 0, y: 0 },
        movePhase: Math.random() * Math.PI * 2
    };

    if (STATE.subMode === 'moving') {
        target.velocity = {
            x: (Math.random() - 0.5) * 400,
            y: 0
        };
    }

    STATE.targets.push(target);
}

function updateHUD() {
    ui.score.innerText = STATE.score;
    let mins = Math.floor(STATE.timeLeft / 60);
    let secs = Math.floor(STATE.timeLeft % 60);
    ui.time.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showGameOver() {
    ui.modal.classList.remove('hidden');
    ui.finalScore.innerText = STATE.score;

    const accuracy = STATE.stats.shots > 0 ? Math.round((STATE.stats.hits / STATE.stats.shots) * 100) : 0;
    ui.finalAcc.innerText = `${accuracy}%`;
    ui.finalHits.innerText = STATE.stats.hits;
    ui.finalMisses.innerText = STATE.stats.shots - STATE.stats.hits;
}

// Loop
function gameLoop(timestamp) {
    if (!STATE.isPlaying) return;

    const dt = (timestamp - STATE.lastTime) / 1000;
    STATE.lastTime = timestamp;

    // Timer
    STATE.timeLeft -= dt;
    if (STATE.timeLeft <= 0) {
        STATE.timeLeft = 0;
        updateHUD();
        stopGame();
        return;
    }
    updateHUD();

    updateTargets(dt, timestamp);
    updateParticles(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

function updateTargets(dt, timestamp) {
    const now = performance.now();

    for (let i = STATE.targets.length - 1; i >= 0; i--) {
        const t = STATE.targets[i];

        // Moving Logic
        if (STATE.subMode === 'moving') {
            t.x += t.velocity.x * dt;
            if (t.x < 100 || t.x > STATE.canvas.width - 100) {
                t.velocity.x *= -1;
            }
        }

        // Weakpoint Logic
        if (STATE.subMode === 'random-weakpoint') {
            const speed = 3;
            t.redDotOffset.x += Math.sin(now * 0.005) * speed * dt * 20;
            t.redDotOffset.y += Math.cos(now * 0.003) * speed * dt * 20;
        }

        // Auto Despawn Check
        if (STATE.mainMode === 'auto-despawn') {
            if (now - t.spawnTime > CONFIG.autoDespawnTime) {
                STATE.targets.splice(i, 1);
            }
        }
    }

    if (STATE.targets.length === 0 && STATE.isPlaying) {
        spawnTarget();
    }
}

function updateParticles(dt) {
    for (let i = STATE.particles.length - 1; i >= 0; i--) {
        const p = STATE.particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) {
            STATE.particles.splice(i, 1);
        }
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
        STATE.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 300,
            vy: (Math.random() - 0.5) * 300,
            life: 0.5,
            color: color
        });
    }
}

function handleInput(e) {
    if (!STATE.isPlaying) return;

    STATE.stats.shots++;

    const rect = STATE.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let hit = false;

    for (let i = STATE.targets.length - 1; i >= 0; i--) {
        const t = STATE.targets[i];

        const redDotWorldX = t.x + t.redDotOffset.x;
        const redDotWorldY = t.y + t.redDotOffset.y;

        // Precision requirement based on mode
        // Headshot/Weakpoint: strict (15px), others: specific part but maybe larger? 
        // User requested fix for TC008: "Hit detection outside 12px incorrectly registers".
        // Let's set strict radius for weakpoint modes.
        let hitRadius = 30;
        if (STATE.subMode === 'headshot' || STATE.subMode === 'random-weakpoint') {
            hitRadius = 15; // Strict
        }

        const dist = Math.hypot(clickX - redDotWorldX, clickY - redDotWorldY);

        if (dist < hitRadius) {
            hit = true;
            onTargetHit(i, clickX, clickY);
            break;
        }
    }

    if (!hit) {
        AUDIO.playMiss();
    }
}

function onTargetHit(targetIndex, hitX, hitY) {
    STATE.stats.hits++;
    STATE.score += 100;

    AUDIO.playHit();
    createExplosion(hitX, hitY, '#ff4757');

    // Remove target immediately in both modes for immediate feedback?
    // "Hit to Remove" -> Target Gone. "Auto Despawn" -> If hit, it is also removed (success).
    STATE.targets.splice(targetIndex, 1);

    spawnTarget();
}

// Drawing
function draw() {
    STATE.ctx.clearRect(0, 0, STATE.canvas.width, STATE.canvas.height);

    // Draw Targets
    STATE.targets.forEach(t => {
        const w = CONFIG.targetBaseSize;
        const h = w;

        if (STATE.targetImage.complete) {
            STATE.ctx.drawImage(STATE.targetImage, t.x - w / 2, t.y - h / 2, w, h);
        } else {
            STATE.ctx.fillStyle = '#111';
            STATE.ctx.beginPath();
            STATE.ctx.arc(t.x, t.y, 50, 0, Math.PI * 2);
            STATE.ctx.fill();
        }

        const dotX = t.x + t.redDotOffset.x;
        const dotY = t.y + t.redDotOffset.y;

        STATE.ctx.fillStyle = '#ff4757';
        STATE.ctx.shadowColor = '#ff4757';
        STATE.ctx.shadowBlur = 15;
        STATE.ctx.beginPath();
        STATE.ctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
        STATE.ctx.fill();
        STATE.ctx.shadowBlur = 0;

        STATE.ctx.strokeStyle = '#fff';
        STATE.ctx.lineWidth = 2;
        STATE.ctx.beginPath();
        STATE.ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
        STATE.ctx.stroke();
    });

    // Draw Particles
    STATE.particles.forEach(p => {
        STATE.ctx.fillStyle = p.color;
        STATE.ctx.globalAlpha = p.life * 2; // Fade out
        STATE.ctx.beginPath();
        STATE.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        STATE.ctx.fill();
        STATE.ctx.globalAlpha = 1;
    });
}

// Helper
// Sound effects etc.
