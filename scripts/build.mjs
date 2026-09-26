// Static site generator: renders every language from src/i18n into docs/ (GitHub Pages ready),
// bundles the scripts with esbuild and copies fonts and data.
import fs from 'node:fs';
import path from 'node:path';
import { build as esbuild } from 'esbuild';
import config from '../src/config.js';
import { BONAIRE, REGIONS } from '../src/data/places.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'docs');
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/map.json'), 'utf8'));
const LANGS = config.languages;
const T = Object.fromEntries(await Promise.all(LANGS.map(async (l) => [l, (await import(`../src/i18n/${l}.js`)).default])));
const YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = (n) => String(n).padStart(2, '0');
const abs = (p) => (config.siteUrl ? config.siteUrl + p : p);
const project = ([lon, lat]) => [+((lon - MAP.lon0) * MAP.cos).toFixed(3), +(-(lat - MAP.lat0)).toFixed(3)];
const B = project(BONAIRE);
const targets = Object.entries(REGIONS).flatMap(([region, pts]) => pts.map((p) => ({ region, p: project(p) })));

// ---------- static SVG map (fallback without WebGL/JS) ----------
function svgMap(t) {
  const S = 20;
  const { x0, x1, z0, z1 } = MAP.size;
  const X = (x) => ((x - x0) * S).toFixed(1);
  const Y = (z) => ((z - z0) * S).toFixed(1);
  const w = ((x1 - x0) * S).toFixed(0), h = ((z1 - z0) * S).toFixed(0);
  const land = (kind) => MAP.hi.filter((p) => p.k === kind).map((p) => {
    let d = '';
    for (let i = 0; i < p.r.length; i += 2) d += (i ? 'L' : 'M') + X(p.r[i]) + ' ' + Y(p.r[i + 1]);
    return d + 'Z';
  }).join('');
  const grat = [];
  for (let lon = -90; lon <= -54; lon += 5) { const [x] = project([lon, 0]); grat.push(`M${X(x)} 0V${h}`); }
  for (let lat = 5; lat <= 25; lat += 5) { const [, z] = project([0, lat]); grat.push(`M0 ${Y(z)}H${w}`); }
  const arcs = targets.map(({ p }) => {
    const mx = (B[0] + p[0]) / 2, mz = (B[1] + p[1]) / 2, d = Math.hypot(p[0] - B[0], p[1] - B[1]);
    return `M${X(B[0])} ${Y(B[1])}Q${X(mx)} ${Y(mz - d * 0.35)} ${X(p[0])} ${Y(p[1])}`;
  }).join('');
  const dots = targets.map(({ p }) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.2"/>`).join('');
  return `<svg class="stage-fallback" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t.ui.mapAlt)}" focusable="false">
<defs><radialGradient id="glow"><stop offset="0" stop-color="#F26A36" stop-opacity=".55"/><stop offset="1" stop-color="#F26A36" stop-opacity="0"/></radialGradient>
<radialGradient id="sea" cx="${(((B[0] - x0) / (x1 - x0)) * 100).toFixed(1)}%" cy="${(((B[1] - z0) / (z1 - z0)) * 100).toFixed(1)}%" r="70%"><stop offset="0" stop-color="#103746"/><stop offset="1" stop-color="#071E28"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="url(#sea)"/>
<path d="${grat.join('')}" stroke="#24565B" stroke-opacity=".35" stroke-width="1" fill="none"/>
<path d="${land('m')}" fill="#15424A"/>
<path d="${land('i')}" fill="#2E6A6E"/>
<path d="${arcs}" fill="none" stroke="#FFB68E" stroke-opacity=".55" stroke-width="1.4"/>
<g fill="#FFB68E">${dots}</g>
<circle cx="${X(B[0])}" cy="${Y(B[1])}" r="42" fill="url(#glow)"/>
<path d="${land('b')}" fill="#F26A36" stroke="#F26A36" stroke-width="2"/>
</svg>`;
}

// ---------- shared fragments ----------
const logo = (t, base) => `<a class="brand" href="${base}${t.meta.lang}/#top" aria-label="${esc(t.ui.home)}">
  <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" stroke-opacity=".45"/><path d="M6 25c6-5 11-7 14-7s8 2 14 7" fill="none" stroke="currentColor" stroke-opacity=".45"/><circle cx="20" cy="18" r="4.2" fill="#F26A36"/></svg>
  <span class="brand-name">Caribbean Public Solutions</span></a>`;

function langSwitch(t, pathFor, cls = '') {
  return `<ul class="lang-switch ${cls}" aria-label="${esc(t.ui.langLabel)}">${LANGS.map((l) => {
    const m = T[l].meta;
    const cur = l === t.meta.lang;
    return `<li><a href="${pathFor(l)}" hreflang="${l}" lang="${l}" data-lang-link${cur ? ' aria-current="true"' : ''} title="${esc(m.name)}"><span aria-hidden="true">${m.short}</span><span class="sr-only">${esc(m.name)}${cur ? ` (${esc(t.ui.langCurrent)})` : ''}</span></a></li>`;
  }).join('')}</ul>`;
}

const motionToggle = (t) => `<button type="button" class="motion-toggle" data-motion-toggle aria-pressed="true" title="${esc(t.ui.motionHint)}">
  <span class="motion-icon" aria-hidden="true"></span><span class="motion-label" data-label="${esc(t.ui.motion)}">${esc(t.ui.motion)}:</span> <span class="motion-state" data-on="${esc(t.ui.motionOn)}" data-off="${esc(t.ui.motionOff)}">${esc(t.ui.motionOn)}</span></button>`;

function head(t, { title, description, pathOf, base, pageLang }) {
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(pathOf(l))}">`).join('\n');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Caribbean Public Solutions',
    description: t.meta.description,
    address: { '@type': 'PostalAddress', addressLocality: 'Bonaire', addressCountry: 'BQ' },
    areaServed: { '@type': 'Place', name: 'Caribbean' },
    knowsAbout: t.services.items.map((s) => s.name),
    ...(config.siteUrl ? { url: config.siteUrl + '/' } : {}),
  };
  return `<!doctype html>
<html lang="${pageLang}" class="no-js" data-motion="on">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#071E28">
<meta name="color-scheme" content="dark light">
${config.siteUrl ? `<link rel="canonical" href="${abs(pathOf(t.meta.lang))}">` : ''}
${alternates}
<link rel="alternate" hreflang="x-default" href="${abs(pathOf(config.defaultLanguage))}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Caribbean Public Solutions">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:locale" content="${t.meta.locale}">
${config.siteUrl ? `<meta property="og:url" content="${abs(pathOf(t.meta.lang))}">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${base}assets/fonts/fraunces-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}assets/fonts/inter-tight-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}assets/css/site.css">
<script>document.documentElement.classList.replace('no-js','js');try{var m=localStorage.getItem('cps-motion');if(m==='off'||(!m&&matchMedia('(prefers-reduced-motion: reduce)').matches))document.documentElement.dataset.motion='off'}catch(e){if(matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.motion='off'}</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

function header(t, base, pathFor, { home = true } = {}) {
  const link = (id, label) => `<li><a href="${home ? '' : `${base}${t.meta.lang}/`}#${id}" data-nav="${id}">${esc(label)}</a></li>`;
  return `<a class="skip-link" href="#main">${esc(t.ui.skip)}</a>
<header class="site-header" data-header>
  <div class="header-inner">
    ${logo(t, base)}
    <nav class="main-nav" aria-label="${esc(t.ui.mainNav)}" id="main-nav" data-nav-panel>
      <ul class="nav-links">
        ${link('services', t.nav.services)}${link('audiences', t.nav.audiences)}${link('approach', t.nav.approach)}${link('principles', t.nav.principles)}${link('contact', t.nav.contact)}
      </ul>
      <div class="nav-tools">
        ${langSwitch(t, pathFor)}
        ${motionToggle(t)}
      </div>
    </nav>
    <a class="btn btn-primary btn-sm header-cta" href="${home ? '' : `${base}${t.meta.lang}/`}#contact">${esc(t.nav.cta)}</a>
    <button type="button" class="menu-toggle" aria-expanded="false" aria-controls="main-nav" data-menu-toggle data-open="${esc(t.ui.menuOpen)}" data-close="${esc(t.ui.menuClose)}">
      <span class="sr-only" data-menu-label>${esc(t.ui.menuOpen)}</span><span class="menu-bars" aria-hidden="true"><span></span><span></span></span>
    </button>
  </div>
</header>`;
}

function footer(t, base, pathFor) {
  const home = `${base}${t.meta.lang}/`;
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      ${logo(t, base)}
      <p class="footer-tagline">${esc(t.footer.tagline)}</p>
      <p class="footer-base">${esc(t.footer.base)}</p>
    </div>
    <nav class="footer-nav" aria-label="${esc(t.footer.navTitle)}">
      <h2 class="footer-title">${esc(t.footer.navTitle)}</h2>
      <ul>
        <li><a href="${home}#services">${esc(t.nav.services)}</a></li>
        <li><a href="${home}#audiences">${esc(t.nav.audiences)}</a></li>
        <li><a href="${home}#approach">${esc(t.nav.approach)}</a></li>
        <li><a href="${home}#training">${esc(t.training.kicker)}</a></li>
        <li><a href="${home}#principles">${esc(t.nav.principles)}</a></li>
        <li><a href="${home}#faq">${esc(t.faq.title)}</a></li>
        <li><a href="${home}#contact">${esc(t.nav.contact)}</a></li>
      </ul>
    </nav>
    <div class="footer-meta">
      <h2 class="footer-title">${esc(t.footer.langTitle)}</h2>
      ${langSwitch(t, pathFor, 'lang-switch-footer')}
      ${motionToggle(t)}
      <p><a href="${base}${t.meta.lang}/privacy/">${esc(t.footer.legal)}</a></p>
    </div>
  </div>
  <div class="wrap footer-bottom">
    <p>© ${YEAR} Caribbean Public Solutions. ${esc(t.footer.rights)}</p>
    <p>${esc(t.footer.mapCredit)}</p>
  </div>
</footer>`;
}

const sectionHead = (kicker, title, intro, id, extra = '') => `<header class="section-head ${extra}">
  <p class="kicker">${esc(kicker)}</p>
  <h2 id="${id}-title" class="section-title">${esc(title)}</h2>
  ${intro ? `<p class="section-intro">${esc(intro)}</p>` : ''}
</header>`;

// ---------- home page ----------
function home(t) {
  const L = t.meta.lang;
  const base = '../';
  const pathOf = (l) => `/${l}/`;
  const pathFor = (l) => `../${l}/`;
  const c = t.contact;

  const heroTitle = `<h1 class="hero-title"><span class="hero-line hero-line-1">${esc(t.hero.line1)}</span> <span class="hero-line hero-line-2">${esc(t.hero.line2)}</span></h1>`;

  const regionButtons = t.region.regions.map((r, i) => `<li><button type="button" class="region-btn" data-region="${r.id}" aria-pressed="${i === 0}" aria-controls="region-detail">
      <span class="region-dot" aria-hidden="true"></span>${esc(r.name)}</button></li>`).join('');

  const regionPanels = t.region.regions.map((r, i) => `<div class="region-panel" data-region-panel="${r.id}"${i === 0 ? '' : ' hidden'}>
      <h4 class="region-panel-title">${esc(r.name)}</h4><p>${esc(r.text)}</p></div>`).join('');

  const problems = t.problems.items.map((p, i) => `<li class="problem reveal">
      <span class="problem-num" aria-hidden="true">${pad(i + 1)}</span>
      <h3 class="problem-title">${esc(p.t)}</h3>
      <div class="problem-body">
        <p class="problem-challenge"><span class="label">${esc(t.problems.challengeLabel)}</span>${esc(p.p)}</p>
        <p class="problem-help"><span class="label label-accent">${esc(t.problems.helpLabel)}</span>${esc(p.h)}</p>
      </div>
    </li>`).join('');

  const services = t.services.items.map((s, i) => `<article class="service" id="service-${s.id}" data-service-index="${i}" aria-labelledby="service-${s.id}-title">
      <p class="service-num"><span aria-hidden="true">${pad(i + 1)}</span><span class="service-count" aria-hidden="true"> / 04</span></p>
      <h3 class="service-title" id="service-${s.id}-title">${esc(s.name)}</h3>
      <p class="service-text">${esc(s.text)}</p>
      <p class="service-points-label">${esc(t.services.pointsLabel)}</p>
      <ul class="service-points">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <div class="service-outcome"><p class="label label-accent">${esc(t.services.outcomeLabel)}</p><p>${esc(s.outcome)}</p></div>
      <p class="service-layer"><span class="layer-icon" aria-hidden="true"></span><span><strong>${esc(t.services.layerLabel)}:</strong> ${esc(s.layer)}</span></p>
      <a class="btn btn-ghost" href="#contact" data-service-cta="${i}">${esc(s.cta)}<span class="btn-arrow" aria-hidden="true">→</span></a>
    </article>`).join('');

  const serviceNav = t.services.items.map((s, i) => `<li><button type="button" class="index-btn" data-service-select="${i}" aria-pressed="${i === 0}" aria-describedby="service-select-hint">
      <span class="index-num" aria-hidden="true">${pad(i + 1)}</span><span>${esc(s.name)}</span></button></li>`).join('');

  const steps = t.process.steps.map((s, i) => `<li class="step" id="phase-${s.id}" data-step-index="${i}">
      <p class="step-num"><span class="sr-only">${esc(t.process.phaseLabel)} </span>${pad(i + 1)}</p>
      <h3 class="step-title">${esc(s.name)}</h3>
      <p class="step-text">${esc(s.text)}</p>
      <p class="step-result"><span class="label label-accent">${esc(t.process.resultLabel)}</span>${esc(s.result)}</p>
    </li>`).join('');

  const stepNav = t.process.steps.map((s, i) => `<li><button type="button" class="phase-btn" data-step-select="${i}" aria-pressed="${i === 0}">
      <span class="phase-num" aria-hidden="true">${pad(i + 1)}</span><span class="phase-name">${esc(s.name)}</span></button></li>`).join('');

  const field = (id, label, input, hint = '') => `<div class="field">
      <label for="f-${id}">${esc(label)}</label>
      ${hint ? `<p class="field-hint" id="f-${id}-hint">${esc(hint)}</p>` : ''}
      ${input}
      <p class="field-error" id="f-${id}-err" hidden></p>
    </div>`;
  const opts = (list) => `<option value="">${esc(c.fields.select)}</option>` + list.map((o) => `<option>${esc(o)}</option>`).join('');

  const clientData = {
    lang: L,
    endpoint: config.contactEndpoint,
    assets: base + 'assets/',
    bonaire: B,
    bonaireLabel: t.ui.bonaire,
    targets,
    regions: t.region.regions.map((r) => r.id),
    serviceOptions: c.serviceOptions,
    contact: {
      errors: c.errors, briefHeading: c.briefHeading, briefDate: c.briefDate, fileName: c.fileName,
      copied: c.copied, copyFailed: c.copyFailed, downloaded: c.downloaded, sending: c.sending, sent: c.sent,
      submitBrief: c.submitBrief, submitSend: c.submitSend, fields: c.fields,
    },
    ui: { menuOpen: t.ui.menuOpen, menuClose: t.ui.menuClose },
  };

  return `${head(t, { title: t.meta.title, description: t.meta.description, pathOf, base, pageLang: L })}
<body class="page-home">
${header(t, base, pathFor)}
<div class="stage" aria-hidden="true" data-stage>
  ${svgMap(t)}
  <canvas class="stage-canvas" data-canvas></canvas>
  <div class="stage-labels" data-labels></div>
  <div class="stage-vignette"></div>
</div>

<main id="main" tabindex="-1">

<section id="top" class="hero scene" data-scene="hero" aria-labelledby="hero-title">
  <div class="wrap hero-inner">
    <p class="eyebrow reveal-hero"><span class="eyebrow-dot" aria-hidden="true"></span>${esc(t.hero.eyebrow)}</p>
    <div id="hero-title" class="reveal-hero">${heroTitle}</div>
    <p class="hero-sub reveal-hero">${esc(t.hero.sub)}</p>
    <div class="hero-bottom reveal-hero">
      <p class="hero-lead">${esc(t.hero.lead)}</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#contact">${esc(t.hero.cta1)}<span class="btn-arrow" aria-hidden="true">→</span></a>
        <a class="btn btn-outline" href="#services">${esc(t.hero.cta2)}</a>
      </div>
    </div>
    <ul class="hero-tags reveal-hero">${t.hero.tags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
  <a class="scroll-cue" href="#region"><span class="scroll-line" aria-hidden="true"></span>${esc(t.hero.scroll)}</a>
</section>

<section id="region" class="region scene" data-scene="region" aria-labelledby="region-title">
  <div class="wrap region-grid">
    <div class="region-copy panel-dark">
      ${sectionHead(t.region.kicker, t.region.title, '', 'region')}
      ${t.region.paras.map((p) => `<p class="lede">${esc(p)}</p>`).join('')}
      <p class="map-note"><span class="map-note-line" aria-hidden="true"></span>${esc(t.region.note)}</p>
      <div class="region-selector">
        <h3 class="mini-title" id="region-selector-title">${esc(t.region.selectorTitle)}</h3>
        <p class="mini-hint">${esc(t.region.selectorHint)}</p>
        <ul class="region-list" aria-labelledby="region-selector-title">${regionButtons}</ul>
        <div id="region-detail" class="region-detail" aria-live="polite">${regionPanels}</div>
      </div>
    </div>
  </div>
  <div class="wrap factors panel-dark">
    <h3 class="mini-title">${esc(t.region.factorsTitle)}</h3>
    <ul class="factor-list">${t.region.factors.map((f, i) => `<li class="factor reveal"><span class="factor-num" aria-hidden="true">${pad(i + 1)}</span><h4>${esc(f.t)}</h4><p>${esc(f.d)}</p></li>`).join('')}</ul>
  </div>
</section>

<section id="problems" class="section light problems" aria-labelledby="problems-title" data-theme="light">
  <div class="wrap">
    ${sectionHead(t.problems.kicker, t.problems.title, t.problems.intro, 'problems', 'head-split')}
    <ol class="problem-list">${problems}</ol>
  </div>
</section>

<section id="services" class="services scene" data-scene="services" aria-labelledby="services-title">
  <div class="wrap">
    <div class="services-head panel-dark">${sectionHead(t.services.kicker, t.services.title, t.services.intro, 'services')}</div>
    <div class="services-grid">
      <div class="services-index">
        <p class="sr-only" id="service-select-hint">${esc(t.services.selectLabel)}</p>
        <ul class="index-list">${serviceNav}</ul>
      </div>
      <div class="services-list">${services}</div>
    </div>
  </div>
</section>

<section id="audiences" class="section light audiences" aria-labelledby="audiences-title" data-theme="light">
  <div class="wrap">
    ${sectionHead(t.audiences.kicker, t.audiences.title, t.audiences.intro, 'audiences', 'head-split')}
    <div class="aud-grid">
      <div class="aud-col">
        <h3 class="aud-title">${esc(t.audiences.orgsTitle)}</h3>
        <ul class="aud-list">${t.audiences.orgs.map((o) => `<li class="reveal"><h4>${esc(o.t)}</h4><p>${esc(o.d)}</p></li>`).join('')}</ul>
      </div>
      <div class="aud-col">
        <h3 class="aud-title">${esc(t.audiences.rolesTitle)}</h3>
        <ul class="aud-list aud-roles">${t.audiences.roles.map((o) => `<li class="reveal"><h4>${esc(o.t)}</h4><p>${esc(o.d)}</p></li>`).join('')}</ul>
      </div>
    </div>
  </div>
</section>

<section id="approach" class="process scene" data-scene="process" aria-labelledby="approach-title">
  <div class="wrap process-grid">
    <div class="process-copy">
      <div class="panel-dark">${sectionHead(t.process.kicker, t.process.title, t.process.intro, 'approach')}</div>
      <nav class="phase-nav" aria-label="${esc(t.process.navLabel)}">
        <div class="phase-track" aria-hidden="true"><span class="phase-progress" data-phase-progress></span></div>
        <ul>${stepNav}</ul>
      </nav>
      <ol class="step-list">${steps}</ol>
      <p class="compliance panel-dark"><span class="compliance-mark" aria-hidden="true">§</span>${esc(t.process.compliance)}</p>
    </div>
  </div>
</section>

<section id="training" class="section light training" aria-labelledby="training-title" data-theme="light">
  <div class="wrap training-grid">
    <div class="training-intro">
      ${sectionHead(t.training.kicker, t.training.title, t.training.intro, 'training')}
      <div class="training-for">
        <p class="label">${esc(t.training.audienceTitle)}</p>
        <ul class="pill-list">${t.training.audience.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      </div>
      <p class="training-note">${esc(t.training.note)}</p>
      <a class="btn btn-primary" href="#contact" data-service-cta="3">${esc(t.training.cta)}<span class="btn-arrow" aria-hidden="true">→</span></a>
    </div>
    <div class="training-modules">
      <h3 class="mini-title">${esc(t.training.modulesTitle)}</h3>
      <ol class="module-list">${t.training.modules.map((m, i) => `<li class="module reveal"><span class="module-num" aria-hidden="true">${pad(i + 1)}</span><div><h4>${esc(m.t)}</h4><p>${esc(m.d)}</p></div></li>`).join('')}</ol>
    </div>
  </div>
</section>

<section id="principles" class="section principles" aria-labelledby="principles-title">
  <div class="wrap principles-grid">
    <div class="principles-head">${sectionHead(t.principles.kicker, t.principles.title, t.principles.intro, 'principles')}</div>
    <ol class="principle-list" data-principles>
      ${t.principles.items.map((p, i) => `<li class="principle" data-principle>
        <span class="principle-num" aria-hidden="true">${i + 1}</span>
        <div class="principle-body"><h3 class="principle-title">${esc(p.t)}</h3><p class="principle-q">${esc(p.q)}</p></div>
      </li>`).join('')}
    </ol>
  </div>
</section>

<section id="faq" class="section light faq" aria-labelledby="faq-title" data-theme="light">
  <div class="wrap faq-grid">
    ${sectionHead(t.faq.kicker, t.faq.title, '', 'faq')}
    <div class="faq-list">${t.faq.items.map((f) => `<details class="faq-item"><summary><span>${esc(f.q)}</span><span class="faq-icon" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`).join('')}</div>
  </div>
</section>

<section id="contact" class="contact scene" data-scene="contact" aria-labelledby="contact-title">
  <div class="wrap contact-grid">
    <div class="contact-copy panel-dark">
      <p class="kicker">${esc(c.kicker)}</p>
      <h2 id="contact-title" class="contact-title">${esc(c.title)}</h2>
      <p class="lede">${esc(c.text)}</p>
      <h3 class="mini-title">${esc(c.nextTitle)}</h3>
      <ol class="next-list">${c.next.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>
    </div>
    <div class="contact-card">
      <form id="brief-form" class="brief-form" novalidate data-mode="${config.contactEndpoint ? 'send' : 'brief'}" aria-labelledby="form-title">
        <h3 id="form-title" class="form-title">${esc(c.formTitle)}</h3>
        ${config.contactEndpoint ? '' : `<p class="form-notice"><span class="notice-icon" aria-hidden="true">i</span>${esc(c.briefNotice)}</p>`}
        <noscript><p class="form-notice">${esc(t.ui.noscriptForm)}</p></noscript>
        <p class="form-required">${esc(c.requiredNote)}</p>
        <div class="error-summary" data-error-summary tabindex="-1" hidden><p>${esc(c.errors.summary)}</p><ul></ul></div>
        <div class="form-grid">
          ${field('name', c.fields.name, `<input id="f-name" name="name" type="text" autocomplete="name" required maxlength="120" aria-describedby="f-name-err">`)}
          ${field('organization', c.fields.organization, `<input id="f-organization" name="organization" type="text" autocomplete="organization" required maxlength="160" aria-describedby="f-organization-err">`)}
          ${field('email', c.fields.email, `<input id="f-email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="160" aria-describedby="f-email-err">`)}
          ${field('region', c.fields.region, `<select id="f-region" name="region" required aria-describedby="f-region-err">${opts(c.regionOptions)}</select>`)}
          ${field('service', c.fields.service, `<select id="f-service" name="service" required aria-describedby="f-service-err">${opts(c.serviceOptions)}</select>`)}
          ${field('description', c.fields.description, `<textarea id="f-description" name="description" rows="5" required minlength="20" maxlength="4000" aria-describedby="f-description-hint f-description-err"></textarea>`, c.fields.descriptionHint)}
        </div>
        <div class="hp" aria-hidden="true"><label for="f-website">${esc(c.fields.honeypot)}</label><input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        <button type="submit" class="btn btn-primary btn-block">${esc(config.contactEndpoint ? c.submitSend : c.submitBrief)}<span class="btn-arrow" aria-hidden="true">→</span></button>
        <p class="form-status" role="status" aria-live="polite" data-form-status></p>
      </form>
      <div class="brief-output" data-brief-output hidden tabindex="-1" aria-labelledby="brief-title">
        <h3 id="brief-title" class="form-title">${esc(c.briefTitle)}</h3>
        <p class="brief-status"><span class="status-dot" aria-hidden="true"></span>${esc(c.briefStatus)}</p>
        <pre class="brief-text" data-brief-text tabindex="0"></pre>
        <div class="brief-actions">
          <button type="button" class="btn btn-primary" data-brief-copy>${esc(c.copy)}</button>
          <button type="button" class="btn btn-outline-dark" data-brief-download>${esc(c.download)}</button>
          <button type="button" class="btn btn-link" data-brief-edit>${esc(c.edit)}</button>
        </div>
        <p class="form-status" role="status" aria-live="polite" data-brief-status></p>
      </div>
    </div>
  </div>
</section>

</main>
${footer(t, base, pathFor)}
<script type="application/json" id="cps-data">${JSON.stringify(clientData).replace(/</g, '\\u003c')}</script>
<script type="module" src="${base}assets/js/main.js"></script>
</body>
</html>
`;
}

// ---------- legal page ----------
function legal(t) {
  const L = t.meta.lang;
  const base = '../../';
  const pathOf = (l) => `/${l}/privacy/`;
  const pathFor = (l) => `../../${l}/privacy/`;
  return `${head(t, { title: t.meta.legalTitle, description: t.meta.legalDescription, pathOf, base, pageLang: L })}
<body class="page-legal">
${header(t, base, pathFor, { home: false })}
<main id="main" tabindex="-1" class="legal">
  <div class="wrap legal-wrap">
    <p class="kicker"><a href="${base}${L}/">← ${esc(t.legal.back)}</a></p>
    <h1 class="legal-title">${esc(t.legal.title)}</h1>
    <p class="legal-updated">${esc(t.legal.updated)}: <time datetime="${TODAY}">${TODAY}</time></p>
    ${t.legal.sections.map((s) => `<section class="legal-section"><h2>${esc(s.h)}</h2>${s.p.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`).join('')}
  </div>
</main>
${footer(t, base, pathFor)}
<script type="module" src="${base}assets/js/main.js"></script>
</body>
</html>
`;
}

// ---------- root language gateway ----------
function root() {
  const t = T[config.defaultLanguage];
  const links = LANGS.map((l) => `<li><a href="${l}/" hreflang="${l}" lang="${l}">${esc(T[l].meta.name)}</a></li>`).join('');
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(`/${l}/`)}">`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Caribbean Public Solutions</title>
<meta name="description" content="${esc(t.meta.description)}">
<meta name="theme-color" content="#071E28">
${alternates}
<link rel="alternate" hreflang="x-default" href="${abs('/')}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/site.css">
<script>
(function(){var langs=${JSON.stringify(LANGS)},pick='${config.defaultLanguage}';
try{var list=navigator.languages||[navigator.language];for(var i=0;i<list.length;i++){var c=String(list[i]).toLowerCase().split('-')[0];if(langs.indexOf(c)>-1){pick=c;break}}}catch(e){}
location.replace(pick+'/'+location.hash);})();
</script>
</head>
<body class="page-gateway">
<main class="gateway">
  <p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>Caribbean Public Solutions</p>
  <p class="gateway-lead">${esc(t.hero.sub)}</p>
  <ul class="gateway-langs">${links}</ul>
</main>
</body>
</html>
`;
}

// ---------- write everything ----------
function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function copy(from, to) {
  const dest = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, from), dest);
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const l of LANGS) {
  write(`${l}/index.html`, home(T[l]));
  write(`${l}/privacy/index.html`, legal(T[l]));
}
write('index.html', root());
write('404.html', root().replace('location.replace(pick+\'/\'+location.hash)', 'void 0'));
write('.nojekyll', '');
write('robots.txt', `User-agent: *\nAllow: /\n${config.siteUrl ? `Sitemap: ${config.siteUrl}/sitemap.xml\n` : ''}`);
if (config.siteUrl) {
  const urls = LANGS.flatMap((l) => [`/${l}/`, `/${l}/privacy/`]);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.map((u) => `<url><loc>${abs(u)}</loc>${LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(u.replace(/^\/[a-z]+\//, `/${l}/`))}"/>`).join('')}</url>`).join('\n')}\n</urlset>\n`);
}

// assets
copy('src/css/site.css', 'assets/css/site.css');
copy('src/favicon.svg', 'assets/favicon.svg');
const fonts = [
  ['@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2', 'fraunces-latin-opsz-normal.woff2'],
  ['@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2', 'fraunces-latin-opsz-italic.woff2'],
  ['@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2', 'inter-tight-latin-wght-normal.woff2'],
];
for (const [from, to] of fonts) copy(`node_modules/${from}`, `assets/fonts/${to}`);
fs.writeFileSync(path.join(OUT, 'assets/map.json'), JSON.stringify({ size: MAP.size, hi: MAP.hi, lo: MAP.lo }));

await esbuild({
  entryPoints: { main: 'src/js/main.js' },
  chunkNames: '[name]-[hash]',
  outdir: path.join(OUT, 'assets/js'),
  bundle: true, format: 'esm', splitting: true, minify: true, target: ['es2020'],
  legalComments: 'linked', absWorkingDir: ROOT, logLevel: 'warning',
});

console.log(`Built ${LANGS.length} languages into docs/`);
