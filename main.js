/* =========================================================
   Prabhkirat Singh — 3D Portfolio
   Three.js scene + scroll choreography + UI micro-interactions
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const state = {
    mx: 0, my: 0,          // smoothed mouse (-1..1)
    tmx: 0, tmy: 0,        // target mouse
    scroll: 0, vel: 0,
    pulse: 0,
  };

  /* ---------- LOADER ---------- */
  const loader = $('#loader');
  const loaderNum = $('#loaderNum');
  let loadVal = 0, pageLoaded = document.readyState === 'complete';
  window.addEventListener('load', () => (pageLoaded = true));

  function revealSite() {
    loader.classList.add('done');
    document.body.classList.remove('loading');
    document.body.classList.add('ready');
    $$('.hero .reveal').forEach((el, i) => {
      el.style.setProperty('--i', i);
      el.classList.add('in');
    });
    startTyped();
    state.intro = performance.now();
  }
  const loaderTimer = setInterval(() => {
    const target = pageLoaded ? 100 : 88;
    loadVal += (target - loadVal) * 0.07 + 0.35;
    loadVal = Math.min(loadVal, target);
    loaderNum.textContent = Math.round(loadVal);
    if (loadVal >= 99.5 && pageLoaded) {
      clearInterval(loaderTimer);
      loaderNum.textContent = '100';
      setTimeout(revealSite, 350);
    }
  }, 30);

  /* ---------- THREE.JS SCENE ---------- */
  const canvas = $('#bg');
  let renderer, scene, camera, orb, sphereMat, wire, rings = [], satellites = [], field, shards, glow;
  const CAM_Z = 9;
  const palettes = {
    home:     ['#3b1fd1', '#22d3ee', '#ff4d9d'],
    about:    ['#5b21b6', '#8b6cff', '#22d3ee'],
    twin:     ['#0e7490', '#22d3ee', '#ff4d9d'],
    projects: ['#9d174d', '#ff4d9d', '#ffb347'],
    skills:   ['#0e7490', '#22d3ee', '#b6ff5c'],
    journey:  ['#312e81', '#8b6cff', '#ff4d9d'],
    contact:  ['#4c1d95', '#ff4d9d', '#22d3ee'],
  };
  const sectionIds = ['home', 'about', 'twin', 'projects', 'skills', 'journey', 'contact'];
  const sections = sectionIds.map((id) => document.getElementById(id));

  // Orb anchors in normalised screen space (-1..1), per section (desktop / mobile)
  const anchors = {
    home:     { d: [0.58, 0.0, 1.45],  m: [0.0, -0.42, 0.78] },
    about:    { d: [0.95, 0.72, 0.62], m: [0.85, 0.8, 0.45] },
    twin:     { d: [-0.96, 0.78, 0.5], m: [0.85, 0.85, 0.35] },
    projects: { d: [0.95, 0.7, 0.58],  m: [0.85, 0.82, 0.42] },
    skills:   { dyn: true },
    journey:  { d: [0.92, -0.15, 0.55], m: [0.9, 0.7, 0.4] },
    contact:  { d: [0.0, 0.3, 1.5],    m: [0.0, 0.4, 1.1] },
  };

  function initThree() {
    if (typeof THREE === 'undefined') { canvas.style.display = 'none'; return false; }
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { canvas.style.display = 'none'; return false; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, 0, CAM_Z);

    /* --- hero orb --- */
    orb = new THREE.Group();
    scene.add(orb);

    const noise = `
      vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
      float snoise(vec3 v){
        const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
        vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
        vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
        vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
        vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
        i=mod289(i);
        vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
        float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
        vec4 j=p-49.0*floor(p*ns.z*ns.z);
        vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
        vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
        vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
        vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
        vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
        vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
        vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
        vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
        return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }`;

    sphereMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uAmp: { value: 0.36 }, uPulse: { value: 0 },
        uC1: { value: new THREE.Color(palettes.home[0]) },
        uC2: { value: new THREE.Color(palettes.home[1]) },
        uC3: { value: new THREE.Color(palettes.home[2]) },
      },
      vertexShader: `
        uniform float uTime, uAmp, uPulse;
        varying vec3 vNormal; varying vec3 vView; varying float vNoise;
        ${noise}
        float disp(vec3 p){
          return snoise(p*1.05+vec3(0.0,uTime*0.28,uTime*0.17))*0.55 + snoise(p*2.4-vec3(uTime*0.22))*0.18;
        }
        void main(){
          vec3 p = position;
          float amp = uAmp + uPulse*0.4;
          float d = disp(p);
          vec3 np = p + normal*d*amp;
          float e = 0.025;
          vec3 t = normalize(cross(normal, vec3(0.0,1.0,0.0)) + vec3(0.0001));
          vec3 b = normalize(cross(normal, t));
          vec3 q1 = (p + t*e) + normal*disp(p + t*e)*amp;
          vec3 q2 = (p + b*e) + normal*disp(p + b*e)*amp;
          vec3 n = normalize(cross(q1-np, q2-np));
          if (dot(n, normal) < 0.0) n = -n;
          vNormal = normalize(normalMatrix * n);
          vec4 mv = modelViewMatrix * vec4(np, 1.0);
          vView = -mv.xyz;
          vNoise = d;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uC1, uC2, uC3; uniform float uTime;
        varying vec3 vNormal; varying vec3 vView; varying float vNoise;
        void main(){
          vec3 n = normalize(vNormal); vec3 v = normalize(vView);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 2.4);
          vec3 L = normalize(vec3(0.55, 0.8, 0.75));
          float diff = max(dot(n, L), 0.0)*0.75 + 0.25;
          float t = vNoise*0.9 + 0.5;
          vec3 col = mix(uC1, uC2, smoothstep(0.05, 0.85, t + n.y*0.35));
          col = mix(col, uC3, smoothstep(0.5, 1.05, t + fres*0.7 + sin(uTime*0.6 + n.x*3.0)*0.08));
          col *= diff;
          col += fres * mix(uC2, uC3, 0.5) * 1.5;
          vec3 h = normalize(L + v);
          col += pow(max(dot(n, h), 0.0), 60.0) * 0.8;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.55, 128, 128), sphereMat);
    orb.add(core);

    wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.3, 2),
      new THREE.MeshBasicMaterial({ color: 0x8b6cff, wireframe: true, transparent: true, opacity: 0.22 })
    );
    orb.add(wire);

    const ringCols = [0x22d3ee, 0x8b6cff, 0xff4d9d];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.75 + i * 0.35, 0.012, 8, 220),
        new THREE.MeshBasicMaterial({ color: ringCols[i], transparent: true, opacity: 0.75 })
      );
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.55;
      ring.rotation.y = i * 0.7;
      orb.add(ring);
      rings.push(ring);
      const sat = new THREE.Mesh(
        new THREE.SphereGeometry(0.075 + i * 0.01, 16, 16),
        new THREE.MeshBasicMaterial({ color: ringCols[i] })
      );
      ring.add(sat);
      satellites.push({ mesh: sat, r: 2.75 + i * 0.35, speed: 0.5 + i * 0.22, off: i * 2.1 });
    }

    // soft glow sprite
    const gc = document.createElement('canvas');
    gc.width = gc.height = 256;
    const gx = gc.getContext('2d');
    const gg = gx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gg.addColorStop(0, 'rgba(255,255,255,0.55)');
    gg.addColorStop(0.35, 'rgba(255,255,255,0.14)');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    gx.fillStyle = gg; gx.fillRect(0, 0, 256, 256);
    const glowTex = new THREE.CanvasTexture(gc);
    glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x8b6cff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(9, 9, 1);
    glow.position.z = -1;
    orb.add(glow);

    /* --- particle field --- */
    const N = innerWidth < 760 ? 1200 : 2600;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const pal = [new THREE.Color('#22d3ee'), new THREE.Color('#8b6cff'), new THREE.Color('#ff4d9d'), new THREE.Color('#ffffff')];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 38;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 2] = -22 + Math.random() * 30;
      const c = pal[(Math.random() * pal.length) | 0];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dc = document.createElement('canvas');
    dc.width = dc.height = 64;
    const dx = dc.getContext('2d');
    const dg = dx.createRadialGradient(32, 32, 0, 32, 32, 32);
    dg.addColorStop(0, 'rgba(255,255,255,1)');
    dg.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    dg.addColorStop(1, 'rgba(255,255,255,0)');
    dx.fillStyle = dg; dx.fillRect(0, 0, 64, 64);
    field = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 0.11, map: new THREE.CanvasTexture(dc), vertexColors: true, transparent: true,
      opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    scene.add(field);

    /* --- floating shards --- */
    shards = new THREE.Group();
    scene.add(shards);
    const geos = [
      new THREE.OctahedronGeometry(0.42),
      new THREE.TetrahedronGeometry(0.5),
      new THREE.IcosahedronGeometry(0.36, 0),
      new THREE.TorusKnotGeometry(0.28, 0.08, 64, 8),
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
    ];
    const wireCols = [0x22d3ee, 0x8b6cff, 0xff4d9d, 0xb6ff5c];
    const shardCount = innerWidth < 760 ? 12 : 24;
    for (let i = 0; i < shardCount; i++) {
      const g = geos[i % geos.length];
      const solid = i % 3 === 0;
      const m = solid
        ? new THREE.MeshNormalMaterial({ flatShading: true })
        : new THREE.MeshBasicMaterial({ color: wireCols[i % wireCols.length], wireframe: true, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(g, m);
      const s = 0.6 + Math.random() * 1.1;
      mesh.scale.setScalar(s);
      mesh.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 24, -7 + Math.random() * 9);
      mesh.userData = {
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.6),
        phase: Math.random() * 6.28, base: mesh.position.y, amp: 0.2 + Math.random() * 0.4,
      };
      shards.add(mesh);
    }

    resize();
    return true;
  }

  function resize() {
    if (!renderer) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  // screen (-1..1) → world on z=0 plane
  function toWorld(nx, ny) {
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * CAM_Z;
    return { x: nx * halfH * camera.aspect, y: ny * halfH, ppu: innerHeight / (2 * halfH) };
  }

  const colA = typeof THREE !== 'undefined' ? [new THREE.Color(), new THREE.Color(), new THREE.Color()] : [];
  const colB = typeof THREE !== 'undefined' ? [new THREE.Color(), new THREE.Color(), new THREE.Color()] : [];

  function anchorFor(id, mobile) {
    const a = anchors[id];
    if (a.dyn) {
      const el = $('#skillSphere');
      const r = el.getBoundingClientRect();
      const cx = ((r.left + r.width / 2) / innerWidth) * 2 - 1;
      const cy = -(((r.top + r.height / 2) / innerHeight) * 2 - 1);
      const { ppu } = toWorld(0, 0);
      const s = (r.width * 0.5) / (3.1 * ppu);
      return [cx, cy, s];
    }
    return mobile ? a.m : a.d;
  }

  const target = { x: 0, y: 0, s: 1 };
  const cur = { x: 0, y: 0, s: 0.001 };
  let lastY = 0;

  function frame(t) {
    const time = t * 0.001;
    const mobile = innerWidth < 760;

    // smooth input
    state.mx += (state.tmx - state.mx) * 0.06;
    state.my += (state.tmy - state.my) * 0.06;
    const y = window.scrollY;
    const dv = y - lastY; lastY = y;
    state.vel += (Math.min(Math.abs(dv), 80) - state.vel) * 0.1;
    state.pulse *= 0.94;

    if (renderer) {
      // which section pair are we between?
      const mid = y + innerHeight * 0.5;
      let i = 0;
      for (let k = 0; k < sections.length; k++) if (sections[k].offsetTop <= mid) i = k;
      const a = sections[i], b = sections[Math.min(i + 1, sections.length - 1)];
      const span = Math.max(1, (b === a ? a.offsetHeight : b.offsetTop - a.offsetTop));
      const f = b === a ? 0 : smooth(0.55, 1.0, (mid - a.offsetTop) / span);

      const A = anchorFor(sectionIds[i], mobile);
      const B = anchorFor(sectionIds[Math.min(i + 1, sections.length - 1)], mobile);
      const nx = lerp(A[0], B[0], f), ny = lerp(A[1], B[1], f), ns = lerp(A[2], B[2], f);
      const w = toWorld(nx, ny);
      target.x = w.x; target.y = w.y; target.s = ns;

      // intro scale-in
      const introK = state.intro ? smooth(0, 1800, performance.now() - state.intro) : 0;
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;
      cur.s += (target.s * introK - cur.s) * 0.08;

      orb.position.set(cur.x, cur.y + Math.sin(time * 0.8) * 0.12, 0);
      orb.scale.setScalar(Math.max(cur.s, 0.0001));
      orb.rotation.y = time * 0.18 + state.mx * 0.7 + y * 0.0009;
      orb.rotation.x = state.my * 0.35 + Math.sin(time * 0.3) * 0.08;
      wire.rotation.y = -time * 0.12;
      wire.rotation.x = time * 0.07;
      rings.forEach((r, k) => { r.rotation.z = time * (0.12 + k * 0.07) * (k % 2 ? -1 : 1); });
      satellites.forEach((s) => {
        const ang = time * s.speed + s.off;
        s.mesh.position.set(Math.cos(ang) * s.r, Math.sin(ang) * s.r, 0);
      });

      // palette blend
      const pa = palettes[sectionIds[i]], pb = palettes[sectionIds[Math.min(i + 1, sections.length - 1)]];
      const u = sphereMat.uniforms;
      for (let c = 0; c < 3; c++) {
        colA[c].set(pa[c]); colB[c].set(pb[c]);
        colA[c].lerp(colB[c], f);
      }
      u.uC1.value.lerp(colA[0], 0.08);
      u.uC2.value.lerp(colA[1], 0.08);
      u.uC3.value.lerp(colA[2], 0.08);
      glow.material.color.lerp(colA[1], 0.08);
      wire.material.color.lerp(colA[1], 0.08);

      u.uTime.value = time;
      u.uPulse.value = state.pulse;
      u.uAmp.value = 0.34 + Math.min(state.vel * 0.012, 0.35);

      // field & shards
      field.rotation.y = time * 0.02 + state.mx * 0.08;
      field.rotation.x = state.my * 0.05;
      field.position.y = y * 0.0007;
      field.position.z = Math.sin(y * 0.0008) * 2;
      shards.position.y = y * 0.0019;
      shards.rotation.y = state.mx * 0.12;
      shards.children.forEach((m) => {
        const d = m.userData;
        m.rotation.x += d.spin.x * 0.01;
        m.rotation.y += d.spin.y * 0.01;
        m.rotation.z += d.spin.z * 0.01;
        m.position.y = d.base + Math.sin(time * 0.6 + d.phase) * d.amp;
      });

      camera.position.x += (state.mx * 0.6 - camera.position.x) * 0.05;
      camera.position.y += (-state.my * 0.4 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    /* UI loops that share the frame */
    updateCursor();
    updateMagnets();
    updateSphere(time);

    requestAnimationFrame(frame);
  }

  /* ---------- POINTER ---------- */
  window.addEventListener('pointermove', (e) => {
    state.tmx = (e.clientX / innerWidth) * 2 - 1;
    state.tmy = (e.clientY / innerHeight) * 2 - 1;
    cur2.tx = e.clientX; cur2.ty = e.clientY;
    if (!document.body.classList.contains('has-cursor') && finePointer) document.body.classList.add('has-cursor');
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, [data-tilt], .sphere, .skill-group')) return;
    state.pulse = 1;
  });

  /* ---------- CUSTOM CURSOR ---------- */
  const dot = $('#cursorDot'), ring = $('#cursorRing');
  const cur2 = { x: -100, y: -100, tx: -100, ty: -100 };
  function updateCursor() {
    if (!finePointer) return;
    cur2.x += (cur2.tx - cur2.x) * 0.18;
    cur2.y += (cur2.ty - cur2.y) * 0.18;
    dot.style.transform = `translate3d(${cur2.tx}px, ${cur2.ty}px, 0)`;
    ring.style.transform = `translate3d(${cur2.x}px, ${cur2.y}px, 0)`;
  }
  document.addEventListener('pointerover', (e) => {
    ring.classList.toggle('hover', !!e.target.closest('a, button, [data-magnetic], [data-tilt], .sphere'));
  });

  /* ---------- MAGNETIC ELEMENTS ---------- */
  const magnets = $$('[data-magnetic]').map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0 }));
  if (finePointer) {
    magnets.forEach((m) => {
      m.el.addEventListener('pointermove', (e) => {
        const r = m.el.getBoundingClientRect();
        m.tx = (e.clientX - (r.left + r.width / 2)) * 0.28;
        m.ty = (e.clientY - (r.top + r.height / 2)) * 0.38;
      });
      m.el.addEventListener('pointerleave', () => { m.tx = 0; m.ty = 0; });
    });
  }
  function updateMagnets() {
    for (const m of magnets) {
      if (Math.abs(m.x - m.tx) < 0.05 && Math.abs(m.y - m.ty) < 0.05 && !m.tx && !m.ty) {
        if (m.x || m.y) { m.x = m.y = 0; m.el.style.translate = ''; }
        continue;
      }
      m.x += (m.tx - m.x) * 0.2;
      m.y += (m.ty - m.y) * 0.2;
      m.el.style.translate = `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
    }
  }

  /* ---------- 3D TILT CARDS ---------- */
  $$('[data-tilt]').forEach((el) => {
    if (!finePointer) return;
    const max = el.classList.contains('id-card') ? 16 : el.classList.contains('project') ? 5 : el.classList.contains('t-card') ? 5 : 9;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.classList.add('moving');
      el.style.transform = `perspective(1000px) rotateX(${((0.5 - py) * max * 2).toFixed(2)}deg) rotateY(${((px - 0.5) * max * 2).toFixed(2)}deg) translateZ(0)`;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('moving');
      el.style.transform = '';
    });
  });

  /* ---------- SCROLL UI ---------- */
  const progress = $('#progress');
  const nav = $('#nav');
  const navLinks = $$('#navLinks a');
  const timelineFill = $('#timelineFill');
  const timeline = $('.timeline');
  let prevY = 0;
  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle('hide', y > prevY && y > 260);
    prevY = y;
    if (timeline) {
      const r = timeline.getBoundingClientRect();
      timelineFill.style.height = `${clamp((innerHeight * 0.65 - r.top) / r.height) * 100}%`;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => s && spy.observe(s));

  /* ---------- REVEAL ON SCROLL + COUNT-UP ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      $$('.count', en.target).forEach(countUp);
      io.unobserve(en.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((el) => { if (!el.closest('.hero')) io.observe(el); });

  function countUp(el) {
    const to = +el.dataset.to;
    const t0 = performance.now(), dur = 1400;
    (function step(now) {
      const k = clamp((now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- TYPED ROLE ---------- */
  const typedEl = $('#typed');
  const roles = ['Python Developer', 'AI Engineering Enthusiast', 'Data Analyst in the making', 'UI/UX-trained builder', 'Agentic AI explorer'];
  let typedStarted = false;
  function startTyped() {
    if (typedStarted) return; typedStarted = true;
    let r = 0, c = 0, del = false;
    (function tick() {
      const word = roles[r];
      typedEl.textContent = word.slice(0, c);
      if (!del && c === word.length) { del = true; return setTimeout(tick, 1500); }
      if (del && c === 0) { del = false; r = (r + 1) % roles.length; }
      c += del ? -1 : 1;
      setTimeout(tick, del ? 28 : 65);
    })();
  }

  /* ---------- SKILL SPHERE (3D tag cloud) ---------- */
  const sphere = $('#skillSphere');
  const skills = [
    ['Python', '#22d3ee'], ['SQL', '#22d3ee'], ['TypeScript', '#22d3ee'], ['HTML', '#22d3ee'],
    ['Pandas', '#8b6cff'], ['NumPy', '#8b6cff'], ['Matplotlib', '#8b6cff'], ['Seaborn', '#8b6cff'], ['Scikit-learn', '#8b6cff'],
    ['Machine Learning', '#ff4d9d'], ['LLMs', '#ff4d9d'], ['Agentic AI', '#ff4d9d'], ['NLP', '#ff4d9d'], ['Deep Learning', '#ff4d9d'],
    ['Data Analysis', '#ff4d9d'], ['Statistics', '#ff4d9d'], ['Data Viz', '#ff4d9d'], ['UI/UX', '#ff4d9d'],
    ['Power BI', '#b6ff5c'], ['Tableau', '#b6ff5c'], ['Excel', '#b6ff5c'], ['MySQL', '#b6ff5c'], ['Firebase', '#b6ff5c'],
    ['Vite', '#b6ff5c'], ['Git', '#b6ff5c'], ['GitHub', '#b6ff5c'], ['Jupyter', '#b6ff5c'], ['Colab', '#b6ff5c'],
    ['Problem Solving', '#ffb347'], ['Critical Thinking', '#ffb347'],
  ];
  const tags = skills.map(([label, color], i) => {
    const n = skills.length;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
    const el = document.createElement('span');
    el.className = 's-tag';
    el.textContent = label;
    el.style.color = color;
    sphere.appendChild(el);
    return {
      el,
      x: Math.cos(theta) * Math.sin(phi),
      y: Math.cos(phi),
      z: Math.sin(theta) * Math.sin(phi),
    };
  });
  const sp = { rx: 0.2, ry: 0, vx: 0, vy: 0.004, drag: false, lx: 0, ly: 0 };
  sphere.addEventListener('pointerdown', (e) => {
    sp.drag = true; sp.lx = e.clientX; sp.ly = e.clientY;
    sphere.setPointerCapture(e.pointerId);
  });
  sphere.addEventListener('pointermove', (e) => {
    if (!sp.drag) return;
    sp.vy = (e.clientX - sp.lx) * 0.006;
    sp.vx = (e.clientY - sp.ly) * -0.006;
    sp.lx = e.clientX; sp.ly = e.clientY;
  });
  const endDrag = () => (sp.drag = false);
  sphere.addEventListener('pointerup', endDrag);
  sphere.addEventListener('pointercancel', endDrag);

  function updateSphere() {
    if (!sp.drag) {
      sp.vx *= 0.96;
      sp.vy += (0.004 - sp.vy) * 0.02;
    }
    sp.rx += sp.vx; sp.ry += sp.vy;
    const cx = Math.cos(sp.rx), sx = Math.sin(sp.rx), cy = Math.cos(sp.ry), sy = Math.sin(sp.ry);
    const R = sphere.clientWidth * 0.42;
    for (const t of tags) {
      // rotate Y then X
      const x1 = t.x * cy + t.z * sy;
      const z1 = -t.x * sy + t.z * cy;
      const y2 = t.y * cx - z1 * sx;
      const z2 = t.y * sx + z1 * cx;
      const d = (z2 + 1) / 2;
      const s = 0.55 + d * 0.65;
      t.el.style.transform = `translate(-50%, -50%) translate3d(${(x1 * R).toFixed(1)}px, ${(y2 * R).toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      t.el.style.opacity = (0.18 + d * 0.82).toFixed(2);
      t.el.style.zIndex = Math.round(d * 100);
    }
  }

  /* ---------- SMARTCROWD DEMO VISUAL ---------- */
  const barsWrap = $('#vizBars');
  const bars = [];
  for (let i = 0; i < 18; i++) { const b = document.createElement('i'); barsWrap.appendChild(b); bars.push(b); }
  const vizDensity = $('#vizDensity'), vizQueue = $('#vizQueue');
  const vizStatus = $('.viz-foot b.ok');
  let vizT = 0;
  function vizTick() {
    vizT += 0.7;
    let sum = 0;
    bars.forEach((b, i) => {
      const v = 38 + 38 * Math.sin(vizT + i * 0.55) * Math.cos(vizT * 0.4 + i * 0.2) + Math.random() * 14;
      const h = clamp(v, 8, 100);
      sum += h;
      b.style.height = h + '%';
      b.classList.toggle('hot', h > 78);
    });
    const avg = sum / bars.length;
    vizDensity.textContent = Math.round(avg) + '%';
    vizQueue.textContent = Math.round(avg * 0.26);
    const hot = avg > 62;
    vizStatus.textContent = hot ? 'Crowded' : 'Normal';
    vizStatus.classList.toggle('warn', hot);
    vizStatus.classList.toggle('ok', !hot);
  }
  vizTick();
  setInterval(vizTick, 1000);

  /* ---------- COPY EMAIL ---------- */
  const toast = $('#toast');
  $('#copyEmail').addEventListener('click', async () => {
    const email = 'prabhkirat1006@gmail.com';
    try { await navigator.clipboard.writeText(email); toast.textContent = 'Email copied to clipboard ✓'; }
    catch { toast.textContent = email; }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  });


  /* ---------- AI TWIN: particle avatar built from the photo ---------- */
  (function initTwin() {
    const stage = $('#twinStage'), cv = $('#twinCanvas');
    if (!stage || typeof THREE === 'undefined' || !window.AVATAR_DATA_URI) return;
    let tr;
    try { tr = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true }); } catch (e) { return; }
    tr.setClearColor(0x000000, 0);

    const tScene = new THREE.Scene();
    const tCam = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    tCam.position.set(0, 0.15, 10.5);
    const group = new THREE.Group();
    tScene.add(group);

    const uni = {
      uTime: { value: 0 }, uMix: { value: 1 }, uMode: { value: 0 }, uSpeak: { value: 0 },
      uPx: { value: 1 }, uMouse: { value: new THREE.Vector2(99, 99) },
      uShock: { value: new THREE.Vector3(0, 0, -99) },
    };
    let points = null, visible = false;
    const stat = $('#twinStat'), modeLbl = $('#twinMode');
    const modeNames = ['REAL', 'HOLOGRAM', 'NEON', 'MATRIX'];

    /* mix tween (scatter <-> assemble) */
    let mixAnim = null;
    function tween(from, to, ms, delay) {
      mixAnim = { from, to, ms, t0: performance.now() + (delay || 0) };
    }

    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const { data } = g.getImageData(0, 0, c.width, c.height);
      const stride = innerWidth < 760 ? 2 : 1;
      const unit = 5.3 / c.height;
      const T = [], C = [], S = [], R = [];
      for (let y = 0; y < c.height; y += stride) {
        for (let x = 0; x < c.width; x += stride) {
          const i = (y * c.width + x) * 4;
          if (data[i + 3] < 128) continue;
          const r = data[i] / 255, gg = data[i + 1] / 255, b = data[i + 2] / 255;
          const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
          T.push((x - c.width / 2 + (Math.random() - 0.5)) * unit, (c.height * 0.5 - y + (Math.random() - 0.5)) * unit, (lum - 0.4) * 0.35 + (Math.random() - 0.5) * 0.12);
          C.push(r, gg, b);
          const a = Math.random() * Math.PI * 2, rad = 3 + Math.random() * 9, el = (Math.random() - 0.5) * 2.2;
          S.push(Math.cos(a) * rad, el * 3.2, Math.sin(a) * rad - 3);
          R.push(Math.random());
        }
      }
      const n = R.length;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('aTarget', new THREE.BufferAttribute(new Float32Array(T), 3));
      geo.setAttribute('aScatter', new THREE.BufferAttribute(new Float32Array(S), 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(C), 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(R), 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `
          attribute vec3 aTarget; attribute vec3 aScatter; attribute vec3 aColor; attribute float aSeed;
          uniform float uTime, uMix, uMode, uSpeak, uPx; uniform vec2 uMouse; uniform vec3 uShock;
          varying vec3 vCol; varying float vA;
          void main(){
            float k = clamp(uMix, 0.0, 1.0); k = k*k*(3.0-2.0*k);
            vec3 sc = aScatter + vec3(sin(uTime*0.5 + aSeed*20.0)*0.9, cos(uTime*0.4 + aSeed*17.0)*0.9, sin(uTime*0.3 + aSeed*9.0)*0.9);
            vec3 p = mix(aTarget, sc, k);
            p.y += sin(uTime*1.1 + aTarget.x*0.9) * 0.012;
            p.z += sin(uTime*0.8 + aSeed*6.283) * 0.03;
            p.z += sin(uTime*22.0 + aTarget.y*9.0) * 0.05 * uSpeak;
            p.x += sin(uTime*17.0 + aTarget.y*7.0) * 0.012 * uSpeak;
            if (uMode > 0.5 && uMode < 1.5) {
              float gl = step(0.985, sin(aTarget.y*5.0 + uTime*2.5));
              p.x += gl * 0.14 * sin(uTime*40.0 + aSeed*3.0);
            }
            vec2 d = p.xy - uMouse; float dl = length(d);
            float rep = smoothstep(1.25, 0.0, dl);
            p.xy += normalize(d + vec2(0.0001)) * rep * 0.6;
            p.z += rep * (aSeed - 0.5) * 1.4;
            float age = uTime - uShock.z;
            if (age > 0.0 && age < 3.5) {
              vec2 sd = p.xy - uShock.xy; float sl = length(sd);
              float ring = exp(-pow(sl - age*4.5, 2.0)*2.5) * exp(-age*1.1);
              p.xy += normalize(sd + vec2(0.0001)) * ring * 1.2;
              p.z += ring * (aSeed - 0.5) * 2.4;
            }
            float lum = dot(aColor, vec3(0.299, 0.587, 0.114));
            vec3 col;
            if (uMode < 0.5) {
              col = aColor*1.7 + vec3(0.14, 0.17, 0.38);
            } else if (uMode < 1.5) {
              float scan = 0.55 + 0.45*sin(p.y*70.0 - uTime*5.0);
              col = vec3(0.10, 0.85, 1.0) * (0.35 + lum*1.5) * scan + vec3(0.02, 0.05, 0.14);
              col += vec3(0.5, 0.2, 1.0) * step(0.97, fract(aSeed*13.0 + uTime*0.3)) * 0.8;
            } else if (uMode < 2.5) {
              float l = floor(lum*5.0)/4.0;
              col = mix(vec3(0.30, 0.12, 1.0), vec3(1.0, 0.18, 0.6), smoothstep(0.0, 0.35, l));
              col = mix(col, vec3(0.1, 0.9, 1.0), smoothstep(0.35, 0.7, l));
              col = mix(col, vec3(1.0, 1.0, 0.8), smoothstep(0.7, 1.0, l));
              col = col * (0.75 + 0.15*sin(uTime*2.0 + aSeed*6.283)) + vec3(0.06, 0.02, 0.15);
            } else {
              float rain = fract(-aTarget.y*0.35 + floor(aTarget.x*38.0)*0.371 + uTime*0.55);
              col = vec3(0.08, 1.0, 0.35) * (0.22 + lum*1.3) * (0.3 + 1.6*pow(rain, 3.0)) + vec3(0.0, 0.05, 0.02);
              col += vec3(0.7, 1.0, 0.8) * pow(rain, 14.0);
            }
            vCol = col;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uPx * (2.3 + aSeed*1.3) * (10.5 / -mv.z) * (1.0 + k*0.6);
            vA = 0.55 + 0.45*(1.0 - k*0.5);
          }`,
        fragmentShader: `
          varying vec3 vCol; varying float vA;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.05, d);
            gl_FragColor = vec4(vCol, a * vA);
          }`,
      });
      points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      group.add(points);
      stat.textContent = 'PARTICLES ' + n.toLocaleString('en-US');
      tween(1, 0, 2200, 0);   // materialise
    };
    img.src = window.AVATAR_DATA_URI;

    function explode() {
      uni.uShock.value.set(0, 0, uni.uTime.value);
      tween(uni.uMix.value, 1, 650, 0);
      setTimeout(() => tween(1, 0, 2100, 0), 1500);
    }
    function setMode(m) {
      uni.uMode.value = m;
      modeLbl.textContent = 'MODE: ' + modeNames[m];
      $$('.mode-btn[data-mode]').forEach((b) => b.classList.toggle('active', +b.dataset.mode === m));
      uni.uShock.value.set(0, -0.5, uni.uTime.value);
    }
    $$('.mode-btn[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(+b.dataset.mode)));
    $('#boomBtn').addEventListener('click', explode);

    /* pointer → local coords */
    const want = { x: 0, y: 0 }, rot = { x: 0, y: 0 };
    function toLocal(e) {
      const r = cv.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
      const halfH = Math.tan((tCam.fov * Math.PI) / 360) * tCam.position.z;
      return { x: nx * halfH * tCam.aspect, y: ny * halfH + tCam.position.y, nx, ny };
    }
    cv.addEventListener('pointermove', (e) => {
      const p = toLocal(e);
      uni.uMouse.value.set(p.x, p.y);
      want.x = p.nx; want.y = p.ny;
    });
    cv.addEventListener('pointerleave', () => { uni.uMouse.value.set(99, 99); want.x = want.y = 0; });
    cv.addEventListener('pointerdown', (e) => {
      const p = toLocal(e);
      uni.uShock.value.set(p.x, p.y, uni.uTime.value);
    });
    cv.addEventListener('dblclick', explode);

    new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.05 }).observe(stage);

    function sizeTwin() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      tr.setPixelRatio(dpr);
      tr.setSize(w, h, false);
      tCam.aspect = w / h;
      tCam.position.z = tCam.aspect < 0.8 ? 10.5 / Math.max(tCam.aspect / 0.8, 0.62) : 10.5;
      tCam.updateProjectionMatrix();
      uni.uPx.value = dpr * Math.max(0.8, Math.min(1.5, h / 640)) * (innerWidth < 760 ? 1.35 : 1);
    }
    sizeTwin();
    window.addEventListener('resize', sizeTwin);
    if (window.ResizeObserver) new ResizeObserver(sizeTwin).observe(stage);

    let speakUntil = 0;
    window.__twin = { speak(ms) { speakUntil = performance.now() + ms; }, setMode, explode };

    (function loop() {
      requestAnimationFrame(loop);
      if (!visible || !points) return;
      const now = performance.now();
      const t = now * 0.001;
      uni.uTime.value = t;
      if (mixAnim && now >= mixAnim.t0) {
        const k = clamp((now - mixAnim.t0) / mixAnim.ms);
        const e = mixAnim.to > mixAnim.from ? k * k : 1 - Math.pow(1 - k, 3);
        uni.uMix.value = lerp(mixAnim.from, mixAnim.to, e);
        if (k >= 1) mixAnim = null;
      }
      uni.uSpeak.value += ((now < speakUntil ? 1 : 0) - uni.uSpeak.value) * 0.15;
      rot.x += (want.y * -0.12 - rot.x) * 0.06;
      rot.y += (want.x * 0.5 - rot.y) * 0.06;
      group.rotation.y = rot.y + Math.sin(t * 0.45) * 0.14;
      group.rotation.x = rot.x;
      group.position.y = -0.1 + Math.sin(t * 0.9) * 0.05;
      tr.render(tScene, tCam);
    })();
  })();

  /* ---------- AI TWIN: scripted chat ---------- */
  (function initChat() {
    const log = $('#chatLog'), form = $('#chatForm'), input = $('#chatInput'), chips = $('#chatChips');
    if (!log) return;
    const KB = [
      [/contact|email|mail|reach|linkedin|github|phone|call|number/i,
        "You can reach me at prabhkirat1006@gmail.com or +91 88723 26607. I'm also on LinkedIn (prabhkirat-singh-6aa70823b) and GitHub (Prabkiratt). Scroll to the Contact section for one-click links!"],
      [/certif|course|workshop|great learning|coursera|simplilearn|be10x/i,
        "Six so far: AI Fusion 2026 — Agentic AI Workshop (Sep 2026), AI Tools & ChatGPT Workshop by be10X (Oct 2026), Data Analysis with Python and Excel for Data Analysis (Great Learning, 2024), Introduction to SQL (Simplilearn, 2024) and AI For Everyone (Coursera, 2024)."],
      [/stack|skill|tech|tool|librar|python|sql|typescript|pandas|numpy|power ?bi|tableau|excel|firebase/i,
        "Languages: Python, SQL, TypeScript, HTML. Libraries: Pandas, NumPy, Matplotlib, Seaborn, Scikit-learn. Tools: Jupyter, Google Colab, MySQL, Power BI, Tableau, Excel (advanced), Firebase, Vite, VS Code, Git & GitHub. Spin the 3D skill sphere below for the full cloud."],
      [/hire|why|strength|worth|good|best|offer|intern/i,
        "I'm a BCA student (2024–2027) who learns by shipping — real projects, a UI/UX training with Grade A, and fresh Agentic AI and AI-tools workshops. I'm looking for a Python Developer or IT Intern role where I can build, learn fast and contribute from day one."],
      [/build|project|made|make|smartcrowd|crowd|hostel|complaint|work/i,
        "SmartCrowd is my favourite: a TypeScript + Vite + Firebase system that monitors crowd density and queue length in real time with Computer Vision and AI, shown on a smart dashboard. I also built a Python Hostel Complaint Management System, plus data-analysis and ML projects."],
      [/\bai\b|agentic|llm|\bml\b|machine|model|chatbot|nlp|learning|scikit|predict/i,
        "On the AI side I've built an ML model that predicts student performance, an NLP-based chatbot, and classification models with Scikit-learn. I have working basics in LLMs, Agentic AI, NLP and Deep Learning — and I'm going deeper every month."],
      [/educat|study|college|degree|bca|school|pcte|university|cbse/i,
        "I'm pursuing a Bachelor of Computer Applications at PCTE Group of Institutes, Ludhiana (2024–2027). Before that, I completed secondary education at BCM School, Dugri, Ludhiana (CBSE)."],
      [/\bui\b|\bux\b|design|thinknext|training/i,
        "I completed the UI/UX Industrial Training Program at ThinkNEXT Technologies Pvt. Ltd., Mohali (1 June – 3 July 2026) and was awarded Grade A."],
      [/where|location|live|city|punjab|ludhiana/i,
        "Home base is Model Town, Ludhiana, Punjab, India."],
      [/language|speak|hindi|punjabi|english/i,
        "I speak English, Hindi and Punjabi — ਸਤ ਸ੍ਰੀ ਅਕਾਲ!"],
      [/resume|\bcv\b|download/i,
        "Hit the “Résumé” button in the top bar, or the download card in Contact — it's the same PDF this whole site was built from."],
      [/who|name|hello|\bhi\b|hey|\bsup\b|\byo\b/i,
        "I'm the digital twin of Prabhkirat Singh — a Python developer and AI engineering enthusiast. I'm made of thousands of particles sampled from one photo, driven by a tiny scripted brain (no cloud AI). The real one is in Ludhiana, Punjab."],
    ];
    const fallback = "Hmm, that one's outside my scripted brain 🤖. Try asking about my projects, tech stack, certifications, education, AI work, or how to contact me.";

    let busy = false;
    function add(text, who) {
      const el = document.createElement('div');
      el.className = 'msg ' + who;
      el.textContent = text;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }
    function say(text) {
      busy = true;
      const el = add('', 'twin');
      el.classList.add('typing');
      let i = 0;
      if (window.__twin) window.__twin.speak(text.length * 16 + 300);
      (function step() {
        i += 1 + (Math.random() > 0.7 ? 1 : 0);
        el.textContent = text.slice(0, i);
        log.scrollTop = log.scrollHeight;
        if (i < text.length) setTimeout(step, 16);
        else { el.classList.remove('typing'); busy = false; }
      })();
    }
    function ask(q) {
      if (busy || !q.trim()) return;
      add(q, 'me');
      const low = q.toLowerCase();
      const tw = window.__twin;
      const cmd = { matrix: 3, neon: 2, hologram: 1, holo: 1, real: 0, normal: 0 };
      for (const k in cmd) {
        if (new RegExp('\\b' + k + '\\b').test(low) && tw) {
          tw.setMode(cmd[k]);
          return setTimeout(() => say('Mode switched to ' + k.toUpperCase() + '. Looking good, right? ✨'), 350);
        }
      }
      if (/explode|boom|blast|crazy|destroy/.test(low) && tw) {
        tw.explode();
        return setTimeout(() => say("💥 BOOM. Don't worry, I'll reassemble myself… give me a second."), 450);
      }
      const hit = KB.find(([re]) => re.test(q));
      setTimeout(() => say(hit ? hit[1] : fallback), 450);
    }

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) ask(b.textContent);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value;
      input.value = '';
      ask(v);
    });

    let greeted = false;
    new IntersectionObserver((en, ob) => {
      if (en[0].isIntersecting && !greeted) {
        greeted = true; ob.disconnect();
        setTimeout(() => say("Hey, I'm Prabhkirat's digital twin 👋 — thousands of particles, zero cloud AI. Poke me, click me, switch my modes, or ask me anything!"), 900);
      }
    }, { threshold: 0.35 }).observe($('#twin'));
  })();

  /* ---------- BOOT ---------- */
  document.body.classList.add('loading');
  window.addEventListener('resize', resize);
  initThree();
  onScroll();
  requestAnimationFrame(frame);
})();
