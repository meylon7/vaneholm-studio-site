// Renders share images (1200x630) from the live pages: site/assets/img/og-en.jpg and og-he.jpg
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright');
const sharp = require(process.env.SHARP || '/opt/npm-tools/node_modules/sharp');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..'), SITE = path.join(root, 'site');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const resolve = p => [path.join(SITE, p), path.join(SITE, p + '.html'), path.join(SITE, p, 'index.html')].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const c = await b.newContext({ viewport: { width: 1200, height: 630 } });
await c.route('https://site.test/**', r => { const f = resolve(decodeURIComponent(new URL(r.request().url()).pathname)); r.fulfill(f ? { contentType: types[path.extname(f)], body: fs.readFileSync(f) } : { status: 404, body: '' }); });
for (const lang of ['en', 'he']) {
  const pg = await c.newPage();
  await pg.goto(`https://site.test/${lang}/`, { waitUntil: 'networkidle' });
  await pg.addStyleTag({ content: '.top-end,.nav,.controls{visibility:hidden}.hero{min-height:0;aspect-ratio:auto;height:566px}' });
  await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(2500);
  await sharp(await pg.screenshot()).jpeg({ quality: 84 }).toFile(path.join(SITE, 'assets/img', `og-${lang}.jpg`));
}
await b.close(); console.log('og images written');
