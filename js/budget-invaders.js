const BI_W = 800;
const BI_H = 600;
const PLAYER_W = 40;
const PLAYER_H = 40;
const BULLET_SPEED = 10;
const BASE_SPEED = 1.2;
const BASE_SPAWN = 0.012;
const SHOOT_COOLDOWN = 200;

const NEEDS = [
    'Rent', 'Groceries', 'Electricity', 'Car Loan', 'Health Insurance',
    'Water Bill', 'Gas Bill', 'Phone Bill', 'Internet', 'Dental Visit',
    'Medication', 'Bus Pass', 'Car Insurance', 'Home Insurance', 'Eye Care',
];

const WANTS = [
    'Netflix', 'Designer Shoes', 'Daily Latte', 'Luxury Watch', 'Gaming PC',
    'Vacation', 'Concert Tickets', 'Restaurant Dining', 'Gym Sub', 'New iPhone',
    'Amazon Impulse', 'Designer Bag', 'Streaming Bundle', 'Gaming DLC', 'Takeout',
];

class BudgetInvadersGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.rafId = null;
        this.isPlaying = false;
        this.keys = {};
        this.lastShot = 0;
        this.levelUpTimer = 0;

        this.onHUDUpdate = null;
        this.onGameOver = null;

        this._initState();
    }

    _initState() {
        this.player = { x: BI_W / 2 - PLAYER_W / 2, y: BI_H - 80 };
        this.bullets = [];
        this.invaders = [];
        this.score = 0;
        this.health = 100;
        this.level = 1;
        this.lastShot = 0;
        this.levelUpTimer = 0;
    }

    _spawnInvader() {
        const isWant = Math.random() < 0.55;
        const pool = isWant ? WANTS : NEEDS;
        const term = pool[Math.floor(Math.random() * pool.length)];
        const w = 116, h = 40;
        const speedMult = Math.min(3, 1 + (this.level - 1) * 0.25);
        const speed = BASE_SPEED * speedMult + Math.random() * 0.5;
        this.invaders.push({
            x: Math.random() * (BI_W - w),
            y: -h,
            width: w, height: h,
            term, speed,
            category: isWant ? 'WANT' : 'NEED',
            color: isWant ? '#FF6B6B' : '#8585FF',
            active: true,
        });
    }

    _update() {
        if (!this.isPlaying) return;
        const { keys, player } = this;

        if (keys['ArrowLeft']  && player.x > 0)                      player.x -= 8;
        if (keys['ArrowRight'] && player.x < BI_W - PLAYER_W)        player.x += 8;

        if (keys[' '] || keys['Space']) {
            const now = Date.now();
            if (now - this.lastShot > SHOOT_COOLDOWN) {
                this.bullets.push({
                    x: player.x + PLAYER_W / 2 - 2,
                    y: player.y,
                    width: 4, height: 15,
                    active: true,
                });
                this.lastShot = now;
            }
        }

        const spawnRate = BASE_SPAWN + (this.level - 1) * 0.008;
        if (Math.random() < spawnRate) this._spawnInvader();

        for (const b of this.bullets) {
            b.y -= BULLET_SPEED;
            if (b.y < 0) b.active = false;
        }

        for (const inv of this.invaders) {
            if (!inv.active) continue;
            inv.y += inv.speed;
            if (inv.y > BI_H) {
                inv.active = false;
                if (inv.category === 'WANT') {
                    this._damage(10);
                } else {
                    this.score += 50;
                }
            }
        }

        for (const b of this.bullets) {
            if (!b.active) continue;
            for (const inv of this.invaders) {
                if (!inv.active) continue;
                if (b.x < inv.x + inv.width && b.x + b.width > inv.x &&
                    b.y < inv.y + inv.height && b.y + b.height > inv.y) {
                    inv.active = false;
                    b.active = false;
                    if (inv.category === 'WANT') {
                        this.score += 150;
                    } else {
                        this.score = Math.max(0, this.score - 100);
                        this._damage(15);
                    }
                    break;
                }
            }
        }

        this.bullets  = this.bullets.filter(b => b.active);
        this.invaders = this.invaders.filter(inv => inv.active || inv.y <= BI_H);

        const threshold = this.level * 1000 + (this.level - 1) * 500;
        if (this.score >= threshold) {
            this.level++;
            this.health = Math.min(100, this.health + 15);
            this.levelUpTimer = 100;
        }

        if (this.levelUpTimer > 0) this.levelUpTimer--;

        if (this.onHUDUpdate) this.onHUDUpdate(this.score, this.health, this.level);
    }

    _damage(amt) {
        this.health = Math.max(0, this.health - amt);
        if (this.health <= 0) {
            this.health = 0;
            this.isPlaying = false;
            if (this.onGameOver) this.onGameOver(this.score, this.level);
        }
    }

    _draw() {
        const { ctx } = this;
        const W = BI_W, H = BI_H;

        ctx.clearRect(0, 0, W, H);

        // grid
        ctx.strokeStyle = 'rgba(42,36,44,0.4)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

        // player — purple triangle ship
        const p = this.player;
        ctx.fillStyle = '#6626D9';
        ctx.beginPath();
        ctx.moveTo(p.x + PLAYER_W / 2, p.y);
        ctx.lineTo(p.x, p.y + PLAYER_H);
        ctx.lineTo(p.x + PLAYER_W, p.y + PLAYER_H);
        ctx.closePath();
        ctx.fill();
        // thruster flame
        ctx.fillStyle = '#8585FF';
        ctx.beginPath();
        ctx.moveTo(p.x + 12, p.y + PLAYER_H);
        ctx.lineTo(p.x + PLAYER_W - 12, p.y + PLAYER_H);
        ctx.lineTo(p.x + PLAYER_W / 2, p.y + PLAYER_H + 12);
        ctx.fill();

        // bullets
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FF6B6B';
        ctx.fillStyle = '#FF6B6B';
        for (const b of this.bullets) ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.shadowBlur = 0;

        // invaders
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const inv of this.invaders) {
            if (!inv.active) continue;
            ctx.fillStyle = 'rgba(20,18,22,0.95)';
            ctx.fillRect(inv.x, inv.y, inv.width, inv.height);
            ctx.strokeStyle = inv.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(inv.x, inv.y, inv.width, inv.height);
            ctx.fillStyle = inv.color;
            ctx.font = 'bold 11px monospace';
            ctx.fillText(inv.term.toUpperCase(), inv.x + inv.width / 2, inv.y + inv.height / 2 - 6);
            ctx.font = '8px monospace';
            ctx.fillText(inv.category, inv.x + inv.width / 2, inv.y + inv.height / 2 + 9);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        // level-up flash
        if (this.levelUpTimer > 0) {
            const alpha = this.levelUpTimer / 100;
            ctx.fillStyle = `rgba(102,38,217,${alpha * 0.25})`;
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = `rgba(133,133,255,${alpha})`;
            ctx.textAlign = 'center';
            ctx.font = `bold 56px monospace`;
            ctx.fillText('LEVEL ' + this.level, W / 2, H / 2);
            ctx.font = `bold 16px monospace`;
            ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
            ctx.fillText('ECONOMY SCALING UP', W / 2, H / 2 + 44);
            ctx.textAlign = 'left';
        }
    }

    keyDown(k) { this.keys[k] = true; }
    keyUp(k)   { this.keys[k] = false; }
    moveLeft(on)  { this.keys['ArrowLeft']  = on; }
    moveRight(on) { this.keys['ArrowRight'] = on; }
    shoot()       { this.keys[' '] = true; setTimeout(() => { this.keys[' '] = false; }, 60); }

    start() {
        this._initState();
        this.isPlaying = true;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        const loop = () => {
            this._update();
            this._draw();
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }

    stop() {
        if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
        this.isPlaying = false;
    }
}

