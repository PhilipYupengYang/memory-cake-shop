// Builds window.STORY from a buyer's plain inputs (gift-shop "schema 2" manifests and previews).
//
// CONTRACT with the gift shop (keep it backward compatible — paid gifts live for a year):
//   input = { schema: 2, lang: 'zh'|'en', recipient, age, from, birthday?, title?, subtitle?,
//             letter: '多行文字', heartText?, chapters: [{ title, line?, items: [{ id, cap }] }] }
// Only data is stored, never code or HTML. All wording that is not typed by the buyer comes from
// the defaults below, so improving these lines (or the rest of the template) upgrades every gift.
// New optional fields are fine; never rename or remove existing ones.

const ZH = {
  title: '{name}，生日快乐',
  subtitle: '一份准备了很久的礼物',
  intro: ['{name}，', '{age} 年前，你来到这个世界。', '这里有 {age} 根蜡烛，', '和一些，我们一起走过的日子。'],
  gestureHelp: ['✋ 张开手，<b>往左或往右移</b> —— 转动时间', '✊ <b>握拳</b> —— 走近看看　✋ 再张开 —— 退后',
    '🫶 两只手<b>比个心</b> —— 有惊喜'],
  mouseHelp: ['<b>左右拖动</b> —— 转动时间　·　<b>点一下照片</b> —— 走近看看', '也可以用 ← → 键和空格，或者下面的按钮'],
  heartText: '{name}，我爱你 ❤',
  finale: {
    readyHint: '照片看完了，该许愿了',
    wish: ['{age} 岁生日快乐。', '闭上眼睛，许个愿吧。'],
    blowHint: '许好愿了吗？<br>对着屏幕<b>吹一口气</b> —— 或者按 🎂 / 空格',
    blowHintCam: '许好愿了吗？<br>对着屏幕<b>吹一口气</b> —— 或者<b>握紧拳头</b>两秒',
    celebrate: '生日快乐，{name}！',
  },
  kickers: ['第一章', '第二章', '第三章', '第四章', '第五章', '第六章', '第七章', '第八章', '第九章', '第十章'],
  letterSign: '—— {from}',
};
const EN = {
  title: 'Happy Birthday, {name}',
  subtitle: 'A gift that took a while to make',
  intro: ['{name},', '{age} years ago, you came into this world.', 'Here are {age} candles,',
    'and some of the days we shared.'],
  gestureHelp: ['✋ Open hand, <b>move left or right</b> — travel through time',
    '✊ <b>Make a fist</b> — look closer　✋ open again — step back', '🫶 <b>Make a heart</b> with both hands — surprise'],
  mouseHelp: ['<b>Drag</b> left/right — travel through time · <b>tap a photo</b> — look closer',
    'Arrow keys, space and the buttons work too'],
  heartText: 'Love you, {name} ❤',
  finale: {
    readyHint: 'That was every photo — time to make a wish',
    wish: ['Happy birthday — {age} today.', 'Close your eyes and make a wish.'],
    blowHint: 'Ready?<br><b>Blow</b> at the screen — or press 🎂 / space',
    blowHintCam: 'Ready?<br><b>Blow</b> at the screen — or <b>hold a fist</b> for two seconds',
    celebrate: 'Happy Birthday, {name}!',
  },
  kickers: ['Chapter one', 'Chapter two', 'Chapter three', 'Chapter four', 'Chapter five', 'Chapter six',
    'Chapter seven', 'Chapter eight', 'Chapter nine', 'Chapter ten'],
  letterSign: '— {from}',
};

// Buyer text is shown with textContent almost everywhere, but a few labels go through innerHTML
// (chapter timeline), so angle brackets are removed. Length caps keep layouts intact.
const clean = (v, max = 60) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export function buildStory(input = {}) {
  const L = input.lang === 'en' ? EN : ZH;
  const age = Math.max(1, Math.min(120, parseInt(input.age, 10) || 1));
  const letterLines = String(input.letter ?? '').replace(/[<>]/g, '').split(/\r?\n/)
    .slice(0, 60).map((l) => l.trimEnd().slice(0, 90));
  while (letterLines.length && !letterLines[letterLines.length - 1].trim()) letterLines.pop();
  const chapters = (input.chapters || []).slice(0, 12).map((ch, i) => ({
    kicker: L.kickers[i] || `${i + 1}`,
    title: clean(ch.title, 14) || L.kickers[i] || `${i + 1}`,
    line: clean(ch.line, 40),
    items: (ch.items || []).slice(0, 150).map((it) => ({ id: clean(it.id, 40), cap: clean(it.cap, 18) })),
  })).filter((ch) => ch.items.length);
  return {
    recipient: clean(input.recipient, 12) || (input.lang === 'en' ? 'you' : '你'),
    age,
    from: clean(input.from, 16) || (input.lang === 'en' ? 'your family' : '家人'),
    lang: input.lang === 'en' ? 'en' : 'zh',
    title: clean(input.title, 24) || L.title,
    subtitle: clean(input.subtitle, 40) || L.subtitle,
    intro: L.intro,
    gestureHelp: L.gestureHelp,
    mouseHelp: L.mouseHelp,
    heartText: clean(input.heartText, 24) || L.heartText,
    chapters,
    finale: L.finale,
    letter: letterLines.length ? letterLines : [L.letterSign],
  };
}
