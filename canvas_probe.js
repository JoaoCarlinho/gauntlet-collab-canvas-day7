const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  await page.goto(frontendUrl + '/dev/canvas/e2e-probe', { waitUntil: 'domcontentloaded' });
  try { await page.waitForSelector('[data-testid=canvas-container]', { timeout: 20000 }); } catch {}
  const result = await page.evaluate(() => {
    const out = { ok: false, rect: null, blockers: [] };
    const target = document.querySelector('[data-testid=canvas-container] canvas');
    if (!target) return out;
    const r = target.getBoundingClientRect();
    out.rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    const els = Array.from(document.elementsFromPoint(r.left + r.width/2, r.top + r.height/2));
    for (const el of els) {
      if (el !== target && el !== target.parentElement) {
        const cs = window.getComputedStyle(el);
        out.blockers.push({ tag: el.tagName.toLowerCase(), id: el.id || null, class: el.className || null, pointerEvents: cs.pointerEvents, zIndex: cs.zIndex, display: cs.display, visibility: cs.visibility });
      }
    }
    out.ok = true;
    return out;
  });
  console.log(JSON.stringify(result));
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
