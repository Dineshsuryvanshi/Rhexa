// ==================== CONFIG ====================
const HEX_SIZE = 35;
const GRID_RADIUS = 2;
const MAX_STACK_HEIGHT = 10;
const COLORS = ['#FF4D4D', '#4CAF50', '#2196F3', '#FFC107', '#9C27B0'];

// ==================== STATE ====================
let grid = new Map();
let hand = [];
let score = 0;
let gameOver = false;
let draggedItem = null;
let newPlacedHex = null;

// ==================== DOM ELEMENTS ====================
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const boardEl = document.getElementById('game-board');
const handEl = document.getElementById('hand-container');
const modalEl = document.getElementById('game-over-modal');
const playAgainBtn = document.getElementById('play-again-btn');
const dragGhost = document.getElementById('drag-ghost');

// ==================== HEX MATH ====================
function hexToPixel(q, r) {
    const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = HEX_SIZE * ((3 / 2) * r);
    return { x, y };
}

function pixelToHex(x, y) {
    const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / HEX_SIZE;
    const r = ((2 / 3) * y) / HEX_SIZE;
    return hexRound(q, r);
}

function hexRound(q, r) {
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(-q - r);
    const q_diff = Math.abs(rq - q);
    const r_diff = Math.abs(rr - r);
    const s_diff = Math.abs(rs - (-q - r));
    if (q_diff > r_diff && q_diff > s_diff) rq = -rr - rs;
    else if (r_diff > s_diff) rr = -rq - rs;
    return { q: rq, r: rr };
}

function getGridHexes(radius) {
    const hexes = [];
    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
            hexes.push({ q, r });
        }
    }
    return hexes;
}

function getNeighbors(q, r) {
    return [
        [1, 0], [1, -1], [0, -1],
        [-1, 0], [-1, 1], [0, 1]
    ].map(d => ({ q: q + d[0], r: r + d[1] }));
}

function hexToString(q, r) {
    return `${q},${r}`;
}

function getRandomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// ==================== GAME LOGIC ====================
function initGame() {
    grid.clear();
    hand = [];
    score = 0;
    gameOver = false;
    newPlacedHex = null;
    updateScore();
    generateNewHand();
    renderBoard();
    renderHand();
    modalEl.classList.add('hidden');
}

function updateScore() {
    scoreEl.textContent = score;
    finalScoreEl.textContent = score;
    scoreEl.parentElement.style.animation = 'pulse 0.4s ease';
    setTimeout(() => {
        scoreEl.parentElement.style.animation = '';
    }, 400);
}

function generateNewHand() {
    hand = [];
    for (let i = 0; i < 3; i++) {
        const count = Math.floor(Math.random() * 2) + 1;
        const color = getRandomColor();
        hand.push(Array(count).fill(color));
    }
    renderHand();
}

function checkGameOver() {
    const allHexes = getGridHexes(GRID_RADIUS);
    const emptySpots = allHexes.filter(h => !grid.has(hexToString(h.q, h.r)));
    const hasPlayableTiles = hand.some(stack => stack.length > 0);
    
    if (emptySpots.length === 0 && hasPlayableTiles) {
        gameOver = true;
        setTimeout(() => {
            modalEl.classList.remove('hidden');
        }, 300);
    }
}

function placeTile(q, r, handIndex) {
    const key = hexToString(q, r);
    if (grid.has(key)) return;
    
    const tileStack = hand[handIndex];
    if (!tileStack || tileStack.length === 0) return;
    
    grid.set(key, [...tileStack]);
    hand[handIndex] = [];
    newPlacedHex = key;
    
    renderHand();
    
    // Delay board render for animation effect
    setTimeout(() => {
        renderBoard();
        
        const points = processMerge(q, r);
        if (points > 0) {
            score += points;
            updateScore();
        }
        
        if (hand.every(s => s.length === 0)) {
            generateNewHand();
        }
        
        newPlacedHex = null;
        checkGameOver();
    }, 100);
}

function processMerge(q, r) {
    let totalPoints = 0;
    const key = hexToString(q, r);
    let currentStack = grid.get(key);
    
    if (!currentStack) return 0;
    
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < 20) {
        changed = false;
        iterations++;
        
        if (!currentStack || currentStack.length === 0) break;
        
        const topColor = currentStack[currentStack.length - 1];
        const neighbors = getNeighbors(q, r);
        
        for (const n of neighbors) {
            const nk = hexToString(n.q, n.r);
            const neighborStack = grid.get(nk);
            
            if (neighborStack && neighborStack.length > 0) {
                const nTop = neighborStack[neighborStack.length - 1];
                
                if (nTop === topColor) {
                    let matchCount = 0;
                    for (let i = neighborStack.length - 1; i >= 0; i--) {
                        if (neighborStack[i] === topColor) matchCount++;
                        else break;
                    }
                    
                    if (matchCount > 0) {
                        for (let i = 0; i < matchCount; i++) {
                            currentStack.push(topColor);
                            neighborStack.pop();
                        }
                        
                        if (neighborStack.length === 0) {
                            grid.delete(nk);
                        }
                        
                        totalPoints += matchCount * 20;
                        changed = true;
                    }
                }
            }
        }
        
        if (currentStack.length >= MAX_STACK_HEIGHT) {
            grid.delete(key);
            totalPoints += 100;
            
            if (typeof confetti !== 'undefined') {
                confetti({
                    particleCount: 100,
                    spread: 80,
                    origin: { y: 0.5 },
                    colors: ['#FFD700', '#FFA500', '#FF6B6B'],
                    gravity: 0.8,
                    scalar: 1.2
                });
            }
            changed = false;
            break;
        }
    }
    
    renderBoard();
    return totalPoints;
}

