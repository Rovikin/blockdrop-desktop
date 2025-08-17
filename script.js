// ===================== KONFIGURASI DASAR =====================
const COLS = 10, ROWS = 20, BLOCK = 28;
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d', { alpha: false });

// HiDPI scaling (crisp di layar retina)
function resizeCanvasForDevicePixelRatio() {
  const scale = window.devicePixelRatio || 1;
  canvas.width  = COLS * BLOCK * scale;
  canvas.height = ROWS * BLOCK * scale;
  canvas.style.width  = (COLS * BLOCK) + 'px';
  canvas.style.height = (ROWS * BLOCK) + 'px';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(scale, scale);
}
resizeCanvasForDevicePixelRatio();

// Warna block
const COLORS = [null, '#22c1c3', '#ffb86b', '#9ae66e', '#7dd3fc', '#f6a6ff', '#ffd36e', '#8ad0ff'];

// Bentuk Tetromino
const SHAPES = {
  I: [[1,1,1,1]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1]],
  S: [[0,1,1],[1,1,0]],
  Z: [[1,1,0],[0,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]]
};
const SHAPE_KEYS = Object.keys(SHAPES);

// ===================== STATE GAME =====================
let board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
let current = null;
let nextPieceKey = null;
let currentPos = {x:0, y:0};

let score = 0, level = 0, lines = 0;
let dropCounter = 0, dropInterval = 1000;
let lastTime = 0;
let paused = false, gameOver = false;
let isHardDropping = false;

// Speed/level
const BASE_SPEED = 1000;
const SPEED_INCREASE_PER_LEVEL = 30;
const MIN_SPEED = 200;
const SCORE_PER_LEVEL = 2000;

// ===================== UTILS =====================
function randomPieceKey() {
  return SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
}

function collides() {
  for (let y = 0; y < current.shape.length; y++) {
    for (let x = 0; x < current.shape[y].length; x++) {
      if (current.shape[y][x]) {
        const nx = currentPos.x + x;
        const ny = currentPos.y + y;
        if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx])) {
          return true;
        }
      }
    }
  }
  return false;
}

function collidesAt(x, y) {
  for (let py = 0; py < current.shape.length; py++) {
    for (let px = 0; px < current.shape[py].length; px++) {
      if (current.shape[py][px]) {
        const nx = x + px, ny = y + py;
        if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx])) return true;
      }
    }
  }
  return false;
}

// ===================== INIT / SPAWN =====================
function initGame() {
  board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
  score = 0; level = 0; lines = 0;
  dropInterval = BASE_SPEED;
  paused = false; gameOver = false; isHardDropping = false;

  nextPieceKey = randomPieceKey();   // siapkan next
  spawnPiece();                      // munculin current dari next
  updateHud();
}

function spawnPiece() {
  // current dari next
  const key = nextPieceKey;
  current = {
    shape: SHAPES[key].map(r => [...r]),
    id: SHAPE_KEYS.indexOf(key) + 1
  };
  // generate next baru
  nextPieceKey = randomPieceKey();

  // posisi awal ditengah
  currentPos = { x: Math.floor((COLS - current.shape[0].length) / 2), y: 0 };

  if (collides()) {
    gameOver = true;
  }
  updateHud();
}

function updateLevel() {
  const newLevel = Math.floor(score / SCORE_PER_LEVEL);
  if (newLevel > level) {
    level = newLevel;
    dropInterval = Math.max(MIN_SPEED, BASE_SPEED - (level * SPEED_INCREASE_PER_LEVEL));
  }
}

// ===================== CONTROL =====================
function rotatePiece() {
  if (paused || gameOver) return;
  const rotated = current.shape[0].map((_, i) => current.shape.map(row => row[i]).reverse());
  const original = current.shape;
  current.shape = rotated;

  // wall kick sederhana
  const offsets = [0, -1, 1, -2, 2];
  for (const off of offsets) {
    currentPos.x += off;
    if (!collides()) return;
    currentPos.x -= off;
  }
  current.shape = original;
}

function move(dx) {
  if (paused || gameOver) return;
  currentPos.x += dx;
  if (collides()) currentPos.x -= dx;
}

function hardDrop() {
  if (paused || gameOver || isHardDropping) return;
  isHardDropping = true;
  while (!collides()) currentPos.y++;
  currentPos.y--;
  mergeToBoard();
  clearLines();
  spawnPiece();
  setTimeout(() => { isHardDropping = false; }, 100);
}

function mergeToBoard() {
  for (let y = 0; y < current.shape.length; y++) {
    for (let x = 0; x < current.shape[y].length; x++) {
      if (current.shape[y][x] && currentPos.y + y >= 0) {
        board[currentPos.y + y][currentPos.x + x] = current.id;
      }
    }
  }
}

function clearLines() {
  let linesCleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      linesCleared++;
      y++;
    }
  }
  if (linesCleared) {
    lines += linesCleared;
    score += [100, 300, 500, 800][Math.min(linesCleared, 4) - 1] * (level + 1);
    updateLevel();
    updateHud();
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
}

function resetGame() {
  initGame();
}

