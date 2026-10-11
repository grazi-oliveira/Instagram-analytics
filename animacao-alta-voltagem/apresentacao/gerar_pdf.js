// Gera o PDF da apresentação (17 páginas 1920x1080) a partir de apresentacao.html
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.join(__dirname, 'apresentacao.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(__dirname, 'Alta_Voltagem_Apresentacao.pdf'), width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  await b.close();
})();
