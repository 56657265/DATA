class MemoryGame {
    constructor() {
        this.cards = [];
        this.deck = [];
        this.players = [];
        this.currentPlayerIndex = 0;
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.specialCards = { shuffle: 0, bomb: 0 };
        this.totalCards = 42; // Default
        this.mode = 'solo'; // 'solo' or 'multi'
        this.isProcessing = false;

        this.activeTimers = []; // Track active timeouts

        this.ui = {
            room: document.getElementById('room'),
            grid: document.getElementById('card-grid'),
            scoreBoard: document.getElementById('score-board'),
            turnIndicator: document.getElementById('current-turn-label'),
            loading: document.getElementById('loading-screen'),
            menu: document.getElementById('menu-overlay'),
            gameOver: document.getElementById('game-over-screen'),
            shuffleVfx: document.getElementById('shuffle-overlay'),
            bombVfx: document.getElementById('bomb-overlay')
        };

        this.emojis = [
            '🍎', '🍊', '🍇', '🍉', '🍓', '🍒', '🍍', '🥝', '🥑', '🍆',
            '🥔', '🥕', '🌽', '🌶️', '🥒', '🥦', '🍄', '🥜', '🌰', '🍞',
            '🥐', '🥖', '🥨', '🥞', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔',
            '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥚', '🍳', '🥘', '🍲',
            '🥣', '🥗', '🍿', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜',
            '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🍡', '🥟', '🥠', '🥡'
        ];

        this.init();
    }

    setGameTimeout(callback, delay) {
        const id = setTimeout(() => {
            this.activeTimers = this.activeTimers.filter(t => t !== id);
            callback();
        }, delay);
        this.activeTimers.push(id);
        return id;
    }

    clearAllTimers() {
        this.activeTimers.forEach(id => clearTimeout(id));
        this.activeTimers = [];
    }

    init() {
        // Event Listeners
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.mode = e.target.dataset.mode;
                const playerCountGroup = document.getElementById('player-count-group');
                if (this.mode === 'multi') {
                    playerCountGroup.classList.remove('hidden');
                } else {
                    playerCountGroup.classList.add('hidden');
                }
            });
        });

        document.querySelectorAll('.player-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        const slider = document.getElementById('card-count-slider');
        const countDisplay = document.getElementById('card-count-display');
        slider.addEventListener('input', (e) => {
            countDisplay.innerText = e.target.value;
        });

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.resetGame();
            this.ui.gameOver.classList.remove('active');
            this.ui.gameOver.classList.add('hidden');
            this.ui.menu.classList.add('active');
            this.ui.menu.classList.remove('hidden');
        });
        document.getElementById('menu-btn').addEventListener('click', () => {
            // Confirm? Nah just go back.
            this.ui.menu.classList.add('active');
            this.ui.menu.classList.remove('hidden');
            this.resetGame();
        });

        // Hide loading after a brief moment
        this.setGameTimeout(() => {
            this.ui.loading.classList.add('hidden');
        }, 1000);
    }

    resetGame() {
        this.clearAllTimers();
        this.isProcessing = false;
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.players.forEach(p => p.score = 0); // Optional, usually re-init in startGame

        this.ui.room.style.transform = `rotateZ(0deg)`; // Reset rotation
        this.ui.grid.innerHTML = '';
        this.ui.scoreBoard.innerHTML = '';

        // Reset VFX
        this.ui.shuffleVfx.classList.add('hidden');
        this.ui.bombVfx.classList.add('hidden');

        document.getElementById('ui-layer').classList.add('hidden');
    }

    startGame() {
        this.resetGame();
        // Config
        this.totalCards = parseInt(document.getElementById('card-count-slider').value);
        this.mode = document.querySelector('.mode-btn.active').dataset.mode;

        let playerCount = 1;
        if (this.mode === 'multi') {
            playerCount = parseInt(document.querySelector('.player-btn.active').dataset.count);
        }

        // Setup Players
        this.players = [];
        for (let i = 0; i < playerCount; i++) {
            this.players.push({
                id: i + 1,
                name: this.mode === 'solo' ? 'Player' : `Player ${i + 1}`,
                score: 0,
                color: this.getPlayerColor(i)
            });
        }
        this.currentPlayerIndex = 0;

        // Setup Deck
        this.generateDeck();

        // UI Setup
        this.ui.menu.classList.remove('active');
        this.ui.menu.classList.add('hidden'); // Ensure hidden
        document.getElementById('ui-layer').classList.remove('hidden');
        this.updateScoreBoard();
        this.updateTurnIndicator();
        this.renderGrid();

        // Camera Init
        this.updatePerspective();
    }

    getPlayerColor(index) {
        const colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71'];
        return colors[index % colors.length];
    }

    generateDeck() {
        // Logic: 2 Special Cards always.
        // Remaining: Total - 2.
        // Pairs: (Total - 2) / 2.

        // Define Specials
        let shuffleCount = 0;
        let bombCount = 0;

        if (this.mode === 'solo') {
            shuffleCount = 2;
            bombCount = 0;
        } else {
            shuffleCount = 1;
            bombCount = 1;
        }

        const numPairs = (this.totalCards - (shuffleCount + bombCount)) / 2;

        let deck = [];

        // Add Pairs
        for (let i = 0; i < numPairs; i++) {
            const emoji = this.emojis[i % this.emojis.length];
            deck.push({ type: 'normal', content: emoji, id: `pair-${i}-a` });
            deck.push({ type: 'normal', content: emoji, id: `pair-${i}-b` });
        }

        // Add Specials
        for (let i = 0; i < shuffleCount; i++) deck.push({ type: 'shuffle', content: '🔀', id: `shuffle-${i}` });
        for (let i = 0; i < bombCount; i++) deck.push({ type: 'bomb', content: '💣', id: `bomb-${i}` });

        this.deck = this.shuffleArray(deck);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    renderGrid() {
        this.ui.grid.innerHTML = '';
        this.deck.forEach((cardData, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.dataset.index = index;
            cardEl.dataset.type = cardData.type;

            // Inner HTML for 3D flip
            cardEl.innerHTML = `
                <div class="card-face card-front">${cardData.content}</div>
                <div class="card-face card-back"></div>
            `;

            cardEl.addEventListener('click', () => this.handleCardClick(index));
            this.ui.grid.appendChild(cardEl);
        });
    }

    handleCardClick(index) {
        if (this.isProcessing) return;
        if (this.flippedCards.length >= 2) return; // Extra safety
        if (this.flippedCards.includes(index)) return; // Already flipped this turn
        if (this.deck[index].matched) return; // Already matched/removed

        const cardEl = this.ui.grid.children[index];
        cardEl.classList.add('flipped');
        this.flippedCards.push(index);

        if (this.flippedCards.length === 2) {
            this.isProcessing = true;
            this.checkMatch();
        }
    }

    checkMatch() {
        const [idx1, idx2] = this.flippedCards;
        const card1 = this.deck[idx1];
        const card2 = this.deck[idx2];
        const el1 = this.ui.grid.children[idx1];
        const el2 = this.ui.grid.children[idx2];

        // 1. Check for Special Cards (Shuffle or Bomb)
        const isSpecial1 = (card1.type === 'shuffle' || card1.type === 'bomb');
        const isSpecial2 = (card2.type === 'shuffle' || card2.type === 'bomb');

        if (isSpecial1 || isSpecial2) {
            this.isProcessing = true;
            this.setGameTimeout(() => {
                // "특수 카드들은 절대적으로 일회용이다" - Mark as matched and remove from field
                if (isSpecial1) {
                    el1.classList.add('removed');
                    this.deck[idx1].matched = true;
                } else {
                    // Normal card flipped with a special card returns face down
                    el1.classList.remove('flipped');
                }

                if (isSpecial2) {
                    el2.classList.add('removed');
                    this.deck[idx2].matched = true;
                } else {
                    el2.classList.remove('flipped');
                }

                this.flippedCards = [];

                // Trigger the appropriate effect
                // If both are special, shuffle takes visual precedence
                if (card1.type === 'shuffle' || card2.type === 'shuffle') {
                    this.triggerShuffleEffect();
                } else if (card1.type === 'bomb' || card2.type === 'bomb') {
                    this.triggerBombEffect();
                    this.setGameTimeout(() => this.nextTurn(), 1500);
                }
            }, 800);
            return;
        }

        // 2. Normal Card Match
        if (card1.content === card2.content) {
            this.setGameTimeout(() => {
                el1.classList.add('matched');
                el2.classList.add('matched');

                // Mark in data
                this.deck[idx1].matched = true;
                this.deck[idx2].matched = true;

                // Add Score (1 card = 1 point, so a pair is 2 points)
                this.players[this.currentPlayerIndex].score += 2;
                this.updateScoreBoard();

                this.flippedCards = [];
                this.isProcessing = false;

                this.checkWinCondition();
                // Match allows the player to continue their turn (Rule implied: goal is to find pairs)
            }, 600);
        } else {
            // 3. Mismatch
            this.setGameTimeout(() => {
                el1.classList.remove('flipped');
                el2.classList.remove('flipped');
                this.flippedCards = [];
                this.nextTurn();
            }, 1000);
        }
    }

    triggerBombEffect() {
        this.ui.bombVfx.classList.remove('hidden');
        this.setGameTimeout(() => {
            this.ui.bombVfx.classList.add('hidden');
        }, 2000);
    }

    triggerShuffleEffect() {
        this.ui.shuffleVfx.classList.remove('hidden');
        this.setGameTimeout(() => {
            this.ui.shuffleVfx.classList.add('hidden');
            this.animateShuffle();
        }, 1500);
    }

    animateShuffle() {
        const unmatchedIndices = [];
        this.deck.forEach((c, i) => {
            if (!c.matched) unmatchedIndices.push(i);
        });

        if (unmatchedIndices.length < 2) {
            this.nextTurn();
            return;
        }

        const gridRect = this.ui.grid.getBoundingClientRect();
        const centerX = gridRect.width / 2;
        const centerY = gridRect.height / 2;
        const cardElements = unmatchedIndices.map(i => this.ui.grid.children[i]);

        // 1단계: 카드 집결 (Gather Phase)
        cardElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            // Calculate center of card relative to grid
            const cardCenterX = (rect.left - gridRect.left) + rect.width / 2;
            const cardCenterY = (rect.top - gridRect.top) + rect.height / 2;
            const deltaX = centerX - cardCenterX;
            const deltaY = centerY - cardCenterY;

            // Set CSS variables for the spin animation to stay at center
            el.style.setProperty('--gather-x', `${deltaX}px`);
            el.style.setProperty('--gather-y', `${deltaY}px`);

            el.style.transition = 'transform 0.6s cubic-bezier(0.5, 0, 0.2, 1)';
            el.style.transform = `translate(${deltaX}px, ${deltaY}px) rotateY(180deg)`;
            el.classList.add('shuffling');
        });

        // 2단계: 셔플 연출 (Shuffle Phase) - 700ms 대기 후 시작
        this.setGameTimeout(() => {
            cardElements.forEach((el, i) => {
                const isEven = i % 2 === 0;
                const animName = isEven ? 'spinClockwise' : 'spinCounterClockwise';
                const duration = 0.4 + Math.random() * 0.4; // 0.4s ~ 0.8s 사이의 랜덤 속도
                const delay = Math.random() * 0.2; // 0.2s 이내의 랜덤 딜레이

                el.style.animation = `${animName} ${duration}s ease-in-out ${delay}s infinite`;
            });

            // 내부 데이터 셔플
            const tempDeck = unmatchedIndices.map(i => this.deck[i]);
            const shuffled = this.shuffleArray([...tempDeck]);
            unmatchedIndices.forEach((originalIndex, i) => {
                this.deck[originalIndex] = shuffled[i];
            });
        }, 700);

        // 3단계: 재배치 (Spread Phase) - 셔플 충분히 연출 후 시작 (1700ms)
        this.setGameTimeout(() => {
            // 내용 업데이트 및 애니메이션 제거
            unmatchedIndices.forEach((index) => {
                const el = this.ui.grid.children[index];
                const data = this.deck[index];
                el.innerHTML = `
                    <div class="card-face card-front">${data.content}</div>
                    <div class="card-face card-back"></div>
                `;
                el.dataset.type = data.type;
                el.style.animation = '';
            });

            // 각자의 슬롯으로 이동
            cardElements.forEach(el => {
                el.style.transition = 'transform 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                el.style.transform = `translate(0, 0) rotateY(180deg)`;
            });

            // 마무리
            this.setGameTimeout(() => {
                cardElements.forEach(el => {
                    el.classList.remove('shuffling');
                    el.style.transform = '';
                    el.style.transition = '';
                });
                this.nextTurn();
            }, 800);
        }, 1700);
    }

    // Legacy mapping for safety
    shuffleRemainingCards() { this.animateShuffle(); }

    nextTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.isProcessing = false;
        this.updateTurnIndicator();
        this.updatePerspective();
    }

    updatePerspective() {
        // v3: Camera is FIXED. No rotation.
        this.ui.room.style.transform = `rotateZ(0deg)`;
        const table = document.getElementById('table');
        if (table) table.style.transform = `rotateZ(0deg)`;
        this.ui.grid.style.setProperty('--table-rotation', `0deg`);
    }

    updateScoreBoard() {
        this.ui.scoreBoard.innerHTML = '';
        this.players.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = `player-score ${i === this.currentPlayerIndex ? 'active' : ''}`;
            div.innerText = `${p.name}: ${p.score}`;
            this.ui.scoreBoard.appendChild(div);
        });
    }

    updateTurnIndicator() {
        const p = this.players[this.currentPlayerIndex];
        this.ui.turnIndicator.innerText = `${p.name}의 턴`;
        this.ui.turnIndicator.style.borderColor = p.color;
        this.updateScoreBoard();
    }

    checkWinCondition() {
        // Win if all pairs matched?
        // Or if remaining cards are only specials?
        // Special cards are never "Matched" in the sense of staying face up.
        // So game ends when all Normal cards are matched.

        const normalCards = this.deck.filter(c => c.type === 'normal');
        const matchedCards = normalCards.filter(c => c.matched);

        if (matchedCards.length === normalCards.length) {
            this.endGame();
        }
    }

    endGame() {
        // Calc Winner
        // Sort by score
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
        const winner = sorted[0];
        const isDraw = sorted.length > 1 && sorted[0].score === sorted[1].score;

        this.setGameTimeout(() => {
            this.ui.gameOver.classList.remove('hidden');
            this.ui.gameOver.classList.add('active'); // fade in

            const winnerDiv = document.getElementById('winner-display');
            const scoresDiv = document.getElementById('final-scores');

            if (isDraw) {
                winnerDiv.innerHTML = `<h2>무승부!</h2>`;
            } else {
                winnerDiv.innerHTML = `<h2>🏆 ${winner.name} 승리! 🏆</h2><p>압도적인 기억력입니다!</p>`;
            }

            scoresDiv.innerHTML = sorted.map(p => `<p>${p.name}: ${p.score}장</p>`).join('');
        }, 1000);
    }
}

// Start
window.addEventListener('DOMContentLoaded', () => {
    new MemoryGame();
});
