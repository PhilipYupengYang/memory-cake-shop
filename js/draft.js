// The buyer's draft lives only in this browser (IndexedDB) until they pay: text in "kv",
// resized photos / videos in "media". Shared by make.js and the free preview (g/?preview).

const DB_NAME = 'memory-cake-shop';
let dbp;
function db() {
  dbp ||= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('media'); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}
export const getDraft = () => tx('kv', 'readonly', (s) => s.get('draft'));
export const saveDraft = (d) => tx('kv', 'readwrite', (s) => s.put(d, 'draft'));
export const getMedia = (id) => tx('media', 'readonly', (s) => s.get(id));
export const putMedia = (id, v) => tx('media', 'readwrite', (s) => s.put(v, id));
export const delMedia = (id) => tx('media', 'readwrite', (s) => s.delete(id));
export const clearAll = () => Promise.all([tx('kv', 'readwrite', (s) => s.clear()), tx('media', 'readwrite', (s) => s.clear())]);

export const fillText = (s, d) => String(s || '').replaceAll('{name}', d.recipient || 'TA').replaceAll('{from}', d.from || '');

// draft.items (flat, in order; an item with chapterStart opens a new chapter) -> chapters
export function chaptersOf(d) {
  const out = [];
  (d.items || []).forEach((it, i) => {
    if (i === 0 || it.chapterStart) out.push({ title: it.chapterTitle || '', items: [] });
    out[out.length - 1].items.push(it);
  });
  return out;
}

// The only thing stored for a paid gift besides the media: plain inputs (see story-builder.js).
export function buildInput(d) {
  return {
    schema: 2,
    lang: d.lang === 'en' ? 'en' : 'zh',
    recipient: d.recipient || '',
    age: Number(d.age) || 1,
    from: d.from || '',
    birthday: d.birthday || '',
    title: fillText(d.title, d),
    subtitle: fillText(d.subtitle, d),
    heartText: fillText(d.heart, d),
    letter: d.letter || '',
    chapters: chaptersOf(d).map((ch) => ({ title: ch.title, items: ch.items.map((it) => ({ id: it.id, cap: it.cap || '' })) })),
  };
}
