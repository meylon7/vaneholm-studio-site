# LEARNINGS

What to repeat and what to stop doing. Covers the Vaneholm sketch and the bilingual site built from it. The reference was charlesalexandertv.com (Webflow, GSAP, Lenis, Swiper, Vimeo).

## Do not do again

- **Hero children with `margin-inline:auto` inside a flex column.** Auto margins switch off stretch, so the controls row shrank to its content and the timeline ruler disappeared on the home page. Fix: `.hero > .wrap { width: 100% }`.
- **A grid child holding an `overflow-x:auto` strip** caused 1600px of page overflow in the sketch. Grid and flex children need `min-width: 0`.
- **Mixed Hebrew and numbers drawn on a canvas** in an LTR context come out in the wrong order ("1:800 חזית א"). Draw Hebrew labels with `ctx.direction = 'rtl'` and right alignment.
- **`dir="ltr"` values inside an RTL spec table** align to the wrong edge: `text-align:end` becomes right. Set the alignment for `[dir=rtl] .spec dd` explicitly. Wrap Latin names inside Hebrew strings in `<bdi>`.
- **Wide 2.39:1 crops of a top down shot** come out mostly empty sky. Pick the shot for the crop, not the other way round.
- **Firecrawl rawHtml of a Webflow page** comes without the main stylesheet. Read the type from the screenshot.
- **Lit windows as flat blocks** looked like bricks. Panes, mullions, a spandrel band, fewer lit windows and varied lamp colour fixed it.

## Repeat

- **Sketch artifact first, then the site.** The sketch settled the look. The site then reused its shader and CSS almost unchanged, spliced in from the sketch file instead of retyped.
- **Generator plus one content file.** 16 pages in two languages stay in sync, and adding a film is a data entry.
- **Data driven buildings.** One `kind` triple (twist, taper, levels) drives:
  - the shader geometry;
  - the camera heights in all five shots;
  - the elevation drawing;
  - the spec table numbers.
- **One offscreen WebGL context** copied into many 2D canvases, with a pixel cap per use: hero 520k, dialog 760k, stills 1.1M.
- **Page data in `<script type="application/json">`.** The shared JS reads film settings and localized UI labels from it, so gl.js holds no copy.
- **Timeline controls forced `dir="ltr"`** in both languages, because a timecode is not prose.
- **Word light that never hides text** (0.26 to 1 opacity). The text stays readable with no JS.
- **check.mjs, interact.mjs and review.mjs together.** They gave errors, overflow, links, behaviour and a visual pass in under ten minutes for 16 pages.
- **Deploy with the static-site-ship skill**, now on its third run.

## Skill candidate

The chain has now run three times with the same steps:
1. research a reference;
2. build a sketch artifact;
3. build a bilingual generator site;
4. ship it.

Steps 3 and 4 are mechanical enough to become a `reference-site-to-bilingual` skill that wraps static-site-ship.
