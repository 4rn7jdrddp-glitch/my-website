// Contact form: validation, spam limitation and either submission (when an endpoint is configured)
// or a local project brief that can be copied or downloaded. A success message is only shown after
// a confirmed 2xx response from the endpoint.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_FILL_MS = 3000;

export function initForm(data) {
  const form = document.getElementById('brief-form');
  if (!form) return;
  const S = data.contact;
  const out = document.querySelector('[data-brief-output]');
  const briefText = document.querySelector('[data-brief-text]');
  const status = form.querySelector('[data-form-status]');
  const briefStatus = document.querySelector('[data-brief-status]');
  const summary = form.querySelector('[data-error-summary]');
  const submit = form.querySelector('button[type="submit"]');
  const mode = data.endpoint ? 'send' : 'brief';
  // Timer starts at the first interaction with the form, not at page load.
  let startedAt = 0;
  form.addEventListener('focusin', () => { if (!startedAt) startedAt = Date.now(); });
  const fields = ['name', 'organization', 'email', 'region', 'service', 'description'].map((n) => form.elements[n]);

  // Service call-to-action buttons preselect the matching service.
  document.querySelectorAll('[data-service-cta]').forEach((a) => a.addEventListener('click', () => {
    const opt = data.serviceOptions[+a.dataset.serviceCta];
    if (opt) form.elements.service.value = opt;
  }));

  function check(el) {
    const v = el.value.trim();
    if (el.tagName === 'SELECT') return v ? '' : S.errors.select;
    if (!v) return S.errors.required;
    if (el.name === 'email' && !EMAIL.test(v)) return S.errors.email;
    if (el.name === 'description' && v.length < 20) return S.errors.short;
    return '';
  }
  function show(el, msg) {
    const err = document.getElementById(`${el.id}-err`);
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) { err.textContent = msg; err.hidden = !msg; }
  }
  fields.forEach((el) => {
    el.addEventListener('blur', () => { if (el.value.trim() || el.getAttribute('aria-invalid') === 'true') show(el, check(el)); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') show(el, check(el)); });
  });

  function setStatus(el, msg, kind) {
    el.textContent = msg;
    el.classList.toggle('is-error', kind === 'error');
    el.classList.toggle('is-ok', kind === 'ok');
  }

  function buildBrief(values) {
    const f = S.fields;
    const date = new Date().toISOString().slice(0, 10);
    return [
      S.briefHeading,
      '='.repeat(S.briefHeading.length),
      `${S.briefDate}: ${date}`,
      '',
      `${f.name}: ${values.name}`,
      `${f.organization}: ${values.organization}`,
      `${f.email}: ${values.email}`,
      `${f.region}: ${values.region}`,
      `${f.service}: ${values.service}`,
      '',
      `${f.description}:`,
      values.description,
      '',
    ].join('\n');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus(status, '', null);
    const errors = fields.map((el) => [el, check(el)]).filter(([, m]) => m);
    fields.forEach((el) => show(el, check(el)));
    const list = summary.querySelector('ul');
    list.innerHTML = '';
    if (errors.length) {
      errors.forEach(([el, m]) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${el.id}`;
        a.textContent = `${form.querySelector(`label[for="${el.id}"]`).textContent}: ${m}`;
        a.addEventListener('click', (ev) => { ev.preventDefault(); el.focus(); });
        li.append(a);
        list.append(li);
      });
      summary.hidden = false;
      summary.focus();
      return;
    }
    summary.hidden = true;

    // Spam limitation: hidden honeypot field and a minimum time on the form.
    if (form.elements.website.value) return;
    if (!startedAt || Date.now() - startedAt < MIN_FILL_MS) { setStatus(status, S.errors.tooFast, 'error'); return; }

    const values = Object.fromEntries(fields.map((el) => [el.name, el.value.trim()]));
    const brief = buildBrief(values);

    if (mode === 'send') {
      submit.disabled = true;
      setStatus(status, S.sending, null);
      try {
        const res = await fetch(data.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ...values, language: data.lang, brief }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        form.reset();
        setStatus(status, S.sent, 'ok');
      } catch {
        setStatus(status, S.errors.sendFailed, 'error');
        showBrief(brief);
      } finally {
        submit.disabled = false;
      }
      return;
    }
    showBrief(brief);
  });

  function showBrief(brief) {
    briefText.textContent = brief;
    setStatus(briefStatus, '', null);
    out.hidden = false;
    if (mode === 'brief') form.hidden = true;
    out.focus();
  }

  document.querySelector('[data-brief-edit]')?.addEventListener('click', () => {
    out.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });

  document.querySelector('[data-brief-copy]')?.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unsupported');
      await navigator.clipboard.writeText(briefText.textContent);
      setStatus(briefStatus, S.copied, 'ok');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(briefText);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      setStatus(briefStatus, S.copyFailed, 'error');
    }
  });

  document.querySelector('[data-brief-download]')?.addEventListener('click', () => {
    const blob = new Blob([briefText.textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = S.fileName;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(briefStatus, S.downloaded, 'ok');
  });
}
