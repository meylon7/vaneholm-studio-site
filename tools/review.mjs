// Visual review: scrolls each page and saves viewport screenshots, then you build contact sheets from tools/shots/rv-*.png
// usage: node tools/review.mjs desktop|mobile /en/ /he/films ...
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..'), SITE = path.join(root, 'site'), OUT = path.join(root, 'tools', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const resolve = p => [path.join(SITE, p), path.join(SITE, p + '.html'), path.join(SITE, p, 'index.html')].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
const [mode, ...urls] = process.argv.slice(2);
const vp = mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const c = await b.newContext({ viewport: vp, isMobile: mode === 'mobile', hasTouch: mode === 'mobile' });
await c.route('https://site.test/**', r => { const f = resolve(decodeURIComponent(new URL(r.request().url()).pathname)); r.fulfill(f ? { contentType: types[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) } : { status: 404, body: '' }); });
for (const u of urls) {
  const pg = await c.newPage();
  await pg.goto('https://site.test' + u, { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(1000);
  const H = await pg.evaluate(() => document.documentElement.scrollHeight); const tag = mode[0] + u.replace(/\//g, '_');
  let i = 0;
  for (let y = 0; y < H; y += vp.height) { await pg.evaluate(y => window.scrollTo(0, y), y); await pg.waitForTimeout(1100); await pg.screenshot({ path: path.join(OUT, `rv-${tag}-${String(i++).padStart(2, '0')}.png`) }); }
  console.log(u, i, 'screens');
  await pg.close();
}
await b.close();
