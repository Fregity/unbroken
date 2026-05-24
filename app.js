// ── CONSTANTS ──
const COLORS = [
  '#3fb950','#58a6ff','#f78166','#d2a8ff','#ffa657',
  '#79c0ff','#ff7b72','#a5d6ff','#7ee787','#e3b341'
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['','M','','W','','F',''];

// ── STATE ──
let habits = [];
let selectedColor = COLORS[0];

// ── STORAGE ──
function loadData() {
  try {
    habits = JSON.parse(localStorage.getItem('unbroken_habits') || '[]');
  } catch(e) { habits = []; }
}

function saveData() {
  localStorage.setItem('unbroken_habits', JSON.stringify(habits));
}

// ── DATE HELPERS ──
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function currentYear() { return new Date().getFullYear(); }

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── GRID LOGIC ──
// Builds array of 52+ weeks × 7 days covering the full current year
function buildYearGrid() {
  const year = currentYear();
  const jan1 = new Date(year, 0, 1);
  const startDay = jan1.getDay(); // 0 = Sunday
  const cells = [];

  // Pad back to the Sunday before Jan 1
  for (let i = 0; i < startDay; i++) {
    const d = new Date(jan1);
    d.setDate(d.getDate() - (startDay - i));
    cells.push({ date: fmtDate(d), inYear: false });
  }

  // All days of the current year
  const d = new Date(jan1);
  while (d.getFullYear() === year) {
    cells.push({ date: fmtDate(d), inYear: true });
    d.setDate(d.getDate() + 1);
  }

  // Pad to complete the final week
  while (cells.length % 7 !== 0) {
    cells.push({ date: fmtDate(d), inYear: false });
    d.setDate(d.getDate() + 1);
  }

  // Chunk into columns of 7 (one column = one week)
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function getMonthLabels(weeks) {
  const labels = new Array(weeks.length).fill('');
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstInYear = week.find(c => c.inYear);
    if (!firstInYear) return;
    const m = parseInt(firstInYear.date.split('-')[1]) - 1;
    if (m !== lastMonth) { labels[wi] = MONTHS[m]; lastMonth = m; }
  });
  return labels;
}

