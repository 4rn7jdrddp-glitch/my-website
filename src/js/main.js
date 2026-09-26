// UI behaviour: motion preference, navigation, language links, interactive sections,
// contact form / project brief and lazy loading of the 3D scene.
import { initForm } from './form.js';

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const dataEl = $('#cps-data');
const DATA = dataEl ? JSON.parse(dataEl.textContent) : null;

// A tiny event hub shared with the 3D scene.
export const state = {
  motion: root.dataset.motion !== 'off',
  region: DATA?.regions?.[0] ?? 'bes',
  service: 0,
  step: 0,
  listeners: new Set(),
  set(patch) { Object.assign(this, patch); this.listeners.forEach((fn) => fn(this, patch)); },
};

// ---------- motion ----------
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
function applyMotion(on, persist) {
  root.dataset.motion = on ? 'on' : 'off';
  $$('[data-motion-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(on));
    const s = $('.motion-state', b);
    if (s) s.textContent = on ? s.dataset.on : s.dataset.off;
  });
  if (persist) { try { localStorage.setItem('cps-motion', on ? 'on' : 'off'); } catch { /* storage unavailable */ } }
  state.set({ motion: on });
}
applyMotion(root.dataset.motion !== 'off', false);
$$('[data-motion-toggle]').forEach((b) => b.addEventListener('click', () => applyMotion(root.dataset.motion === 'off', true)));
reducedQuery.addEventListener?.('change', (e) => {
  let stored = null;
  try { stored = localStorage.getItem('cps-motion'); } catch { /* ignore */ }
  if (!stored) applyMotion(!e.matches, false);
});

// ---------- header ----------
const header = $('[data-header]');
const menuBtn = $('[data-menu-toggle]');
const navPanel = $('[data-nav-panel]');
function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', String(open));
  navPanel.classList.toggle('is-open', open);
  header.classList.toggle('menu-open', open);
  $('[data-menu-label]', menuBtn).textContent = open ? menuBtn.dataset.close : menuBtn.dataset.open;
  document.body.style.overflow = open ? 'hidden' : '';
}
menuBtn?.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
navPanel?.addEventListener('click', (e) => { if (e.target.closest('a') && menuBtn.getAttribute('aria-expanded') === 'true') setMenu(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuBtn?.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
});
matchMedia('(min-width: 1241px)').addEventListener?.('change', (e) => { if (e.matches) setMenu(false); });

function onScrollHeader() { header?.classList.toggle('is-scrolled', scrollY > 24); }
addEventListener('scroll', onScrollHeader, { passive: true });
onScrollHeader();

// Header tone follows the section underneath it; nav highlights the current section.
const sections = $$('main > section[id]');
const navLinks = $$('[data-nav]');
const navMap = { region: null, problems: null, services: 'services', audiences: 'audiences', approach: 'approach', training: null, principles: 'principles', faq: null, contact: 'contact' };
function currentSection() {
  const y = (header?.offsetHeight ?? 72) + 2;
  return sections.find((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
}
function updateCurrent() {
  const s = currentSection();
  if (header) header.dataset.tone = s?.dataset.theme === 'light' ? 'light' : 'dark';
  const id = s ? navMap[s.id] : null;
  navLinks.forEach((a) => (a.dataset.nav === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
}
addEventListener('scroll', updateCurrent, { passive: true });
updateCurrent();

// ---------- language links keep the current section ----------
$$('[data-lang-link]').forEach((a) => a.addEventListener('click', () => {
  const s = currentSection();
  const base = a.getAttribute('href').split('#')[0];
  if (s && s.id !== 'top' && !document.body.classList.contains('page-legal')) a.setAttribute('href', `${base}#${s.id}`);
}));

// ---------- reveal on scroll ----------
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el) => io.observe(el));
  root.classList.add('reveal-ready');
}

// ---------- region selector ----------
const regionBtns = $$('[data-region]');
function selectRegion(id) {
  regionBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.region === id)));
  $$('[data-region-panel]').forEach((p) => { p.hidden = p.dataset.regionPanel !== id; });
  state.set({ region: id });
}
regionBtns.forEach((b) => b.addEventListener('click', () => selectRegion(b.dataset.region)));

// ---------- scroll-tracked selections (services, process) ----------
function trackActive(items, onActive) {
  let current = -1;
  const update = () => {
    const mid = innerHeight * 0.5;
    let best = -1, bestDist = Infinity;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best >= 0 && best !== current) { current = best; onActive(best); }
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
}
function scrollToEl(el) {
  const y = el.getBoundingClientRect().top + scrollY - innerHeight * 0.5 + Math.min(el.offsetHeight, innerHeight * 0.6) / 2;
  scrollTo({ top: Math.max(0, y), behavior: root.dataset.motion === 'on' ? 'smooth' : 'auto' });
}

const serviceEls = $$('[data-service-index]');
const serviceBtns = $$('[data-service-select]');
function setService(i) {
  serviceBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
  serviceEls.forEach((el, j) => el.classList.toggle('is-active', i === j));
  state.set({ service: i });
}
if (serviceEls.length) trackActive(serviceEls, setService);
serviceBtns.forEach((b) => b.addEventListener('click', () => {
  const i = +b.dataset.serviceSelect;
  setService(i);
  scrollToEl(serviceEls[i]);
}));

const stepEls = $$('[data-step-index]');
const stepBtns = $$('[data-step-select]');
const phaseProgress = $('[data-phase-progress]');
function setStep(i) {
  stepBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
  stepEls.forEach((el, j) => el.classList.toggle('is-active', i === j));
  phaseProgress?.style.setProperty('--progress', String((i + 1) / stepEls.length));
  state.set({ step: i });
}
if (stepEls.length) trackActive(stepEls, setStep);
stepBtns.forEach((b) => b.addEventListener('click', () => {
  const i = +b.dataset.stepSelect;
  setStep(i);
  scrollToEl(stepEls[i]);
}));

// ---------- principles: activate in sequence while scrolling ----------
const principleList = $('[data-principles]');
if (principleList) {
  const items = $$('[data-principle]', principleList);
  const update = () => {
    const r = principleList.getBoundingClientRect();
    const line = innerHeight * 0.62;
    const fill = Math.min(1, Math.max(0, (line - r.top - 40) / (r.height - 80)));
    principleList.style.setProperty('--fill', fill.toFixed(3));
    items.forEach((el) => el.classList.toggle('is-active', el.getBoundingClientRect().top + 36 < line));
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
}

// ---------- contact ----------
if (DATA) initForm(DATA);

// ---------- 3D scene (lazy) ----------
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
const canvas = $('[data-canvas]');
const saveData = navigator.connection?.saveData === true;
if (canvas && DATA && webglAvailable() && !saveData) {
  const start = () => import('./scene.js')
    .then((m) => m.startScene({ canvas, labels: $('[data-labels]'), data: DATA, state }))
    .then(() => root.classList.add('webgl-ready'))
    .catch((err) => { console.warn('3D scene unavailable, showing static map.', err); });
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  if (document.readyState === 'complete') idle(start, { timeout: 1500 });
  else addEventListener('load', () => idle(start, { timeout: 1500 }), { once: true });
}
