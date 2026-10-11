'use strict';
// Alta Voltagem: animação de encerramento (1920x1080, 30fps).
// Tudo é função do tempo t (segundos): renderFrame(t) desenha o quadro exato,
// o que permite renderizar quadro a quadro sem perder nenhum frame.

const W = 1920, H = 1080, FPS = 30;
const C = { indigo: '#4231A6', yellow: '#FFD528', black: '#111118', white: '#FFFFFF' };
const ICE = '#9AD8FF';            // raio branco-azulado do filme (continuidade da emenda)
const FONT = '"Inter Display", "Inter", sans-serif';

// ---------- linha do tempo (segundos) ----------
// cada versículo (T_V*) entra rasgando por cima dos últimos JCUT segundos da cena anterior
const T_OPEN = 0, T_V1 = 5.6, T_COL = 8.6, T_V2 = 15.0, T_FLAG = 18.4, T_V3 = 24.2,
  T_TEAM = 27.4, T_V4 = 36.4, T_FIN = 39.8, DUR = 46.9;
const JCUT = .35;
const FIN_HIT = 1.4;              // segundos após T_FIN: o golpe final

const LEADER = 'GIOVANA';
const TEAM = ['OSÉAS', 'KAUÃ', 'PEDRO', 'SARA', 'GIOVANNA', 'MARCOS VINÍCIUS', 'GUETA'];
const COLS = [
  { n: 'ÍNDIGO', hex: '#4231A6', c: C.indigo, tc: '#FFFFFF' },
  { n: 'AMARELO', hex: '#FFD528', c: C.yellow, tc: C.black },
  { n: 'PRETO', hex: '#111118', c: C.black, tc: '#FFFFFF' },
  { n: 'BRANCO', hex: '#FFFFFF', c: C.white, tc: C.black },
];
const VERSES = {
  v1: { lines: ['Haja *luz.*'], ref: 'GÊNESIS 1:3', size: 160 },
  v2: { lines: ['Mas receberão *poder*', 'quando o Espírito Santo', 'descer sobre vocês.'], ref: 'ATOS 1:8', size: 76 },
  v3: { lines: ['Vocês são a', '*luz* *do* *mundo.*'], ref: 'MATEUS 5:14', size: 104 },
  v4: { lines: ['Nunca lhes falte o zelo,', 'sejam *fervorosos* no espírito.'], ref: 'ROMANOS 12:11', size: 80 },
};

// ---------- canvases ----------
const cv = document.getElementById('c'), M = cv.getContext('2d');
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const gC = mk(960, 540), G = gC.getContext('2d');           // camada emissiva (meia resolução)
const b1C = mk(480, 270), B1 = b1C.getContext('2d');
const b2C = mk(240, 135), B2 = b2C.getContext('2d');
const b3C = mk(120, 68), B3 = b3C.getContext('2d');
const shC = mk(1100, 1100), SH = shC.getContext('2d');      // reflexo na logo
const flagTex = mk(1500, 1000);
const flagL = mk(1300, 1100), FL = flagL.getContext('2d');
const caA = mk(W, H), CA1 = caA.getContext('2d');           // aberração cromática
const caB = mk(W, H), CA2 = caB.getContext('2d');
const vigC = mk(W, H);
const grain = [], clouds = [];

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
const decay = (t, t0, dur) => t < t0 ? 0 : Math.exp(-(t - t0) / dur);

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

