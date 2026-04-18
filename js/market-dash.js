const GRAVITY = 0.8;
const JUMP_FORCE = -18;
const INITIAL_SPEED = 6;
const TARGETS_PER_LEVEL = 5;
const SPAWN_DIST = 400;
const PLAYER_W = 64;
const PLAYER_H = 48;
const PLAYER_X = 100;

const MARKET_TERMS = {
    STOCKS:              { term: 'Stock',             category: 'asset', definition: 'A share entitling the holder to a fraction of ownership in a corporation.' },
    DIVIDENDS:           { term: 'Dividend',          category: 'asset', definition: 'A sum paid regularly by a company to its shareholders out of its profits.' },
    COMPOUND_INTEREST:   { term: 'Compound Interest', category: 'asset', definition: 'Interest calculated on the principal and also on the accumulated interest of previous periods.' },
    ETFS:                { term: 'ETF',               category: 'asset', definition: 'Exchange-Traded Funds: baskets of securities that trade on an exchange like individual stocks.' },
    BONDS:               { term: 'Bond',              category: 'asset', definition: 'A fixed income instrument representing a loan made by an investor to a borrower.' },
    LIQUIDITY:           { term: 'Liquidity',         category: 'asset', definition: 'The ease with which an asset can be converted to cash without affecting its market price.' },
    DIVERSIFICATION:     { term: 'Diversification',   category: 'asset', definition: 'Mixing a wide variety of investments within a portfolio to limit exposure to any single asset.' },
    MARKET_CAP:          { term: 'Market Cap',        category: 'asset', definition: "Total market value of a company's outstanding shares, calculated by shares × current price." },
    DEBT_TRAP:           { term: 'Debt Trap',         category: 'risk',  definition: 'Forced to take new loans to pay off existing debt — a dangerous cycle of borrowing.' },
    BEAR_PITFALL:        { term: 'Bear Market',       category: 'risk',  definition: 'A market condition where prices fall 20% or more from recent highs.' },
    INFLATION:           { term: 'Inflation',         category: 'risk',  definition: 'Rising price levels that erode purchasing power over time.' },
    VOLATILITY:          { term: 'Volatility',        category: 'risk',  definition: 'Rapid, unpredictable swings in asset prices — a measure of market uncertainty.' },
    SPECULATION:         { term: 'Speculation',       category: 'risk',  definition: 'Risky financial bets on price movements hoping for significant gain despite high loss potential.' },
    RECESSION:           { term: 'Recession',         category: 'risk',  definition: 'Two consecutive quarters of negative GDP growth — a widespread economic downturn.' },
    OPPORTUNITY_COST:    { term: 'Opportunity Cost',  category: 'risk',  definition: 'The value of the best alternative you give up when making a financial choice.' },
    FEAR_OF_MISSING_OUT: { term: 'FOMO',              category: 'risk',  definition: "Fear Of Missing Out: emotional pressure to invest due to others' gains, often causing poor timing." },
};
const TERM_KEYS = Object.keys(MARKET_TERMS);

class MarketDashGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.rafId = null;
        this.isPlaying = false;
        this.activeTerm = null;
        this.isGameOverPending = false;

        this.onHUDUpdate = null;
        this.onTermShow = null;
        this.onTermHide = null;
        this.onGameOver = null;

        this._initState();
    }

    _gy() { return this.canvas.height * 0.75; }

    _initState() {
        const gy = this._gy();
        this.player = { y: gy + 24, vy: 0, isJumping: false, frame: 0 };
        this.gs = { score: 0, level: 1, zone: 'Bull Run', distance: 0, speed: INITIAL_SPEED, targetsCollected: 0 };
        this.portfolio = { balance: 1000, assets: [], risks: [] };
        this.items = [];
        this.lastItemDist = 0;
    }

    jump() {
        if (!this.player.isJumping && this.isPlaying && !this.activeTerm) {
            this.player.vy = JUMP_FORCE;
            this.player.isJumping = true;
        }
    }

    _spawnItem() {
        const gy = this._gy();
        const key = TERM_KEYS[Math.floor(Math.random() * TERM_KEYS.length)];
        const termData = MARKET_TERMS[key];
        const isRisk = termData.category === 'risk';
        this.items.push({
            key, termData,
            type: isRisk ? 'obstacle' : 'collectible',
            x: this.canvas.width + 100,
            y: isRisk ? gy + 20 : gy - 200 + Math.random() * 120,
            width: 40, height: 40,
            collected: false,
        });
        this.lastItemDist = this.gs.distance;
    }

    _handleInteraction(item) {
        const { gs, portfolio } = this;
        if (item.type === 'collectible') {
            portfolio.balance += 50 * gs.level;
            if (!portfolio.assets.includes(item.termData.term)) portfolio.assets.push(item.termData.term);
            gs.score += 5;
            gs.targetsCollected++;
            if (gs.targetsCollected >= TARGETS_PER_LEVEL) {
                gs.targetsCollected = 0;
                gs.level++;
                gs.speed += 0.5;
                gs.zone = gs.level % 2 === 0 ? 'Bear Scramble' : 'Bull Run';
                this.isPlaying = false;
                this.isGameOverPending = false;
                this.activeTerm = item.key;
                if (this.onTermShow) this.onTermShow(item.key, false);
            }
        } else {
            portfolio.balance -= 100 * gs.level;
            if (!portfolio.risks.includes(item.termData.term)) portfolio.risks.push(item.termData.term);
            gs.score = Math.max(0, gs.score - 10);
            if (portfolio.balance <= 0) {
                portfolio.balance = 0;
                this.isPlaying = false;
                this.isGameOverPending = true;
                this.activeTerm = item.key;
                if (this.onTermShow) this.onTermShow(item.key, true);
            }
        }
        if (this.onHUDUpdate) this.onHUDUpdate(portfolio, gs);
    }

    resumeFromTerm() {
        if (this.onTermHide) this.onTermHide();
        if (this.isGameOverPending) {
            this.activeTerm = null;
            if (this.onGameOver) this.onGameOver(this.gs.score, this.portfolio.balance);
        } else {
            this.activeTerm = null;
            this.isPlaying = true;
        }
    }

    _update() {
        if (!this.isPlaying) return;
        const gy = this._gy();
        const { gs, player } = this;

        player.vy += GRAVITY;
        player.y += player.vy;
        if (player.y > gy + 24) {
            player.y = gy + 24;
            player.vy = 0;
            player.isJumping = false;
        }

        player.frame = (player.frame + 0.15) % 4;
        gs.distance += gs.speed;
        if (gs.distance - this.lastItemDist > SPAWN_DIST) this._spawnItem();

        this.items = this.items.filter(item => {
            item.x -= gs.speed;
            if (!item.collected &&
                PLAYER_X < item.x + item.width &&
                PLAYER_X + PLAYER_W > item.x &&
                player.y < item.y + item.height &&
                player.y + PLAYER_H > item.y) {
                item.collected = true;
                this._handleInteraction(item);
            }
            return item.x > -100;
        });
    }

    _draw() {
        const { ctx, canvas, gs, player } = this;
        const W = canvas.width, H = canvas.height;
        const gy = this._gy();
        const isBull = gs.zone === 'Bull Run';

        ctx.clearRect(0, 0, W, H);

        // scrolling grid
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        const off = -(gs.distance % 40);
        for (let x = off; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        // floor
        const floorY = gy + 72;
        ctx.fillStyle = isBull ? '#003300' : '#1a1a1a';
        ctx.fillRect(0, floorY, W, H - floorY);
        ctx.fillStyle = '#32cd32';
        ctx.fillRect(0, floorY, W, 4);

        // progress dots
        const dotSpacing = 18;
        const dotsStartX = W / 2 - (TARGETS_PER_LEVEL * dotSpacing) / 2;
        for (let i = 0; i < TARGETS_PER_LEVEL; i++) {
            const filled = i < gs.targetsCollected;
            ctx.fillStyle = filled ? '#fbbf24' : 'transparent';
            ctx.strokeStyle = filled ? '#fbbf24' : '#444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(dotsStartX + i * dotSpacing, 14, 10, 10);
            if (filled) ctx.fill(); else ctx.stroke();
        }

        // zone label
        const zoneColor = isBull ? '#32cd32' : '#818cf8';
        ctx.fillStyle = zoneColor;
        ctx.font = '11px monospace';
        ctx.fillText((isBull ? '▲ ' : '▼ ') + gs.zone.toUpperCase(), 12, 24);

        for (const item of this.items) {
            if (!item.collected) this._drawItem(item);
        }

        this._drawPlayer(player.y, player.frame, player.isJumping);
    }

    _r(x, y, w, h, c) {
        this.ctx.fillStyle = c;
        this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    }

    _drawPlayer(py, frame, isJumping) {
        const r = (x, y, w, h, c) => this._r(x, y, w, h, c);
        const px = PLAYER_X;
        // body
        r(px + 4,  py + 12, 40, 24, '#8B4513');
        r(px + 8,  py + 32, 32,  4, '#5D2E0C');
        // head
        r(px + 40, py + 4,  16, 16, '#8B4513');
        r(px + 48, py + 12, 12, 12, '#8B4513');
        // eye
        r(px + 56, py + 16,  4,  4, '#000');
        // horns
        r(px + 44, py - 4,   4,  8, '#D2B48C');
        r(px + 52, py - 4,   4,  8, '#D2B48C');
        // tail
        r(px - 4,  py + 16,  8,  4, '#5D2E0C');
        // legs
        if (isJumping) {
            r(px + 8,  py + 36, 8, 8, '#8B4513');
            r(px + 32, py + 36, 8, 8, '#8B4513');
        } else {
            const s = Math.floor(frame) % 2;
            const l1 = s === 0 ? 36 : 40;
            const l2 = s === 1 ? 36 : 40;
            r(px + 8,  py + l1, 8, 12, '#8B4513');
            r(px + 16, py + l2, 8, 12, '#8B4513');
            r(px + 32, py + l1, 8, 12, '#8B4513');
            r(px + 40, py + l2, 8, 12, '#8B4513');
        }
    }

    _drawItem(item) {
        const { ctx } = this;
        const { x, y, type } = item;
        if (type === 'collectible') {
            ctx.fillStyle = '#ffff00'; ctx.fillRect(x + 8, y + 8, 24, 24);
            ctx.fillStyle = '#ffd700'; ctx.fillRect(x + 12, y + 12, 16, 16);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('$', x + 20, y + 28);
            ctx.textAlign = 'left';
        } else {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.moveTo(x, y + 40);
            ctx.lineTo(x + 20, y);
            ctx.lineTo(x + 40, y + 40);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillRect(x + 18, y + 20, 4, 12);
        }
    }

    start() {
        this._initState();
        this.isPlaying = true;
        this.activeTerm = null;
        this.isGameOverPending = false;
        if (this.onHUDUpdate) this.onHUDUpdate(this.portfolio, this.gs);
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

export function initMarketDash() {
    const overlay     = document.getElementById('market-dash-overlay');
    const canvas      = document.getElementById('market-dash-canvas');
    const closeBtn    = document.getElementById('market-dash-close');
    const startScreen = document.getElementById('md-start-screen');
    const startBtn    = document.getElementById('md-start-btn');
    const gameOverScr = document.getElementById('md-gameover-screen');
    const restartBtn  = document.getElementById('md-restart-btn');
    const finalScore  = document.getElementById('md-final-score');
    const termPopup   = document.getElementById('md-term-popup');
    const termType    = document.getElementById('md-term-type');
    const termName    = document.getElementById('md-term-name');
    const termDef     = document.getElementById('md-term-def');
    const termResume  = document.getElementById('md-term-resume');
    const hudBalance  = document.getElementById('md-balance');
    const hudScore    = document.getElementById('md-score');
    const hudLevel    = document.getElementById('md-level');

    if (!overlay || !canvas) return;

    let game = null;

    function resizeCanvas() {
        const wrap = canvas.parentElement;
        canvas.width  = wrap.clientWidth;
        canvas.height = wrap.clientHeight;
    }

    function showTerm(key, isGameOver) {
        const td = MARKET_TERMS[key];
        const isRisk = td.category === 'risk';
        const accent = isRisk ? '#ef4444' : '#32cd32';
        termType.textContent = isRisk ? '⚠  RISK DETECTED' : '✦  LEVEL UP!';
        termType.style.color = accent;
        termType.style.borderColor = accent;
        termName.textContent = td.term;
        termDef.textContent  = td.definition;
        termResume.textContent = isGameOver ? 'VIEW SUMMARY →' : 'CONTINUE RUN →';
        termResume.style.color = accent;
        termResume.style.borderColor = accent;
        termPopup.classList.remove('hidden');
    }

    function hideTerm() { termPopup.classList.add('hidden'); }

    function openOverlay() {
        overlay.removeAttribute('inert');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('open');
        resizeCanvas();
        startScreen.classList.remove('hidden');
        gameOverScr.classList.add('hidden');
        hideTerm();
        // hide games menu while playing
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
        hideTerm();
        resizeCanvas();
        if (game) game.stop();

        game = new MarketDashGame(canvas);

        game.onHUDUpdate = (portfolio, gs) => {
            if (hudBalance) hudBalance.textContent = '$' + portfolio.balance.toLocaleString();
            if (hudScore)   hudScore.textContent   = 'Score: ' + gs.score;
            if (hudLevel)   hudLevel.textContent   = 'Lvl ' + gs.level + '  —  ' + gs.zone;
        };
        game.onTermShow = showTerm;
        game.onTermHide = hideTerm;
        game.onGameOver = (score, balance) => {
            gameOverScr.classList.remove('hidden');
            if (finalScore) finalScore.textContent = 'Score: ' + score + '   |   Balance: $' + balance.toLocaleString();
        };

        game.start();
    }

    closeBtn.addEventListener('click', closeOverlay);
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    termResume.addEventListener('click', () => { if (game) game.resumeFromTerm(); });
    canvas.addEventListener('click', () => { if (game && game.isPlaying) game.jump(); });

    window.addEventListener('keydown', (e) => {
        if (!overlay.classList.contains('open')) return;
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (game && game.activeTerm) game.resumeFromTerm();
            else if (game && game.isPlaying) game.jump();
        }
        if (e.key === 'Escape') closeOverlay();
    });

    window.addEventListener('resize', () => {
        if (overlay.classList.contains('open')) resizeCanvas();
    });

    const openCard = document.getElementById('open-market-dash');
    if (openCard) openCard.addEventListener('click', openOverlay);

    document.addEventListener('open-market-dash', openOverlay);
}
