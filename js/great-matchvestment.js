const FINANCE_TERMS = [
    { id: '1',  term: 'Compound Interest', definition: 'Interest calculated on the principal amount and also on the accumulated interest of previous periods.' },
    { id: '2',  term: 'Asset Allocation',  definition: 'An investment strategy that aims to balance risk and reward by apportioning a portfolio among different categories of assets.' },
    { id: '3',  term: 'Liquidity',         definition: 'The ease with which an asset or security can be converted into ready cash without affecting its market price.' },
    { id: '4',  term: 'Diversification',   definition: 'The process of allocating capital in a way that reduces the exposure to any one particular asset or risk.' },
    { id: '5',  term: 'Inflation',         definition: 'A general increase in prices and fall in the purchasing value of money.' },
    { id: '6',  term: 'Dividend',          definition: "A distribution of a portion of a company's earnings, decided by the board of directors, paid to shareholders." },
    { id: '7',  term: 'Bull Market',       definition: 'A market in which share prices are rising, encouraging buying.' },
    { id: '8',  term: 'Equity',            definition: "The value of an ownership interest in property, including shareholders' equity in a business." },
    { id: '9',  term: 'Fixed Income',      definition: 'A type of investment that pays out a set amount of interest or dividends on a regular schedule.' },
    { id: '10', term: 'Amortization',      definition: 'The action or process of gradually writing off the initial cost of an asset or paying off a debt over time.' },
];

const LABELS = ['A', 'B', 'C', 'D'];

function buildOptions(termIndex) {
    const correct = FINANCE_TERMS[termIndex];
    const distractors = FINANCE_TERMS
        .filter((_, i) => i !== termIndex)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    return [correct, ...distractors].sort(() => Math.random() - 0.5);
}

function buildGardenBackground() {
    const cloudsLayer = document.getElementById('gm-clouds-layer');
    const bladesEl    = document.getElementById('gm-grass-blades');
    const rocksEl     = document.getElementById('gm-rocks');
    const plantsEl    = document.getElementById('gm-plants-row');

    if (cloudsLayer) {
        for (let i = 0; i < 5; i++) {
            const wrap = document.createElement('div');
            wrap.className = 'gm-cloud-wrap';
            const duration = 80 + Math.random() * 60;
            const delay    = -(Math.random() * duration);
            const top      = (Math.random() * 40 + 5);
            const scale    = 0.8 + Math.random() * 0.7;
            wrap.style.cssText = `top:${top}%;animation-duration:${duration}s;animation-delay:${delay}s;`;
            wrap.innerHTML = `<div class="gm-cloud" style="transform:scale(${scale})">
                <div class="gm-cloud-base"></div>
                <div class="gm-cloud-mid"></div>
                <div class="gm-cloud-l"></div>
                <div class="gm-cloud-r"></div>
            </div>`;
            cloudsLayer.appendChild(wrap);
        }
    }

    if (bladesEl) {
        for (let i = 0; i < 40; i++) {
            const b = document.createElement('div');
            b.className = 'gm-blade';
            b.style.marginTop = i % 3 === 0 ? '4px' : '0px';
            bladesEl.appendChild(b);
        }
    }

    if (rocksEl) {
        for (let i = 0; i < 20; i++) {
            const r = document.createElement('div');
            r.className = 'gm-rock';
            r.style.cssText = `top:${Math.random()*90}%;left:${Math.random()*98}%;opacity:${Math.random()*0.4+0.05};`;
            rocksEl.appendChild(r);
        }
    }

    if (plantsEl) {
        const leafColors = ['#66bb6a','#43a047','#81c784','#388e3c'];
        for (let i = 0; i < 15; i++) {
            const sprout = document.createElement('div');
            sprout.className = 'gm-sprout';
            const leaf = leafColors[i % leafColors.length];
            const anim = i % 3 === 0 ? 'gm-plant-bounce' : 'gm-plant-sway';
            const dur  = (2 + i * 0.2).toFixed(1);
            sprout.style.animation = `${anim} ${dur}s ease-in-out infinite`;
            sprout.innerHTML = `
                <div class="gm-sprout-flower"></div>
                <div class="gm-sprout-leaf-l" style="background:${leaf}"></div>
                <div class="gm-sprout-leaf-r" style="background:${leaf}"></div>
                <div class="gm-sprout-stem"></div>`;
            plantsEl.appendChild(sprout);
        }
    }
}

