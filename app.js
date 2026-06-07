// ── CONSTANTS ──
const COLORS = [
  '#ff3c6e', // red
  '#f78166', // coral
  '#ffa657', // orange
  '#ffd166', // yellow
  '#3fb950', // green
  '#7ee787', // mint/light green
  '#79c0ff', // light blue
  '#58a6ff', // blue
  '#7c6fff', // purple
  '#3C4142',  // charcoal
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
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayStr() { return fmtDate(new Date()); }

function currentYear() { return new Date().getFullYear(); }

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

function calcStats(habit) {
  const today   = todayStr();
  const year    = currentYear();
  const yearStr = String(year);

  const jan1      = new Date(year, 0, 1);
  const now       = new Date();
  const dayOfYear = Math.floor((now - jan1) / 86400000) + 1;

  // Year-scoped for total + rate
  const checkedThisYear = (habit.checked || []).filter(d => d.startsWith(yearStr));
  const total = checkedThisYear.length;
  const rate  = dayOfYear > 0 ? Math.round((total / dayOfYear) * 100) : 0;

  // All checked days for streak calculations
  const allChecked = [...(habit.checked || [])].sort();
  const checkedSet = new Set(allChecked);

  // Current streak — walk backwards from today
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const ds = fmtDate(cursor);
    if (checkedSet.has(ds)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (ds === today) {
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
    if (streak > 3650) break;
  }

  // Longest streak — across all time
  // Use pure string date math to avoid timezone issues
  let longest = 0, cur = 0;
  allChecked.forEach((ds, i) => {
    if (i === 0) {
      cur = 1;
    } else {
      // check if previous date + 1 day === current date
      const [y, m, d] = allChecked[i-1].split('-').map(Number);
      const prev = new Date(y, m-1, d);
      prev.setDate(prev.getDate() + 1);
      const expectedNext = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
      cur = expectedNext === ds ? cur + 1 : 1;
    }
    if (cur > longest) longest = cur;
  });

  longest = Math.max(longest, streak);

  return { total, streak, longest, rate };
}

// ── CHAIN SVG ──
function chainSVG(color) {
  return `<svg class="chain-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
      stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
      stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// ── SOUND ENGINE ──
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playChainSound(milestone = false) {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    // Metallic click base
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(milestone ? 880 : 660, now);
    osc1.frequency.exponentialRampToValueAtTime(milestone ? 440 : 220, now + 0.15);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(milestone ? 1320 : 990, now);
    osc2.frequency.exponentialRampToValueAtTime(milestone ? 660 : 440, now + 0.12);

    filter.type = 'bandpass';
    filter.frequency.value = milestone ? 1200 : 800;
    filter.Q.value = 2;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(milestone ? 0.18 : 0.12, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + (milestone ? 0.4 : 0.25));

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  } catch(e) {
    // audio not supported, silently skip
  }
}

// ── STREAK CHIPS ──
const MILESTONES = [7, 14, 30, 50, 100, 200, 365];

function isMilestone(n) {
  return MILESTONES.includes(n);
}

function renderStreakChips() {
  const container = document.getElementById('streak-chips');
  if (!container) return;
  if (habits.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = habits.map((habit, hi) => {
    const stats = calcStats(habit);
    const milestone = isMilestone(stats.streak);
    return `
      <div class="streak-chip ${milestone ? 'milestone' : ''}"
           id="chip-${hi}"
           style="--chip-color:${habit.color}; color:${habit.color}; border-color:${milestone ? habit.color : ''}">
        ${chainSVG(habit.color)}
        <span class="chip-num" id="chip-num-${hi}">${stats.streak}</span>
        <span class="chip-name">${escHtml(habit.name)}</span>
      </div>
    `;
  }).join('');
}

function animateChip(hi, newStreak) {
  if (navigator.vibrate) navigator.vibrate(isMilestone(newStreak) ? [40,30,40] : 40);
  const chip = document.getElementById(`chip-${hi}`);
  const num  = document.getElementById(`chip-num-${hi}`);
  if (!chip || !num) return;

  const milestone = isMilestone(newStreak);
  playChainSound(milestone);

  // update number mid-animation
  setTimeout(() => { num.textContent = newStreak; }, 175);

  chip.classList.remove('animate-snap');
  void chip.offsetWidth; // force reflow to restart animation
  chip.classList.add('animate-snap');
  setTimeout(() => chip.classList.remove('animate-snap'), 650);

  // milestone — upgrade border
  if (milestone) {
    chip.classList.add('milestone');
    chip.style.borderColor = habits[hi].color;
  }
}

// ── RENDER ── //
function render() {
  const empty = document.getElementById('empty-state');
  const container = document.getElementById('habits-container');
  const exportBar = document.getElementById('export-bar');
  const addBtn = document.getElementById('btn-add-header');

  document.getElementById('year-label').textContent = `// ${currentYear()}`;
  renderStreakChips();
  checkStreakRisk();

  if (habits.length === 0) {
    empty.style.display = 'block';
    container.innerHTML = '';
    exportBar.style.display = 'none';
    addBtn.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  exportBar.style.display = 'flex';
  addBtn.style.display = habits.length < 5 && !deleteMode && !editMode ? 'block' : 'none';
  document.getElementById('btn-delete-header').style.display = habits.length > 0 && !deleteMode && !editMode ? 'block' : 'none';
  document.getElementById('btn-edit-header').style.display = habits.length > 0 && !deleteMode && !editMode ? 'block' : 'none';

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
      ? `class="btn-checkin logged" data-unlog="✓ UNLOG TODAY" style="--habit-color:${habit.color}"`
      : `class="btn-checkin unlogged" data-log="✓ LOG TODAY" style="background:${habit.color};color:#0e0e0e;--habit-color:${habit.color}"`;
    
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
            ${deleteMode
              ? `<input type="checkbox" class="delete-checkbox" data-hi="${hi}">`
              : editMode
                ? `<div class="edit-mode-actions">
                     <div class="reorder-arrows">
                       <button class="btn-arrow" onclick="moveHabit(${hi},-1)" ${hi === 0 ? 'disabled' : ''} aria-label="Move ${escHtml(habit.name)} up">↑</button>
                       <button class="btn-arrow" onclick="moveHabit(${hi},1)" ${hi === habits.length-1 ? 'disabled' : ''} aria-label="Move ${escHtml(habit.name)} down">↓</button>
                     </div>
                     <button class="btn-icon" onclick="openEditModal(${hi})" aria-label="Edit ${escHtml(habit.name)}">EDIT</button>
                   </div>`
                : ''
            }
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
            ${isCheckedToday ? '✓ UNLOG TODAY' : '+ LOG TODAY'}
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
  if (date !== todayStr()) return; // lock all past days
  const habit = habits[hi];
  if (!habit.checked) habit.checked = [];
  const idx = habit.checked.indexOf(date);
  if (idx === -1) {
    habit.checked.push(date);
    saveData();
    updateCell(date, hi);
    updateStats(hi);
    animateChip(hi, calcStats(habit).streak);
  } else {
    habit.checked.splice(idx, 1);
    saveData();
    updateCell(date, hi);
    updateStats(hi);
  }
}

function checkInToday(hi) {
  const today = todayStr();
  const habit = habits[hi];
  if (!habit.checked) habit.checked = [];
  const idx = habit.checked.indexOf(today);
  if (idx === -1) {
    habit.checked.push(today);
    saveData();
    updateCell(today, hi);
    updateStats(hi);
    updateCheckinBtn(hi);
    animateChip(hi, calcStats(habit).streak);
  } else {
    habit.checked.splice(idx, 1);
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
  // always sync checkin button and chip after any cell change
  if (date === todayStr()) updateCheckinBtn(hi);

  const stats = calcStats(habit);
  const num = document.getElementById(`chip-num-${hi}`);
  if (num) num.textContent = stats.streak;
  const chip = document.getElementById(`chip-${hi}`);
  if (chip) {
    const milestone = isMilestone(stats.streak);
    chip.classList.toggle('milestone', milestone);
    chip.style.borderColor = milestone ? habit.color : '';
  }
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
    btn.textContent = '✓ UNLOG TODAY';
    btn.className = 'btn-checkin logged';
    btn.style.background = '';
    btn.style.color = '';
    btn.setAttribute('data-unlog', '− UNLOG TODAY');
    btn.style.setProperty('--habit-color', habit.color);
  } else {
    btn.textContent = '+ LOG TODAY';
    btn.className = 'btn-checkin unlogged';
    btn.style.background = habit.color;
    btn.style.color = '#0e0e0e';
    btn.style.setProperty('--habit-color', habit.color);
    btn.setAttribute('data-log', '✓ LOG TODAY');
    btn.removeAttribute('data-unlog');
  }
}

// ── DELETE MODE ──
let deleteMode = false;

function enterDeleteMode() {
  deleteMode = true;
  render();
  // swap header buttons
  document.getElementById('btn-add-header').style.display = 'none';
  document.getElementById('btn-delete-header').style.display = 'none';

  // inject delete bar
  const bar = document.createElement('div');
  bar.id = 'delete-bar';
  bar.innerHTML = `
    <span class="delete-bar-label">// SELECT HABITS TO DELETE</span>
    <div class="delete-bar-actions">
      <button class="btn-delete-cancel" onclick="exitDeleteMode()">CANCEL</button>
      <button class="btn-delete-confirm" onclick="confirmDelete()">DELETE SELECTED</button>
    </div>
  `;
  document.body.appendChild(bar);
}

function exitDeleteMode() {
  deleteMode = false;
  const bar = document.getElementById('delete-bar');
  if (bar) bar.remove();
  render();
  renderStreakChips();
}

function confirmDelete() {
  const checkboxes = document.querySelectorAll('.delete-checkbox:checked');
  if (checkboxes.length === 0) { exitDeleteMode(); return; }
  const indicesToDelete = Array.from(checkboxes)
    .map(cb => parseInt(cb.dataset.hi))
    .sort((a, b) => b - a); // delete from end to preserve indices
  indicesToDelete.forEach(i => habits.splice(i, 1));
  saveData();
  exitDeleteMode();
}

// ── EDIT MODE ──
let editMode = false;

function enterEditMode() {
  editMode = true;
  render();
  document.getElementById('btn-add-header').style.display    = 'none';
  document.getElementById('btn-delete-header').style.display = 'none';
  document.getElementById('btn-edit-header').style.display   = 'none';

  const bar = document.createElement('div');
  bar.id = 'edit-bar';
  bar.innerHTML = `
    <span class="edit-bar-label">// USE ↑↓ TO REORDER · EDIT TO RENAME OR RECOLOR</span>
    <button class="btn-delete-confirm btn-edit-done" onclick="exitEditMode()">DONE</button>
  `;
  document.body.appendChild(bar);
}

function exitEditMode() {
  editMode = false;
  const bar = document.getElementById('edit-bar');
  if (bar) bar.remove();
  render();
}

function moveHabit(hi, dir) {
  const newIdx = hi + dir;
  if (newIdx < 0 || newIdx >= habits.length) return;
  const tmp      = habits[hi];
  habits[hi]     = habits[newIdx];
  habits[newIdx] = tmp;
  saveData();
  render();
}

// ── CARD PICKER ──
let cardPickerShare = false;

function openCardPicker(share) {
  cardPickerShare = share;

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id = 'card-picker-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeCardPicker(); };

  const habitsHtml = habits.map((habit, hi) => {
    const stats = calcStats(habit);
    return `
      <div class="sheet-habit" onclick="pickHabitCard(${hi})">
        <div class="sheet-habit-dot" style="background:${habit.color}"></div>
        <div class="sheet-habit-name">${escHtml(habit.name)}</div>
        <div class="sheet-habit-streak">
          ${chainSVG(habit.color)}
          ${stats.streak} day streak
        </div>
      </div>
    `;
  }).join('');

  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-title">// Choose a habit to share</div>
      <div class="sheet-habits">${habitsHtml}</div>
      <button class="sheet-cancel" onclick="closeCardPicker()">CANCEL</button>
    </div>
  `;

  document.body.appendChild(overlay);
}

function closeCardPicker() {
  const overlay = document.getElementById('card-picker-overlay');
  if (overlay) overlay.remove();
}

function pickHabitCard(hi) {
  closeCardPicker();
  exportCard(cardPickerShare, hi);
}

// ── TOOLTIP ──
function showTooltip(e, date, _isFilled, inYear) {
  if (!inYear) return;
  const tt = document.getElementById('tooltip');
  const [y, m, d] = date.split('-');
  tt.textContent = `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
  tt.style.display = 'block';
  tt.style.left = e.clientX + 'px';
  tt.style.top = (e.clientY - 8) + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
}

// ── MODAL ──
function openModal() {
  if (habits.length >= 5) return;
  document.getElementById('color-picker').innerHTML = COLORS.map(c => `
    <div class="color-opt ${c === selectedColor ? 'selected' : ''}"
      style="background:${c}"
      data-color="${c}"
      onclick="selectColor('${c}')"
    ></div>
  `).join('');
  document.getElementById('habit-name-input').value = '';
  document.getElementById('modal').style.display = 'flex';
  initColorPickerScroll();
  setTimeout(() => document.getElementById('habit-name-input').focus(), 100);
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-title').textContent = 'New Habit';
  document.getElementById('modal-save-btn').textContent = 'CREATE →';
  document.getElementById('modal-save-btn').onclick = saveHabit;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

function initColorPickerScroll() {
  const picker    = document.getElementById('color-picker');
  const fadeLeft  = document.getElementById('fade-left');
  const fadeRight = document.getElementById('fade-right');
  if (!picker || !fadeLeft || !fadeRight) return;

  function updateFade() {
    const atStart = picker.scrollLeft <= 2;
    const atEnd   = picker.scrollLeft >= picker.scrollWidth - picker.clientWidth - 2;
    fadeLeft.style.opacity  = atStart ? '0' : '1';
    fadeRight.style.opacity = atEnd   ? '0' : '1';
  }

  picker.removeEventListener('scroll', picker._fadeHandler);
  picker._fadeHandler = updateFade;
  picker.addEventListener('scroll', updateFade);
  updateFade();
}

function selectColor(c) {
  selectedColor = c;
  document.querySelectorAll('.color-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === c);
  });
}

function openEditModal(hi) {
  const habit = habits[hi];
  selectedColor = habit.color;

  document.getElementById('color-picker').innerHTML = COLORS.map(c => `
    <div class="color-opt ${c === selectedColor ? 'selected' : ''}"
      style="background:${c}"
      data-color="${c}"
      onclick="selectColor('${c}')"
    ></div>
  `).join('');

  document.getElementById('habit-name-input').value = habit.name;
  document.getElementById('modal-title').textContent = 'Edit Habit';
  document.getElementById('modal-save-btn').textContent = 'SAVE →';
  document.getElementById('modal-save-btn').onclick = () => saveEdit(hi);
  document.getElementById('modal').style.display = 'flex';
  initColorPickerScroll();
  setTimeout(() => document.getElementById('habit-name-input').focus(), 100);
}

function saveEdit(hi) {
  const name = document.getElementById('habit-name-input').value.trim();
  if (!name) { document.getElementById('habit-name-input').focus(); return; }
  habits[hi].name = name;
  habits[hi].color = selectedColor;
  saveData();
  closeModal();
  render();
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
function exportCard(share = false, hi = 0) {
  const habit = habits[hi];
  if (!habit) return;

  const filename = `unbroken-${slugify(habit.name)}-${currentYear()}.png`;

  const canvas = document.getElementById('export-canvas');
  const ctx = canvas.getContext('2d');

  const S = 1080;

  canvas.width = S;
  canvas.height = S;

  const color = habit.color;
  const stats = calcStats(habit);

  const streak = String(stats.streak);

  const accent = color;
  const accentSoft = hexToRgba(color, 0.16);
  const accentStrong = hexToRgba(color, 0.85);

  // ─────────────────────────────
  // BACKGROUND (bold + cinematic)
  // ─────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#07080c');
  bg.addColorStop(0.5, '#0c0f18');
  bg.addColorStop(1, '#0a0b10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // strong color bloom (more “IG grab”)
  const glow = ctx.createRadialGradient(S * 0.5, S * 0.25, 0, S * 0.5, S * 0.25, S * 0.9);
  glow.addColorStop(0, accentSoft);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  // subtle grain (kept but lighter)
  const grain = ctx.createImageData(S, S);
  for (let i = 0; i < grain.data.length; i += 4) {
    const v = Math.random() * 8;
    grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = v;
    grain.data[i + 3] = 10;
  }
  ctx.putImageData(grain, 0, 0);

  // ─────────────────────────────
  // HEAVY CHAIN (uniform + intentional)
  // ─────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = hexToRgba(color, 0.9);
  ctx.lineWidth = 18;

  const startX = -120;
  const startY = 120;

  const linkW = 140;
  const linkH = 78;

  for (let i = 0; i < 10; i++) {
    const x = startX + i * 120;
    const y = startY + (i % 2 ? 40 : 0);

    ctx.beginPath();
    ctx.ellipse(x, y, linkW / 2, linkH / 2, 0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ─────────────────────────────
  // HERO TITLE (BIG + CENTERED ENERGY)
  // ─────────────────────────────
  ctx.save();

  ctx.textAlign = 'center';

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '600 22px JetBrains Mono, monospace';
  ctx.fillText('UNBROKEN', S / 2, 140);

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = accentStrong;
  ctx.shadowBlur = 40;

  ctx.font = '900 110px Inter, system-ui, sans-serif';
  ctx.fillText('UNBROKEN', S / 2, 255);

  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '500 34px "Fraunces", Georgia, serif';
  ctx.fillText(habit.name, S / 2, 305);

  ctx.restore();

  // ─────────────────────────────
  // STREAK HERO (centered anchor)
  // ─────────────────────────────
  ctx.save();

  ctx.textAlign = 'center';

  ctx.fillStyle = accent;
  ctx.shadowColor = accentStrong;
  ctx.shadowBlur = 30;

  const size = streak.length > 3 ? 220 : 260;

  ctx.font = `900 ${size}px Inter, system-ui, sans-serif`;
  ctx.fillText(streak, S / 2, 470);

  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '500 24px JetBrains Mono, monospace';
  ctx.fillText('DAY STREAK', S / 2, 510);

  ctx.restore();

  // ─────────────────────────────
  // STATS STRIP (centered, not left heavy)
  // ─────────────────────────────
  const chips = [
    `${stats.longest} BEST`,
    `${stats.total} TOTAL`,
    `${stats.rate}% RATE`
  ];

  ctx.font = '500 18px JetBrains Mono, monospace';

  let totalW = 0;
  const widths = chips.map(c => ctx.measureText(c).width + 40);
  totalW = widths.reduce((a, b) => a + b, 0) + 24 * (chips.length - 1);

  let x = (S - totalW) / 2;
  const y = 560;

  chips.forEach((c, i) => {
    const w = widths[i];

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 38, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(c, x + 18, y + 25);

    x += w + 24;
  });

  // ─────────────────────────────
  // GRID (bottom anchored, denser feel)
  // ─────────────────────────────
  const CELL = 34, GAP = 6, ROWS = 7, COLS = 16;
  const step = CELL + GAP;

  const gridW = COLS * step - GAP;
  const gridH = ROWS * step - GAP;

  const gridX = (S - gridW) / 2;
  const gridY = 640;

  const today = todayStr();
  const checked = new Set(habit.checked || []);

  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay();

  const endDate = new Date(todayDate);
  endDate.setDate(endDate.getDate() - dayOfWeek + 6);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (COLS * 7) + 1);

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {

      const d = new Date(startDate);
      d.setDate(d.getDate() + col * 7 + row);

      const ds = fmtDate(d);
      const cx = gridX + col * step;
      const cy = gridY + row * step;

      const isFilled = checked.has(ds);
      const isFuture = ds > today;

      ctx.fillStyle = isFilled
        ? hexToRgba(color, 0.55)
        : isFuture
          ? 'rgba(255,255,255,0.03)'
          : 'rgba(255,255,255,0.08)';

      ctx.beginPath();
      ctx.roundRect(cx, cy, CELL, CELL, 7);
      ctx.fill();
    }
  }

  // ─────────────────────────────
  // FOOTER (minimal + centered balance)
  // ─────────────────────────────
  ctx.save();
  ctx.textAlign = 'center';

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '400 18px JetBrains Mono, monospace';
  ctx.fillText('unbroken.fyi', S / 2, 1020);

  ctx.restore();

  // ─────────────────────────────
  // EXPORT
  // ─────────────────────────────
  canvas.toBlob(async (blob) => {
    if (share && navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `My ${habit.name} streak`,
            files: [file]
          });
          return;
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }

    if (share) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        return;
      } catch (e) {}
    }

    const link = document.createElement('a');
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
  }, 'image/png');
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const full = value.length === 3
    ? value.split('').map(ch => ch + ch).join('')
    : value;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'habit';
}

function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', (e) => {
  const typing = document.activeElement.tagName === 'INPUT';

  if ((e.key === 'n' || e.key === 'N') && !typing && !deleteMode && !editMode)
    openModal();

  if ((e.key === 'd' || e.key === 'D' || e.key === 'Backspace') && !typing && !deleteMode && !editMode && habits.length > 0)
    enterDeleteMode();

  if ((e.key === 'e' || e.key === 'E') && !typing && !deleteMode && !editMode && habits.length > 0)
    enterEditMode();

  if (e.key === 'Escape') {
    if (document.getElementById('modal').style.display !== 'none') closeModal();
    else if (deleteMode) exitDeleteMode();
    else if (editMode)   exitEditMode();
  }
});