export function initBudgetInvaders() {
    const overlay     = document.getElementById('budget-invaders-overlay');
    const canvas      = document.getElementById('bi-canvas');
    const closeBtn    = document.getElementById('bi-close');
    const startScreen = document.getElementById('bi-start-screen');
    const startBtn    = document.getElementById('bi-start-btn');
    const gameOverScr = document.getElementById('bi-gameover-screen');
    const restartBtn  = document.getElementById('bi-restart-btn');
    const exitBtn     = document.getElementById('bi-exit-btn');
    const finalScore  = document.getElementById('bi-final-score');
    const hudScore    = document.getElementById('bi-score');
    const hudLevel    = document.getElementById('bi-level');
    const hudHealthFill = document.getElementById('bi-health-fill');
    const hudHealthPct  = document.getElementById('bi-health-pct');
    const btnLeft     = document.getElementById('bi-btn-left');
    const btnRight    = document.getElementById('bi-btn-right');
    const btnFire     = document.getElementById('bi-btn-fire');

    if (!overlay || !canvas) return;

    let game = null;

    function updateHUD(score, health, level) {
        if (hudScore) hudScore.textContent = score.toLocaleString();
        if (hudLevel) hudLevel.textContent = 'LVL ' + level;
        if (hudHealthFill) {
            hudHealthFill.style.width = health + '%';
            hudHealthFill.style.background = health > 30
                ? 'linear-gradient(90deg,#6626D9,#8585FF)'
                : '#FF6B6B';
        }
        if (hudHealthPct) {
            hudHealthPct.textContent = health + '%';
            hudHealthPct.style.color = health > 30 ? '#8585FF' : '#FF6B6B';
        }
    }

    function openOverlay() {
        overlay.removeAttribute('inert');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('open');
        startScreen.classList.remove('hidden');
        gameOverScr.classList.add('hidden');
        const gamesOverlay = document.getElementById('games-overlay');
        if (gamesOverlay) {
            gamesOverlay.classList.remove('open');
            gamesOverlay.setAttribute('aria-hidden', 'true');
            gamesOverlay.setAttribute('inert', '');
        }
    }

    function closeOverlay() {
        if (game) { game.stop(); game = null; }
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('inert', '');
        document.dispatchEvent(new CustomEvent('open-games-overlay'));
    }

    function startGame() {
        startScreen.classList.add('hidden');
        gameOverScr.classList.add('hidden');
        if (game) game.stop();
        game = new BudgetInvadersGame(canvas);
        game.onHUDUpdate = updateHUD;
        game.onGameOver = (score, level) => {
            gameOverScr.classList.remove('hidden');
            if (finalScore) finalScore.textContent = '$' + score.toLocaleString() + '  —  Level ' + level;
        };
        game.start();
    }

    closeBtn.addEventListener('click', closeOverlay);
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    if (exitBtn) exitBtn.addEventListener('click', closeOverlay);

    window.addEventListener('keydown', (e) => {
        if (!overlay.classList.contains('open') || !game) return;
        if (e.key === 'Escape') { closeOverlay(); return; }
        game.keyDown(e.key);
        if (e.key === ' ') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
        if (!overlay.classList.contains('open') || !game) return;
        game.keyUp(e.key);
    });

    if (btnLeft) {
        btnLeft.addEventListener('pointerdown', () => game && game.moveLeft(true));
        btnLeft.addEventListener('pointerup',    () => game && game.moveLeft(false));
        btnLeft.addEventListener('pointerleave', () => game && game.moveLeft(false));
    }
    if (btnRight) {
        btnRight.addEventListener('pointerdown', () => game && game.moveRight(true));
        btnRight.addEventListener('pointerup',   () => game && game.moveRight(false));
        btnRight.addEventListener('pointerleave',() => game && game.moveRight(false));
    }
    if (btnFire) btnFire.addEventListener('click', () => game && game.shoot());

    const openCard = document.getElementById('open-budget-invaders');
    if (openCard) openCard.addEventListener('click', openOverlay);
    document.addEventListener('open-budget-invaders', openOverlay);
}
