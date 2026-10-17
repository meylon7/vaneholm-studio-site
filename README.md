# Vaneholm studio site

A bilingual (English and Hebrew) concept site for **Vaneholm**, a fictional architectural film unit that makes launch films for towers by the water.
Static HTML, CSS and vanilla JS with no libraries. Every picture on the site, including the films, the stills and the elevation drawings, is rendered live in the browser. The only image files are the share images.

Live: https://vaneholm-studio-site.vercel.app

## Structure

```
site/                        deploy root (Vercel rootDirectory)
  index.html                 picks /he/ or /en/ from the browser language
  en/  he/                   index, films, studio, contact
  en/films/  he/films/       one case study page per film (4)
  404.html  sitemap.xml  robots.txt  vercel.json
  assets/css/site.css        one stylesheet; RTL through logical properties and :lang(he)
  assets/js/gl.js            WebGL tower shader, five shot grammar, players, stills, elevation drawings
  assets/js/site.js          menu, word light, drag reel, film filter, copy buttons, concept form
  assets/img/                favicon, og-en.jpg, og-he.jpg
tools/
  content.py                 ALL copy in both languages, the films, the archive
  build.py                   generator: writes every page in site/
  check.mjs                  headless Chromium check of all 16 pages
  interact.mjs               interaction tests
  review.mjs                 scrolling screenshots for visual review
  og.mjs                     renders the share images
```

## Editing

All text lives in `tools/content.py`. Change it, then:

```bash
python3 tools/build.py          # prints "built 16 pages"
node tools/check.mjs desktop    # errors, h1, overflow, broken links, every page
node tools/check.mjs mobile
node tools/interact.mjs
node tools/og.mjs               # only when the home hero changes
```

Never edit the HTML in `site/en` or `site/he` by hand. The next build overwrites it.

### Adding a film

Add an entry to `FILMS` with `kind` set to `[twist per level in radians, taper 0..1, levels]` and `tods` set to five times of day (0 is dusk, 1 is night, 2 is dawn fog). Then add its text under `T["en"]["film"]` and `T["he"]["film"]`, and its title under `TITLES`. The building, its five shots, its stills and its elevation drawing are all generated from those numbers, so you don't need any new assets.

The Node scripts need Playwright (and sharp for `og.mjs`). Point `PW` and `SHARP` at their install paths.

## Deploy

The Vercel project uses `site` as the root directory, with no framework and no build command.

```bash
npx vercel@latest deploy --prod --yes --scope meylon-8687s-projects
```

To deploy on every push, connect the repo once in Vercel under Project, Settings, Git. This needs the GitHub login connection in the Vercel account.

## Concept notes

Vaneholm, its people, clients, buildings and films are fictional. The contact form is a concept form: it sends nothing and says so. Email addresses use the reserved `.example` domain.
