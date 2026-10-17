// Headless Chromium check of every page in both languages.
// usage: node tools/check.mjs [desktop|mobile] [full]
// Serves ./site at https://site.test/ with Vercel style clean URLs, then for each page reports
// errors, h1, horizontal overflow and broken internal links, and saves a screenshot to tools/shots/.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = path.join(root, 'site'), OUT = path.join(root, 'tools', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] || 'desktop', full = process.argv[3] === 'full';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };
function resolve(p) {
  p = decodeURIComponent(p.split('#')[0].split('?')[0]);
  const c = [path.join(SITE, p), path.join(SITE, p + '.html'), path.join(SITE, p, 'index.html')];
  return c.find(f => fs.existsSync(f) && fs.statSync(f).isFile());
}
const pages = [];
for (const l of ['en', 'he']) for (const p of ['', 'films', 'studio', 'contact', 'films/saltglass', 'films/ninefold', 'films/cinder-pier', 'films/marrow-house']) pages.push(`/${l}/${p}`);
const list = only ? pages.filter(p => only.some(o => p.includes(o))) : pages;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const vp = mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const ctx = await b.newContext({ viewport: vp, isMobile: mode === 'mobile', hasTouch: mode === 'mobile' });
await ctx.route('https://site.test/**', r => {
  const f = resolve(new URL(r.request().url()).pathname);
  if (!f) return r.fulfill({ status: 404, body: 'not found' });
  r.fulfill({ contentType: types[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
});
let bad = 0;
for (const url of list) {
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  pg.on('response', r => { if (r.url().startsWith('https://site.test') && r.status() >= 400) errs.push('404 ' + r.url()); });
  await pg.goto('https://site.test' + url, { waitUntil: 'networkidle', timeout: 60000 });
  await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(900);
  const info = await pg.evaluate(() => {
    const h = document.querySelector('h1'), r = h ? h.getBoundingClientRect() : null;
    const links = [...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href'));
    return { h1: h ? h.textContent.trim().slice(0, 40) : null, h1size: r ? Math.round(r.width) + 'x' + Math.round(r.height) : null,
      over: document.documentElement.scrollWidth - innerWidth, H: document.documentElement.scrollHeight, dir: document.documentElement.dir, links: [...new Set(links)] };
  });
  const broken = info.links.filter(h => !resolve(h));
  if (errs.length || broken.length || info.over > 0 || !info.h1) bad++;
  console.log(`${url.padEnd(24)} ${info.dir} h1="${info.h1}" ${info.h1size} H=${info.H} overflow=${info.over} broken=${broken.join(',') || 0} ${errs.length ? 'ERR ' + errs.join(' | ') : 'ok'}`);
  const name = mode + url.replace(/\//g, '_') + '.png';
  await pg.screenshot({ path: path.join(OUT, name), fullPage: full });
  await pg.close();
}
console.log(bad ? `${bad} page(s) with problems` : 'all pages clean');
await b.close();