function scrollToToday() {
  const today = todayStr();
  document.querySelectorAll('.grid-wrap').forEach(wrap => {
    const cell = wrap.querySelector(`.cell[data-date="${today}"]`);
    if (!cell) return;
    const cellRect = cell.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const scrollOffset = cellRect.left - wrapRect.left - (wrap.clientWidth / 2) + (cellRect.width / 2);
    wrap.scrollLeft += scrollOffset;
  });
}

function checkStreakRisk() {
  const today = todayStr();
  const hour  = new Date().getHours();
  habits.forEach((habit, hi) => {
    const stats   = calcStats(habit);
    const checked = new Set(habit.checked || []);
    const chip    = document.getElementById(`chip-${hi}`);
    if (!chip) return;
    const isAtRisk = stats.streak > 0 && !checked.has(today) && hour >= 17;

    chip.classList.toggle('at-risk', isAtRisk);
    chip.style.borderColor = isAtRisk ? '#ff4444' : '';
    chip.title = isAtRisk ? `Your ${habit.name} streak is at risk` : '';

    // add or remove risk label below chip
    const existingLabel = document.getElementById(`risk-label-${hi}`);
    if (isAtRisk && !existingLabel) {
      const label = document.createElement('div');
      label.className = 'risk-label';
      label.id = `risk-label-${hi}`;
      label.textContent = 'log before midnight!';
      chip.insertAdjacentElement('afterend', label);
    } else if (!isAtRisk && existingLabel) {
      existingLabel.remove();
    }
  });
}

// ── INIT ──
loadData();
render();
if (window.innerWidth <= 768 && habits.length > 0) {
  setTimeout(scrollToToday, 50);
}