// ===================== RENDER =====================
function draw() {
  // background board
  ctx.fillStyle = '#071425';
  ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

  // grid tipis
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.strokeRect(x * BLOCK + 0.5, y * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
    }
  }

  // block yang sudah nempel
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) drawBlock(x, y, COLORS[board[y][x]]);
    }
  }

  // ghost piece
  if (!gameOver && !paused) {
    const gy = getGhostY();
    ctx.globalAlpha = 0.28;
    for (let y = 0; y < current.shape.length; y++) {
      for (let x = 0; x < current.shape[y].length; x++) {
        if (current.shape[y][x]) drawBlock(currentPos.x + x, gy + y, COLORS[current.id]);
      }
    }
    ctx.globalAlpha = 1;
  }

  // current piece
  if (!gameOver && !paused) {
    for (let y = 0; y < current.shape.length; y++) {
      for (let x = 0; x < current.shape[y].length; x++) {
        if (current.shape[y][x] && currentPos.y + y >= 0) {
          drawBlock(currentPos.x + x, currentPos.y + y, COLORS[current.id]);
        }
      }
    }
  }

  // overlays
  if (gameOver) {
    overlayText('GAME OVER', 'Tekan R untuk reset (Enter juga bisa)');
  } else if (paused) {
    overlayText('PAUSE', 'Tekan ArrowUp untuk lanjut');
  }
}

function overlayText(line1, line2) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(line1, COLS * BLOCK / 2, ROWS * BLOCK / 2 - 10);
  ctx.font = '14px system-ui, sans-serif';
  if (line2) ctx.fillText(line2, COLS * BLOCK / 2, ROWS * BLOCK / 2 + 16);
}

function drawBlock(x, y, color) {
  // isi
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
  // outline lebih jelas
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x * BLOCK + 0.5, y * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
}

function getGhostY() {
  let y = currentPos.y;
  while (!collidesAt(currentPos.x, y + 1) && y < ROWS - current.shape.length) y++;
  return y;
}

// ===================== HUD =====================
function updateHud() {
  // angka
  const S = id => document.getElementById(id);
  S('score').textContent = score;
  S('level').textContent = level;
  S('lines').textContent = lines;

  // next piece preview
  const box = document.getElementById('nextBox');
  if (!box) return;
  box.innerHTML = '';
  const c = document.createElement('canvas');
  const size = 120;
  c.width = size; c.height = size;
  const nctx = c.getContext('2d');

  nctx.fillStyle = '#071425';
  nctx.fillRect(0, 0, size, size);

  const shape = SHAPES[nextPieceKey];
  const cellSize = Math.min(size / Math.max(shape.length, 4), size / Math.max(shape[0].length, 4));
  const ox = (size - shape[0].length * cellSize) / 2;
  const oy = (size - shape.length * cellSize) / 2;

  nctx.fillStyle = COLORS[SHAPE_KEYS.indexOf(nextPieceKey) + 1];
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        nctx.fillRect(ox + x * cellSize + 1, oy + y * cellSize + 1, cellSize - 2, cellSize - 2);
        nctx.strokeStyle = 'rgba(0,0,0,0.45)';
        nctx.strokeRect(ox + x * cellSize + 0.5, oy + y * cellSize + 0.5, cellSize - 1, cellSize - 1);
      }
    }
  }

  box.appendChild(c);

  // (opsional) update teks Help di HTML biar sesuai mapping terbaru
  const help = document.querySelector('.help ul');
  if (help) {
    help.innerHTML = `
      <li>◀️ ▶️ Move</li>
      <li>🔽 Hard Drop</li>
      <li>🔼 Pause/Resume</li>
      <li>Enter/OK/Space Rotate</li>
      <li>R Reset (Enter saat Game Over)</li>
    `;
  }
}

// ===================== GAME LOOP =====================
function gameLoop(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      currentPos.y++;
      if (collides()) {
        currentPos.y--;
        mergeToBoard();
        clearLines();
        spawnPiece();
      }
      dropCounter = 0;
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// ===================== EVENTS =====================
// Keyboard mapping:
// ArrowLeft/Right = move, ArrowDown = hard drop, ArrowUp = pause
// Enter / NumpadEnter / OK / Select / Space = rotate
// R = reset (Enter juga reset kalau game over)
window.addEventListener('keydown', (e) => {
  const key = e.key;
  const rotateKeys = new Set([' ', 'OK', 'Select', 'Enter', 'NumpadEnter']);
  const prevent = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '];

  if (prevent.includes(key)) e.preventDefault();

  // allow Enter to reset only on game over (biar gak tabrakan sama OK=Enter untuk rotate)
  if (gameOver && (key === 'Enter' || key === 'NumpadEnter')) { resetGame(); return; }

  switch (key) {
    case 'ArrowLeft':  move(-1); break;
    case 'ArrowRight': move(1);  break;
    case 'ArrowDown':  hardDrop(); break;
    case 'ArrowUp':    togglePause(); break;
    case 'r':
    case 'R':          resetGame(); break;
    default:
      if (rotateKeys.has(key)) rotatePiece();
      break;
  }
});

window.addEventListener('resize', () => {
  resizeCanvasForDevicePixelRatio();
  draw();
});

// ===================== START =====================
initGame();
requestAnimationFrame(gameLoop);
