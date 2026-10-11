'use strict';
// Alta Voltagem: animação de encerramento (1920x1080, 30fps).
// Tudo é função do tempo t (segundos): renderFrame(t) desenha o quadro exato,
// o que permite renderizar quadro a quadro sem perder nenhum frame.

const W = 1920, H = 1080, FPS = 30;
const C = { indigo: '#4231A6', yellow: '#FFD528', black: '#111118', white: '#FFFFFF' };
const FONT = '"Inter Display", "Inter", sans-serif';

// ---------- linha do tempo (segundos) ----------
const T_OPEN = 0, T_V1 = 10, T_COL = 16, T_V2 = 30, T_FLAG = 36, T_V3 = 50,
  T_TEAM = 55, T_V4 = 70, T_FIN = 75, DUR = 84;

const LEADER = 'GIOVANA';
const TEAM = ['OSÉAS', 'CAUÃ', 'PEDRO', 'SARA', 'GIOVANNA', 'MARCOS VINÍCIUS', 'GUETTA'];
const COLS = [
  { n: 'ÍNDIGO', hex: '#4231A6', c: C.indigo, tc: '#FFFFFF' },
  { n: 'AMARELO', hex: '#FFD528', c: C.yellow, tc: C.black },
  { n: 'PRETO', hex: '#111118', c: C.black, tc: '#FFFFFF' },
  { n: 'BRANCO', hex: '#FFFFFF', c: C.white, tc: C.black },
];
const VERSES = {
  v1: { lines: ['Haja *luz.*'], ref: 'GÊNESIS 1:3', size: 150 },
  v2: { lines: ['Mas receberão *poder*', 'quando o Espírito Santo', 'descer sobre vocês.'], ref: 'ATOS 1:8', size: 72 },
  v3: { lines: ['Vocês são a', '*luz* *do* *mundo.*'], ref: 'MATEUS 5:14', size: 96 },
  v4: { lines: ['Nunca lhes falte o zelo,', 'sejam *fervorosos* no espírito.'], ref: 'ROMANOS 12:11', size: 76 },
};

// ---------- canvases ----------
const cv = document.getElementById('c'), M = cv.getContext('2d');
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const gC = mk(960, 540), G = gC.getContext('2d');           // camada emissiva (meia resolução)
const b1C = mk(480, 270), B1 = b1C.getContext('2d');
const b2C = mk(240, 135), B2 = b2C.getContext('2d');
const shC = mk(1100, 1100), SH = shC.getContext('2d');      // reflexo na logo
const flagTex = mk(1500, 1000);
const flagL = mk(1300, 1100), FL = flagL.getContext('2d');
const vigC = mk(W, H);
const grain = [];

// ---------- matemática ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const eInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eOut = x => 1 - Math.pow(1 - x, 3);
const eIn = x => x * x * x;
const eOutBack = x => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const hash = i => { const r = rng(i * 9973 + 17); r(); return r(); };

// ---------- câmera ----------
let cam;
function applyCam() {
  const c = cam, e = c.px - c.s * c.fx + c.sx, f = c.py - c.s * c.fy + c.sy;
  M.setTransform(c.s, 0, 0, c.s, e, f);
  G.setTransform(c.s * .5, 0, 0, c.s * .5, e * .5, f * .5);
}
function setCam(o) { cam = Object.assign({ s: 1, fx: W / 2, fy: H / 2, px: W / 2, py: H / 2, sx: 0, sy: 0 }, o); applyCam(); }
function shake(t, t0, amp, dec = 6) {
  if (t < t0) return [0, 0];
  const k = amp * Math.exp(-(t - t0) * dec);
  return [k * Math.sin(t * 93.1 + 1.3) * Math.cos(t * 41.7), k * Math.sin(t * 71.3) * Math.cos(t * 57.9 + .7)];
}

// ---------- flashes globais ----------
let FLASH = 0, FLOOD = 0, FADE = 0;
function flash(t, t0, amp, dur) { if (t >= t0) FLASH = Math.max(FLASH, amp * Math.exp(-(t - t0) / dur)); }

