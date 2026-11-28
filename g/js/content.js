// Loads the story + media. Plain sites use story.js/media.json directly; password-locked
// builds (scripts/encrypt_site.mjs) decrypt vault/* in the browser with WebCrypto.
const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const PW_KEY = 'bmc-pw:' + location.pathname + (window.GIFT_ID ? '#' + window.GIFT_ID : '');
// Where the encrypted files live. A plain encrypted build keeps them in ./vault/; the gift shop
// (gift-shop skill) serves many gifts from one viewer and sets window.GIFT_VAULT to the gift's API folder.
const VAULT = window.GIFT_VAULT || 'vault/';

function setProgress(f, label) {
  const bar = $('load-bar'), txt = $('load-text');
  if (bar) bar.style.width = `${Math.round(f * 100)}%`;
  if (txt && label) txt.textContent = label;
}

async function deriveKey(pw, meta) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  const salt = Uint8Array.from(atob(meta.salt), (c) => c.charCodeAt(0));
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: meta.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}
const decrypt = (key, buf) => crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
const fetchBuf = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); };

async function unlock(meta, manifestBuf) {
  const tryPw = async (pw) => {
    try { const key = await deriveKey(pw, meta); return { key, plain: await decrypt(key, manifestBuf) }; }
    catch { return null; }
  };
  let saved = null;
  try { saved = localStorage.getItem(PW_KEY); } catch {}
  if (saved) { const ok = await tryPw(saved); if (ok) return ok; }
  const lock = $('lock'), input = $('lock-input'), err = $('lock-error');
  if (meta.hint) $('lock-hint').textContent = meta.hint;
  lock.classList.add('show');
  input.focus();
  return new Promise((resolve) => {
    const go = async () => {
      err.textContent = '正在打开…';
      const ok = await tryPw(input.value.trim());
      if (!ok) { err.textContent = '密码不对，再试一次 🙂'; input.select(); return; }
      try { localStorage.setItem(PW_KEY, input.value.trim()); } catch {}
      lock.classList.remove('show');
      resolve(ok);
    };
    $('lock-go').onclick = go;
    input.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  });
}

export async function loadContent() {
  if (window.GIFT_PREVIEW) { // shop: unencrypted in-browser preview before purchase
    const c = await window.GIFT_PREVIEW;
    setProgress(1);
    return c;
  }
  if (window.STORY) {
    const media = await fetch('media.json').then((r) => r.json());
    setProgress(1);
    return { STORY: window.STORY, media };
  }
  if (!crypto?.subtle) throw new Error('This page needs https (or localhost) to unlock.');
  const meta = await fetch(VAULT + 'meta.json', { cache: 'no-cache' }).then((r) => r.json());
  const manifestBuf = await fetchBuf(VAULT + 'manifest.bin');
  const { key, plain } = await unlock(meta, manifestBuf);
  const manifest = JSON.parse(new TextDecoder().decode(plain));
  if (manifest.input) {
    // Schema 2 (gift shop): only the buyer's inputs are stored, never code. The story is rebuilt
    // here from the CURRENT template wording, so template improvements reach every old gift.
    const { buildStory } = await import('./story-builder.js');
    window.STORY = buildStory(manifest.input);
  } else {
    new Function(manifest.story)(); // schema 1: our own encrypted story.js (encrypt_site.mjs)
  }

  // Download + decrypt every memory with progress (≈ meta.bytes); 6 at a time.
  const jobs = [];
  for (const m of manifest.media) { jobs.push([m, 'src']); if (m.poster) jobs.push([m, 'poster']); }
  let done = 0, next = 0;
  setProgress(0, '正在打开礼物…');
  const worker = async () => {
    while (next < jobs.length) {
      const [m, field] = jobs[next++];
      const { file, type } = m[field];
      const buf = await decrypt(key, await fetchBuf(VAULT + file));
      m[field] = URL.createObjectURL(new Blob([buf], { type }));
      done++;
      setProgress(done / jobs.length, `正在打开礼物… ${Math.round((done / jobs.length) * 100)}%`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { STORY: window.STORY, media: manifest.media };
}