// ==================== RENDERING ====================
function renderBoard() {
    boardEl.innerHTML = '';
    const hexes = getGridHexes(GRID_RADIUS);
    const centerX = boardEl.clientWidth / 2.4;
    const centerY = boardEl.clientHeight / 2.5;
    
    hexes.forEach((h, index) => {
        const { x, y } = hexToPixel(h.q, h.r);
        const key = hexToString(h.q, h.r);
        const stack = grid.get(key);
        
        const slot = document.createElement('div');
        slot.className = 'hex-slot';
        slot.style.transform = `translate(${centerX + x}px, ${centerY + y}px)`;
        slot.dataset.q = h.q;
        slot.dataset.r = h.r;
        
        const base = document.createElement('div');
        base.className = 'hexagon';
        slot.appendChild(base);
        
        if (stack && stack.length > 0) {
            const renderCount = Math.min(stack.length, 5);
            const color = stack[stack.length - 1];
            const isNew = newPlacedHex === key;
            
            for (let i = 0; i < renderCount; i++) {
                const tile = document.createElement('div');
                const classes = ['hexagon', 'tile', `stack-${i + 1}`];
                if (isNew) classes.push('new-tile');
                tile.className = classes.join(' ');
                tile.style.backgroundColor = color;
                tile.style.zIndex = i + 1;
                
                // Add slight delay for cascading animation
                if (isNew) {
                    tile.style.animationDelay = `${i * 0.05}s`;
                }
                
                slot.appendChild(tile);
            }
        }
        
        boardEl.appendChild(slot);
    });
}

function renderHand() {
    handEl.innerHTML = '';
    hand.forEach((stack, index) => {
        const slot = document.createElement('div');
        slot.className = 'hand-slot';
        
        if (stack.length > 0) {
            const color = stack[stack.length - 1];
            const tile = document.createElement('div');
            tile.className = 'hexagon tile hand-tile';
            tile.style.backgroundColor = color;
            tile.style.position = 'relative';
            
            tile.addEventListener('mousedown', (e) => startDrag(e, index, stack));
            tile.addEventListener('touchstart', (e) => startDrag(e, index, stack), { passive: false });
            
            slot.appendChild(tile);
        }
        
        handEl.appendChild(slot);
    });
}

// ==================== DRAG & DROP ====================
function startDrag(e, index, stack) {
    e.preventDefault();
    if (stack.length === 0) return;
    
    draggedItem = { index, stack };
    const color = stack[stack.length - 1];
    
    dragGhost.innerHTML = '';
    const ghostTile = document.createElement('div');
    ghostTile.className = 'hexagon tile';
    ghostTile.style.backgroundColor = color;
    ghostTile.style.position = 'relative';
    dragGhost.appendChild(ghostTile);
    
    dragGhost.classList.remove('hidden');
    moveDrag(e);
    
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('touchmove', moveDrag, { passive: false });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
}

function moveDrag(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    dragGhost.style.left = clientX + 'px';
    dragGhost.style.top = clientY + 'px';
    
    highlightHex(clientX, clientY);
}

function highlightHex(x, y) {
    document.querySelectorAll('.hex-slot .hexagon').forEach(el => el.classList.remove('highlight'));
    
    const rect = boardEl.getBoundingClientRect();
    const relX = x - rect.left - rect.width / 2;
    const relY = y - rect.top - rect.height / 2;
    
    const hex = pixelToHex(relX, relY);
    
    if (Math.abs(hex.q) <= GRID_RADIUS && Math.abs(hex.r) <= GRID_RADIUS && Math.abs(hex.q + hex.r) <= GRID_RADIUS) {
        const key = hexToString(hex.q, hex.r);
        if (!grid.has(key)) {
            const slot = Array.from(boardEl.children).find(el => el.dataset.q == hex.q && el.dataset.r == hex.r);
            if (slot) {
                slot.querySelector('.hexagon').classList.add('highlight');
            }
        }
    }
}

function endDrag(e) {
    if (!draggedItem) return;
    
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    
    const rect = boardEl.getBoundingClientRect();
    const relX = clientX - rect.left - rect.width / 2;
    const relY = clientY - rect.top - rect.height / 2;
    
    const hex = pixelToHex(relX, relY);
    
    if (Math.abs(hex.q) <= GRID_RADIUS && Math.abs(hex.r) <= GRID_RADIUS && Math.abs(hex.q + hex.r) <= GRID_RADIUS) {
        const key = hexToString(hex.q, hex.r);
        if (!grid.has(key)) {
            placeTile(hex.q, hex.r, draggedItem.index);
        }
    }
    
    draggedItem = null;
    dragGhost.classList.add('hidden');
    document.querySelectorAll('.hex-slot .hexagon').forEach(el => el.classList.remove('highlight'));
    
    document.removeEventListener('mousemove', moveDrag);
    document.removeEventListener('touchmove', moveDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchend', endDrag);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initGame();
});

playAgainBtn.addEventListener('click', () => {
    if (typeof window.show_9920382 === 'function') {
        window.show_9920382()
            .then(() => {
                console.log('Ad completed');
                initGame();
            })
            .catch((err) => {
                console.warn('Ad error:', err);
                initGame();
            });
    } else {
        console.warn('Ad SDK not loaded');
        initGame();
    }
});