// ---------- raios ----------
function boltPts(x1, y1, x2, y2, r, disp, depth) {
  let pts = [[x1, y1], [x2, y2]];
  for (let d = 0; d < depth; d++) {
    const np = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, o = (r() - .5) * 2 * disp;
      np.push([(ax + bx) / 2 - dy / len * o, (ay + by) / 2 + dx / len * o], pts[i + 1]);
    }
    pts = np; disp *= .52;
  }
  return pts;
}
function boltTree(x1, y1, x2, y2, seed, { disp, depth = 6, branches = 3 } = {}) {
  const r = rng(seed), len = Math.hypot(x2 - x1, y2 - y1);
  const main = boltPts(x1, y1, x2, y2, r, disp ?? len * .2, depth), out = [{ pts: main, w: 1 }];
  const base = Math.atan2(y2 - y1, x2 - x1);
  for (let b = 0; b < branches; b++) {
    const p = main[Math.min(main.length - 1, 2 + Math.floor(r() * main.length * .7))];
    const ang = base + (r() < .5 ? -1 : 1) * (.35 + r() * .6), bl = len * (.12 + r() * .25);
    out.push({ pts: boltPts(p[0], p[1], p[0] + Math.cos(ang) * bl, p[1] + Math.sin(ang) * bl, r, bl * .25, Math.max(2, depth - 2)), w: .45 });
  }
  return out;
}
function strokePts(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}
function drawBolt(tree, a = 1, w = 3, col = C.yellow) {
  if (a <= .01) return;
  M.save(); M.globalCompositeOperation = 'lighter'; M.lineJoin = M.lineCap = 'round';
  for (const b of tree) {
    M.globalAlpha = clamp(a * .4 * b.w); M.strokeStyle = col; M.lineWidth = w * 3 * b.w; strokePts(M, b.pts);
    M.globalAlpha = clamp(a * b.w); M.strokeStyle = '#FFFBEA'; M.lineWidth = Math.max(.8, w * b.w); strokePts(M, b.pts);
  }
  M.restore();
  G.save(); G.globalCompositeOperation = 'lighter'; G.lineJoin = G.lineCap = 'round';
  for (const b of tree) { G.globalAlpha = clamp(a * b.w); G.strokeStyle = col; G.lineWidth = w * 5 * b.w; strokePts(G, b.pts); }
  G.restore();
}
function glowDot(ctx, x, y, r, rgb, a) {
  if (a <= .01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(.35, `rgba(${rgb},.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(a); ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
}

// ---------- fundo, partículas ----------
function bg(glowA = .3, cy = .55) {
  M.save(); M.setTransform(1, 0, 0, 1, 0, 0);
  M.fillStyle = '#050409'; M.fillRect(0, 0, W, H);
  const g = M.createRadialGradient(W / 2, H * cy, 0, W / 2, H * cy, W * .62);
  g.addColorStop(0, `rgba(66,49,166,${glowA})`); g.addColorStop(1, 'rgba(66,49,166,0)');
  M.fillStyle = g; M.fillRect(0, 0, W, H); M.restore();
}
function embers(t, a, n = 60, seed = 1, rgb = '255,213,40') {
  if (a <= .01) return;
  for (let i = 0; i < n; i++) {
    const h1 = hash(seed * 1000 + i), h2 = hash(seed * 2000 + i), h3 = hash(seed * 3000 + i);
    const sp = 25 + h2 * 80, y = H + 40 - ((t * sp + h1 * (H + 80)) % (H + 80));
    const x = h3 * W + Math.sin(t * .6 + i) * 30 * h2;
    const tw = .5 + .5 * Math.sin(t * (2 + h1 * 4) + i), r = .8 + h2 * 2;
    const al = clamp(a * tw * (.25 + .75 * h1));
    for (const [ctx, k] of [[M, 1], [G, 3]]) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al; ctx.fillStyle = `rgb(${rgb})`;
      ctx.beginPath(); ctx.arc(x, y, r * k, 0, 7); ctx.fill();
    }
  }
  for (const ctx of [M, G]) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
}
function sparks(t, t0, cx, cy, n, seed, power = 1) {
  const lt = t - t0; if (lt < 0 || lt > 1.6) return;
  for (let i = 0; i < n; i++) {
    const r = rng(seed * 777 + i), ang = r() * Math.PI * 2, v = (300 + r() * 900) * power;
    const life = .6 + r() * .9; if (lt > life) continue;
    const k = lt / life, d = v * (1 - Math.exp(-lt * 3)) / 3;
    const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d + 220 * lt * lt;
    const al = (1 - k) * (1 - k);
    const tx = x - Math.cos(ang) * 18 * (1 - k), ty = y - Math.sin(ang) * 18 * (1 - k);
    for (const [ctx, w] of [[M, 2], [G, 5]]) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al;
      ctx.strokeStyle = r() < .3 ? '#FFFFFF' : C.yellow; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
    }
  }
}
function shockwave(t, t0, cx, cy, maxR = 1300, dur = .9) {
  const p = prog(t, t0, t0 + dur); if (p <= 0 || p >= 1) return;
  const r = maxR * eOutExpo(p), a = (1 - p);
  for (const [ctx, w] of [[M, lerp(28, 2, p)], [G, lerp(60, 8, p)]]) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * .8;
    ctx.strokeStyle = ctx === M ? '#FFF6D0' : C.yellow; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); ctx.restore();
  }
}

// ---------- texto ----------
const font = (w, s) => `${w} ${s}px ${FONT}`;
function text(ctx, str, x, y, { w = 600, s = 40, col = '#fff', a = 1, align = 'center', ls = 0, blur = 0, comp } = {}) {
  if (a <= .01) return;
  ctx.save(); ctx.font = font(w, s); ctx.letterSpacing = ls + 'px'; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.globalAlpha = clamp(a); ctx.fillStyle = col; if (comp) ctx.globalCompositeOperation = comp;
  if (blur > .3) ctx.filter = `blur(${blur * (ctx === G ? .5 : 1)}px)`;
  ctx.fillText(str, x + (align === 'center' ? ls / 2 : 0), y); ctx.restore();
}
// layout por letra (para animar cada caractere)
function charLayout(str, w, s, ls) {
  M.save(); M.font = font(w, s); M.letterSpacing = '0px';
  const ch = [...str].map(c => ({ c, w: M.measureText(c).width }));
  M.restore();
  const total = ch.reduce((a, b) => a + b.w, 0) + ls * (ch.length - 1);
  let x = -total / 2;
  for (const o of ch) { o.x = x + o.w / 2; x += o.w + ls; }
  return { ch, total };
}
function pill(ctx, cx, cy, wdt, hgt, col, a) {
  if (a <= .01) return;
  ctx.save(); ctx.globalAlpha = clamp(a); ctx.fillStyle = col; ctx.beginPath();
  ctx.roundRect(cx - wdt / 2, cy - hgt / 2, wdt, hgt, hgt / 2); ctx.fill(); ctx.restore();
}

// ---------- logo ----------
const logo = new Image(); logo.src = 'logo.png';
const EYES = [[.481, .290], [.5625, .290]];
const EYE_C = [.521, .290];
function drawLogoImg(ctx, cx, cy, size, a = 1, blur = 0) {
  if (a <= .01) return;
  ctx.save(); ctx.globalAlpha = clamp(a); if (blur > .3) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size); ctx.restore();
}
function logoShine(cx, cy, size, p, a = 1) {
  if (p <= 0 || p >= 1) return;
  const S = 1100;
  SH.setTransform(1, 0, 0, 1, 0, 0); SH.globalCompositeOperation = 'source-over';
  SH.clearRect(0, 0, S, S); SH.drawImage(logo, 0, 0, S, S);
  SH.globalCompositeOperation = 'source-in';
  const x = lerp(-.45, 1.45, eInOut(p)) * S;
  const g = SH.createLinearGradient(x - 170, S / 2 - 80, x + 170, S / 2 + 80);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,252,235,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  SH.fillStyle = g; SH.fillRect(0, 0, S, S);
  for (const [ctx, k] of [[M, .38], [G, .35]]) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * k;
    ctx.drawImage(shC, cx - size / 2, cy - size / 2, size, size); ctx.restore();
  }
}
function eyeGlow(cx, cy, size, a, rs = 1) {
  for (const [ex, ey] of EYES) {
    const x = cx + (ex - .5) * size, y = cy + (ey - .5) * size;
    glowDot(M, x, y, size * .05 * rs, '255,240,170', a);
    glowDot(G, x, y, size * .12 * rs, '255,213,40', a);
  }
}
function logoArcs(t, cx, cy, size, a, seed, count = 3) {
  const q = Math.floor(t * 15);
  for (let k = 0; k < count; k++) {
    const r = rng(seed + q * 31 + k * 7); if (r() < .4) continue;
    const ang = r() * Math.PI * 2, R = size * (.38 + r() * .06);
    const x1 = cx + Math.cos(ang) * R * .95, y1 = cy + Math.sin(ang) * R;
    const out = size * (.07 + r() * .12), a2 = ang + (r() - .5) * 1.3;
    drawBolt(boltTree(x1, y1, x1 + Math.cos(a2) * out, y1 + Math.sin(a2) * out, seed + q * 131 + k, { depth: 5, branches: 1 }), a * (.5 + r() * .5), 1.6);
  }
}
function logoFull(t, cx, cy, size, a, o = {}) {
  if (a <= .01) return;
  const { shine = -1, eyes = .6, arcs = 1, seed = 1, blur = 0, eyeR = 1 } = o;
  glowDot(M, cx, cy + size * .02, size * .75, '66,49,166', .55 * a);
  glowDot(G, cx, cy, size * .5, '255,213,40', .12 * a);
  drawLogoImg(M, cx, cy, size, a, blur);
  drawLogoImg(G, cx, cy, size, a * .22, blur);
  logoShine(cx, cy, size, shine, a);
  eyeGlow(cx, cy, size, eyes * a * (.85 + .15 * Math.sin(t * 9)), eyeR);
  if (arcs > 0) logoArcs(t, cx, cy, size, a * arcs, seed, 4);
}

// ---------- bandeira ----------
function buildFlag() {
  const f = flagTex.getContext('2d'), FW = 1500, FH = 1000;
  f.fillStyle = C.indigo; f.fillRect(0, 0, FW, FH);
  // grafismo diagonal sutil
  f.save(); f.globalAlpha = .18; f.fillStyle = '#21177a';
  for (let i = -6; i < 20; i++) { const x = i * 150; f.beginPath(); f.moveTo(x, 0); f.lineTo(x + 55, 0); f.lineTo(x + 55 - 420, FH); f.lineTo(x - 420, FH); f.fill(); }
  f.restore();
  const BOLT = [[.52, 0], [1, 0], [.66, .40], [.9, .40], [.22, 1], [.42, .52], [.14, .52]];
  const bolt = (x, y, sw, sh, rot) => {
    f.save(); f.translate(x, y); f.rotate(rot); f.beginPath();
    BOLT.forEach(([u, v], i) => { const px = (u - .5) * sw, py = (v - .5) * sh; i ? f.lineTo(px, py) : f.moveTo(px, py); });
    f.closePath(); f.fillStyle = C.yellow; f.fill();
    f.lineWidth = 10; f.strokeStyle = '#2a1d86'; f.stroke(); f.restore();
  };
  bolt(150, 180, 300, 460, -.35);
  bolt(FW - 150, FH - 180, 300, 460, Math.PI - .35);
  bolt(FW - 120, 140, 160, 250, .5);
  bolt(120, FH - 140, 160, 250, Math.PI + .5);
  f.drawImage(logo, FW / 2 - 430, FH / 2 - 430, 860, 860);
  // trama do tecido
  f.save(); f.globalAlpha = .05; f.fillStyle = '#000';
  for (let y = 0; y < FH; y += 4) f.fillRect(0, y, FW, 1);
  f.restore();
}
function drawFlag(t, X, Y, dw, dh, a, lit = 0) {
  const pad = 70, LW = Math.ceil(dw), LH = Math.ceil(dh + pad * 2);
  FL.setTransform(1, 0, 0, 1, 0, 0); FL.globalCompositeOperation = 'source-over'; FL.globalAlpha = 1;
  FL.clearRect(0, 0, flagL.width, flagL.height);
  const step = 3, cols = Math.ceil(dw / step), shade = [];
  for (let c = 0; c < cols; c++) {
    const u = c * step / dw, amp = dh * .05 * Math.pow(u, .75);
    const ph = u * 9.5 - t * 4.4, ph2 = u * 5.1 - t * 2.6 + 1;
    const dy = amp * Math.sin(ph) + amp * .5 * Math.sin(ph2);
    const sy = 1 - .035 * u * (.5 + .5 * Math.cos(ph));
    const srcX = u * 1500, srcW = step / dw * 1500;
    FL.drawImage(flagTex, srcX, 0, srcW, 1000, c * step, pad + dy + dh * (1 - sy) * .5, step + .6, dh * sy);
    shade.push(amp * (Math.cos(ph) * 9.5 + .5 * Math.cos(ph2) * 5.1) / (dh * .6));
  }
  FL.globalCompositeOperation = 'source-atop';
  for (let c = 0; c < cols; c++) {
    const s = clamp(shade[c], -1, 1);
    FL.fillStyle = s > 0 ? `rgba(255,255,255,${s * .22})` : `rgba(0,0,10,${-s * .5})`;
    FL.fillRect(c * step, 0, step + .6, LH);
  }
  const lg = FL.createLinearGradient(0, 0, LW, LH);
  lg.addColorStop(0, 'rgba(255,255,255,.10)'); lg.addColorStop(1, 'rgba(0,0,0,.35)');
  FL.fillStyle = lg; FL.fillRect(0, 0, LW, LH);
  if (lit > 0) { FL.fillStyle = `rgba(230,225,255,${lit * .45})`; FL.fillRect(0, 0, LW, LH); }
  M.save(); M.globalAlpha = clamp(a); M.drawImage(flagL, 0, 0, LW, LH, X, Y - pad, LW, LH); M.restore();
  G.save(); G.globalAlpha = clamp(a * .12); G.drawImage(flagL, 0, 0, LW, LH, X, Y - pad, LW, LH); G.restore();
}
function drawPole(x, y, a) {
  M.save(); M.globalAlpha = clamp(a);
  const g = M.createLinearGradient(x - 11, 0, x + 11, 0);
  g.addColorStop(0, '#0b0b10'); g.addColorStop(.45, '#8a8a99'); g.addColorStop(.6, '#2a2a33'); g.addColorStop(1, '#060608');
  M.fillStyle = g; M.fillRect(x - 11, y - 40, 22, H * 1.3);
  const b = M.createRadialGradient(x - 6, y - 58, 2, x, y - 50, 22);
  b.addColorStop(0, '#fff3b0'); b.addColorStop(.4, '#c9a21e'); b.addColorStop(1, '#3a2e05');
  M.fillStyle = b; M.beginPath(); M.arc(x, y - 50, 20, 0, 7); M.fill(); M.restore();
}

// ---------- vinheta e granulação ----------
function buildOverlays() {
  const v = vigC.getContext('2d'), g = v.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.7)');
  v.fillStyle = g; v.fillRect(0, 0, W, H);
  for (let k = 0; k < 4; k++) {
    const c = mk(W, H), x = c.getContext('2d'), id = x.createImageData(W, H), r = rng(500 + k);
    for (let i = 0; i < id.data.length; i += 4) { const n = 128 + (r() - .5) * 160; id.data[i] = id.data[i + 1] = id.data[i + 2] = n; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0); grain.push(c);
  }
}

// =====================================================================
// CENAS
// =====================================================================
const LOGO_SIZE = 880;

function sceneOpen(t) {
  const lt = t - T_OPEN;
  bg(.28 * prog(lt, 1.2, 2.2));
  const cx = W / 2, cy = H / 2;
  const eyeX = cx + (EYE_C[0] - .5) * LOGO_SIZE, eyeY = cy + (EYE_C[1] - .5) * LOGO_SIZE;
  const z = prog(lt, .3, 1.35), ez = eInOut(z);
  let s = 1 + 7 * (1 - ez);
  if (lt > 1.35) s = 1 + .055 * eInOut(prog(lt, 1.6, 9.3)) - .03 * Math.exp(-(lt - 1.35) * 5) * Math.cos((lt - 1.35) * 14);
  if (lt > 9.2) s += .08 * eIn(prog(lt, 9.2, 10));
  const [sx, sy] = shake(lt, 1.35, 16, 5);
  setCam({ s, fx: lerp(eyeX, cx, ez), fy: lerp(eyeY, cy, ez), sx, sy });
  const exitA = 1 - eIn(prog(lt, 9.2, 10));
  const inA = prog(lt, .05, .45);
  // borrão de zoom durante o recuo
  const vel = Math.sin(Math.PI * z);
  if (vel > .05) for (let k = 1; k <= 5; k++) {
    const sz = LOGO_SIZE * (1 + k * .045 * vel);
    drawLogoImg(M, cx, cy, sz, .14 * vel * inA);
  }
  logoFull(lt, cx, cy, LOGO_SIZE, inA * exitA, {
    shine: lt < 5 ? prog(lt, 2.9, 4.1) : prog(lt, 6.8, 7.9),
    eyes: lt < 1.4 ? lerp(.9, 1.3, z) : .7 + .9 * Math.exp(-(lt - 1.35) * 2),
    arcs: prog(lt, 1.3, 1.8), seed: 11, blur: 10 * prog(lt, 9.3, 10), eyeR: 1 / Math.sqrt(s),
  });
  setCam({ s: 1 });
  shockwave(lt, 1.35, cx, cy);
  sparks(lt, 1.35, cx, cy - 80, 70, 3);
  embers(lt, .7 * prog(lt, 1.4, 3) * exitA, 60, 1);
  // relâmpago distante
  if (lt > 5.2 && lt < 5.6) {
    const a = (1 - prog(lt, 5.2, 5.6)) * .5;
    drawBolt(boltTree(1580, -40, 1720, 520, 77 + Math.floor(lt * 15), { depth: 6, branches: 3 }), a, 2, '#8e7dff');
  }
  flash(lt, 1.35, .55, .15);
  flash(lt, 5.2, .08, .2);
}

function sceneVerse(t, t0, d, v, seed) {
  const lt = t - t0; if (lt < 0 || lt > d) return;
  bg(.16, .5); setCam({ s: 1 + .02 * lt / d });
  embers(t, .35, 35, seed);
  const size = v.size, lh = size * 1.28, exitP = prog(lt, d - .7, d), exitA = 1 - eIn(exitP);
  const y0 = H / 2 - (v.lines.length - 1) * lh / 2 - size * .25;
  const space = size * .27;
  let gi = 0, lastStart = 0;
  v.lines.forEach((line, li) => {
    const words = line.split(' ').map(s => ({ s: s.replace(/\*/g, ''), hi: s.startsWith('*') }));
    let total = 0;
    for (const wd of words) {
      M.font = font(wd.hi ? 600 : 300, size); M.letterSpacing = '0px';
      wd.w = M.measureText(wd.s).width; total += wd.w;
    }
    total += space * (words.length - 1);
    let x = W / 2 - total / 2;
    const y = y0 + li * lh;
    for (const wd of words) {
      const st = .35 + gi * .12; lastStart = st;
      const p = eOut(prog(lt, st, st + .85));
      let a = p * exitA;
      if (wd.hi) {
        const fl = lt - st;
        if (fl > 0 && fl < .45) a *= hash(Math.floor(t * 30) + gi * 13) > .45 ? 1 : .25;
      }
      const blur = (1 - p) * 16 + exitP * 12, dy = (1 - p) * 24 - exitP * 12;
      const cxw = x + wd.w / 2;
      text(M, wd.s, cxw, y + dy, { w: wd.hi ? 600 : 300, s: size, col: wd.hi ? C.yellow : '#F2F0FA', a, blur });
      if (wd.hi) text(G, wd.s, cxw, y + dy, { w: 600, s: size, col: C.yellow, a: a * .9, blur: blur + 4 });
      x += wd.w + space; gi++;
    }
  });
  const ra = eOut(prog(lt, lastStart + .6, lastStart + 1.3)) * exitA;
  const ry = y0 + (v.lines.length - 1) * lh + size * .55 + 60;
  text(M, v.ref, W / 2, ry, { w: 600, s: 22, col: '#A79DF0', a: ra, ls: 9 });
  M.save(); M.globalAlpha = ra * .6; M.fillStyle = C.yellow;
  const lw = 40 * ra; M.fillRect(W / 2 - 150 - lw, ry - 1, lw, 2); M.fillRect(W / 2 + 150, ry - 1, lw, 2); M.restore();
}

function sceneV1(t) {
  const lt = t - T_V1;
  sceneVerse(t, T_V1, 5.0, VERSES.v1, 21);
  // luz que inunda a tela e revela as cores
  const p = prog(lt, 4.3, 5.9);
  FLOOD = Math.max(FLOOD, eInExpo(p));
  if (lt > 4.3 && lt < 6) { setCam({}); glowDot(G, W / 2 + 160, H / 2, 300 + 1500 * eIn(p), '255,240,190', p * 1.2); }
  if (lt >= 5 && lt < 6) { M.setTransform(1, 0, 0, 1, 0, 0); M.fillStyle = '#fff'; M.fillRect(0, 0, W, H); }
}

function zigzag(edgeX, seed, t) {
  const r = rng(seed), q = rng(seed * 3 + Math.floor(t * 15)), pts = [];
  for (let j = -1; j <= 13; j++) pts.push([edgeX + (j % 2 ? 70 : -70) + (r() - .5) * 60 + (q() - .5) * 10, j * H / 12]);
  return pts;
}
function sceneColors(t) {
  const lt = t - T_COL; setCam({});
  const per = 2.4;
  if (lt < 4 * per) {
    const i = Math.floor(lt / per), l = lt - i * per, col = COLS[i];
    const prev = i === 0 ? '#FFFFFF' : COLS[i - 1].c;
    M.fillStyle = prev; M.fillRect(0, 0, W, H);
    const p = eInOut(prog(l, 0, .7)), edgeX = lerp(-260, W + 260, p);
    const zz = zigzag(edgeX, 900 + i, t);
    M.fillStyle = col.c; M.beginPath(); M.moveTo(-20, -20);
    for (const pt of zz) M.lineTo(pt[0], pt[1]);
    M.lineTo(-20, H + 20); M.closePath(); M.fill();
    if (p > 0 && p < 1) drawBolt([{ pts: zz, w: 1 }], Math.sin(Math.PI * p) * 1.2, 3.5, i === 1 ? '#FFFFFF' : C.yellow);
    if (l > .55) {
      const exitA = 1 - prog(l, per - .25, per);
      const L = charLayout(col.n, 800, 190, 18);
      L.ch.forEach((o, k) => {
        const st = .55 + k * .045, pp = eOut(prog(l, st, st + .55));
        text(M, o.c, W / 2 + o.x, H / 2 - 30 + (1 - pp) * 50, { w: 800, s: 190, col: col.tc, a: pp * exitA, blur: (1 - pp) * 10 });
      });
      const hp = eOut(prog(l, 1.05, 1.6));
      text(M, col.hex, W / 2, H / 2 + 110 + (1 - hp) * 20, { w: 500, s: 34, col: col.tc, a: hp * .7 * exitA, ls: 12 });
      text(M, 'PALETA', 120, 90, { w: 600, s: 18, col: col.tc, a: .55 * hp * exitA, ls: 8, align: 'left' });
      text(M, `0${i + 1} / 04`, W - 120, 90, { w: 600, s: 18, col: col.tc, a: .55 * hp * exitA, ls: 6, align: 'right' });
    }
  } else {
    const l = lt - 4 * per;   // 0 .. 4.4
    const out = l > 3.6;
    M.fillStyle = out ? '#050409' : '#FFFFFF'; M.fillRect(0, 0, W, H);
    COLS.forEach((col, j) => {
      const pin = eOutExpo(prog(l, .05 + j * .12, 1.0 + j * .12));
      const pout = eInExpo(prog(l, 3.6 + j * .08, 4.3 + j * .08));
      const y = H * (1 - pin) + H * pout, x = j * W / 4;
      M.fillStyle = col.c; M.fillRect(x, y, W / 4 + 1, H);
      const ta = prog(l, .8 + j * .12, 1.3 + j * .12) * (1 - pout);
      text(M, col.n, x + W / 8, y + H - 210, { w: 800, s: 46, col: col.tc, a: ta, ls: 6 });
      text(M, col.hex, x + W / 8, y + H - 155, { w: 500, s: 22, col: col.tc, a: ta * .65, ls: 6 });
      if (j > 0) { M.fillStyle = 'rgba(0,0,0,.12)'; M.fillRect(x, y, 1, H); }
    });
  }
}

function sceneFlag(t) {
  const lt = t - T_FLAG, d = 14;
  bg(.22, .45);
  // nuvem/tempestade
  const st = [3.2, 7.6, 11.2];
  let lit = 0;
  st.forEach((s0, k) => {
    if (lt > s0 && lt < s0 + .45) {
      const a = 1 - prog(lt, s0, s0 + .45);
      const x0 = [1500, 300, 1700][k];
      setCam({});
      drawBolt(boltTree(x0, -60, x0 + (k % 2 ? 160 : -180), 720, 300 + k * 50 + Math.floor(lt * 20), { branches: 4 }), a * 1.1, 2.6, '#a99bff');
      lit = Math.max(lit, a * (hash(Math.floor(lt * 30)) > .3 ? 1 : .4));
    }
  });
  const inA = eOut(prog(lt, .2, 1.6)), exitA = 1 - eIn(prog(lt, d - .8, d));
  const s = lerp(.97, 1.08, eInOut(prog(lt, 0, d)));
  setCam({ s, fx: W / 2 + 40, fy: H / 2, px: W / 2 - lerp(0, 30, lt / d), py: H / 2 });
  const dw = 1180, dh = 787, X = (W - dw) / 2 + 40, Y = (H - dh) / 2 - 20;
  drawPole(X - 6, Y, inA * exitA);
  drawFlag(lt, X, Y, dw, dh, inA * exitA, lit);
  setCam({});
  // vento
  M.save(); M.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const h1 = hash(4000 + i), h2 = hash(5000 + i), sp = 500 + h1 * 700;
    const x = ((lt * sp + h2 * 2600) % 2600) - 340, y = 80 + hash(6000 + i) * (H - 160);
    M.globalAlpha = .06 * inA * exitA; M.strokeStyle = '#cfc8ff'; M.lineWidth = 1.2;
    M.beginPath(); M.moveTo(x, y); M.lineTo(x + 140 + h1 * 160, y + 6); M.stroke();
  }
  M.restore();
  embers(t, .45 * inA * exitA, 40, 9);
  const la = eOut(prog(lt, 1.8, 2.8)) * exitA;
  M.fillStyle = C.yellow; M.globalAlpha = la; M.fillRect(W - 180, H - 112, 60 * la, 2); M.globalAlpha = 1;
  text(M, 'A BANDEIRA', W - 205, H - 111, { w: 600, s: 20, col: '#EDEAFB', a: la * .8, ls: 9, align: 'right' });
  flash(lt, 3.2, .12, .15); flash(lt, 7.6, .12, .15); flash(lt, 11.2, .12, .15);
}

function sceneTeam(t) {
  const lt = t - T_TEAM;
  bg(.2, .5); setCam({});
  embers(t, .4, 40, 13);
  const cy = H / 2 + 10;
  // líder
  if (lt < 3.1) {
    const [sx, sy] = shake(lt, .2, 10, 7);
    setCam({ sx, sy, s: 1 + .03 * lt / 3 });
    if (lt > .15 && lt < .6) drawBolt(boltTree(W / 2 + 60, -50, W / 2, cy - 20, 41 + Math.floor(lt * 20), { branches: 4 }), 1.3 * (1 - prog(lt, .2, .6)), 4);
    const exitP = prog(lt, 2.65, 3.05), exitA = 1 - eIn(exitP);
    const L = charLayout(LEADER, 900, 210, 14);
    L.ch.forEach((o, k) => {
      const on = .25 + hash(k + 70) * .55;
      let a = lt < on ? 0 : (lt < on + .25 ? (hash(Math.floor(t * 30) + k * 9) > .4 ? 1 : .2) : 1);
      a *= exitA;
      const x = W / 2 + o.x - exitP * 90;
      text(M, o.c, x, cy, { w: 900, s: 210, col: '#FFFFFF', a, blur: exitP * 12 });
      text(G, o.c, x, cy, { w: 900, s: 210, col: C.yellow, a: a * .45, blur: 6 });
    });
    const pp = eOutBack(prog(lt, .85, 1.25));
    setCam({ sx, sy });
    M.save(); M.translate(W / 2, cy - 170); M.scale(pp, pp);
    pill(M, 0, 0, 190, 48, C.yellow, exitA); text(M, 'LÍDER', 0, 1, { w: 800, s: 24, col: C.black, ls: 8, a: exitA });
    M.restore();
    glowDot(G, W / 2, cy - 170, 160, '255,213,40', .5 * clamp(pp) * exitA);
    setCam({});
    flash(lt, .2, .55, .12);
    sparks(lt, .2, W / 2, cy - 20, 50, 41, .8);
  }
  // nomes um a um
  const per = 1.3;
  TEAM.forEach((name, i) => {
    const s0 = 3.0 + i * per, l = lt - s0;
    if (l < 0 || l > per) return;
    const pin = eOutExpo(prog(l, 0, .38)), pout = eInExpo(prog(l, per - .28, per));
    const x = W / 2 + (1 - pin) * 160 - pout * 160, a = pin * (1 - pout);
    const blur = (1 - pin) * 16 + pout * 16;
    const sz = name.length > 10 ? 130 : 160;
    text(M, name, x, cy, { w: 900, s: sz, col: '#FFFFFF', a, blur, ls: 8 });
    text(G, name, x, cy, { w: 900, s: sz, col: C.yellow, a: a * .3, blur: 8, ls: 8 });
    text(M, `0${i + 2} / 08`, x, cy - 140, { w: 600, s: 20, col: C.yellow, a: a * .85, ls: 8 });
    if (l < .3) {
      const r = rng(i + 500);
      drawBolt(boltTree(-40, cy + 120 + r() * 40, W + 40, cy + 90 - r() * 40, 600 + i * 10 + Math.floor(l * 30), { branches: 3, disp: 70 }), 1 - prog(l, 0, .3), 2.2);
    }
    flash(l, 0, .14, .08);
  });
  // todos juntos
  const g0 = 3.0 + TEAM.length * per; // 12.1
  const gl = lt - g0;
  if (gl >= 0) {
    const exitA = 1 - eIn(prog(gl, 2.3, 2.9));
    const top = 300;
    const rows = [[0, 1, 2, 3], [4, 5, 6]];
    const pos = [];
    rows[0].forEach((k, j) => pos[k] = [W * (j + 1) / 5, 590]);
    [440, 960, 1480].forEach((x, j) => pos[rows[1][j]] = [x, 750]);
    pos.forEach(([x, y], k) => {
      const st = .35 + k * .09, a = eOut(prog(gl, st, st + .5)) * exitA;
      if (a > 0) {
        const q = Math.floor(t * 15);
        drawBolt(boltTree(W / 2, top + 50, x, y - 45, 700 + k * 13 + q, { depth: 5, branches: 0, disp: 35 }), a * (.3 + .25 * hash(q + k)), 1.1);
      }
      text(M, TEAM[k], x, y + (1 - a) * 20, { w: 800, s: 54, col: '#FFFFFF', a, ls: 5 });
    });
    const la = eOut(prog(gl, 0, .5)) * exitA;
    text(M, LEADER, W / 2, top + (1 - la) * 20, { w: 900, s: 100, col: C.yellow, a: la, ls: 10 });
    text(G, LEADER, W / 2, top, { w: 900, s: 100, col: C.yellow, a: la * .5, blur: 6, ls: 10 });
    pill(M, W / 2, top - 85, 150, 38, C.yellow, la);
    text(M, 'LÍDER', W / 2, top - 84, { w: 800, s: 19, col: C.black, ls: 7, a: la });
    text(M, 'ALTA VOLTAGEM', W / 2, H - 120, { w: 600, s: 20, col: '#A79DF0', a: eOut(prog(gl, 1.2, 1.8)) * exitA, ls: 12 });
  }
}

function sceneFinal(t) {
  const lt = t - T_FIN, cx = W / 2, cy = H / 2, hit = 1.6;
  bg(lt < hit ? .08 : .3 * (1 - prog(lt, 8.2, 9)));
  setCam({});
  if (lt < hit) {
    // energia convergindo
    for (let i = 0; i < 90; i++) {
      const h1 = hash(8000 + i), h2 = hash(8100 + i), ang = h1 * Math.PI * 2;
      const f = (lt * (.7 + h2 * .8) + h2) % 1, d = (1 - eIn(f)) * (500 + h2 * 700);
      const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d, a = f * prog(lt, 0, .6);
      for (const [ctx, r] of [[M, 2], [G, 6]]) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = C.yellow;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
    }
    M.globalAlpha = G.globalAlpha = 1; M.globalCompositeOperation = G.globalCompositeOperation = 'source-over';
    glowDot(G, cx, cy, 120 + 200 * lt / hit, '255,213,40', .3 + .7 * lt / hit);
    glowDot(M, cx, cy, 40 + 60 * lt / hit, '255,250,220', .5 * lt / hit);
    [.45, .85, 1.15, 1.38].forEach((b, k) => {
      if (lt > b && lt < b + .14) {
        const r = rng(k + 300), ang = r() * Math.PI * 2;
        drawBolt(boltTree(cx + Math.cos(ang) * 1100, cy + Math.sin(ang) * 700, cx, cy, 310 + k * 7 + Math.floor(lt * 30), { branches: 2 }), 1 - prog(lt, b, b + .14), 2.4);
      }
    });
  } else {
    const [sx, sy] = shake(lt, hit, 20, 5);
    const pin = eOutBack(prog(lt, hit, hit + .5));
    const s = lerp(1.4, 1, pin) + .05 * eInOut(prog(lt, 2.2, 8.4));
    setCam({ s, sx, sy });
    const outA = 1 - eInOut(prog(lt, 8.1, 9));
    logoFull(lt, cx, cy, LOGO_SIZE, prog(lt, hit, hit + .08) * outA, {
      shine: prog(lt, 3.0, 4.2), seed: 51,
      eyes: .7 + 1.6 * Math.exp(-(lt - hit) * 2.5) + 1.4 * Math.exp(-Math.abs(lt - 7.75) * 5),
      arcs: 1 + prog(lt, 7, 7.8),
    });
    setCam({});
    if (lt < hit + .4) drawBolt(boltTree(cx + 80, -60, cx, cy - 120, 999 + Math.floor(lt * 30), { branches: 5 }), 1.5 * (1 - prog(lt, hit, hit + .4)), 6);
    shockwave(lt, hit, cx, cy, 1500, 1);
    shockwave(lt, hit + .12, cx, cy, 1100, .9);
    sparks(lt, hit, cx, cy - 60, 110, 61, 1.3);
    sparks(lt, 7.75, cx, cy - 160, 40, 62, .6);
    embers(t, .7 * prog(lt, hit, hit + 1) * outA, 70, 5);
    flash(lt, hit, .85, .16);
    flash(lt, 7.75, .25, .12);
  }
}

// =====================================================================
function renderFrame(t) {
  FLASH = 0; FLOOD = 0; FADE = 0;
  M.setTransform(1, 0, 0, 1, 0, 0); M.globalAlpha = 1; M.globalCompositeOperation = 'source-over'; M.filter = 'none';
  M.fillStyle = '#050409'; M.fillRect(0, 0, W, H);
  G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over';
  G.fillStyle = '#000'; G.fillRect(0, 0, 960, 540);

  if (t < T_V1) sceneOpen(t);
  else if (t < T_COL) sceneV1(t);
  else if (t < T_V2) sceneColors(t);
  else if (t < T_FLAG) sceneVerse(t, T_V2, 6, VERSES.v2, 22);
  else if (t < T_V3) sceneFlag(t);
  else if (t < T_TEAM) sceneVerse(t, T_V3, 5, VERSES.v3, 23);
  else if (t < T_V4) sceneTeam(t);
  else if (t < T_FIN) sceneVerse(t, T_V4, 5, VERSES.v4, 24);
  else sceneFinal(t);

  // bloom
  setCam({}); M.setTransform(1, 0, 0, 1, 0, 0);
  B1.globalCompositeOperation = 'copy'; B1.filter = 'blur(3px)'; B1.drawImage(gC, 0, 0, 480, 270); B1.filter = 'none';
  B2.globalCompositeOperation = 'copy'; B2.filter = 'blur(5px)'; B2.drawImage(gC, 0, 0, 240, 135); B2.filter = 'none';
  M.globalCompositeOperation = 'lighter';
  M.globalAlpha = .5; M.drawImage(gC, 0, 0, W, H);
  M.globalAlpha = .9; M.drawImage(b1C, 0, 0, W, H);
  M.globalAlpha = .9; M.drawImage(b2C, 0, 0, W, H);
  M.globalCompositeOperation = 'source-over'; M.globalAlpha = 1;

  if (FLOOD > 0) { M.globalAlpha = clamp(FLOOD); M.fillStyle = '#FFFFFF'; M.fillRect(0, 0, W, H); M.globalAlpha = 1; }
  const inColors = t >= T_COL && t < T_V2;
  M.globalAlpha = inColors ? .35 : 1; M.drawImage(vigC, 0, 0); M.globalAlpha = 1;
  if (FLASH > 0) { M.globalCompositeOperation = 'lighter'; M.globalAlpha = clamp(FLASH); M.fillStyle = '#FFF7DD'; M.fillRect(0, 0, W, H); M.globalCompositeOperation = 'source-over'; M.globalAlpha = 1; }
  M.globalCompositeOperation = 'overlay'; M.globalAlpha = .07;
  M.drawImage(grain[Math.floor(t * FPS) % grain.length], 0, 0);
  M.globalCompositeOperation = 'source-over'; M.globalAlpha = 1;
}

// ---------- efeitos sonoros sincronizados (lidos pelo gerador de áudio) ----------
function buildSFX() {
  const S = [], add = (t, type, o = {}) => S.push(Object.assign({ t, type }, o));
  // abertura
  add(.05, 'zap', { g: .5 }); add(.25, 'whoosh', { dur: 1.1, g: 1 }); add(1.35, 'impact', { g: 1 });
  add(1.4, 'crackle', { dur: 7.8, g: .35 }); add(1.4, 'hum', { dur: 8.6, g: .25 });
  add(2.9, 'shimmer', { dur: 1.3, g: .45 }); add(5.2, 'thunder', { dur: 3.5, g: .5 }); add(6.8, 'shimmer', { dur: 1.2, g: .3 });
  add(9.25, 'swoosh', { g: .5, dur: .8 });
  // versículos: cada palavra entra com um "tick" sutil, a palavra destacada com zap
  const verseSfx = (t0, v) => {
    let gi = 0;
    v.lines.forEach(line => line.split(' ').forEach(w => {
      const st = t0 + .35 + gi * .12;
      if (w.startsWith('*')) add(st, 'zap', { g: .45 }); else add(st, 'tick', { g: .18 });
      gi++;
    }));
    add(t0 + .2, 'air', { dur: 4, g: .25 });
  };
  verseSfx(T_V1, VERSES.v1); add(T_V1 + .5, 'hum', { dur: 3.8, g: .2 });
  add(T_V1 + 4.2, 'riser', { dur: 1.8, g: .8 });
  // cores
  for (let i = 0; i < 4; i++) { add(T_COL + i * 2.4, 'swoosh', { g: .8, dur: .7 }); add(T_COL + i * 2.4 + .3, 'zap', { g: .5 }); add(T_COL + i * 2.4 + 1.05, 'tick', { g: .3 }); }
  for (let j = 0; j < 4; j++) add(T_COL + 9.6 + .05 + j * .12, 'swoosh', { g: .35, dur: .5 });
  add(T_COL + 9.6 + 3.6, 'swoosh', { g: .6, dur: .8 });
  verseSfx(T_V2, VERSES.v2);
  // bandeira
  add(T_FLAG, 'wind', { dur: 14, g: .55 });
  [3.2, 7.6, 11.2].forEach(s => { add(T_FLAG + s, 'zap', { g: .7 }); add(T_FLAG + s + .05, 'thunder', { dur: 3, g: .65 }); });
  verseSfx(T_V3, VERSES.v3); add(T_V3 + 1.1, 'shimmer', { dur: 1.5, g: .35 });
  // equipe
  add(T_TEAM + .2, 'impact', { g: .75 }); add(T_TEAM + .2, 'zap', { g: .8 }); add(T_TEAM + .25, 'crackle', { dur: .7, g: .6 });
  add(T_TEAM + .9, 'tick', { g: .5 });
  TEAM.forEach((n, i) => { const s = T_TEAM + 3 + i * 1.3; add(s - .05, 'swoosh', { g: .55, dur: .45 }); add(s, 'zap', { g: .6 }); });
  add(T_TEAM + 12.1, 'shimmer', { dur: 2, g: .45 }); add(T_TEAM + 12.4, 'crackle', { dur: 2.4, g: .25 });
  verseSfx(T_V4, VERSES.v4);
  // final
  add(T_FIN, 'riser', { dur: 1.6, g: 1 }); add(T_FIN, 'hum', { dur: 1.6, g: .4 });
  [.45, .85, 1.15, 1.38].forEach(b => add(T_FIN + b, 'zap', { g: .5 }));
  add(T_FIN + 1.6, 'impact', { g: 1.1 }); add(T_FIN + 1.62, 'thunder', { dur: 4, g: .7 });
  add(T_FIN + 1.7, 'crackle', { dur: 6.4, g: .35 }); add(T_FIN + 1.7, 'hum', { dur: 7, g: .25 });
  add(T_FIN + 3.0, 'shimmer', { dur: 1.4, g: .45 });
  add(T_FIN + 7.75, 'zap', { g: .9 }); add(T_FIN + 7.75, 'crackle', { dur: .6, g: .6 });
  return S;
}

window.CONFIG = { W, H, FPS, DUR };
window.SFX = buildSFX();
window.renderFrame = renderFrame;
window.ready = Promise.all([
  new Promise(r => { if (logo.complete && logo.naturalWidth) r(); else logo.onload = r; }),
  ...[300, 500, 600, 800, 900].map(w => document.fonts.load(font(w, 50), 'ÍÃÉ abc')),
]).then(() => { buildFlag(); buildOverlays(); window.isReady = true; });

// pré-visualização no navegador: ?t=12 congela num instante; sem parâmetro toca em tempo real
window.ready.then(() => {
  if (navigator.webdriver) return;
  const q = new URLSearchParams(location.search);
  if (q.has('t')) { renderFrame(parseFloat(q.get('t'))); return; }
  const start = performance.now();
  const loop = () => { renderFrame(((performance.now() - start) / 1000) % DUR); requestAnimationFrame(loop); };
  loop();
});
