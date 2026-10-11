// Renderiza a animação quadro a quadro com o Chromium e envia os PNGs ao FFmpeg.
// Uso: node render.js saida.mp4 [inicio_s] [fim_s]   |   node render.js --stills pasta t1 t2 ...
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const args = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--disable-web-security', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[page error]', e); process.exit(1); });
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForFunction(() => window.isReady === true);
  const cfg = await page.evaluate(() => window.CONFIG);
  fs.writeFileSync(path.join(__dirname, 'sfx.json'), JSON.stringify(await page.evaluate(() => window.SFX), null, 1));
  // JPEG 97% gerado no próprio canvas: ~20x mais rápido que screenshot PNG e visualmente idêntico após o H.264
  const shot = async () => Buffer.from((await page.evaluate(() =>
    document.getElementById('c').toDataURL('image/jpeg', .97))).split(',')[1], 'base64');

  if (args[0] === '--stills') {
    const dir = args[1]; fs.mkdirSync(dir, { recursive: true });
    for (const t of args.slice(2)) {
      await page.evaluate(t => window.renderFrame(t), parseFloat(t));
      fs.writeFileSync(path.join(dir, `t${String(t).padStart(5, '0')}.jpg`), await shot());
    }
    await browser.close(); return;
  }
  const out = args[0];
  const t0 = parseFloat(args[1] ?? 0), t1 = parseFloat(args[2] ?? cfg.DUR);
  const f0 = Math.round(t0 * cfg.FPS), f1 = Math.round(t1 * cfg.FPS);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(cfg.FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const start = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate(t => window.renderFrame(t), f / cfg.FPS);
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 150 === 0) console.log(`quadro ${f}/${f1}  ${((Date.now() - start) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
})();
