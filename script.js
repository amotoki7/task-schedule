'use strict';

/* =========================================================
   定数
   ========================================================= */
const PX_PER_MIN = 2;                              // 2px = 1分
const START_HOUR = 5;
const END_HOUR   = 24;
const START_MIN  = START_HOUR * 60;                // 300
const TOTAL_MIN  = (END_HOUR - START_HOUR) * 60;  // 1140
const TOTAL_H    = TOTAL_MIN * PX_PER_MIN;         // 2280px

const COLORS = [
  '#5c6bc0', '#e53935', '#43a047', '#fb8c00',
  '#00acc1', '#8e24aa', '#f4511e', '#039be5',
  '#558b2f', '#d81b60'
];

/* =========================================================
   状態
   ========================================================= */
let tasks    = [];
let nextId   = 0;
let colorIdx = 0;
let dragging = null;   // ドラッグ中の { task }

/* =========================================================
   初期化
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  initDate();
  buildGrid();
  loadTasks();
  updateClock();
  setInterval(updateClock, 30_000);
  scrollToNow();

  document.getElementById('add-btn')
    .addEventListener('click', addTask);
  document.getElementById('task-name')
    .addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
});

/* =========================================================
   日付・時刻
   ========================================================= */
function initDate() {
  const opts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
  document.getElementById('today-label').textContent =
    new Date().toLocaleDateString('ja-JP', opts);
}