export function initGreatMatchvestment() {
    buildGardenBackground();
    const overlay        = document.getElementById('great-matchvestment-overlay');
    const closeBtn       = document.getElementById('gm-close');
    const startScreen    = document.getElementById('gm-start-screen');
    const playScreen     = document.getElementById('gm-play-screen');
    const finishedScreen = document.getElementById('gm-finished-screen');
    const startBtn       = document.getElementById('gm-start-btn');
    const nextBtn        = document.getElementById('gm-next-btn');
    const replayBtn      = document.getElementById('gm-replay-btn');
    const homeBtn        = document.getElementById('gm-home-btn');
    const termEl         = document.getElementById('gm-term');
    const optionsEl      = document.getElementById('gm-options');
    const footerHint     = document.getElementById('gm-footer-hint');
    const scoreEl        = document.getElementById('gm-score');
    const progressEl     = document.getElementById('gm-progress');
    const healthFill     = document.getElementById('gm-health-fill');
    const healthPct      = document.getElementById('gm-health-pct');
    const finishScore    = document.getElementById('gm-finish-score');
    const finishBar      = document.getElementById('gm-finish-bar');

    if (!overlay) return;

    let currentIndex = 0;
    let score = 0;
    let health = 100;
    let answered = false;
    let currentOptions = [];

    function updateHUD() {
        if (scoreEl)     scoreEl.textContent     = score + ' / ' + FINANCE_TERMS.length;
        if (progressEl)  progressEl.textContent  = (currentIndex + 1) + ' / ' + FINANCE_TERMS.length;
        if (healthPct)   healthPct.textContent   = health + '%';
        if (healthFill) {
            healthFill.style.width = health + '%';
            healthFill.style.background =
                health > 50 ? '#22c55e' : health > 25 ? '#eab308' : '#ef4444';
        }
    }

    function showQuestion() {
        answered = false;
        currentOptions = buildOptions(currentIndex);
        const term = FINANCE_TERMS[currentIndex];

        if (termEl) termEl.textContent = term.term;
        if (nextBtn) nextBtn.classList.add('hidden');
        if (footerHint) footerHint.classList.remove('hidden');

        optionsEl.innerHTML = '';
        currentOptions.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'gm-option';
            btn.innerHTML = `<span class="gm-option-label">${LABELS[i]}</span><span class="gm-option-text">${opt.definition}</span>`;
            btn.addEventListener('click', () => handleSelect(opt, btn));
            optionsEl.appendChild(btn);
        });

        updateHUD();
    }

    function handleSelect(selectedTerm, selectedBtn) {
        if (answered) return;
        answered = true;

        const correct = FINANCE_TERMS[currentIndex];
        const isCorrect = selectedTerm.id === correct.id;

        if (isCorrect) {
            score++;
            health = Math.min(100, health + 10);
            selectedBtn.classList.add('gm-correct');
        } else {
            health = Math.max(0, health - 25);
            selectedBtn.classList.add('gm-incorrect');
            optionsEl.querySelectorAll('.gm-option').forEach((btn, i) => {
                if (currentOptions[i].id === correct.id) btn.classList.add('gm-correct');
                else if (btn !== selectedBtn) btn.classList.add('gm-missed');
            });
        }

        optionsEl.querySelectorAll('.gm-option').forEach(btn => btn.disabled = true);
        updateHUD();
        if (nextBtn) nextBtn.classList.remove('hidden');
        if (footerHint) footerHint.classList.add('hidden');
    }

    function showScreen(name) {
        for (const el of [startScreen, playScreen, finishedScreen]) el.classList.add('hidden');
        const map = { start: startScreen, play: playScreen, finished: finishedScreen };
        map[name]?.classList.remove('hidden');
    }

    function startGame() {
        currentIndex = 0;
        score = 0;
        health = 100;
        showScreen('play');
        showQuestion();
    }

    function openOverlay() {
        overlay.removeAttribute('inert');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('open');
        showScreen('start');
        const gamesOverlay = document.getElementById('games-overlay');
        if (gamesOverlay) {
            gamesOverlay.classList.remove('open');
            gamesOverlay.setAttribute('aria-hidden', 'true');
            gamesOverlay.setAttribute('inert', '');
        }
    }

    function closeOverlay() {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('inert', '');
        document.dispatchEvent(new CustomEvent('open-games-overlay'));
    }

    closeBtn.addEventListener('click', closeOverlay);
    startBtn.addEventListener('click', startGame);
    replayBtn.addEventListener('click', startGame);
    homeBtn.addEventListener('click', () => showScreen('start'));

    nextBtn?.addEventListener('click', () => {
        const next = currentIndex + 1;
        if (next < FINANCE_TERMS.length) {
            currentIndex = next;
            showQuestion();
        } else {
            showScreen('finished');
            if (finishScore) finishScore.textContent = 'YOU HARVESTED ' + score + ' OUT OF ' + FINANCE_TERMS.length + ' PLANTS!';
            if (finishBar)   finishBar.style.width = (score / FINANCE_TERMS.length * 100) + '%';
        }
    });

    window.addEventListener('keydown', (e) => {
        if (!overlay.classList.contains('open')) return;
        if (e.key === 'Escape') closeOverlay();
        if (!answered && e.key >= '1' && e.key <= '4') {
            const idx = parseInt(e.key) - 1;
            const btns = optionsEl.querySelectorAll('.gm-option');
            if (btns[idx]) btns[idx].click();
        }
    });

    const openCard = document.getElementById('open-great-matchvestment');
    if (openCard) openCard.addEventListener('click', openOverlay);
    document.addEventListener('open-great-matchvestment', openOverlay);
}