// ── STATS ──
function calcStats(habit) {
  const today = todayStr();
  const year = currentYear();
  const yearStr = String(year);

  const jan1 = new Date(year, 0, 1);
  const now = new Date();
  const dayOfYear = Math.floor((now - jan1) / 86400000) + 1;

  const checked = (habit.checked || []).filter(d => d.startsWith(yearStr));
  const total = checked.length;
  const rate = dayOfYear > 0 ? Math.round((total / dayOfYear) * 100) : 0;

  // Current streak — walk backwards from today
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const ds = fmtDate(cursor);
    if (checked.includes(ds)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (ds === today) {
      // Today not checked yet — skip it and keep looking back
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
    if (streak > 365) break;
  }

  // Longest streak
  let longest = 0, cur = 0;
  const sorted = [...checked].sort();
  sorted.forEach((ds, i) => {
    if (i === 0) {
      cur = 1;
    } else {
      const prev = new Date(sorted[i - 1]);
      prev.setDate(prev.getDate() + 1);
      cur = fmtDate(prev) === ds ? cur + 1 : 1;
    }
    if (cur > longest) longest = cur;
  });

  return { total, streak, longest, rate };
}

// ── RENDER ──
function render() {
  const empty = document.getElementById('empty-state');
  const container = document.getElementById('habits-container');
  const exportBar = document.getElementById('export-bar');
  const addBtn = document.getElementById('btn-add-header');

  document.getElementById('year-label').textContent = `// ${currentYear()}`;

  if (habits.length === 0) {
    empty.style.display = 'block';
    container.innerHTML = '';
    exportBar.style.display = 'none';
    addBtn.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  exportBar.style.display = 'flex';
  addBtn.style.display = habits.length < 5 ? 'block' : 'none';

  const weeks = buildYearGrid();
  const monthLabels = getMonthLabels(weeks);
  const today = todayStr();

  container.innerHTML = habits.map((habit, hi) => {
    const stats = calcStats(habit);
    const checked = new Set(habit.checked || []);

    // Month label row
    const monthRow = monthLabels
      .map(lbl => `<div class="month-label-slot">${lbl}</div>`)
      .join('');

    // Grid columns
    const cols = weeks.map(week => {
      const cells = week.map(cell => {
        const isFuture = cell.date > today;
        const isToday  = cell.date === today;
        const isFilled = checked.has(cell.date);
        const isInYear = cell.inYear;

        let cls = 'cell';
        if (isFuture || !isInYear) cls += ' future';
        if (isFilled && isInYear)  cls += ' filled';
        if (isToday)               cls += ' today';

        const bgStyle      = isFilled && isInYear ? `background:${habit.color}` : '';
        const hiddenStyle  = !isInYear ? 'opacity:0;pointer-events:none;' : '';

        return `<div class="${cls}"
          style="${bgStyle}${hiddenStyle}"
          data-date="${cell.date}"
          onmouseenter="showTooltip(event,'${cell.date}',${isFilled},${isInYear})"
          onmouseleave="hideTooltip()"
          onclick="toggleDay('${cell.date}',${hi},${isFuture || !isInYear})"
        ></div>`;
      }).join('');
      return `<div class="grid-col">${cells}</div>`;
    }).join('');

    const dayLabelsHtml = DAYS
      .map(d => `<div class="day-label">${d}</div>`)
      .join('');

    const isCheckedToday = checked.has(today);
    const checkinBtn = isCheckedToday
      ? `class="btn-checkin done"`
      : `class="btn-checkin" style="background:${habit.color};color:#0e0e0e"`;

    return `
      <div class="habit-card" id="hcard-${hi}">
        <div class="habit-header">
          <div class="habit-left">
            <div class="habit-dot" style="background:${habit.color}"></div>
            <div class="habit-name">${escHtml(habit.name)}</div>
          </div>
          <div class="habit-stats">
            <div class="stat">
              <div class="stat-val" style="color:${habit.color}">${stats.streak}</div>
              <div class="stat-label">Streak</div>
            </div>
            <div class="stat">
              <div class="stat-val">${stats.longest}</div>
              <div class="stat-label">Best</div>
            </div>
            <div class="stat">
              <div class="stat-val">${stats.total}</div>
              <div class="stat-label">Total</div>
            </div>
            <div class="stat">
              <div class="stat-val">${stats.rate}%</div>
              <div class="stat-label">Rate</div>
            </div>
          </div>
          <div class="habit-actions">
            <button class="btn-icon danger" onclick="deleteHabit(${hi})">DELETE</button>
          </div>
        </div>

        <div class="grid-wrap">
          <div class="grid-inner">
            <div class="month-labels">${monthRow}</div>
            <div class="grid-rows">
              <div class="day-labels">${dayLabelsHtml}</div>
              <div class="grid-cols">${cols}</div>
            </div>
          </div>
        </div>

        <div class="today-row">
          <button ${checkinBtn} onclick="checkInToday(${hi})">
            ${isCheckedToday ? '✓ LOGGED TODAY' : '+ LOG TODAY'}
          </button>
          <span class="checkin-date">${today}</span>
        </div>
      </div>
      ${hi < habits.length - 1 ? '<div class="habit-divider"></div>' : ''}
    `;
  }).join('');
}

// ── INTERACTIONS ──
function toggleDay(date, hi, blocked) {
  if (blocked) return;
  if (date > todayStr()) return;
  const habit = habits[hi];
  if (!habit.checked) habit.checked = [];
  const idx = habit.checked.indexOf(date);
  if (idx === -1) habit.checked.push(date);
  else habit.checked.splice(idx, 1);
  saveData();
  updateCell(date, hi);
  updateStats(hi);
}

function checkInToday(hi) {
  const today = todayStr();
  const habit = habits[hi];
  if (!habit.checked) habit.checked = [];
  if (!habit.checked.includes(today)) {
    habit.checked.push(today);
    saveData();
    updateCell(today, hi);
    updateStats(hi);
    updateCheckinBtn(hi);
  }
}

function updateCell(date, hi) {
  const habit = habits[hi];
  const checked = new Set(habit.checked || []);
  const card = document.getElementById(`hcard-${hi}`);
  if (!card) return;
  const cell = card.querySelector(`.cell[data-date="${date}"]`);
  if (!cell) return;
  if (checked.has(date)) {
    cell.classList.add('filled');
    cell.style.background = habit.color;
  } else {
    cell.classList.remove('filled');
    cell.style.background = '';
  }
  // always sync the log today button after any cell change
  if (date === todayStr()) updateCheckinBtn(hi);
}

function updateStats(hi) {
  const stats = calcStats(habits[hi]);
  const card = document.getElementById(`hcard-${hi}`);
  if (!card) return;
  const vals = card.querySelectorAll('.stat-val');
  if (vals.length < 4) return;
  vals[0].textContent = stats.streak;
  vals[1].textContent = stats.longest;
  vals[2].textContent = stats.total;
  vals[3].textContent = stats.rate + '%';
}

function updateCheckinBtn(hi) {
  const card = document.getElementById(`hcard-${hi}`);
  if (!card) return;
  const btn = card.querySelector('.btn-checkin');
  if (!btn) return;
  const habit = habits[hi];
  const isChecked = (habit.checked || []).includes(todayStr());
  if (isChecked) {
    btn.textContent = '✓ LOGGED TODAY';
    btn.className = 'btn-checkin done';
    btn.style.background = '';
    btn.style.color = '';
  } else {
    btn.textContent = '+ LOG TODAY';
    btn.className = 'btn-checkin';
    btn.style.background = habit.color;
    btn.style.color = '#0e0e0e';
  }
}

function deleteHabit(hi) {
  const confirmed = window._deleteConfirm === hi;
  if (!confirmed) {
    window._deleteConfirm = hi;
    const btn = document.querySelector(`#hcard-${hi} .btn-icon.danger`);
    if (btn) {
      btn.innerHTML = 'CONFIRM?<br><span style="font-size:8px;opacity:0.7;letter-spacing:0.08em">click again</span>';
      btn.style.borderColor = '#ff4444';
      btn.style.color = '#ff4444';
      btn.style.lineHeight = '1.4';
      btn.style.padding = '4px 12px';
      btn.style.whiteSpace = 'nowrap';
    }
    setTimeout(() => {
      window._deleteConfirm = null;
      if (btn) {
        btn.innerHTML = 'DELETE';
        btn.style.borderColor = '';
        btn.style.color = '';
        btn.style.lineHeight = '';
        btn.style.padding = '';
        btn.style.whiteSpace = '';
      }
    }, 2500);
    return;
  }
  window._deleteConfirm = null;
  habits.splice(hi, 1);
  saveData();
  render();
}

// ── TOOLTIP ──
function showTooltip(e, date, hi, inYear) {
  if (!inYear) return;
  const tt = document.getElementById('tooltip');
  const [y, m, d] = date.split('-');
  tt.textContent = `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
  tt.style.display = 'block';
  tt.style.left = e.clientX + 'px';
  tt.style.top = (e.clientY - 5) + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
}

// ── MODAL ──
function openModal() {
  if (habits.length >= 5) return;
  const usedColors = habits.map(h => h.color);
  document.getElementById('color-picker').innerHTML = COLORS.map(c => `
    <div class="color-opt ${c === selectedColor ? 'selected' : ''}"
      style="background:${c};${usedColors.includes(c) ? 'opacity:0.3;cursor:not-allowed' : ''}"
      onclick="${usedColors.includes(c) ? '' : `selectColor('${c}')`}"
    ></div>
  `).join('');
  document.getElementById('habit-name-input').value = '';
  document.getElementById('modal').style.display = 'flex';
  setTimeout(() => document.getElementById('habit-name-input').focus(), 100);
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

function selectColor(c) {
  selectedColor = c;
  document.querySelectorAll('.color-opt').forEach(el => {
    el.classList.toggle('selected', rgbToHex(el.style.background) === c);
  });
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return rgb;
  return '#' + m.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}

function saveHabit() {
  const name = document.getElementById('habit-name-input').value.trim();
  if (!name) { document.getElementById('habit-name-input').focus(); return; }
  habits.push({ name, color: selectedColor, checked: [] });
  const usedColors = habits.map(h => h.color);
  selectedColor = COLORS.find(c => !usedColors.includes(c)) || COLORS[0];
  saveData();
  closeModal();
  render();
}

// ── EXPORT ──
function exportCard(share = false) {
  const canvas = document.getElementById('export-canvas');
  const ctx = canvas.getContext('2d');
  const W        = 900;
  const HABIT_H  = 160;
  const HEADER_H = 80;
  const FOOTER_H = 60;
  const PAD      = 48;
  const H        = HEADER_H + habits.length * HABIT_H + FOOTER_H + PAD;
  canvas.width  = W;
  canvas.height = H;
  // Background
  ctx.fillStyle = '#0e0e0e';
  ctx.fillRect(0, 0, W, H);
  // Subtle horizontal rules
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 28) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // Header
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillText('UNBROKEN', PAD, 52);
  ctx.fillStyle = '#444';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText(`// ${currentYear()} · ${todayStr()}`, PAD + 130, 52);
  // Habits
  const weeks  = buildYearGrid();
  const CELL   = 10;
  const GAP    = 2;
  const GRID_W = weeks.length * (CELL + GAP);
  const xStart = (W - GRID_W) / 2;
  const today  = todayStr();
  habits.forEach((habit, hi) => {
    const y0      = HEADER_H + hi * HABIT_H;
    const checked = new Set(habit.checked || []);
    const stats   = calcStats(habit);
    // Name
    ctx.fillStyle = habit.color;
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.fillText(habit.name.toUpperCase(), PAD, y0 + 22);
    // Stats line
    ctx.fillStyle = '#666';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(
      `${stats.streak} streak · ${stats.longest} best · ${stats.total} days · ${stats.rate}% rate`,
      PAD, y0 + 40
    );
    // Grid
    const gridY = y0 + 55;
    weeks.forEach((week, wi) => {
      week.forEach((cell, di) => {
        if (!cell.inYear) return;
        const cx       = xStart + wi * (CELL + GAP);
        const cy       = gridY  + di * (CELL + GAP);
        const isFilled = checked.has(cell.date);
        const isFuture = cell.date > today;
        ctx.fillStyle = isFilled ? habit.color : isFuture ? '#131313' : '#1c1c1c';
        ctx.beginPath();
        ctx.roundRect(cx, cy, CELL, CELL, 1.5);
        ctx.fill();
        // Today outline
        if (cell.date === today) {
          ctx.strokeStyle = '#e8e8e8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(cx, cy, CELL, CELL, 1.5);
          ctx.stroke();
        }
      });
    });
  });
  // Footer rule
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, H - FOOTER_H, W, 1);
  // Footer left
  ctx.fillStyle = '#444';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('unbroken.fyi · your year in pixels', PAD, H - 22);
  // Footer right
  const totalDays = habits.reduce((s, h) =>
    s + (h.checked || []).filter(d => d.startsWith(String(currentYear()))).length, 0
  );
  ctx.textAlign = 'right';
  ctx.fillStyle = '#333';
  ctx.fillText(`${totalDays} total check-ins this year`, W - PAD, H - 22);
  ctx.textAlign = 'left';

  // ── SHARE OR DOWNLOAD ──
  canvas.toBlob(async (blob) => {
    if (share && navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], `unbroken-${currentYear()}.png`,
          { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Unbroken — My year in pixels',
            files: [file]
          });
          return; // shared successfully, stop here no matter what
        }
      } catch(e) {
        if (e.name === 'AbortError') return; // user cancelled, don't download
        // only fall through to clipboard/download on genuine errors
      }
      return; // canShare returned false, don't download either
    }
    if (share) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        const btn = document.querySelector('.btn-export:not(.secondary)');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = 'COPIED ✓';
          setTimeout(() => btn.textContent = orig, 2000);
        }
        return;
      } catch(e) {
        // clipboard failed, fall through to download
      }
    }
    // Default download
    const link = document.createElement('a');
    link.download = `unbroken-${currentYear()}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }, 'image/png');
}

// ── UTILS ──
function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── INIT ──
loadData();
render();