// ---------- efeitos globais de pós ----------
let FLASH = 0, FLOOD = 0, BLACK = 0, CA = 0;
function flash(t, t0, amp, dur) { if (t >= t0) FLASH = Math.max(FLASH, amp * Math.exp(-(t - t0) / dur)); }
function aberr(t, t0, amp, dur) { if (t >= t0) CA = Math.max(CA, amp * Math.exp(-(t - t0) / dur)); }

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
    M.globalAlpha = clamp(a * b.w); M.strokeStyle = '#FFFDF4'; M.lineWidth = Math.max(.8, w * b.w); strokePts(M, b.pts);
  }
  M.restore();
  G.save(); G.globalCompositeOperation = 'lighter'; G.lineJoin = G.lineCap = 'round';
  for (const b of tree) { G.globalAlpha = clamp(a * b.w); G.strokeStyle = col; G.lineWidth = w * 5 * b.w; strokePts(G, b.pts); }
  G.restore();
}
// raio que "cai" do céu: cresce do topo até o alvo em ~0.08s, brilha e some
function strike(t, t0, x0, y0, x1, y1, seed, { w = 5, col = C.yellow, life = .5, branches = 5 } = {}) {
  const lt = t - t0; if (lt < 0 || lt > life) return;
  const tree = boltTree(x0, y0, x1, y1, seed + Math.floor(lt * 24), { branches });
  const grow = eOut(prog(lt, 0, .08));
  if (grow < 1) for (const b of tree) b.pts = b.pts.slice(0, Math.max(2, Math.ceil(b.pts.length * grow)));
  const fl = lt < .2 ? (hash(Math.floor(t * 30) + seed) > .3 ? 1 : .35) : 1;
  drawBolt(tree, 1.6 * fl * (1 - prog(lt, .1, life)), w, col);
  if (grow >= 1) glowDot(G, x1, y1, 260, '255,230,140', 1 - prog(lt, 0, life));
}
function glowDot(ctx, x, y, r, rgb, a) {
  if (a <= .01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(.35, `rgba(${rgb},.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(a); ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
}
// reflexo anamórfico: risco horizontal de luz (lente de cinema)
function anamorphic(x, y, len, a, rgb = '160,200,255') {
  if (a <= .01) return;
  for (const [ctx, th, k] of [[M, 3, .9], [M, 14, .25], [G, 26, .6]]) {
    const g = ctx.createLinearGradient(x - len, 0, x + len, 0);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(.5, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(a * k); ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, len, th, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  glowDot(M, x, y, 40, '255,255,255', a * .8);
}
// feixes de luz girando atrás de um ponto
function godRays(t, cx, cy, a, n = 16, R = 1500, rgb = '255,213,40') {
  if (a <= .01) return;
  for (const [ctx, k] of [[M, .5], [G, .7]]) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, `rgba(${rgb},.55)`); g.addColorStop(.3, `rgba(${rgb},.18)`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    for (let i = 0; i < n; i++) {
      const base = i / n * Math.PI * 2 + t * .06 * (i % 2 ? 1 : -.6), wd = .035 + .05 * hash(i + 40);
      const pulse = .55 + .45 * Math.sin(t * (.7 + hash(i) * 1.3) + i * 2);
      ctx.globalAlpha = clamp(a * k * pulse);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, base - wd, base + wd); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// ---------- fundo: céu de tempestade, partículas ----------
function bg(glowA = .3, cy = .55) {
  M.save(); M.setTransform(1, 0, 0, 1, 0, 0);
  M.fillStyle = '#040308'; M.fillRect(0, 0, W, H);
  const g = M.createRadialGradient(W / 2, H * cy, 0, W / 2, H * cy, W * .62);
  g.addColorStop(0, `rgba(66,49,166,${glowA})`); g.addColorStop(1, 'rgba(66,49,166,0)');
  M.fillStyle = g; M.fillRect(0, 0, W, H); M.restore();
}
function buildClouds() {
  const w = 640, h = 360;
  for (let k = 0; k < 2; k++) {
    const r = rng(90 + k), grid = [];
    const octs = [4, 8, 16, 32, 64];
    const lat = octs.map(n => { const a = []; for (let i = 0; i < (n + 1) * (n + 1); i++) a.push(r()); return a; });
    const c = mk(w, h), x = c.getContext('2d'), id = x.createImageData(w, h);
    const cl = mk(w, h), xl = cl.getContext('2d'), il = xl.createImageData(w, h);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      let v = 0, amp = .5, tot = 0;
      octs.forEach((n, o) => {
        const fx = px / w * n, fy = py / h * n * .6, ix = Math.floor(fx), iy = Math.floor(fy);
        const ux = fx - ix, uy = fy - iy, sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
        const L = lat[o], at = (i, j) => L[(j % (n + 1)) * (n + 1) + (i % (n + 1))];
        v += amp * lerp(lerp(at(ix, iy), at(ix + 1, iy), sx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy);
        tot += amp; amp *= .5;
      });
      v /= tot;
      const d = clamp((v - .38) / .4), i4 = (py * w + px) * 4;
      const vert = .55 + .45 * (1 - py / h);
      id.data[i4] = 22 + 30 * d; id.data[i4 + 1] = 16 + 20 * d; id.data[i4 + 2] = 48 + 70 * d; id.data[i4 + 3] = 255 * d * vert;
      il.data[i4] = 150 + 70 * d; il.data[i4 + 1] = 140 + 60 * d; il.data[i4 + 2] = 255; il.data[i4 + 3] = 255 * d * d * vert;
    }
    x.putImageData(id, 0, 0); xl.putImageData(il, 0, 0);
    clouds.push({ base: c, lit: cl });
  }
}
function drawClouds(t, a, lit = 0, litX = W / 2) {
  if (a <= .01) return;
  M.save(); M.setTransform(1, 0, 0, 1, 0, 0);
  clouds.forEach((c, k) => {
    const dx = -260 + ((t * (10 + k * 7)) % 260), sc = 1.35 + k * .2;
    M.globalAlpha = clamp(a * (k ? .6 : .9));
    M.drawImage(c.base, dx - k * 120, -140, W * sc, H * sc * .8);
    if (lit > .01) {
      M.globalCompositeOperation = 'lighter'; M.globalAlpha = clamp(lit * a * (k ? .5 : .8));
      M.drawImage(c.lit, dx - k * 120, -140, W * sc, H * sc * .8);
      M.globalCompositeOperation = 'source-over';
    }
  });
  M.restore();
  if (lit > .01) glowDot(G, litX, 140, 900, '160,150,255', lit * .5 * a);
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
  const lt = t - t0; if (lt < 0 || lt > 1.8) return;
  for (let i = 0; i < n; i++) {
    const r = rng(seed * 777 + i), ang = r() * Math.PI * 2, v = (300 + r() * 1100) * power;
    const life = .6 + r() * 1.1; if (lt > life) continue;
    const k = lt / life, d = v * (1 - Math.exp(-lt * 3)) / 3;
    const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d + 260 * lt * lt;
    const al = (1 - k) * (1 - k);
    const tx = x - Math.cos(ang) * 22 * (1 - k), ty = y - Math.sin(ang) * 22 * (1 - k);
    for (const [ctx, w] of [[M, 2], [G, 5]]) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al;
      ctx.strokeStyle = r() < .3 ? '#FFFFFF' : C.yellow; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
    }
  }
}
function shockwave(t, t0, cx, cy, maxR = 1300, dur = .9, col = '#FFF6D0') {
  const p = prog(t, t0, t0 + dur); if (p <= 0 || p >= 1) return;
  const r = maxR * eOutExpo(p), a = (1 - p);
  for (const [ctx, w] of [[M, lerp(30, 2, p)], [G, lerp(70, 8, p)]]) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * .8;
    ctx.strokeStyle = ctx === M ? col : C.yellow; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * .92, 0, 0, 7); ctx.stroke(); ctx.restore();
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
// texto com "metal" iluminado: gradiente vertical + brilho emissivo
function heroText(str, x, y, s, a, { w = 900, ls = 10, blur = 0, glow = .45, col = '#FFFFFF' } = {}) {
  if (a <= .01) return;
  M.save(); M.font = font(w, s); M.letterSpacing = ls + 'px'; M.textAlign = 'center'; M.textBaseline = 'middle';
  const g = M.createLinearGradient(0, y - s * .5, 0, y + s * .5);
  if (col === '#FFFFFF') { g.addColorStop(0, '#FFFFFF'); g.addColorStop(.55, '#E9E6F7'); g.addColorStop(1, '#9C93C9'); }
  else { g.addColorStop(0, '#FFF6C2'); g.addColorStop(.5, C.yellow); g.addColorStop(1, '#C9930A'); }
  M.fillStyle = g; M.globalAlpha = clamp(a); if (blur > .3) M.filter = `blur(${blur}px)`;
  M.fillText(str, x + ls / 2, y); M.restore();
  text(G, str, x, y, { w, s, col: C.yellow, a: a * glow, blur: 6 + blur, ls });
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
function eyePos(cx, cy, size) { return EYES.map(([ex, ey]) => [cx + (ex - .5) * size, cy + (ey - .5) * size]); }
function eyeGlow(cx, cy, size, a, rs = 1) {
  for (const [x, y] of eyePos(cx, cy, size)) {
    glowDot(M, x, y, size * .05 * rs, '255,240,170', a);
    glowDot(G, x, y, size * .12 * rs, '255,213,40', a);
  }
}
function logoArcs(t, cx, cy, size, a, seed, count = 3, col = C.yellow) {
  const q = Math.floor(t * 15);
  for (let k = 0; k < count; k++) {
    const r = rng(seed + q * 31 + k * 7); if (r() < .4) continue;
    const ang = r() * Math.PI * 2, R = size * (.38 + r() * .06);
    const x1 = cx + Math.cos(ang) * R * .95, y1 = cy + Math.sin(ang) * R;
    const out = size * (.08 + r() * .16), a2 = ang + (r() - .5) * 1.3;
    drawBolt(boltTree(x1, y1, x1 + Math.cos(a2) * out, y1 + Math.sin(a2) * out, seed + q * 131 + k, { depth: 5, branches: 1 }), a * (.5 + r() * .5), 1.8, col);
  }
}
function logoFull(t, cx, cy, size, a, o = {}) {
  if (a <= .01) return;
  const { shine = -1, eyes = .6, arcs = 1, seed = 1, blur = 0, eyeR = 1, arcCol = C.yellow, arcN = 4, gA = 1 } = o;
  glowDot(M, cx, cy + size * .02, size * .75, '66,49,166', .6 * a);
  glowDot(G, cx, cy, size * .5, '255,213,40', .14 * a);
  drawLogoImg(M, cx, cy, size, a, blur);
  drawLogoImg(G, cx, cy, size, a * .24 * gA, blur);
  logoShine(cx, cy, size, shine, a);
  eyeGlow(cx, cy, size, eyes * a * (.85 + .15 * Math.sin(t * 9)), eyeR);
  if (arcs > 0) logoArcs(t, cx, cy, size, a * arcs, seed, arcN, arcCol);
}

// ---------- bandeira ----------
function buildFlag() {
  const f = flagTex.getContext('2d'), FW = 1500, FH = 1000;
  f.fillStyle = C.indigo; f.fillRect(0, 0, FW, FH);
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
    const u = c * step / dw, amp = dh * .055 * Math.pow(u, .75);
    const ph = u * 9.5 - t * 4.4, ph2 = u * 5.1 - t * 2.6 + 1;
    const dy = amp * Math.sin(ph) + amp * .5 * Math.sin(ph2);
    const sy = 1 - .04 * u * (.5 + .5 * Math.cos(ph));
    const srcX = u * 1500, srcW = step / dw * 1500;
    FL.drawImage(flagTex, srcX, 0, srcW, 1000, c * step, pad + dy + dh * (1 - sy) * .5, step + .6, dh * sy);
    shade.push(amp * (Math.cos(ph) * 9.5 + .5 * Math.cos(ph2) * 5.1) / (dh * .6));
  }
  FL.globalCompositeOperation = 'source-atop';
  for (let c = 0; c < cols; c++) {
    const s = clamp(shade[c], -1, 1);
    FL.fillStyle = s > 0 ? `rgba(255,255,255,${s * .24})` : `rgba(0,0,10,${-s * .55})`;
    FL.fillRect(c * step, 0, step + .6, LH);
  }
  const lg = FL.createLinearGradient(0, 0, LW, LH);
  lg.addColorStop(0, 'rgba(255,255,255,.10)'); lg.addColorStop(1, 'rgba(0,0,0,.4)');
  FL.fillStyle = lg; FL.fillRect(0, 0, LW, LH);
  if (lit > 0) { FL.fillStyle = `rgba(225,220,255,${lit * .5})`; FL.fillRect(0, 0, LW, LH); }
  M.save(); M.globalAlpha = clamp(a); M.drawImage(flagL, 0, 0, LW, LH, X, Y - pad, LW, LH); M.restore();
  G.save(); G.globalAlpha = clamp(a * .14); G.drawImage(flagL, 0, 0, LW, LH, X, Y - pad, LW, LH); G.restore();
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
  const v = vigC.getContext('2d'), g = v.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.78)');
  v.fillStyle = g; v.fillRect(0, 0, W, H);
  for (let k = 0; k < 4; k++) {
    const c = mk(W, H), x = c.getContext('2d'), id = x.createImageData(W, H), r = rng(500 + k);
    for (let i = 0; i < id.data.length; i += 4) { const n = 128 + (r() - .5) * 160; id.data[i] = id.data[i + 1] = id.data[i + 2] = n; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0); grain.push(c);
  }
}
function chromatic(k) {
  // separa R, G e B e amplia cada canal um pouco diferente a partir do centro
  CA1.globalCompositeOperation = 'copy'; CA1.drawImage(cv, 0, 0);
  M.setTransform(1, 0, 0, 1, 0, 0); M.globalCompositeOperation = 'source-over'; M.globalAlpha = 1;
  M.fillStyle = '#000'; M.fillRect(0, 0, W, H);
  [['#FF0000', 1 + k * .012], ['#00FF00', 1], ['#0000FF', 1 - k * .012]].forEach(([col, s]) => {
    CA2.globalCompositeOperation = 'copy'; CA2.drawImage(caA, 0, 0);
    CA2.globalCompositeOperation = 'multiply'; CA2.fillStyle = col; CA2.fillRect(0, 0, W, H);
    M.globalCompositeOperation = 'lighter';
    M.drawImage(caB, W / 2 - W * s / 2, H / 2 - H * s / 2, W * s, H * s);
  });
  M.globalCompositeOperation = 'source-over';
}

// =====================================================================
// CENAS
// =====================================================================
const LOGO_SIZE = 880;

// 0–6s: emenda com o close do Super Choque → recuo explosivo até a logo
function sceneOpen(t) {
  const lt = t - T_OPEN, cx = W / 2, cy = H / 2;
  const IMP = 1.1;
  bg(.3 * prog(lt, 1, 1.8));
  const stormLit = Math.max(decay(lt, IMP, .25), decay(lt, 3.6, .16) * (hash(Math.floor(t * 30)) > .3 ? 1 : .4));
  drawClouds(t, prog(lt, 1, 2), stormLit, 1500);
  const eyeX = cx + (EYE_C[0] - .5) * LOGO_SIZE, eyeY = cy + (EYE_C[1] - .5) * LOGO_SIZE;
  const z = prog(lt, .2, IMP), ez = eInOut(z);
  let s = 1 + 7 * (1 - ez);
  if (lt > IMP) s = 1 + .07 * eInOut(prog(lt, 1.3, 6)) - .035 * Math.exp(-(lt - IMP) * 5) * Math.cos((lt - IMP) * 14);
  const [sx, sy] = shake(lt, IMP, 22, 4.5);
  setCam({ sx, sy });
  godRays(t, cx, cy - 40, .55 * eOut(prog(lt, IMP, IMP + .5)), 18, 1500);
  setCam({ s, fx: lerp(eyeX, cx, ez), fy: lerp(eyeY, cy, ez), sx, sy });
  const inA = prog(lt, .03, .3);
  const vel = Math.sin(Math.PI * z);
  if (vel > .05) for (let k = 1; k <= 6; k++) drawLogoImg(M, cx, cy, LOGO_SIZE * (1 + k * .05 * vel), .13 * vel * inA);
  logoFull(lt, cx, cy, LOGO_SIZE, inA, {
    shine: prog(lt, 1.9, 2.9),
    eyes: lt < IMP + .05 ? lerp(.9, 1.3, z) : .7 + 1.2 * Math.exp(-(lt - IMP) * 2),
    arcs: lt < .7 ? 1 : prog(lt, .95, 1.3), seed: 11, eyeR: 1 / Math.sqrt(s),
    arcCol: lt < 2.2 ? ICE : C.yellow, arcN: lt < IMP ? 6 : 4, gA: 1 / (s * s),
  });
  setCam({ sx, sy });
  [[.0, -80, 300, 900, 620], [.1, 2000, 200, 1150, 520], [.28, 700, -60, 960, 460], [.5, 1980, 900, 1020, 470]].forEach(([b, x0, y0, x1, y1], k) => {
    if (lt > b && lt < b + .25) drawBolt(boltTree(x0, y0, x1, y1, 20 + k * 9 + Math.floor(lt * 24), { branches: 4 }), 1.4 * (1 - prog(lt, b, b + .25)), 3.2, ICE);
  });
  if (lt > IMP - .02) eyePos(cx, cy, LOGO_SIZE).forEach(([x, y]) => anamorphic(x, y, 900 * eOut(prog(lt, IMP, IMP + .25)), .75 * decay(lt, IMP, .5) + .1, '255,226,140'));
  shockwave(lt, IMP, cx, cy, 1500, 1);
  shockwave(lt, IMP + .1, cx, cy, 1000, .8);
  sparks(lt, IMP, cx, cy - 80, 110, 3, 1.2);
  embers(lt, .75 * prog(lt, 1.2, 2.5), 70, 1);
  if (lt > 3.6 && lt < 3.95) drawBolt(boltTree(1580, -40, 1720, 560, 77 + Math.floor(lt * 15), { depth: 6, branches: 4 }), (1 - prog(lt, 3.6, 3.95)) * .9, 2.2, '#9d8dff');
  flash(lt, IMP, .45, .12); flash(lt, 3.6, .07, .2);
  aberr(lt, IMP, 1, .35); aberr(lt, 0, .5, .15); aberr(lt, .28, .4, .12);
}

// Versículo em J-cut: rasga a tela por cima do fim da cena anterior e as palavras batem rápido
function ripPath(ctx, lt, seed) {
  const p = eOutExpo(prog(lt, 0, .32)), hh = (H / 2 + 120) * p;
  const r = rng(seed), q = rng(seed + Math.floor(lt * 24));
  const top = [], bot = [];
  for (let x = -80; x <= W + 80; x += 80) {
    top.push([x, H / 2 - hh + (r() - .5) * 60 * p + (q() - .5) * 10]);
    bot.push([x, H / 2 + hh + (r() - .5) * 60 * p + (q() - .5) * 10]);
  }
  ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]);
  for (const pt of top) ctx.lineTo(pt[0], pt[1]);
  for (const pt of bot.slice().reverse()) ctx.lineTo(pt[0], pt[1]);
  ctx.closePath();
  return { top, bot, p };
}
function sceneVerse(t, t0, d, v, seed) {
  const lt = t - t0; if (lt < 0 || lt > d) return;
  // recorte rasgado (aplicado em M e G)
  setCam({});
  M.save(); G.save();
  const rip = ripPath(M, lt, seed * 31); M.clip(); ripPath(G, lt, seed * 31); G.clip();
  G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.fillStyle = '#000'; G.fillRect(0, 0, 960, 540); G.restore();
  bg(.14, .5); drawClouds(t, .45);
  setCam({ s: 1.04 - .04 * lt / d });
  embers(t, .35, 35, seed);
  const size = v.size, lh = size * 1.28;
  const y0 = H / 2 - (v.lines.length - 1) * lh / 2 - size * .25;
  const space = size * .27;
  let gi = 0, lastStart = 0, hiPos = null;
  v.lines.forEach((line, li) => {
    const words = line.split(' ').map(s => ({ s: s.replace(/\*/g, ''), hi: s.startsWith('*') }));
    let total = 0;
    for (const wd of words) {
      M.font = font(wd.hi ? 700 : 300, size); M.letterSpacing = '0px';
      wd.w = M.measureText(wd.s).width; total += wd.w;
    }
    total += space * (words.length - 1);
    let x = W / 2 - total / 2;
    const y = y0 + li * lh;
    for (const wd of words) {
      const st = .12 + gi * .055; lastStart = st;
      const p = eOutExpo(prog(lt, st, st + .35));
      let a = clamp(p * 1.4);
      if (wd.hi) {
        const fl = lt - st;
        if (fl > 0 && fl < .3) a *= hash(Math.floor(t * 30) + gi * 13) > .45 ? 1 : .2;
        if (!hiPos) hiPos = [x + wd.w / 2, y, st];
      }
      const blur = (1 - p) * 14, dx = (1 - p) * 70 * (li % 2 ? -1 : 1);
      const cxw = x + wd.w / 2;
      if (wd.hi) heroText(wd.s, cxw + dx, y, size, a, { w: 700, ls: 0, blur, glow: .32, col: 'Y' });
      else text(M, wd.s, cxw + dx, y, { w: 300, s: size, col: '#F2F0FA', a, blur });
      x += wd.w + space; gi++;
    }
  });
  if (hiPos) {
    const [hx, hy, hs] = hiPos;
    anamorphic(hx, hy + size * .05, 700 * eOut(prog(lt, hs + .2, hs + .6)), .35 * decay(lt, hs + .2, .8), '255,220,120');
  }
  const ra = eOut(prog(lt, lastStart + .25, lastStart + .7));
  const ry = y0 + (v.lines.length - 1) * lh + size * .55 + 60;
  text(M, v.ref, W / 2, ry, { w: 600, s: 22, col: '#A79DF0', a: ra, ls: 9 });
  M.save(); M.globalAlpha = ra * .6; M.fillStyle = C.yellow;
  const lw = 40 * ra; M.fillRect(W / 2 - 160 - lw, ry - 1, lw, 2); M.fillRect(W / 2 + 160, ry - 1, lw, 2); M.restore();
  M.restore(); G.restore();
  // raios nas bordas do rasgo enquanto abre
  setCam({});
  if (rip.p < 1) {
    const a = 1.3 * (1 - rip.p);
    drawBolt([{ pts: rip.top, w: 1 }], a, 3.5); drawBolt([{ pts: rip.bot, w: 1 }], a, 3.5);
  }
  flash(lt, 0, .3, .08); aberr(lt, 0, .8, .18);
}

function sceneV1(t) {
  const lt = t - T_V1, d = T_COL - T_V1;
  sceneVerse(t, T_V1, d, VERSES.v1, 21);
  const p = prog(lt, d - .7, d);
  FLOOD = Math.max(FLOOD, eInExpo(p));
  if (p > 0) { setCam({}); glowDot(G, W / 2 + 170, H / 2, 300 + 1600 * eIn(p), '255,240,190', p * 1.3); godRays(t, W / 2 + 170, H / 2, p * 1.2, 22, 2000, '255,240,200'); }
}

function zigzag(edgeX, seed, t) {
  const r = rng(seed), q = rng(seed * 3 + Math.floor(t * 15)), pts = [];
  for (let j = -1; j <= 13; j++) pts.push([edgeX + (j % 2 ? 80 : -80) + (r() - .5) * 70 + (q() - .5) * 12, j * H / 12]);
  return pts;
}
// cores: 4 cortes rápidos em tela cheia + os 4 quadrados entrando dos cantos
function sceneColors(t) {
  const lt = t - T_COL; setCam({});
  const per = .8, A = 4 * per;
  if (lt < A) {
    const i = Math.floor(lt / per), l = lt - i * per, col = COLS[i];
    const prev = i === 0 ? '#FFFFFF' : COLS[i - 1].c;
    const [sx, sy] = shake(l, .18, 10, 8);
    setCam({ sx, sy, s: 1.03 + .03 * l / per });
    M.fillStyle = prev; M.fillRect(-60, -60, W + 120, H + 120);
    const p = eInOut(prog(l, 0, .3)), edgeX = lerp(-260, W + 260, p);
    const zz = zigzag(edgeX, 900 + i, t);
    M.fillStyle = col.c; M.beginPath(); M.moveTo(-80, -80);
    for (const pt of zz) M.lineTo(pt[0], pt[1]);
    M.lineTo(-80, H + 80); M.closePath(); M.fill();
    const sheen = M.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, 'rgba(255,255,255,.10)'); sheen.addColorStop(.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(0,0,0,.18)');
    M.fillStyle = sheen; M.fillRect(-60, -60, W + 120, H + 120);
    if (p > 0 && p < 1) drawBolt([{ pts: zz, w: 1 }], Math.sin(Math.PI * p) * 1.4, 4.5, i === 1 ? '#FFFFFF' : C.yellow);
    if (l > .16) {
      const L = charLayout(col.n, 900, 220, 22);
      L.ch.forEach((o, k) => {
        const st = .16 + k * .022, pp = eOutExpo(prog(l, st, st + .25));
        text(M, o.c, W / 2 + o.x, H / 2 - 30 + (1 - pp) * 70, { w: 900, s: 220, col: col.tc, a: clamp(pp * 1.5), blur: (1 - pp) * 12 });
      });
      const hp = eOut(prog(l, .3, .5));
      text(M, col.hex, W / 2, H / 2 + 125, { w: 500, s: 34, col: col.tc, a: hp * .75, ls: 14 });
      text(M, `0${i + 1} / 04`, W - 120, 90, { w: 600, s: 18, col: col.tc, a: .55 * hp, ls: 6, align: 'right' });
      text(M, 'IDENTIDADE  •  CORES', 120, 90, { w: 600, s: 18, col: col.tc, a: .55 * hp, ls: 8, align: 'left' });
    }
    aberr(l, .18, .5, .15);
  } else {
    const l = lt - A;
    const [sx, sy] = shake(l, .42, 14, 6);
    bg(.2, .5); drawClouds(t, .6, decay(l, .42, .25), 960);
    setCam({ sx, sy, s: 1 + .05 * eOut(prog(l, .4, 3.2)) });
    const tw = 640, th = 340, gap = 26;
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    COLS.forEach((col, j) => {
      const [kx, ky] = corners[j];
      const tx = W / 2 + kx * (tw / 2 + gap / 2), ty = H / 2 + ky * (th / 2 + gap / 2);
      const p = eOutExpo(prog(l, j * .06, .42 + j * .06));
      const x = lerp(W / 2 + kx * 1500, tx, p), y = lerp(H / 2 + ky * 1000, ty, p);
      const rot = (1 - p) * kx * ky * .25, sc = lerp(1.6, 1, p);
      M.save(); M.translate(x, y); M.rotate(rot); M.scale(sc, sc);
      M.shadowColor = 'rgba(0,0,0,.55)'; M.shadowBlur = 40; M.shadowOffsetY = 18;
      M.fillStyle = col.c; M.beginPath(); M.roundRect(-tw / 2, -th / 2, tw, th, 22); M.fill();
      M.shadowColor = 'transparent';
      const sh = M.createLinearGradient(-tw / 2, -th / 2, tw / 2, th / 2);
      sh.addColorStop(0, 'rgba(255,255,255,.14)'); sh.addColorStop(.6, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.15)');
      M.fillStyle = sh; M.fill();
      if (j === 2) { M.strokeStyle = 'rgba(255,255,255,.18)'; M.lineWidth = 2; M.stroke(); }
      M.restore();
      const ta = eOut(prog(l, .45 + j * .05, .75 + j * .05));
      text(M, col.n, tx - tw / 2 + 44, ty + th / 2 - 92, { w: 900, s: 58, col: col.tc, a: ta, ls: 4, align: 'left' });
      text(M, col.hex, tx - tw / 2 + 46, ty + th / 2 - 46, { w: 500, s: 24, col: col.tc, a: ta * .7, ls: 6, align: 'left' });
    });
    // energia atravessando as divisões quando os quadrados se encaixam
    if (l > .42 && l < 1.0) {
      const a = 1.3 * (1 - prog(l, .42, 1.0)), q = Math.floor(l * 24);
      drawBolt(boltTree(W / 2, H / 2 - th - 60, W / 2, H / 2 + th + 60, 960 + q, { branches: 2, disp: 30 }), a, 3);
      drawBolt(boltTree(W / 2 - tw - 60, H / 2, W / 2 + tw + 60, H / 2, 970 + q, { branches: 2, disp: 30 }), a, 3);
    }
    setCam({});
    flash(l, .42, .35, .1); aberr(l, .42, .9, .25);
    sparks(l, .42, W / 2, H / 2, 70, 77, 1);
  }
}

// bandeira: o raio a revela, a câmera avança e termina num zoom rápido na logo do pano
function sceneFlag(t) {
  const lt = t - T_FLAG, d = T_V3 - T_FLAG + .4;
  bg(.22, .45);
  const ST = [[.1, 960, 1], [2.0, 1500, .8], [3.9, 300, .8]];
  let lit = 0;
  ST.forEach(([s0, x0, k]) => { lit = Math.max(lit, k * decay(lt, s0, .22) * (lt - s0 < .25 ? (hash(Math.floor(lt * 30)) > .3 ? 1 : .4) : 1)); });
  drawClouds(t, .9, lit, 960);
  setCam({});
  ST.forEach(([s0, x0], k) => {
    if (k === 0) return;
    if (lt > s0 && lt < s0 + .45) drawBolt(boltTree(x0, -60, x0 + (k % 2 ? 160 : -180), 760, 300 + k * 50 + Math.floor(lt * 20), { branches: 5 }), (1 - prog(lt, s0, s0 + .45)) * 1.2, 2.8, '#b3a6ff');
  });
  const inA = eOut(prog(lt, .1, .4));
  const [sx, sy] = shake(lt, .1, 16, 5);
  const dw = 1180, dh = 787, X = (W - dw) / 2 + 40, Y = (H - dh) / 2 - 20;
  const logoX = X + dw / 2, logoY = Y + dh / 2;
  const push = eInOut(prog(lt, 0, 4.9)), whip = eInExpo(prog(lt, 4.7, 5.9));
  const s = lerp(.92, 1.16, push) * (1 + 2.6 * whip);
  setCam({ s, fx: lerp(W / 2 + 40, logoX, whip), fy: lerp(H / 2, logoY, whip), sx, sy });
  drawPole(X - 6, Y, inA);
  drawFlag(lt * 1.25, X, Y, dw, dh, inA, lit);
  setCam({ sx, sy });
  strike(lt, .1, 980, -80, 1000, Y + dh * .45, 310, { w: 7, life: .5, branches: 7 });
  setCam({});
  M.save(); M.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const h1 = hash(4000 + i), h2 = hash(5000 + i), sp = 900 + h1 * 900;
    const x = ((lt * sp * .55 + h2 * 2600) % 2600) - 340, y = ((lt * sp + hash(6000 + i) * 1400) % 1400) - 160;
    M.globalAlpha = (.05 + .05 * h2) * inA; M.strokeStyle = '#cfc8ff'; M.lineWidth = 1.1;
    M.beginPath(); M.moveTo(x, y); M.lineTo(x + 30, y + 55); M.stroke();
  }
  M.restore();
  embers(t, .45 * inA, 40, 9);
  const la = eOut(prog(lt, .8, 1.4)) * (1 - prog(lt, 4.5, 4.9));
  M.fillStyle = C.yellow; M.globalAlpha = la; M.fillRect(W - 180, H - 112, 60 * la, 2); M.globalAlpha = 1;
  text(M, 'A BANDEIRA', W - 205, H - 111, { w: 600, s: 20, col: '#EDEAFB', a: la * .8, ls: 9, align: 'right' });
  flash(lt, .1, .7, .12); aberr(lt, .1, .9, .3);
  ST.slice(1).forEach(([s0]) => { flash(lt, s0, .12, .15); aberr(lt, s0, .25, .15); });
  aberr(lt, 4.7, .9 * prog(lt, 4.7, 5.9), 99);   // aberração crescendo no zoom final
}

function sceneTeam(t) {
  const lt = t - T_TEAM;
  bg(.18, .5);
  const cy = H / 2 + 10, per = .7, N0 = 1.8;
  let lit = decay(lt, .1, .3);
  TEAM.forEach((_, i) => { lit = Math.max(lit, .7 * decay(lt, N0 + i * per, .15)); });
  drawClouds(t, .7, lit, 960);
  setCam({});
  embers(t, .4, 40, 13);
  // líder
  if (lt < N0) {
    const [sx, sy] = shake(lt, .1, 16, 6);
    const exitP = prog(lt, N0 - .2, N0), exitA = 1 - eIn(exitP);
    setCam({ sx, sy });
    godRays(t, W / 2, cy, .45 * eOut(prog(lt, .1, .5)) * exitA, 14, 1300);
    setCam({ sx, sy, s: 1 + .05 * lt / N0 });
    strike(lt, .08, W / 2 + 60, -80, W / 2, cy - 110, 41, { w: 7, life: .45, branches: 6 });
    const L = charLayout(LEADER, 900, 230, 16);
    L.ch.forEach((o, k) => {
      const on = .12 + hash(k + 70) * .3;
      let a = lt < on ? 0 : (lt < on + .18 ? (hash(Math.floor(t * 30) + k * 9) > .4 ? 1 : .2) : 1);
      heroText(o.c, W / 2 + o.x - exitP * 120, cy, 230, a * exitA, { ls: 0, blur: exitP * 14, glow: .5 });
    });
    const pp = eOutBack(prog(lt, .45, .75));
    M.save(); M.translate(W / 2, cy - 185); M.scale(pp, pp);
    pill(M, 0, 0, 200, 50, C.yellow, exitA); text(M, 'LÍDER', 0, 1, { w: 800, s: 25, col: C.black, ls: 8, a: exitA });
    M.restore();
    glowDot(G, W / 2, cy - 185, 170, '255,213,40', .55 * clamp(pp) * exitA);
    anamorphic(W / 2, cy - 185, 800 * eOut(prog(lt, .45, .8)), .7 * decay(lt, .45, .6) * exitA, '255,220,120');
    setCam({});
    flash(lt, .1, .65, .12); aberr(lt, .1, .9, .3);
    sparks(lt, .1, W / 2, cy - 100, 70, 41, 1);
  }
  // nomes: um raio para cada um, em sequência rápida
  TEAM.forEach((name, i) => {
    const s0 = N0 + i * per, l = lt - s0;
    if (l < -.05 || l > per) return;
    const [sx, sy] = shake(l, 0, 12, 9);
    setCam({ sx, sy });
    const pin = eOutExpo(prog(l, 0, .18)), pout = eInExpo(prog(l, per - .14, per));
    const sc = lerp(1.35, 1, pin) + .05 * l;
    const a = pin * (1 - pout), blur = (1 - pin) * 14 + pout * 18;
    const sz = name.length > 10 ? 140 : 175;
    M.save(); M.translate(W / 2, cy); M.scale(sc, sc); M.translate(-W / 2, -cy);
    G.save(); G.translate(W / 2, cy); G.scale(sc, sc); G.translate(-W / 2, -cy);
    heroText(name, W / 2 - pout * 160, cy, sz, a, { ls: 10, blur, glow: .35 });
    M.restore(); G.restore();
    text(M, `0${i + 2} / 08`, W / 2, cy - 150, { w: 600, s: 20, col: C.yellow, a: a * .85, ls: 8 });
    const r = rng(i + 500);
    strike(l, 0, W / 2 + (r() - .5) * 600, -80, W / 2 + (r() - .5) * 200, cy - 100, 600 + i * 10, { w: 4.5, life: .32, branches: 4 });
    setCam({});
    flash(l, 0, .3, .07); aberr(l, 0, .55, .12);
    sparks(l, 0, W / 2, cy - 90, 30, 500 + i, .7);
  });
  // todos juntos, ligados por energia
  const gl = lt - (N0 + TEAM.length * per);
  if (gl >= 0) {
    const [sx, sy] = shake(gl, 0, 12, 6);
    setCam({ sx, sy, s: 1 + .04 * gl / 2.5 });
    const top = 300;
    godRays(t, W / 2, top, .35 * eOut(prog(gl, 0, .4)), 14, 1200);
    const pos = [];
    [0, 1, 2, 3].forEach((k, j) => pos[k] = [W * (j + 1) / 5, 590]);
    [440, 960, 1480].forEach((x, j) => pos[4 + j] = [x, 750]);
    pos.forEach(([x, y], k) => {
      const st = .08 + k * .045, a = eOutExpo(prog(gl, st, st + .3));
      if (a > 0) {
        const q = Math.floor(t * 15);
        drawBolt(boltTree(W / 2, top + 55, x, y - 45, 700 + k * 13 + q, { depth: 5, branches: 0, disp: 35 }), a * (.35 + .3 * hash(q + k)), 1.2);
      }
      heroText(TEAM[k], x, y + (1 - a) * 30, 56, a, { w: 800, ls: 5, glow: .2 });
    });
    const la = eOutExpo(prog(gl, 0, .25));
    heroText(LEADER, W / 2, top + (1 - la) * 30, 110, la, { ls: 12, glow: .7, col: 'Y' });
    pill(M, W / 2, top - 90, 160, 40, C.yellow, la);
    text(M, 'LÍDER', W / 2, top - 89, { w: 800, s: 20, col: C.black, ls: 7, a: la });
    text(M, 'ALTA VOLTAGEM', W / 2, H - 120, { w: 600, s: 20, col: '#A79DF0', a: eOut(prog(gl, .6, 1)), ls: 14 });
    setCam({});
    flash(gl, 0, .4, .1); aberr(gl, 0, .7, .2);
    sparks(gl, 0, W / 2, top, 60, 88, 1);
  }
}

// final: tempestade converge → apagão e silêncio → GOLPE → logo → corte seco
function sceneFinal(t) {
  const lt = t - T_FIN, cx = W / 2, cy = H / 2, hit = FIN_HIT;
  const END = 6.6;
  if (lt >= END) { M.setTransform(1, 0, 0, 1, 0, 0); M.fillStyle = '#000'; M.fillRect(0, 0, W, H); BLACK = 1; return; }
  const BOLTS = [.15, .4, .62, .8, .92, 1.0];
  if (lt < hit) {
    const chargeA = 1 - prog(lt, 1.08, 1.12);
    bg(.08 * chargeA);
    const lit = Math.max(...BOLTS.map(b => decay(lt, b, .1)));
    drawClouds(t * 3, .8 * chargeA, lit * chargeA, 960);
    setCam({ s: 1 + .1 * lt / hit });
    for (let i = 0; i < 120; i++) {
      const h1 = hash(8000 + i), h2 = hash(8100 + i), ang = h1 * Math.PI * 2 + lt * (.6 + h2);
      const f = (lt * (1.2 + h2 * 1.2) + h2) % 1, d = (1 - eIn(f)) * (500 + h2 * 800);
      const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d, a = f * prog(lt, 0, .3) * chargeA;
      for (const [ctx, r] of [[M, 2], [G, 6]]) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = C.yellow;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
    }
    M.globalAlpha = G.globalAlpha = 1; M.globalCompositeOperation = G.globalCompositeOperation = 'source-over';
    const k = lt / 1.08;
    glowDot(G, cx, cy, 120 + 260 * k, '255,213,40', (.3 + .7 * k) * chargeA);
    glowDot(M, cx, cy, 40 + 80 * k, '255,250,220', .6 * k * chargeA);
    BOLTS.forEach((b, j) => {
      if (lt > b && lt < b + .13) {
        const r = rng(j + 300), ang = r() * Math.PI * 2;
        drawBolt(boltTree(cx + Math.cos(ang) * 1200, cy + Math.sin(ang) * 800, cx, cy, 310 + j * 7 + Math.floor(lt * 30), { branches: 3 }), 1.3 * (1 - prog(lt, b, b + .13)), 3);
        aberr(lt, b, .35, .1);
      }
    });
    if (lt > 1.12) {
      setCam({});
      const ea = eOut(prog(lt, 1.14, 1.28)) * (hash(Math.floor(t * 30)) > .25 ? 1 : .5);
      eyePos(cx, cy, LOGO_SIZE).forEach(([x, y]) => { glowDot(M, x, y, 26, '255,245,200', ea); glowDot(G, x, y, 90, '255,213,40', ea); anamorphic(x, y, 260 * ea, .5 * ea, '255,226,140'); });
    }
  } else {
    const [sx, sy] = shake(lt, hit, 30, 4);
    bg(.32, .5);
    const lit = Math.max(decay(lt, hit, .4), .5 * decay(lt, 3.6, .15), .7 * decay(lt, 5.4, .15));
    drawClouds(t, 1, lit, 960);
    setCam({ sx, sy });
    godRays(t, cx, cy - 40, .75 * eOut(prog(lt, hit, hit + .4)), 22, 1700);
    const pin = eOutBack(prog(lt, hit, hit + .45));
    const s = lerp(1.45, 1, pin) + .06 * eInOut(prog(lt, 2, END));
    setCam({ s, sx, sy });
    logoFull(lt, cx, cy, LOGO_SIZE, prog(lt, hit, hit + .06), {
      shine: prog(lt, 2.4, 3.4), seed: 51,
      eyes: .45 + 1.6 * Math.exp(-(lt - hit) * 2.5) + 1.8 * Math.exp(-Math.abs(lt - 5.9) * 4),
      arcs: 1 + prog(lt, 5, 5.9), arcN: 6,
    });
    setCam({ sx, sy });
    const fl = 1.0 * decay(lt, hit, .45) + .08 + .9 * Math.exp(-Math.abs(lt - 6.0) * 3) * prog(lt, 5, 6);
    eyePos(cx, cy, LOGO_SIZE).forEach(([x, y]) => anamorphic(x, y, 1000, fl, '255,226,140'));
    strike(lt, hit - .04, cx + 90, -100, cx, cy - 140, 999, { w: 9, life: .5, branches: 8 });
    if (lt > 3.6 && lt < 3.95) drawBolt(boltTree(1650, -40, 1760, 600, 1201 + Math.floor(lt * 15), { branches: 4 }), (1 - prog(lt, 3.6, 3.95)) * .9, 2.2, '#b3a6ff');
    if (lt > 5.4 && lt < 5.75) drawBolt(boltTree(240, -40, 120, 640, 1301 + Math.floor(lt * 15), { branches: 4 }), (1 - prog(lt, 5.4, 5.75)) * .9, 2.2, '#b3a6ff');
    shockwave(lt, hit, cx, cy, 1700, 1.1);
    shockwave(lt, hit + .12, cx, cy, 1200, .9);
    shockwave(lt, hit + .25, cx, cy, 800, .7);
    sparks(lt, hit, cx, cy - 60, 160, 61, 1.5);
    sparks(lt, 6.0, cx, cy - 160, 60, 62, .8);
    setCam({});
    embers(t, .8 * prog(lt, hit, hit + 1), 90, 5);
    flash(lt, hit, .85, .15); flash(lt, 6.0, .35, .1);
    aberr(lt, hit, 1.6, .45); aberr(lt, 6.0, .8, .2);
  }
}

// =====================================================================
function renderFrame(t) {
  FLASH = 0; FLOOD = 0; BLACK = 0; CA = 0;
  M.setTransform(1, 0, 0, 1, 0, 0); M.globalAlpha = 1; M.globalCompositeOperation = 'source-over'; M.filter = 'none';
  M.fillStyle = '#040308'; M.fillRect(0, 0, W, H);
  G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over';
  G.fillStyle = '#000'; G.fillRect(0, 0, 960, 540);

  // cada versículo começa por cima do fim da cena anterior (J-cut)
  if (t < T_V1 + JCUT) sceneOpen(t);
  if (t >= T_V1 && t < T_COL) sceneV1(t);
  if (t >= T_COL && t < T_V2 + JCUT) sceneColors(t);
  if (t >= T_V2 && t < T_FLAG) sceneVerse(t, T_V2, T_FLAG - T_V2, VERSES.v2, 22);
  if (t >= T_FLAG && t < T_V3 + JCUT) sceneFlag(t);
  if (t >= T_V3 && t < T_TEAM) sceneVerse(t, T_V3, T_TEAM - T_V3, VERSES.v3, 23);
  if (t >= T_TEAM && t < T_V4 + JCUT) sceneTeam(t);
  if (t >= T_V4 && t < T_FIN) sceneVerse(t, T_V4, T_FIN - T_V4, VERSES.v4, 24);
  if (t >= T_FIN) sceneFinal(t);
  if (BLACK) return;

  // bloom em três escalas
  setCam({}); M.setTransform(1, 0, 0, 1, 0, 0);
  B1.globalCompositeOperation = 'copy'; B1.filter = 'blur(3px)'; B1.drawImage(gC, 0, 0, 480, 270); B1.filter = 'none';
  B2.globalCompositeOperation = 'copy'; B2.filter = 'blur(5px)'; B2.drawImage(gC, 0, 0, 240, 135); B2.filter = 'none';
  B3.globalCompositeOperation = 'copy'; B3.filter = 'blur(6px)'; B3.drawImage(gC, 0, 0, 120, 68); B3.filter = 'none';
  M.globalCompositeOperation = 'lighter';
  M.globalAlpha = .5; M.drawImage(gC, 0, 0, W, H);
  M.globalAlpha = .95; M.drawImage(b1C, 0, 0, W, H);
  M.globalAlpha = .95; M.drawImage(b2C, 0, 0, W, H);
  M.globalAlpha = .8; M.drawImage(b3C, 0, 0, W, H);
  M.globalCompositeOperation = 'source-over'; M.globalAlpha = 1;

  if (FLOOD > 0) { M.globalAlpha = clamp(FLOOD); M.fillStyle = '#FFFFFF'; M.fillRect(0, 0, W, H); M.globalAlpha = 1; }
  const inColors = t >= T_COL && t < T_COL + 3.2;
  M.globalAlpha = inColors ? .35 : 1; M.drawImage(vigC, 0, 0); M.globalAlpha = 1;
  if (FLASH > 0) { M.globalCompositeOperation = 'lighter'; M.globalAlpha = clamp(FLASH); M.fillStyle = '#FFF7DD'; M.fillRect(0, 0, W, H); M.globalCompositeOperation = 'source-over'; M.globalAlpha = 1; }
  if (CA > .03) chromatic(Math.min(CA, 2));
  M.globalCompositeOperation = 'overlay'; M.globalAlpha = .075;
  M.drawImage(grain[Math.floor(t * FPS) % grain.length], 0, 0);
  M.globalCompositeOperation = 'source-over'; M.globalAlpha = 1;
}

// ---------- efeitos sonoros sincronizados (lidos pelo gerador de áudio) ----------
function buildSFX() {
  const S = [], add = (t, type, o = {}) => S.push(Object.assign({ t, type }, o));
  // abertura: raios do filme → recuo → BRAAAM
  [0, .1, .28, .5].forEach((b, k) => add(b, 'zap', { g: [.7, .5, .6, .5][k] }));
  add(0, 'crackle', { dur: 1.1, g: .5 });
  add(.15, 'reverse', { dur: .95, g: .9 }); add(.2, 'whoosh', { dur: .9, g: .8 });
  add(1.1, 'impact', { g: 1 }); add(1.1, 'braam', { dur: 4, g: 1 }); add(1.1, 'subdrop', { g: .9 });
  add(1.15, 'crackle', { dur: 4.6, g: .3 }); add(1.15, 'hum', { dur: 4.6, g: .22 });
  add(1.9, 'shimmer', { dur: 1.1, g: .4 }); add(3.6, 'thunder', { dur: 3, g: .55 });
  // versículos: o rasgo (zap + whoosh + golpe) e as palavras batendo
  const verseSfx = (t0, v) => {
    add(t0 - .12, 'reverse', { dur: .12, g: .5 }); add(t0, 'swoosh', { g: .7, dur: .35 }); add(t0, 'zap', { g: .7 }); add(t0, 'hit', { g: .7 });
    let gi = 0;
    v.lines.forEach(line => line.split(' ').forEach(w => {
      const st = t0 + .12 + gi * .055;
      if (w.startsWith('*')) { add(st, 'zap', { g: .45 }); add(st + .2, 'shimmer', { dur: 1, g: .25 }); } else add(st, 'tick', { g: .2 });
      gi++;
    }));
    add(t0 + .05, 'drone', { dur: 3.6, g: .3 });
  };
  verseSfx(T_V1, VERSES.v1);
  add(T_COL - 1.4, 'riser', { dur: 1.4, g: .9 });
  // cores
  for (let i = 0; i < 4; i++) {
    const s = T_COL + i * .8;
    add(s, 'swoosh', { g: .7, dur: .35 }); add(s + .16, 'hit', { g: .8 }); add(s + .16, 'zap', { g: .45 });
  }
  const B = T_COL + 3.2;
  [0, .06, .12, .18].forEach(d => add(B + d, 'swoosh', { g: .4, dur: .4 }));
  add(B + .42, 'impact', { g: .85 }); add(B + .42, 'zap', { g: .7 }); add(B + .45, 'crackle', { dur: .7, g: .5 });
  verseSfx(T_V2, VERSES.v2);
  // bandeira
  add(T_FLAG + .1, 'impact', { g: .95 }); add(T_FLAG + .1, 'braam', { dur: 3.5, g: .75 }); add(T_FLAG + .12, 'thunder', { dur: 3.5, g: .8 });
  add(T_FLAG, 'wind', { dur: 6.4, g: .6 }); add(T_FLAG, 'rain', { dur: 6.4, g: .3 });
  [2.0, 3.9].forEach(s => { add(T_FLAG + s, 'zap', { g: .6 }); add(T_FLAG + s + .05, 'thunder', { dur: 2.5, g: .6 }); });
  add(T_FLAG + 4.7, 'riser', { dur: 1.2, g: .8 }); add(T_FLAG + 4.9, 'whoosh', { dur: 1.0, g: .7 });
  verseSfx(T_V3, VERSES.v3);
  // equipe
  add(T_TEAM + .08, 'impact', { g: .95 }); add(T_TEAM + .08, 'braam', { dur: 3, g: .8 }); add(T_TEAM + .1, 'thunder', { dur: 2.5, g: .6 });
  add(T_TEAM + .12, 'crackle', { dur: .6, g: .6 }); add(T_TEAM + .45, 'tick', { g: .5 }); add(T_TEAM + .45, 'shimmer', { dur: .8, g: .3 });
  TEAM.forEach((n, i) => { const s = T_TEAM + 1.8 + i * .7; add(s - .12, 'reverse', { dur: .12, g: .4 }); add(s, 'hit', { g: .9 }); add(s, 'zap', { g: .65 }); });
  const GT = T_TEAM + 1.8 + TEAM.length * .7;
  add(GT, 'impact', { g: .8 }); add(GT, 'shimmer', { dur: 1.6, g: .45 }); add(GT + .1, 'crackle', { dur: 1.4, g: .3 });
  verseSfx(T_V4, VERSES.v4);
  // final
  add(T_FIN, 'riser', { dur: 1.08, g: 1 }); add(T_FIN, 'hum', { dur: 1.08, g: .45 }); add(T_FIN, 'rumble', { dur: 1.08, g: .8 });
  [.15, .4, .62, .8, .92, 1.0].forEach(b => add(T_FIN + b, 'zap', { g: .55 }));
  add(T_FIN + 1.14, 'zap', { g: .35 });
  add(T_FIN + FIN_HIT, 'impact', { g: 1.15 }); add(T_FIN + FIN_HIT, 'braam', { dur: 5, g: 1.1 }); add(T_FIN + FIN_HIT, 'subdrop', { g: 1 });
  add(T_FIN + FIN_HIT + .02, 'thunder', { dur: 4, g: .8 });
  add(T_FIN + 1.5, 'crackle', { dur: 5, g: .32 }); add(T_FIN + 1.5, 'hum', { dur: 5.1, g: .22 });
  add(T_FIN + 2.4, 'shimmer', { dur: 1.2, g: .45 }); add(T_FIN + 3.6, 'thunder', { dur: 2.5, g: .4 });
  add(T_FIN + 5.0, 'riser', { dur: 1.0, g: .6 });
  add(T_FIN + 6.0, 'zap', { g: 1 }); add(T_FIN + 6.0, 'hit', { g: .9 });
  add(T_FIN + 6.6, 'impact', { g: 1.1 });   // corte seco no preto
  return S;
}

window.CONFIG = { W, H, FPS, DUR };
window.SFX = buildSFX();
window.renderFrame = renderFrame;
window.ready = Promise.all([
  new Promise(r => { if (logo.complete && logo.naturalWidth) r(); else logo.onload = r; }),
  ...[300, 500, 600, 700, 800, 900].map(w => document.fonts.load(font(w, 50), 'ÍÃÉ abc')),
]).then(() => { buildFlag(); buildOverlays(); buildClouds(); window.isReady = true; });

// pré-visualização no navegador: ?t=12 congela num instante; sem parâmetro toca em tempo real
window.ready.then(() => {
  if (navigator.webdriver) return;
  const q = new URLSearchParams(location.search);
  if (q.has('t')) { renderFrame(parseFloat(q.get('t'))); return; }
  const start = performance.now();
  const loop = () => { renderFrame(((performance.now() - start) / 1000) % DUR); requestAnimationFrame(loop); };
  loop();
});
