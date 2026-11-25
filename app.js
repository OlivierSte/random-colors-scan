'use strict';

// Ordered from most to least distinct: choosing N uses the first N.
const PALETTE = [
  { name: 'Red',    hex: '#FF0000' },
  { name: 'Yellow', hex: '#FFE600' },
  { name: 'Green',  hex: '#00C800' },
  { name: 'Blue',   hex: '#0050FF' },
  { name: 'White',  hex: '#FFFFFF' },
  { name: 'Black',  hex: '#000000' },
  { name: 'Orange', hex: '#FF8000' },
  { name: 'Purple', hex: '#8A2BE2' },
  { name: 'Pink',   hex: '#FF5EC4' },
  { name: 'Cyan',   hex: '#00E5FF' },
  { name: 'Brown',  hex: '#7B4A1E' },
  { name: 'Grey',   hex: '#808080' },
];

// Interval choices in seconds (slider steps through these).
const INTERVALS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20, 30, 45, 60];
const PRESETS = [0.5, 1, 2, 5, 10];

const STORAGE_KEY = 'random-colors-settings';
const DEFAULTS = { count: 4, interval: 2 };

const $ = (id) => document.getElementById(id);
const els = {
  setup: $('setup'), display: $('display'), pause: $('pause'), pauseInfo: $('pauseInfo'),
  count: $('count'), countOut: $('countOut'), swatches: $('swatches'),
  interval: $('interval'), intervalOut: $('intervalOut'), presets: $('presets'),
  start: $('start'), resume: $('resume'), quit: $('quit'),
};

// ---------- Settings ----------
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && Number.isFinite(s.count) && Number.isFinite(s.interval)) return s;
  } catch (_) { /* ignore */ }
  return { ...DEFAULTS };
}

function saveSettings(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) { /* ignore */ }
}

const fmtInterval = (s) => (s < 1 ? `${s * 1000} ms` : `${s} s`);

function nearestIntervalIndex(sec) {
  let best = 0;
  INTERVALS.forEach((v, i) => { if (Math.abs(v - sec) < Math.abs(INTERVALS[best] - sec)) best = i; });
  return best;
}

let settings = loadSettings();

function renderSetup() {
  els.count.max = PALETTE.length;
  els.count.value = settings.count;
  els.countOut.textContent = settings.count;
  els.swatches.innerHTML = '';
  PALETTE.slice(0, settings.count).forEach((c) => {
    const d = document.createElement('div');
    d.className = 'swatch';
    d.style.background = c.hex;
    d.title = c.name;
    els.swatches.appendChild(d);
  });

  els.interval.max = INTERVALS.length - 1;
  els.interval.value = nearestIntervalIndex(settings.interval);
  els.intervalOut.textContent = fmtInterval(settings.interval);
  [...els.presets.children].forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.sec) === settings.interval);
  });
}

PRESETS.forEach((sec) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.sec = sec;
  b.textContent = fmtInterval(sec);
  b.addEventListener('click', () => update({ interval: sec }));
  els.presets.appendChild(b);
});

function update(patch) {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  renderSetup();
}

els.count.addEventListener('input', () => update({ count: Number(els.count.value) }));
els.interval.addEventListener('input', () => update({ interval: INTERVALS[Number(els.interval.value)] }));

// ---------- Running ----------
let timer = null;
let currentIndex = -1;
let paused = false;
let wakeLock = null;

function pickNext() {
  const n = settings.count;
  if (n < 2) return 0;
  // Pick among the other n-1 colors so the same color never repeats twice in a row.
  let i = Math.floor(Math.random() * (n - 1));
  if (currentIndex >= 0 && i >= currentIndex) i += 1;
  return i;
}

function showNext() {
  currentIndex = pickNext();
  els.display.style.background = PALETTE[currentIndex].hex;
}

function startTimer() {
  stopTimer();
  timer = setInterval(showNext, settings.interval * 1000);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (_) { /* not supported or denied */ }
}

function releaseWakeLock() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

function start() {
  saveSettings(settings);
  currentIndex = -1;
  paused = false;
  els.setup.classList.add('hidden');
  els.display.classList.remove('hidden');
  els.pause.classList.add('hidden');
  const root = document.documentElement;
  if (root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().catch(() => {});
  requestWakeLock();
  showNext();
  startTimer();
}

function pause() {
  if (paused) return;
  paused = true;
  stopTimer();
  els.pauseInfo.textContent =
    `${PALETTE[currentIndex].name} · ${settings.count} colors · every ${fmtInterval(settings.interval)}`;
  els.pause.classList.remove('hidden');
}

function resume() {
  paused = false;
  els.pause.classList.add('hidden');
  requestWakeLock();
  showNext();
  startTimer();
}

function quit() {
  stopTimer();
  paused = false;
  releaseWakeLock();
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  els.display.classList.add('hidden');
  els.pause.classList.add('hidden');
  els.setup.classList.remove('hidden');
  renderSetup();
}

els.start.addEventListener('click', start);
els.display.addEventListener('click', (e) => { if (e.target === els.display) pause(); });
els.resume.addEventListener('click', (e) => { e.stopPropagation(); resume(); });
els.quit.addEventListener('click', (e) => { e.stopPropagation(); quit(); });

// Pause automatically if the app goes to the background (Resume re-acquires the wake lock).
document.addEventListener('visibilitychange', () => {
  if (els.display.classList.contains('hidden')) return;
  if (document.hidden) pause();
});

renderSetup();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
