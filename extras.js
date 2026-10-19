/* =========================================================
   Extras: sticker wall, command palette, party mode,
   confetti bursts, sound FX and a live GitHub feed
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const pf = window.__pf || { state: {} };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     SOUND (tiny WebAudio synth — off by default)
  --------------------------------------------------------- */
  let audio = null, soundOn = false;
  function ac() {
    if (!audio) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      audio = new C();
    }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }
  function tone(freq, dur = 0.12, type = 'sine', vol = 0.07, slideTo) {
    if (!soundOn) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur = 0.6, vol = 0.18) {
    if (!soundOn) return;
    const a = ac(); if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, a.currentTime);
    f.frequency.exponentialRampToValueAtTime(120, a.currentTime + dur);
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  }
  const sfx = {
    pop() { tone(rand(520, 820), 0.09, 'triangle', 0.07, 1100); },
    tick() { tone(900, 0.04, 'square', 0.025); },
    whoosh() { tone(420, 0.28, 'sawtooth', 0.035, 90); },
    boom() { noise(0.8, 0.22); tone(100, 0.5, 'sine', 0.2, 30); },
    blip() { tone(660, 0.08, 'square', 0.045, 990); },
    party() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.08), i * 90)); },
  };
  window.__sfx = sfx;

  const soundBtn = $('#soundBtn');
  function toggleSound() {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.title = 'Sound effects (' + (soundOn ? 'on' : 'off') + ')';
    if (soundOn) { ac(); sfx.party(); }
  }
  soundBtn.addEventListener('click', toggleSound);
  $$('.mode-btn[data-mode]').forEach((b) => b.addEventListener('click', () => sfx.blip()));
  const boomBtn = $('#boomBtn');
  if (boomBtn) boomBtn.addEventListener('click', () => sfx.boom());

  /* ---------------------------------------------------------
     CONFETTI / EMOJI BURSTS (2D overlay canvas)
  --------------------------------------------------------- */
  const fx = $('#fx'), fctx = fx.getContext('2d');
  let parts = [], fxRunning = false;
  function fxSize() { fx.width = innerWidth; fx.height = innerHeight; }
  fxSize();
  window.addEventListener('resize', fxSize);
  const COLORS = ['#22d3ee', '#8b6cff', '#ff4d9d', '#b6ff5c', '#ffb347', '#ffffff'];

  function burst(x, y, n, o = {}) {
    if (reduceMotion) return;
    const angle = o.angle ?? -Math.PI / 2, spread = o.spread ?? Math.PI * 2, power = o.power ?? 8;
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const p = power * (0.4 + Math.random() * 0.8);
      parts.push({
        x, y, vx: Math.cos(a) * p, vy: Math.sin(a) * p,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        size: o.size ?? rand(6, 11), color: pick(COLORS),
        emoji: o.emoji ? pick(o.emoji) : null,
        life: rand(80, 150), age: 0, shape: Math.random() < 0.3 ? 'c' : 'r',
      });
    }
    if (!fxRunning) { fxRunning = true; requestAnimationFrame(fxLoop); }
  }
  function fxLoop() {
    fctx.clearRect(0, 0, fx.width, fx.height);
    parts = parts.filter((p) => p.age < p.life && p.y < fx.height + 60);
    for (const p of parts) {
      p.age++;
      p.vy += 0.26; p.vx *= 0.99; p.vy *= 0.992;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const fade = clamp((p.life - p.age) / 30, 0, 1);
      fctx.save();
      fctx.globalAlpha = fade;
      fctx.translate(p.x, p.y); fctx.rotate(p.rot);
      if (p.emoji) {
        fctx.font = p.size * 2.2 + 'px serif'; fctx.textAlign = 'center'; fctx.textBaseline = 'middle';
        fctx.fillText(p.emoji, 0, 0);
      } else {
        fctx.fillStyle = p.color;
        if (p.shape === 'c') { fctx.beginPath(); fctx.arc(0, 0, p.size / 2, 0, 6.28); fctx.fill(); }
        else fctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      }
      fctx.restore();
    }
    if (parts.length) requestAnimationFrame(fxLoop);
    else { fxRunning = false; fctx.clearRect(0, 0, fx.width, fx.height); }
  }

  // click anywhere on empty space → confetti pop
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input, .sticker, .sphere, .twin-stage, .twin-chat, .palette, .lid, .nav, .skill-group')) return;
    burst(e.clientX, e.clientY, 14, { power: 7 });
    sfx.pop();
  });

  /* ---------------------------------------------------------
     STICKER ENGINE (drag · throw · tap-to-spin)
  --------------------------------------------------------- */
  const boards = [];
  function createBoard(container, items, opts = {}) {
    const board = { el: container, list: [], z: 10, k: opts.scale || 1, items, opts };
    boards.push(board);
    const measure = () => {
      const ow = board.w, oh = board.h, nw = container.clientWidth, nh = container.clientHeight;
      if (ow && oh && (ow !== nw || oh !== nh)) {      // keep stickers at the same relative spot when the box resizes
        for (const s of board.list) {
          const rx = ow - s.w > 0 ? s.x / (ow - s.w) : 0, ry = oh - s.h > 0 ? s.y / (oh - s.h) : 0;
          s.x = clamp(rx, 0, 1) * Math.max(0, nw - s.w); s.y = clamp(ry, 0, 1) * Math.max(0, nh - s.h);
          board.place(s);
        }
      }
      board.w = nw; board.h = nh;
    };
    board.place = () => {};
    measure();
    window.addEventListener('resize', measure);
    if (window.ResizeObserver) new ResizeObserver(measure).observe(container);

    const place = (st) => { st.el.style.transform = `translate3d(${st.x.toFixed(1)}px, ${st.y.toFixed(1)}px, 0) rotate(${st.rot.toFixed(1)}deg)`; };
    board.place = place;

    function build(item) {
      const el = document.createElement('div');
      el.className = 'sticker ' + (item.cls || '');
      const k = board.k * (board.w < 560 && !opts.noShrink ? 0.72 : 1);
      if (item.src) {
        el.classList.add('img');
        const w = item.w * k;
        el.style.width = w + 'px';
        el.style.height = w * (item.ratio || 1) + 'px';
        el.style.setProperty('--mask', `url("${item.src}")`);
        const im = new Image();
        im.src = item.src; im.alt = item.alt || ''; im.draggable = false;
        el.appendChild(im);
      } else {
        el.innerHTML = item.html;
        if (item.fs) el.style.fontSize = item.fs * k + 'px';
        else el.style.fontSize = 16 * k + 'px';
      }
      container.appendChild(el);
      const st = { el, x: 0, y: 0, vx: 0, vy: 0, rot: item.rot || 0, vrot: 0, drag: false, w: el.offsetWidth, h: el.offsetHeight, item };
      return st;
    }

    function wire(st) {
      const el = st.el;
      el.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const r = container.getBoundingClientRect();
        st.drag = true; st.vx = st.vy = st.vrot = 0; st.moved = 0;
        st.gx = e.clientX - r.left - st.x; st.gy = e.clientY - r.top - st.y;
        st.lx = e.clientX; st.ly = e.clientY; st.lt = performance.now();
        el.style.zIndex = ++board.z;
        el.classList.add('lifted');
        sfx.tick();
      });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sx', ((e.clientX - r.left) / r.width) * 100 + '%');
        el.style.setProperty('--sy', ((e.clientY - r.top) / r.height) * 100 + '%');
        if (!st.drag) return;
        const cr = container.getBoundingClientRect();
        const now = performance.now(), dt = Math.max(8, now - st.lt);
        const nx = clamp(e.clientX - cr.left - st.gx, -10, board.w - st.w + 10);
        const ny = clamp(e.clientY - cr.top - st.gy, -10, board.h - st.h + 10);
        const f = 16.7 / dt;
        st.vx = st.vx * 0.5 + (nx - st.x) * f * 0.5;
        st.vy = st.vy * 0.5 + (ny - st.y) * f * 0.5;
        st.moved += Math.abs(e.clientX - st.lx) + Math.abs(e.clientY - st.ly);
        st.x = nx; st.y = ny; st.lx = e.clientX; st.ly = e.clientY; st.lt = now;
        place(st);
      });
      const release = () => {
        if (!st.drag) return;
        st.drag = false;
        el.classList.remove('lifted');
        if (st.moved < 6) {                 // tap → spin
          st.vx = st.vy = 0;
          st.vrot = (Math.random() < 0.5 ? -1 : 1) * rand(16, 28);
          sfx.whoosh();
        } else {
          st.vx = clamp(st.vx, -40, 40); st.vy = clamp(st.vy, -40, 40);
          st.vrot = st.vx * 0.45;
          if (Math.hypot(st.vx, st.vy) > 6) sfx.whoosh();
        }
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
    }

    board.add = (item, at, o = {}) => {
      const st = build(item);
      wire(st);
      if (o.drop) {
        st.x = rand(0, Math.max(0, board.w - st.w)); st.y = -st.h - 20;
        st.vy = 6; st.vx = rand(-4, 4); st.vrot = rand(-8, 8);
      } else {
        const [fx_, fy_] = at || [Math.random(), Math.random()];
        st.x = fx_ * Math.max(0, board.w - st.w);
        st.y = fy_ * Math.max(0, board.h - st.h);
      }
      st.el.style.zIndex = ++board.z;
      place(st);
      board.list.push(st);
      return st;
    };
    board.clear = () => { board.list.forEach((s) => s.el.remove()); board.list = []; };
    board.fill = () => items.forEach((it) => board.add(it, it.at));
    board.shuffle = () => board.list.forEach((s) => {
      s.vx = rand(-30, 30); s.vy = rand(-26, 26); s.vrot = rand(-18, 18);
    });
    board.fill();
    return board;
  }

  // physics loop (runs only while something is moving)
  function physics() {
    for (const b of boards) {
      for (const s of b.list) {
        if (s.drag) continue;
        if (Math.abs(s.vx) < 0.03 && Math.abs(s.vy) < 0.03 && Math.abs(s.vrot) < 0.05) continue;
        s.x += s.vx; s.y += s.vy; s.rot += s.vrot;
        s.vx *= 0.965; s.vy *= 0.965; s.vrot *= 0.955;
        const maxX = b.w - s.w, maxY = b.h - s.h;
        if (s.x < 0) { s.x = 0; s.vx = -s.vx * 0.6; if (Math.abs(s.vx) > 4) sfx.tick(); }
        else if (s.x > maxX) { s.x = Math.max(0, maxX); s.vx = -s.vx * 0.6; if (Math.abs(s.vx) > 4) sfx.tick(); }
        if (s.y < 0 && s.vy < 0) { s.y = 0; s.vy = -s.vy * 0.6; }
        else if (s.y > maxY) { s.y = Math.max(0, maxY); s.vy = -s.vy * 0.6; if (Math.abs(s.vy) > 4) sfx.tick(); }
        b.place(s);
      }
    }
    requestAnimationFrame(physics);
  }
  requestAnimationFrame(physics);

  /* sticker definitions */
  const IMG = {
    white: { src: 'assets/stickers/me-white.png', ratio: 544 / 373, alt: 'Sticker of Prabhkirat' },
    neon:  { src: 'assets/stickers/me-neon.png',  ratio: 544 / 373, alt: 'Neon sticker of Prabhkirat' },
    badge: { src: 'assets/stickers/me-badge.png', ratio: 1,         alt: 'Round badge sticker of Prabhkirat' },
  };
  const wallItems = [
    { ...IMG.white, w: 210, rot: -7, at: [0.05, 0.08] },
    { ...IMG.neon,  w: 185, rot: 8,  at: [0.78, 0.06] },
    { ...IMG.badge, w: 140, rot: -12, at: [0.42, 0.55] },
    { cls: 'st-code', html: '<i>&gt;&gt;&gt;</i> print(<b>"Hello, World!"</b>)', rot: 5, at: [0.3, 0.1] },
    { cls: 'st-py', html: '🐍 Python', fs: 24, rot: -6, at: [0.6, 0.3] },
    { cls: 'st-ai', html: 'AI inside 🤖', fs: 20, rot: 9, at: [0.22, 0.62] },
    { cls: 'st-404', html: '404<small>Sleep not found 😴</small>', rot: -4, at: [0.88, 0.5] },
    { cls: 'st-git', html: '$ git commit -m <b>"it works"</b>', rot: 3, at: [0.52, 0.86] },
    { cls: 'st-sql', html: 'SELECT * FROM <b>talent</b>;', rot: -8, at: [0.08, 0.86] },
    { cls: 'st-made', html: 'Made with ☕ + Three.js', fs: 17, rot: 6, at: [0.7, 0.78] },
    { cls: 'st-round st-panda', html: '🐼<small>Pandas</small>', rot: -10, at: [0.46, 0.2] },
    { cls: 'st-punjabi', html: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ 🙏', fs: 22, rot: 4, at: [0.04, 0.48] },
    { cls: 'st-open', html: 'OPEN TO WORK ✅', fs: 18, rot: -3, at: [0.74, 0.62] },
    { cls: 'st-lh', html: 'Ludhiana ❤ Punjab', fs: 18, rot: 7, at: [0.3, 0.36] },
    { cls: 'st-bugs', html: '<small>bugs in prod</small> 0 <small>(trust me)</small>', rot: -6, at: [0.6, 0.05] },
    { cls: 'st-bca', html: "BCA '27 🎓", fs: 20, rot: 10, at: [0.94, 0.28] },
  ];
  const emojiPool = ['🔥', '⚡', '🚀', '🧠', '🎯', '💻', '✨', '🤖', '🐍', '☕', '📊', '🧪', '🎨', '💡'];

  const wall = $('#stickerWall');
  let wallBoard = null;
  if (wall) {
    wallBoard = createBoard(wall, wallItems);
    $('#stShuffle').addEventListener('click', () => { wallBoard.shuffle(); sfx.whoosh(); });
    $('#stAdd').addEventListener('click', () => {
      const r = Math.random();
      const item = r < 0.25 ? { ...pick([IMG.white, IMG.neon, IMG.badge]), w: rand(110, 150), rot: rand(-14, 14) }
        : { cls: 'st-round st-emoji', html: pick(emojiPool), fs: rand(46, 70), rot: rand(-20, 20) };
      wallBoard.add(item, null, { drop: true });
      sfx.pop();
    });
    $('#stReset').addEventListener('click', () => { wallBoard.clear(); wallBoard.fill(); sfx.whoosh(); });
  }

  const heroBox = $('#heroStickers');
  if (heroBox) {
    createBoard(heroBox, [
      { ...IMG.neon, w: 120, rot: 8, at: [0.97, 0.9] },
      { cls: 'st-code', html: '<i>&gt;&gt;&gt;</i> hire(<b>"me"</b>)', rot: -5, at: [0.8, 0.96] },
    ], { noShrink: true });
  }

  /* ---------------------------------------------------------
     PARTY MODE
  --------------------------------------------------------- */
  const banner = $('#partyBanner');
  let partyOn = false;
  const partyEmojis = ['🐍', '🔥', '🚀', '✨', '🤖', '⚡', '🎉', '💜'];
  function party() {
    if (partyOn) return;
    partyOn = true;
    document.body.classList.add('party');
    banner.classList.add('show');
    pf.state.party = 1;
    sfx.party();
    if (window.__twin) window.__twin.explode();
    let n = 0;
    const iv = setInterval(() => {
      burst(0, innerHeight, 45, { angle: -Math.PI / 3, spread: 0.8, power: 17 });
      burst(innerWidth, innerHeight, 45, { angle: (-2 * Math.PI) / 3, spread: 0.8, power: 17 });
      if (n % 2 === 0) burst(rand(0, innerWidth), -20, 14, { angle: Math.PI / 2, spread: 0.6, power: 3, emoji: partyEmojis });
      if (++n > 13) clearInterval(iv);
    }, 450);
    setTimeout(() => {
      partyOn = false;
      document.body.classList.remove('party');
      banner.classList.remove('show');
      pf.state.party = 0;
    }, 7000);
  }

  // Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kpos = 0;
  window.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = key === konami[kpos] ? kpos + 1 : (key === konami[0] ? 1 : 0);
    if (kpos === konami.length) { kpos = 0; party(); }
  });

  /* ---------------------------------------------------------
     COMMAND PALETTE  (Ctrl/⌘ + K  or  /)
  --------------------------------------------------------- */
  const pal = $('#palette'), palInput = $('#palInput'), palList = $('#palList');
  const go = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const goTwin = (fn) => { go('twin'); setTimeout(() => window.__twin && fn(window.__twin), 700); };
  const dl = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name || ''; document.body.appendChild(a); a.click(); a.remove(); };
  const sec = (id, label, icon) => ({ icon, label: 'Go to ' + label, hint: 'section', kw: id + ' ' + label, run: () => go(id) });

  const commands = [
    sec('home', 'Home', '🏠'), sec('about', 'About', '👤'), sec('twin', 'AI Twin', '🧬'), sec('projects', 'Projects', '🚀'),
    sec('skills', 'Skills', '🧠'), sec('stickers', 'Sticker Wall', '🎟️'), sec('journey', 'Journey', '🛣️'), sec('contact', 'Contact', '✉️'),
    { icon: '🎉', label: 'Party mode', hint: 'chaos', kw: 'party confetti konami crazy fun', run: party },
    { icon: '💥', label: 'Explode the AI twin', hint: 'twin', kw: 'explode boom avatar particles', run: () => goTwin((t) => t.explode()) },
    { icon: '🧑‍🚀', label: 'Twin mode: Real', hint: 'twin', kw: 'real normal photo', run: () => goTwin((t) => t.setMode(0)) },
    { icon: '🛸', label: 'Twin mode: Hologram', hint: 'twin', kw: 'hologram holo cyan', run: () => goTwin((t) => t.setMode(1)) },
    { icon: '🌈', label: 'Twin mode: Neon', hint: 'twin', kw: 'neon pink', run: () => goTwin((t) => t.setMode(2)) },
    { icon: '🟩', label: 'Twin mode: Matrix', hint: 'twin', kw: 'matrix green code rain', run: () => goTwin((t) => t.setMode(3)) },
    { icon: '🔀', label: 'Shuffle the stickers', hint: 'stickers', kw: 'shuffle throw scatter sticker', run: () => { go('stickers'); setTimeout(() => wallBoard && wallBoard.shuffle(), 700); } },
    { icon: '🎟️', label: 'Download my sticker (PNG)', hint: 'download', kw: 'sticker download whatsapp', run: () => dl('assets/stickers/me-sticker-512.png', 'prabhkirat-sticker.png') },
    { icon: '📄', label: 'Download résumé', hint: 'download', kw: 'resume cv pdf', run: () => dl('Prabhkirat_Singh_Resume.pdf') },
    { icon: '📋', label: 'Copy email address', hint: 'action', kw: 'email mail copy', run: () => $('#copyEmail').click() },
    { icon: '🔊', label: 'Toggle sound effects', hint: 'toggle', kw: 'sound audio sfx mute', run: toggleSound },
    { icon: '💼', label: 'Open LinkedIn', hint: 'link', kw: 'linkedin social', run: () => window.open('https://www.linkedin.com/in/prabhkirat-singh-6aa70823b/', '_blank', 'noopener') },
    { icon: '🐙', label: 'Open GitHub', hint: 'link', kw: 'github code repo', run: () => window.open('https://github.com/Prabkiratt', '_blank', 'noopener') },
  ];

  let shown = [], active = 0;
  function renderPal() {
    const q = palInput.value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    shown = commands.filter((c) => {
      const hay = (c.label + ' ' + c.kw + ' ' + c.hint).toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    active = clamp(active, 0, Math.max(0, shown.length - 1));
    palList.textContent = '';
    if (!shown.length) {
      const li = document.createElement('li');
      li.className = 'pal-empty'; li.textContent = 'No matching command — try “party” or “sticker”';
      palList.appendChild(li); return;
    }
    shown.forEach((c, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.className = i === active ? 'on' : '';
      const ic = document.createElement('span'); ic.className = 'pal-ic'; ic.textContent = c.icon;
      const lb = document.createElement('span'); lb.className = 'pal-lb'; lb.textContent = c.label;
      const ht = document.createElement('span'); ht.className = 'pal-ht mono'; ht.textContent = c.hint;
      li.append(ic, lb, ht);
      li.addEventListener('pointermove', () => { if (active !== i) { active = i; markActive(); } });
      li.addEventListener('click', () => run(i));
      palList.appendChild(li);
    });
  }
  function markActive() {
    [...palList.children].forEach((li, i) => li.classList.toggle('on', i === active));
    const on = palList.children[active];
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  function run(i) {
    const c = shown[i]; if (!c) return;
    closePal();
    setTimeout(c.run, 120);
  }
  function openPal() {
    pal.hidden = false;
    palInput.value = ''; active = 0; renderPal();
    requestAnimationFrame(() => { pal.classList.add('open'); palInput.focus(); });
    sfx.blip();
  }
  function closePal() {
    pal.classList.remove('open');
    setTimeout(() => { pal.hidden = true; }, 180);
  }
  palInput.addEventListener('input', () => { active = 0; renderPal(); });
  pal.addEventListener('pointerdown', (e) => { if (e.target === pal) closePal(); });
  $('#kHint').addEventListener('click', openPal);

  window.addEventListener('keydown', (e) => {
    const typing = /^(input|textarea)$/i.test(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? openPal() : closePal(); return; }
    if (e.key === '/' && !typing && pal.hidden) { e.preventDefault(); openPal(); return; }
    if (pal.hidden) return;
    if (e.key === 'Escape') { closePal(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, shown.length); markActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + shown.length) % Math.max(1, shown.length); markActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(active); }
  });

  /* ---------------------------------------------------------
     LIVE GITHUB FEED (public API, degrades silently)
  --------------------------------------------------------- */
  const ghBox = $('#ghLive');
  const ago = (iso) => {
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 3600) return Math.max(1, Math.round(d / 60)) + 'm ago';
    if (d < 86400) return Math.round(d / 3600) + 'h ago';
    if (d < 86400 * 30) return Math.round(d / 86400) + 'd ago';
    if (d < 86400 * 365) return Math.round(d / 86400 / 30) + 'mo ago';
    return Math.round(d / 86400 / 365) + 'y ago';
  };
  const LANG_COL = { Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c', 'Jupyter Notebook': '#DA5B0B' };
  let ghLoaded = false;
  async function loadGH() {
    if (ghLoaded || !ghBox) return;
    ghLoaded = true;
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 7000);
      const get = (u) => fetch(u, { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
      const [user, repos] = await Promise.all([
        get('https://api.github.com/users/Prabkiratt'),
        get('https://api.github.com/users/Prabkiratt/repos?sort=pushed&per_page=8'),
      ]);
      clearTimeout(to);
      const list = repos.filter((r) => !r.fork).slice(0, 6);
      if (!list.length) return;
      $('#ghStats').textContent = `${user.public_repos} repos · ${user.followers} followers · joined ${new Date(user.created_at).getFullYear()}`;
      const grid = $('#ghGrid');
      list.forEach((r) => {
        const a = document.createElement('a');
        a.className = 'gh-card'; a.href = r.html_url; a.target = '_blank'; a.rel = 'noopener';
        const h = document.createElement('h4'); h.textContent = r.name;
        const p = document.createElement('p'); p.textContent = r.description || 'No description yet — more soon.';
        const meta = document.createElement('div'); meta.className = 'gh-meta mono';
        if (r.language) {
          const l = document.createElement('span');
          const dot = document.createElement('i'); dot.style.background = LANG_COL[r.language] || '#8b6cff';
          l.append(dot, document.createTextNode(r.language)); meta.appendChild(l);
        }
        const st = document.createElement('span'); st.textContent = '★ ' + r.stargazers_count; meta.appendChild(st);
        const up = document.createElement('span'); up.textContent = 'pushed ' + ago(r.pushed_at); meta.appendChild(up);
        a.append(h, p, meta);
        grid.appendChild(a);
      });
      ghBox.hidden = false;
      ghBox.classList.add('in');
    } catch (e) { /* offline or rate-limited: keep the block hidden */ }
  }
  const proj = $('#projects');
  if (proj && ghBox) new IntersectionObserver((en, ob) => { if (en[0].isIntersecting) { ob.disconnect(); loadGH(); } }, { rootMargin: '300px' }).observe(proj);

  // console easter egg
  console.log('%c Hi recruiter 👋 ', 'background:linear-gradient(90deg,#22d3ee,#8b6cff,#ff4d9d);color:#05060f;font:700 16px monospace;padding:6px 10px;border-radius:6px');
  console.log('Press Ctrl+K for the command palette, or try ↑ ↑ ↓ ↓ ← → ← → B A.');
})();
