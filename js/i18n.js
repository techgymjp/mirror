// 表示言語（日本語 / 英語）。端末の言語が日本語なら日本語、それ以外は英語。タイトル画面で切り替えもできる
window.I18N = (() => {
  const dict = {
    ja: {
      'doc.title': '犬も歩けば鏡に当たる',
      'title.h1': '犬も歩けば<br><span>鏡に当たる</span>',
      'title.lead': '壁はぜんぶ鏡。見えている道は、本物？ 映りこみ？<br>走りつづける犬をフリックで導いて、たった一つの出口へ！<br>鏡に当たったら一発アウト！',
      'btn.howto': '遊び方',
      'legal.privacy': 'プライバシーポリシー',
      'url.privacy': 'https://techgym.jp/privacy-policy/',
      'legal.adSettings': '広告の設定',
      'howto.title': '遊び方',
      'howto.1': '<b>あなたは犬。</b>迷路の中を自動で前へ走りつづけます。',
      'howto.2': '操作は<b>左右だけ</b>。<b>フリック ← →</b> で曲がる予約。<b>その向きに曲がれる角</b>に着いたら曲がります。早めのフリックでも大丈夫。',
      'howto.3': '行き止まりでは、角に着く前に<b>同じ向きへ2回</b>フリックすると後ろを向けます。',
      // web-only:start
      'howto.pc': 'PC は <kbd>←</kbd><kbd>→</kbd> で曲がる、<kbd>M</kbd> で地図、<kbd>Esc</kbd> で一時停止。',
      // web-only:end
      'howto.4': '右上の <b>🗺</b> で地図、<b>Ⅱ</b> で一時停止。',
      'howto.5': '右上の <b>🐕 / 👁</b> で視点を切り替え（背後視点 / 犬目線）。',
      'howto.6': '全10ステージ。らせん、つづら折り、暗闇、左右反転、加速…ステージごとに仕掛けが変わります。',
      'howto.7': '<b>壁はすべて鏡。</b>まっすぐ続く道に見えても、それは映りこみかも。曲がり忘れて鏡に当たると「ゴン！」で<b>即ゲームオーバー</b>。',
      'howto.8': '鏡には<b>自分の姿</b>も映ります。向こうから犬が来たら…それは自分です。',
      'howto.9': '<b>本物の出口は一つだけ。</b>ほかの「EXIT」はワープゾーン。<b>行き止まりの突き当たりは必ずワープ</b>で、迷路のどこかへ飛ばされます。',
      'howto.10': '<b>🦴 ほね</b>を持っていれば、鏡に当たっても<b>1回だけセーフ</b>（ほねを1本使います）。行き止まりに落ちているので、取りに行くかは作戦しだい。',
      'howto.11': 'ワープとセーフになったゴンが少ないほど ★ が増えます。',
      'btn.back': 'もどる',
      'pause.title': 'ひと休み',
      'btn.resume': 'つづける',
      'btn.restart': 'やり直す',
      'btn.toTitle': 'タイトルへ',
      'over.title': 'ゲームオーバー',
      'over.msg': '鏡にぶつかってしまった…<br>次は曲がり角を見きわめよう！',
      'over.kicker': '💥 ゴン！ {where}',
      'btn.again': 'もう一度',
      'btn.share': 'シェア',
      'clear.kicker': '🐾 ワン！',
      'clear.title': '脱出成功！',
      'clear.titleStage': 'STAGE {n} 脱出成功！',
      'clear.best': '自己ベスト更新！',
      'btn.next': '次のステージへ',
      'btn.another': 'もう一つ',
      'redo.watch': '▶ 広告を見て、つづきから',
      'redo.note': 'ぶつかる前の場所からやり直せます（このステージであと {n} 回）',
      'redo.skip': 'あきらめる（{s}）',
      'redo.loading': '広告を読み込んでいます…',
      'redo.fail': '広告を読み込めませんでした',
      'row.time': 'タイム', 'row.progress': '出口までの道のり', 'row.warps': 'ワープ', 'row.saves': 'ほねでセーフ',
      'row.redo': 'やり直し', 'row.bones': '拾ったほね', 'unit.times': '{n} 回',
      'hud.time': 'タイム', 'hud.warps': 'ワープした回数', 'hud.bones': '持っているほね（1本でゴン1回セーフ）',
      'hud.map': '地図', 'hud.pause': '一時停止',
      'hud.stage': 'STAGE {n}　{name}',
      'cam.toEye': '犬目線に切り替え', 'cam.toBehind': '背後視点に切り替え',
      'cam.titleBehind': '背後視点（タップで犬目線）', 'cam.titleEye': '犬目線（タップで背後視点）',
      'snd.on': '音を出す', 'snd.off': '音を消す', 'bgm.on': 'BGMを流す', 'bgm.off': 'BGMを止める',
      'pop.ready': 'よーい…', 'pop.go': 'ワン！', 'pop.bonk': 'ゴン！', 'pop.bone': 'ほねゲット！ ゴン1回セーフ',
      'pop.saved': 'ほねでセーフ！', 'pop.gameover': 'ゲームオーバー', 'pop.warp': 'ワープ！？', 'pop.where': 'ここはどこ…？',
      'pop.speedUp': 'スピードアップ！', 'pop.continue': 'つづきから！', 'pop.bark': 'ワン！',
      'hint.firstTouch': '←\u00a0→ フリックで次の角を曲がる', 'hint.firstKeys': '←\u00a0→ キーで次の角を曲がる',
      'hint.turnTouch': '←\u00a0→ フリックで向きを変えよう', 'hint.turnKeys': '←\u00a0→ で向きを変えよう',
      'dir.0': '東', 'dir.1': '南', 'dir.2': '西', 'dir.3': '北', 'compass.to': '{d}へ',
      'stage.locked': '？？？', 'stage.new': 'NEW', 'stage.unlockRandom': '全ステージクリアで解放',
      'share.title': '犬も歩けば鏡に当たる', 'share.dialog': '結果をシェア',
      'share.where': 'STAGE {n}「{name}」',
      'share.clear': '🐕 {where} を脱出！ {stars} タイム {time}{extra}\n#犬も歩けば鏡に当たる',
      'share.over': '💥 {where} で鏡にゴン！ 出口まであと {pct}%{extra}\n#犬も歩けば鏡に当たる',
      'share.warps': 'ワープ{n}回', 'share.redo': 'やり直し{n}回', 'share.sep': '・', 'share.extra': '（{x}）',
      'stage.1.name': 'はじめての鏡', 'stage.1.desc': 'まずは鏡の迷路に慣れよう',
      'stage.2.name': 'まっすぐ廊下', 'stage.2.desc': '長い廊下の先に急カーブ。曲がり遅れに注意',
      'stage.3.name': 'らせん回廊', 'stage.3.desc': '中心から外へ、ぐるぐる右回り。わき道の扉はワープ',
      'stage.4.name': 'つづら折り', 'stage.4.desc': '右・右・左・左のリズム。近道もあるよ',
      'stage.5.name': '鏡の大広間', 'stage.5.desc': '広い部屋では映りこみが何倍にも。どこでも曲がれる',
      'stage.6.name': '闇の合わせ鏡', 'stage.6.desc': 'ほぼ真っ暗。ときどき光る稲妻で先を見よう',
      'stage.7.name': '横長回廊', 'stage.7.desc': 'くねくね曲がる細長い迷路',
      'stage.8.name': '鏡の国', 'stage.8.desc': '画面が左右反転！見た目と逆にフリック',
      'stage.9.name': '加速する迷宮', 'stage.9.desc': '時間がたつほど犬が速くなる。迷っている暇はない',
      'stage.10.name': '鏡の大迷宮', 'stage.10.desc': 'これまでの試練の集大成',
      'stage.random.name': 'きまぐれ迷宮', 'stage.random.desc': '毎回ちがう迷路',
    },
    en: {
      'doc.title': 'Mirror Maze Dog',
      'title.h1': 'Mirror<br><span>Maze Dog</span>',
      'title.lead': 'Every wall is a mirror. Is that path real, or a reflection? <br>Flick to guide your running Shiba to the one true exit! <br>Bump into a mirror and you\'re out!',
      'btn.howto': 'How to play',
      'legal.privacy': 'Privacy Policy',
      'url.privacy': 'https://techgym.jp/privacy-policy-en/',
      'legal.adSettings': 'Ad settings',
      'howto.title': 'How to play',
      'howto.1': '<b>You are a dog.</b> You keep running forward through the maze on your own.',
      'howto.2': 'Controls are <b>left and right only</b>. <b>Flick ← →</b> to set a turn. You turn at the <b>next corner where that way is open</b>, so flicking early is fine.',
      'howto.3': 'At a dead end, flick <b>the same way twice</b> before the corner to turn around.',
      // web-only:start
      'howto.pc': 'On PC: <kbd>←</kbd><kbd>→</kbd> to turn, <kbd>M</kbd> for the map, <kbd>Esc</kbd> to pause.',
      // web-only:end
      'howto.4': '<b>🗺</b> at the top right shows the map, <b>Ⅱ</b> pauses.',
      'howto.5': '<b>🐕 / 👁</b> at the top right switches the view (behind the dog / dog\'s eyes).',
      'howto.6': '10 stages: a spiral, zigzags, darkness, a flipped mirror world, a speed-up maze… every stage has its own twist.',
      'howto.7': '<b>Every wall is a mirror.</b> A path that seems to go on may just be a reflection. Miss a turn and hit a mirror — BONK — <b>game over</b>.',
      'howto.8': 'You can see <b>yourself</b> in the mirrors too. If a dog comes running at you… it\'s you.',
      'howto.9': '<b>There is only one real exit.</b> Every other EXIT is a warp zone. <b>Every dead end ends in a warp</b> that sends you somewhere else in the maze.',
      'howto.10': 'Carry a <b>🦴 bone</b> and you <b>survive one bump</b> (it uses up the bone). Bones lie in dead ends — it\'s your call whether to go get them.',
      'howto.11': 'The fewer warps and bumps, the more ★ you get.',
      'btn.back': 'Back',
      'pause.title': 'Paused',
      'btn.resume': 'Resume',
      'btn.restart': 'Restart',
      'btn.toTitle': 'Title',
      'over.title': 'Game Over',
      'over.msg': 'You bumped into a mirror…<br>Watch the corners next time!',
      'over.kicker': '💥 BONK! {where}',
      'btn.again': 'Try again',
      'btn.share': 'Share',
      'clear.kicker': '🐾 Woof!',
      'clear.title': 'You escaped!',
      'clear.titleStage': 'STAGE {n} cleared!',
      'clear.best': 'New personal best!',
      'btn.next': 'Next stage',
      'btn.another': 'Another one',
      'redo.watch': '▶ Watch an ad to continue',
      'redo.note': 'Continue from where you bumped ({n} left on this stage)',
      'redo.skip': 'Give up ({s})',
      'redo.loading': 'Loading ad…',
      'redo.fail': 'Couldn\'t load an ad',
      'row.time': 'Time', 'row.progress': 'Way to the exit', 'row.warps': 'Warps', 'row.saves': 'Saved by bones',
      'row.redo': 'Continues', 'row.bones': 'Bones found', 'unit.times': '{n}',
      'hud.time': 'Time', 'hud.warps': 'Warps', 'hud.bones': 'Bones (each one saves you from one bump)',
      'hud.map': 'Map', 'hud.pause': 'Pause',
      'hud.stage': 'STAGE {n}  {name}',
      'cam.toEye': 'Switch to dog\'s-eye view', 'cam.toBehind': 'Switch to behind view',
      'cam.titleBehind': 'Behind view (tap for dog\'s-eye view)', 'cam.titleEye': 'Dog\'s-eye view (tap for behind view)',
      'snd.on': 'Sound on', 'snd.off': 'Sound off', 'bgm.on': 'Music on', 'bgm.off': 'Music off',
      'pop.ready': 'Ready…', 'pop.go': 'Woof!', 'pop.bonk': 'BONK!', 'pop.bone': 'Got a bone! One bump is safe',
      'pop.saved': 'Saved by a bone!', 'pop.gameover': 'Game Over', 'pop.warp': 'Warp!?', 'pop.where': 'Where am I…?',
      'pop.speedUp': 'Speed up!', 'pop.continue': 'Keep going!', 'pop.bark': 'Woof!',
      'hint.firstTouch': 'Flick ←\u00a0→ to turn at the next corner', 'hint.firstKeys': 'Press ←\u00a0→ to turn at the next corner',
      'hint.turnTouch': 'Flick ←\u00a0→ to change direction', 'hint.turnKeys': 'Press ←\u00a0→ to change direction',
      'dir.0': 'East', 'dir.1': 'South', 'dir.2': 'West', 'dir.3': 'North', 'compass.to': '{d}',
      'stage.locked': '???', 'stage.new': 'NEW', 'stage.unlockRandom': 'Clear all stages to unlock',
      'share.title': 'Mirror Maze Dog', 'share.dialog': 'Share your result',
      'share.where': 'STAGE {n} "{name}"',
      'share.clear': '🐕 Escaped {where}! {stars} Time {time}{extra}\n#MirrorMazeDog',
      'share.over': '💥 BONK into a mirror in {where}! {pct}% left to the exit{extra}\n#MirrorMazeDog',
      'share.warps': '{n} warps', 'share.redo': '{n} continues', 'share.sep': ', ', 'share.extra': ' ({x})',
      'stage.1.name': 'First Mirrors', 'stage.1.desc': 'Get used to the mirror maze',
      'stage.2.name': 'Long Hallways', 'stage.2.desc': 'Sharp turns at the end of long hallways. Don\'t turn late',
      'stage.3.name': 'Spiral Corridor', 'stage.3.desc': 'Round and round to the right, from the center out. Side doors are warps',
      'stage.4.name': 'Switchbacks', 'stage.4.desc': 'Right, right, left, left. There are shortcuts too',
      'stage.5.name': 'Hall of Mirrors', 'stage.5.desc': 'Open halls multiply the reflections. Turn anywhere',
      'stage.6.name': 'Mirrors in the Dark', 'stage.6.desc': 'Almost pitch dark. Look ahead when the lightning flashes',
      'stage.7.name': 'Wide Corridor', 'stage.7.desc': 'A long, narrow maze full of twists',
      'stage.8.name': 'Mirror World', 'stage.8.desc': 'The screen is flipped! Flick the opposite way',
      'stage.9.name': 'Speeding Maze', 'stage.9.desc': 'Your dog gets faster over time. No time to get lost',
      'stage.10.name': 'Grand Mirror Maze', 'stage.10.desc': 'Everything you\'ve learned, all at once',
      'stage.random.name': 'Random Maze', 'stage.random.desc': 'A new maze every time',
    },
  };

  const STORE_KEY = 'inu-kagami-lang';
  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* 保存できなくても使える */ }
  const deviceLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
  let lang = dict[saved] ? saved : (/^ja\b/i.test(deviceLang) ? 'ja' : 'en');
  const listeners = [];

  // t('clear.titleStage', { n: 2 }) → 'STAGE 2 脱出成功！'
  function t(key, vars) {
    let s = dict[lang][key];
    if (s === undefined) s = dict.ja[key];
    if (s === undefined) return key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
  }

  // data-i18n（文字）/ data-i18n-html（タグを含む）/ data-i18n-href（リンク先）/ data-i18n-title（説明）の付いた要素を書き換える
  function apply() {
    document.documentElement.lang = lang;
    document.title = t('doc.title');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-href]').forEach(el => { el.href = t(el.dataset.i18nHref); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', t(el.dataset.i18nTitle)); });
    document.querySelectorAll('[data-lang]').forEach(el => el.classList.toggle('on', el.dataset.lang === lang));
  }

  function setLang(l) {
    if (!dict[l] || l === lang) return;
    lang = l;
    try { localStorage.setItem(STORE_KEY, l); } catch (e) { /* 保存できなくても使える */ }
    apply();
    listeners.forEach(f => f(l));
  }

  return {
    t, apply, setLang,
    get lang() { return lang; },
    onChange(f) { listeners.push(f); },
  };
})();