function updateClock() {
  const now  = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();

  document.getElementById('now-badge').textContent =
    `現在  ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const line = document.getElementById('now-line');
  if (!line) return;

  if (mins < START_MIN || mins >= END_HOUR * 60) {
    line.style.display = 'none';
    return;
  }
  line.style.display = 'block';
  line.style.top = `${(mins - START_MIN) * PX_PER_MIN}px`;
}

function scrollToNow() {
  const now  = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < START_MIN) return;

  const scroll = document.getElementById('schedule-scroll');
  const topPx  = (mins - START_MIN) * PX_PER_MIN;

  requestAnimationFrame(() => {
    scroll.scrollTop = Math.max(0, topPx - scroll.clientHeight * 0.33);
  });
}

/* =========================================================
   スケジュールグリッド生成
   ========================================================= */
function buildGrid() {
  const axis = document.getElementById('time-axis');
  const area = document.getElementById('schedule-area');

  axis.style.height = `${TOTAL_H + 24}px`;
  area.style.height = `${TOTAL_H}px`;

  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (const m of [0, 30]) {
      const totalMin = h * 60 + m;
      const top      = (totalMin - START_MIN) * PX_PER_MIN;
      const label    = `${pad(h)}:${pad(m)}`;

      /* 時刻ラベル */
      appendLabel(axis, label, top);

      /* スロット */
      const slot = document.createElement('div');
      slot.className    = 'time-slot' + (m === 0 ? ' hour-line' : '');
      slot.style.top    = `${top}px`;
      slot.dataset.startMin = totalMin;
      bindSlot(slot, totalMin);
      area.appendChild(slot);
    }
  }

  /* 24:00 ラベル */
  appendLabel(axis, '24:00', TOTAL_H);

  /* 現在時刻ライン */
  const line = document.createElement('div');
  line.id = 'now-line';
  area.appendChild(line);
}

function appendLabel(parent, text, top) {
  const el = document.createElement('div');
  el.className    = 'time-label';
  el.style.top    = `${top}px`;
  el.textContent  = text;
  parent.appendChild(el);
}

function bindSlot(slot, startMin) {
  slot.addEventListener('dragover', e => {
    e.preventDefault();
    slot.classList.add('drag-over');
  });
  slot.addEventListener('dragleave', () => {
    slot.classList.remove('drag-over');
  });
  slot.addEventListener('drop', e => {
    e.preventDefault();
    slot.classList.remove('drag-over');
    if (dragging) placeBlock(dragging.task, startMin);
  });
}

/* =========================================================
   タスク管理
   ========================================================= */
function addTask() {
  const nameEl  = document.getElementById('task-name');
  const hoursEl = document.getElementById('task-hours');
  const minsEl  = document.getElementById('task-mins');

  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }

  const h   = Math.max(0, parseInt(hoursEl.value) || 0);
  const m   = Math.max(0, parseInt(minsEl.value)  || 0);
  const dur = h * 60 + m;

  if (dur <= 0) { minsEl.focus(); return; }

  const task = {
    id    : nextId++,
    name,
    dur,
    color : COLORS[colorIdx++ % COLORS.length]
  };

  tasks.push(task);
  renderRow(task);
  saveTasks();

  nameEl.value  = '';
  hoursEl.value = '0';
  minsEl.value  = '30';
  nameEl.focus();

  document.getElementById('empty-msg').style.display = 'none';
}

function renderRow(task) {
  const tbody = document.getElementById('task-tbody');
  const tr    = document.createElement('tr');
  tr.id        = `row-${task.id}`;
  tr.draggable = true;
  tr.title     = 'ドラッグしてスケジュールへ追加';

  tr.innerHTML = `
    <td>
      <span class="color-dot" style="background:${task.color}"></span>
      <span class="task-name-txt">${esc(task.name)}</span>
    </td>
    <td class="duration-cell" title="クリックして編集">${fmtDur(task.dur)}</td>
    <td><button class="del-btn" title="削除">×</button></td>
  `;

  tr.querySelector('.del-btn')
    .addEventListener('click', () => deleteTask(task.id));

  const durCell = tr.querySelector('.duration-cell');
  durCell.addEventListener('click', () => openDurationEditor(task, durCell, tr));

  tr.addEventListener('dragstart', e => {
    dragging = { task };
    e.dataTransfer.effectAllowed = 'copy';
    setTimeout(() => tr.classList.add('dragging'), 0);
  });
  tr.addEventListener('dragend', () => {
    tr.classList.remove('dragging');
    dragging = null;
  });

  tbody.appendChild(tr);
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  document.getElementById(`row-${id}`)?.remove();
  saveTasks();
  if (tasks.length === 0) {
    document.getElementById('empty-msg').style.display = '';
  }
}

function openDurationEditor(task, cell, tr) {
  if (cell.querySelector('.dur-edit')) return;

  const oldH = Math.floor(task.dur / 60);
  const oldM = task.dur % 60;

  cell.innerHTML = `
    <span class="dur-edit">
      <input class="dur-h" type="number" min="0" max="23" value="${oldH}">
      <span class="dur-unit">時間</span>
      <input class="dur-m" type="number" min="0" max="59" value="${oldM}">
      <span class="dur-unit">分</span>
    </span>
  `;

  const hInput = cell.querySelector('.dur-h');
  const mInput = cell.querySelector('.dur-m');
  tr.draggable = false;

  let done = false;

  const commit = () => {
    if (done) return;
    done = true;
    const h      = Math.max(0, parseInt(hInput.value) || 0);
    const m      = Math.max(0, parseInt(mInput.value) || 0);
    const newDur = h * 60 + m;
    if (newDur > 0) task.dur = newDur;
    cell.textContent = fmtDur(task.dur);
    tr.draggable = true;
    saveTasks();
  };

  const cancel = () => {
    if (done) return;
    done = true;
    cell.textContent = fmtDur(task.dur);
    tr.draggable = true;
  };

  [hInput, mInput].forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!cell.contains(document.activeElement)) commit();
      }, 100);
    });
  });

  hInput.focus();
  hInput.select();
}

/* =========================================================
   タスクブロック配置
   ========================================================= */
function placeBlock(task, startMin) {
  const area   = document.getElementById('schedule-area');
  const top    = (startMin - START_MIN) * PX_PER_MIN;
  const maxH   = TOTAL_H - top;
  const height = Math.max(Math.min(task.dur * PX_PER_MIN, maxH), 28);

  const endMin   = Math.min(startMin + task.dur, END_HOUR * 60);
  const startStr = `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`;
  const endStr   = endMin === 1440
    ? '24:00'
    : `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;

  const block = document.createElement('div');
  block.className = 'task-block';
  block.style.cssText =
    `top:${top}px; height:${height}px; background:${task.color};`;

  block.innerHTML = `
    <div class="block-header">
      <span class="block-name">${esc(task.name)}</span>
      <button class="block-del" title="削除">×</button>
    </div>
    <div class="block-time-label">${startStr}–${endStr}（${fmtDur(task.dur)}）</div>
  `;

  block.querySelector('.block-del')
    .addEventListener('click', () => block.remove());

  area.appendChild(block);
}

/* =========================================================
   永続化 (localStorage)
   ========================================================= */
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function loadTasks() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem('tasks'));
  } catch {
    return;
  }
  if (!Array.isArray(saved) || saved.length === 0) return;

  saved.forEach(task => {
    tasks.push(task);
    renderRow(task);
  });

  nextId   = Math.max(...tasks.map(t => t.id)) + 1;
  colorIdx = tasks.length;
  document.getElementById('empty-msg').style.display = 'none';
}

/* =========================================================
   ユーティリティ
   ========================================================= */
function fmtDur(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}分`;
  if (!m) return `${h}時間`;
  return `${h}時間${m}分`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
