#!/usr/bin/env python3
"""Builds the static Vaneholm site into ../site from tools/content.py.

Run from the repo root:  python3 tools/build.py
Output: site/{en,he}/index|films|studio|contact.html, site/{en,he}/films/<slug>.html,
site/index.html (language redirect), site/404.html, sitemap.xml, robots.txt.
Assets in site/assets are hand written and are not touched by this script.
"""
import html
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from content import (T, FILMS, REEL, LENSES, CASE_STILLS, CONTACT_SHEET, ARCHIVE, EMAIL, TITLES, SITE_URL)  # noqa: E402

OUT = os.path.join(os.path.dirname(HERE), "site")
FONTS = ("https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800"
         "&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600"
         "&family=Noto+Sans+Hebrew:wdth,wght@62.5..100,400..800&display=swap")
FILM = {f["slug"]: f for f in FILMS}
COVER = {"saltglass": (0, 0.5), "ninefold": (1, 0.62), "cinder-pier": (4, 0.4), "marrow-house": (2, 0.55)}
PAGES = ["index", "films", "studio", "contact"] + [f"films/{f['slug']}" for f in FILMS]


def e(s):
    return html.escape(str(s), quote=True)


def href(page, L):
    return f"/{L['lang']}/" + ("" if page == "index" else page)


def cur(p, page):
    return ' aria-current="page"' if p == page or (p == "films" and page.startswith("films/")) else ""


def height_m(f):
    return f"{4 + f['kind'][2] * 3.6:.1f}"


def twist_deg(f):
    return round(math.degrees(abs(f["kind"][0])), 1)


def clock(tod):
    m = int(19 * 60 + 30 + tod * 300) % 1440
    return f"{m // 60:02d}:{m % 60:02d}"


def tide(i):
    x = math.sin(i * 12.9898 + 4.1) * 43758.5453
    return f"{0.4 + 2.0 * (x - math.floor(x)):.1f}"


def datum(code, label):
    return f'<p class="datum"><span class="tri" aria-hidden="true"></span><b>{code}</b> {e(label)}</p>'


# ---------------------------------------------------------------- shell

def head(L, page, title, desc):
    lang, other = L["lang"], L["other"]
    s = "" if page == "index" else page
    canon = f"{SITE_URL}/{lang}/{s}"
    og = f"{SITE_URL}/assets/img/og-{lang}.jpg"
    return f"""<!doctype html>
<html lang="{lang}" dir="{L['dir']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="theme-color" content="#08090b">
<link rel="canonical" href="{canon}">
<link rel="alternate" hreflang="{lang}" href="{canon}">
<link rel="alternate" hreflang="{other}" href="{SITE_URL}/{other}/{s}">
<link rel="alternate" hreflang="x-default" href="{SITE_URL}/en/{s}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Vaneholm">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canon}">
<meta property="og:locale" content="{L['locale']}">
<meta property="og:image" content="{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{og}">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="/assets/css/site.css">
<script src="/assets/js/site.js" defer></script>
<script src="/assets/js/gl.js" defer></script>
</head>
<body class="p-{page.split('/')[0]}">
<a class="skip" href="#main">{e(L['skip'])}</a>
"""


def data_blob(L):
    d = {"films": {f["slug"]: {"kind": f["kind"], "tods": f["tods"], "title": TITLES[f["slug"]]} for f in FILMS},
         "reel": REEL, "shots": L["shots"], "lenses": LENSES,
         "ui": {k: L["player"][k] for k in ("play", "pause", "sound_on", "sound_off", "seconds")},
         "copy": {k: L["foot"][k] for k in ("copy", "copied", "select")}}
    return f'<script type="application/json" id="vh-data">{json.dumps(d, ensure_ascii=False)}</script>\n'


def header(L, page):
    n = L["nav"]
    other = L["other"]
    s = "" if page == "index" else page
    items = "".join(f'<a href="{href(p, L)}"{cur(p, page)}>{e(n[p])}</a>' for p in ["films", "studio", "contact"])
    big = "".join(f'<a href="{href(p, L)}"{cur(p, page)}>{e(n[p])}</a>' for p in ["index", "films", "studio", "contact"])
    return f"""<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="/{L['lang']}/" aria-label="Vaneholm"><span class="mark" aria-hidden="true"></span><span dir="ltr">VANEHOLM</span><small>{e(L['brand_sub'])}</small></a>
    <nav class="nav" aria-label="{e(L['menu'])}">{items}</nav>
    <div class="top-end">
      <a class="lang" href="/{other}/{s}" hreflang="{other}" lang="{other}" title="{e(L['other_label'])}">{e(L['other_short'])}</a>
      <a class="cta" href="/{L['lang']}/contact">{e(L['cta'])}</a>
      <button type="button" class="menu-btn" aria-expanded="false" aria-controls="menu" data-open="{e(L['menu'])}" data-close="{e(L['close'])}">{e(L['menu'])}</button>
    </div>
  </div>
  <div class="menu" id="menu" hidden>
    <nav class="wrap menu-in" aria-label="{e(L['menu'])}">{big}<a class="menu-lang" href="/{other}/{s}" hreflang="{other}" lang="{other}">{e(L['other_label'])}</a></nav>
  </div>
</header>
<main id="main">
"""


def footer(L, page):
    f, n = L["foot"], L["nav"]
    other = L["other"]
    s = "" if page == "index" else page
    links = "".join(f'<li><a href="{href(p, L)}">{e(n[p])}</a></li>' for p in ["index", "films", "studio", "contact"])
    return f"""</main>
<footer class="foot">
  <div class="wrap">
    <div class="foot-grid">
      <div class="stack s2">
        <a class="brand" href="/{L['lang']}/" aria-label="Vaneholm"><span class="mark" aria-hidden="true"></span><span dir="ltr">VANEHOLM</span></a>
        <p class="dim small measure">{e(L['tagline'])}</p>
        <a class="lang-row mono" href="/{other}/{s}" hreflang="{other}" lang="{other}">{e(L['other_label'])}</a>
      </div>
      <div><h2 class="fh">{e(f['explore'])}</h2><ul>{links}</ul></div>
      <div><h2 class="fh">{e(f['connect'])}</h2>
        <div class="stack s2">
          <p class="dim small">{e(f['new'])}</p>
          <div class="mail"><code id="mail-foot" dir="ltr">{EMAIL}</code><button type="button" class="copybtn" data-copy="mail-foot">{e(f['copy'])}</button></div>
        </div>
      </div>
      <div><h2 class="fh">{e(f['social'])}</h2><ul class="dim"><li>Vimeo</li><li>Instagram</li><li>LinkedIn</li></ul></div>
    </div>
    <div class="wordmark" aria-hidden="true" dir="ltr">VANEHOLM</div>
    <div class="foot-base"><span dir="ltr">{e(f['rights'])}</span><span>{e(f['note'])}</span></div>
  </div>
</footer>
"""


def end(L):
    return data_blob(L) + "</body>\n</html>\n"


# ---------------------------------------------------------------- components

def controls(L, total_label="00:30:00"):
    p = L["player"]
    marks = "".join(f'<span class="mk" style="left:{i * 20}%">SH0{i + 1}</span>' for i in range(5))
    return f"""<div class="controls" dir="ltr">
    <button type="button" class="ctl toggle" aria-pressed="false"><span class="ico" aria-hidden="true"></span><span class="lbl">{e(p['play'])}</span></button>
    <div class="tc"><span class="time">00:00:00 / {total_label}</span><span class="shot">&nbsp;</span></div>
    <div class="ruler" role="slider" tabindex="0" aria-label="{e(p['scrub'])}" aria-valuemin="0" aria-valuemax="30" aria-valuenow="0" aria-valuetext="0 {e(p['seconds'])}">
      <span class="ticks"></span>{marks}<span class="ph"></span>
    </div>
    <button type="button" class="ctl snd" aria-pressed="false" hidden>{e(p['sound_off'])}</button>
  </div>"""


def dialog(L):
    p = L["player"]
    return f"""<dialog class="film-dlg player" id="film-dlg" aria-label="{e(p['watch'])}">
  <div class="bar"><span class="mono"><span class="dlg-title"></span> <span class="dim">· {e(p['teaser'])}</span></span><button type="button" class="copybtn dlg-x">{e(p['close'])}</button></div>
  <div class="scr"><canvas class="film" aria-hidden="true"></canvas><span class="cap"></span></div>
  <div class="wrap-dlg">{controls(L)}</div>
</dialog>
"""


def still(slug, shot, u, ratio="r-169", shift=None, mono=False, label=""):
    sh = f' data-shift="{shift}"' if shift is not None else ""
    mo = ' data-mono="1"' if mono else ""
    al = f' role="img" aria-label="{e(label)}"' if label else ' aria-hidden="true"'
    return f'<div class="frame {ratio}"><canvas class="still" data-film="{slug}" data-shot="{shot}" data-u="{u}"{sh}{mo}{al}></canvas></div>'


def watch_btn(L, slug):
    return f'<button type="button" class="btn open-film" data-film="{slug}"><span class="play" aria-hidden="true"></span>{e(L["player"]["watch"])}</button>'


def film_card(L, f, big=False, next_label=None):
    slug = f["slug"]
    F = L["film"][slug]
    shot, u = COVER[slug]
    nx = f'<span class="next-tag mono">{e(next_label)}</span>' if next_label else ""
    return f"""<a class="card{' big' if big else ''}" href="{href('films/' + slug, L)}" data-type="{f['type']}">
  <div class="frame">{still(slug, shot, u, 'r-43', label=TITLES[slug] + ': ' + F['card'])}{nx}</div>
  <div class="row"><h3 dir="ltr">{TITLES[slug]}</h3><span class="mono dim">{e(L['types'][f['type']])} · {f['year']}</span></div>
  <p class="dim small">{e(F['card'])}</p>
</a>"""


def contact_sheet(L, slug):
    pr = L["process"]
    frames = "".join(f'<figure><div class="frame r-32"><canvas class="still" data-film="{slug}" data-shot="{s}" data-u="{u}"'
                     + (f' data-shift="{sh}"' if sh is not None else "") + f' data-mono="1" aria-hidden="true"></canvas><span class="no" dir="ltr">R03 · {no}</span></div></figure>'
                     for s, u, sh, no in CONTACT_SHEET)
    return f"""<div class="reel-wrap">
      <div class="reel" tabindex="0" aria-label="{e(pr['strip'])}">{frames}</div>
      <div class="dragcur" aria-hidden="true">{e(pr['drag'])}</div>
    </div>"""


def flow_block(L, f):
    fl, fm = L["flow"], L["fmt"]
    w = f["weeks"]
    durs = [fm["weeks"].format(n=w[0]), fm["days"].format(n=w[1]), fm["weeks"].format(n=w[2])]
    cols = []
    for i, (name, items) in enumerate(fl["steps"]):
        lis = "".join(f"<li>{e(x)}</li>" for x in items)
        cols.append(f'<div><span class="dur">{e(durs[i])}</span><h3>{e(name)}</h3><ul>{lis}</ul></div>')
    arrow = '<span class="arrow" aria-hidden="true"></span>'
    return f'<div class="flow">{cols[0]}{arrow}{cols[1]}{arrow}{cols[2]}</div>'


def band_cta(L):
    h = L["home"]
    return f"""<section class="cta-band">
  <div class="wrap cta-in">
    <h2>{e(h['band_h'])}</h2>
    <div class="stack s3"><p class="lead">{e(h['band_p'])}</p><div><a class="btn" href="{href('contact', L)}">{e(L['cta'])}</a></div></div>
  </div>
</section>
"""


# ---------------------------------------------------------------- pages

def page_home(L):
    h = L["home"]
    reel_json = e(json.dumps(REEL))
    stats = "".join(f'<div class="stat"><b>{n}</b><span>{e(t)}</span></div>' for n, t in h["stats"])
    cards = "".join(film_card(L, f) for f in FILMS)
    grammar = "".join(
        f'<li><figure>{still(REEL[i][1] if i < 4 else "saltglass", i, 0.5, "r-43")}<figcaption><b dir="ltr">SH0{i + 1}</b> {e(L["shots"][i])}</figcaption></figure></li>'
        for i in range(5))
    clients = "".join(f'<li dir="ltr">{e(c)}</li>' for c in h["client_list"])
    f0 = FILM["saltglass"]
    return f"""<section class="hero player home-hero" id="hero" data-reel="{reel_json}" data-autoplay="1" aria-label="{e(L['player']['reel'])}">
  <canvas class="film" aria-hidden="true"></canvas>
  <div class="hero-shade"></div>
  <div class="wrap hero-in">
    <p class="kicker mono">{e(h['kicker'])}</p>
    <h1 class="h1-long">{e(h['h1'])}</h1>
    <p class="hero-sub">{e(h['sub'])}</p>
    <div class="hero-row"><a class="btn" href="{href('films', L)}">{e(h['all_films'])}</a><span class="mono dim">{e(L['player']['reel'])} · 0:30</span></div>
  </div>
  <div class="wrap">{controls(L)}</div>
</section>

<section class="lvl">
  <div class="wrap grid">
    <div class="span-7 stack">
      {datum('L01', h['statement_label'])}
      <h2 class="lightwords">{e(h['statement'])}</h2>
    </div>
    <div class="start-8 copy end">{''.join(f'<p>{e(p)}</p>' for p in h['statement_p'])}</div>
  </div>
  <div class="wrap stats">{stats}</div>
</section>

<section class="lvl" id="selected">
  <div class="wrap stack s4">
    <div class="split">{datum('L02', h['selected'])}<a class="textlink mono" href="{href('films', L)}">{e(h['all_films'])}</a></div>
    <div class="cards c2">{cards}</div>
  </div>
</section>

<section class="lvl">
  <div class="wrap stack s4">
    <div class="grid">
      <div class="span-7 stack">{datum('L03', h['method_label'])}<h2>{e(h['method_h'])}</h2></div>
      <p class="start-8 copy end">{e(L['studio']['method'][0][1])}</p>
    </div>
    <ol class="grammar">{grammar}</ol>
  </div>
</section>

<section class="lvl">
  <div class="wrap grid">
    <div class="span-5 stack">
      {datum('L04', L['datum']['refs'])}
      <h2 class="lightwords">{e(h['drawing_h'])}</h2>
      <div class="copy"><p>{e(h['drawing_p'])}</p></div>
      <div><a class="btn ghost" href="{href('studio', L)}">{e(h['drawing_link'])}</a></div>
    </div>
    <div class="start-7">{elevation(L, f0, 'saltglass')}</div>
  </div>
</section>

<section class="lvl clients">
  <div class="wrap stack s3">
    {datum('L05', h['clients'])}
    <ul class="client-list">{clients}</ul>
  </div>
</section>
""" + band_cta(L)


def elevation(L, f, slug):
    F = L["film"][slug]
    d = L["case"]["drawing"]
    lab = d["label"].format(b=f["building"], n=f["kind"][2], h=height_m(f))
    k = ",".join(str(x) for x in f["kind"])
    return (f'<div class="drawing"><canvas class="elev" role="img" aria-label="{e(lab)}" data-kind="{k}" data-mark="{F["mark"]}" '
            f'data-noa="{e(F["noa"])}" data-building="{e(f["building"].upper())}" data-sheet="{e(d["title"])}" data-sun="{e(d["sun"])}" '
            f'data-clock="{clock(f["tods"][0])}"></canvas></div>')


def page_films(L):
    fl = L["films"]
    chips = "".join(f'<button type="button" data-type="{k}" aria-pressed="{"true" if k == "all" else "false"}">{e(v)}</button>'
                    for k, v in L["types"].items())
    cards = "".join(film_card(L, f, big=True) for f in FILMS)
    cols = fl["archive_cols"]
    rows = "".join(f'<tr data-type="{t}"><td class="mono">{y}</td><td dir="ltr" class="t">{e(n)}</td><td dir="ltr">{e(c)}</td><td class="dim">{e(L["types"][t])}</td></tr>'
                   for y, n, c, t in ARCHIVE)
    return f"""<section class="phead">
  <div class="wrap grid">
    <div class="span-7 stack">{datum('L00', fl['h1'])}<h1 class="h1-page">{e(fl['h1'])}</h1></div>
    <p class="start-8 copy end lead">{e(fl['intro'])}</p>
  </div>
</section>
<section class="lvl tight">
  <div class="wrap stack s4">
    <div class="chips" role="group" aria-label="{e(fl['filter'])}">{chips}</div>
    <div class="cards c2 films-grid">{cards}</div>
    <p class="none mono dim" hidden>0</p>
  </div>
</section>
<section class="lvl">
  <div class="wrap stack s3">
    {datum('L01', fl['archive'])}
    <div class="table-wrap"><table class="archive">
      <thead><tr><th>{e(cols[0])}</th><th>{e(cols[1])}</th><th>{e(cols[2])}</th><th>{e(cols[3])}</th></tr></thead>
      <tbody>{rows}</tbody>
    </table></div>
  </div>
</section>
""" + band_cta(L)


def page_studio(L):
    st = L["studio"]
    intro = "".join(f"<p>{e(p)}</p>" for p in st["intro"])
    grammar = "".join(
        f'<li class="g-item"><figure>{still(REEL[i][1] if i < 4 else "saltglass", i, 0.45, "r-32")}</figure>'
        f'<div class="stack s1"><p class="mono"><b dir="ltr">SH0{i + 1}</b> · {e(L["shots"][i])} · <span dir="ltr">{LENSES[i]}</span></p><p>{e(st["grammar"][i])}</p></div></li>'
        for i in range(5))
    method = "".join(f'<div class="m-item"><h3>{e(t)}</h3><p>{e(p)}</p></div>' for t, p in st["method"])
    team = "".join(f'<li><span dir="ltr">{e(n)}</span><span class="dim">{e(r)}</span></li>' for n, r in st["team"])
    awards = "".join(f'<li><span class="mono">{y}</span><span dir="ltr">{e(f)}</span><span class="dim">{e(a)}</span></li>' for y, f, a in st["awards"])
    return f"""<section class="phead">
  <div class="wrap grid">
    <div class="span-8 stack">{datum('L00', st['label'])}<h1 class="h1-page">{e(st['h1'])}</h1></div>
  </div>
</section>
<div class="wrap band">
  <figure>{still('saltglass', 0, 0.35, 'r-wide', 0.3, label=st['h1'])}</figure>
</div>
<section class="lvl tight">
  <div class="wrap grid"><div class="span-6"></div><div class="start-7 copy">{intro}</div></div>
</section>
<section class="lvl">
  <div class="wrap stack s4">
    <div class="grid"><div class="span-7 stack">{datum('L01', st['grammar_label'])}<h2 class="lightwords">{e(st['grammar_h'])}</h2></div></div>
    <ol class="g-list">{grammar}</ol>
  </div>
</section>
<section class="lvl">
  <div class="wrap stack s4">
    {datum('L02', st['method_label'])}
    <div class="m-grid">{method}</div>
  </div>
</section>
<section class="lvl">
  <div class="wrap grid">
    <div class="span-5 stack">{datum('L03', st['team_label'])}<h2>{e(st['team_h'])}</h2></div>
    <ul class="start-7 people">{team}</ul>
  </div>
</section>
<section class="lvl">
  <div class="wrap grid">
    <div class="span-5 stack">{datum('L04', st['awards_label'])}</div>
    <ul class="start-7 people awards">{awards}</ul>
  </div>
</section>
<section class="lvl">
  <div class="wrap stack s4">
    <div class="grid"><div class="span-6 stack">{datum('L05', L['datum']['process'])}<h2>{e(st['reel_h'])}</h2></div><p class="start-7 copy end">{e(L['process']['p'])}</p></div>
    {contact_sheet(L, 'saltglass')}
  </div>
</section>
""" + band_cta(L)


def page_contact(L):
    c = L["contact"]
    fm = c["form"]
    types = "".join(f'<label class="pick"><input type="radio" name="type" value="{i}"{" checked" if i == 0 else ""}><span>{e(t)}</span></label>' for i, t in enumerate(fm["types"]))
    whens = "".join(f'<option>{e(w)}</option>' for w in fm["whens"])
    units = "".join(f'<div class="unit"><h3>{e(t)}</h3><p class="dim small">{e(p)}</p></div>' for t, p in c["units"])
    faq = "".join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in c["faq"])
    return f"""<section class="phead">
  <div class="wrap grid">
    <div class="span-7 stack">{datum('L00', c['label'])}<h1 class="h1-page">{e(c['h1'])}</h1></div>
    <p class="start-8 copy end lead">{e(c['intro'])}</p>
  </div>
</section>
<section class="lvl tight">
  <div class="wrap grid">
    <form class="span-7 concept brief" data-done="{e(fm['done'])}" novalidate>
      <div class="row2">
        <div class="field"><label for="f-name">{e(fm['name'])}</label><input id="f-name" name="name" autocomplete="name" required></div>
        <div class="field"><label for="f-email">{e(fm['email'])}</label><input id="f-email" name="email" type="email" autocomplete="email" dir="ltr" required></div>
      </div>
      <div class="field"><label for="f-company">{e(fm['company'])}</label><input id="f-company" name="company" autocomplete="organization"></div>
      <fieldset class="field"><legend>{e(fm['type'])}</legend><div class="picks">{types}</div></fieldset>
      <div class="field"><label for="f-when">{e(fm['when'])}</label><select id="f-when" name="when">{whens}</select></div>
      <div class="field"><label for="f-msg">{e(fm['msg'])}</label><textarea id="f-msg" name="msg" rows="5" placeholder="{e(fm['msg_ph'])}"></textarea></div>
      <div class="send-row"><button type="submit" class="btn">{e(fm['send'])}</button><p class="status small" role="status" aria-live="polite"></p></div>
    </form>
    <aside class="start-9 stack s4">
      <div class="stack s2">{datum('L01', c['mail_label'])}<div class="mail big"><code id="mail-contact" dir="ltr">{EMAIL}</code><button type="button" class="copybtn" data-copy="mail-contact">{e(L['foot']['copy'])}</button></div></div>
      <div class="stack s2">{datum('L02', c['units_label'])}{units}</div>
    </aside>
  </div>
</section>
<section class="lvl">
  <div class="wrap grid">
    <div class="span-5 stack">{datum('L03', c['faq_label'])}</div>
    <div class="start-7 faq">{faq}</div>
  </div>
</section>
"""


def page_case(L, slug):
    f = FILM[slug]
    F = L["film"][slug]
    fx, fm, D, C = L["facts"], L["fmt"], L["datum"], L["case"]
    title = TITLES[slug]
    shots = L["shots"]
    twist = fm["straight"] if f["kind"][0] == 0 else fm["twist"].format(d=twist_deg(f), t=round(twist_deg(f) * f["kind"][2]))
    facts = [(fx["client"], f["client"], True), (fx["commissioned"], f["commissioned"], True),
             (fx["building"], (f["building"], fm["levels"].format(n=f["kind"][2], h=height_m(f))), False),
             (fx["twist"], twist, False), (fx["locations"], F["locations"], False), (fx["format"], F["format"], False),
             (fx["runtime"], fm["runtime"].format(r=f["runtime"]), False), (fx["scope"], F["scope"], False)]
    def val(v):
        return f"<bdi>{e(v[0])}</bdi>, {e(v[1])}" if isinstance(v, tuple) else e(v)
    spec = "".join(f'<div><dt>{e(k)}</dt><dd{" dir=ltr" if ltr else ""}>{val(v)}</dd></div>' for k, v, ltr in facts)

    n = [0]

    def fig(item):
        shot, u, ratio, shift, lay = item
        n[0] += 1
        tod = max(0.0, min(2.0, f["tods"][shot] + (shift or 0)))
        cap_r = f'{clock(tod)} · {fm["tide"].format(t=tide(n[0] + len(slug)))}'
        lbl = f"{title}, SH0{shot + 1} {shots[shot]}"
        cls = "" if lay == "full" else f' class="{lay}"'
        return (f'<figure{cls}>{still(slug, shot, u, ratio, shift, label=lbl)}'
                f'<figcaption><span><b dir="ltr">SH0{shot + 1}</b> {e(shots[shot])} · <span dir="ltr">{LENSES[shot]}</span></span><span dir="ltr">{cap_r}</span></figcaption></figure>')

    bands = {k: "".join(fig(i) for i in v) for k, v in CASE_STILLS.items()}
    cr = F["credits"]
    cl = C["credit_labels"]
    crow = "".join(f'<div><dt>{e(cl[k])}</dt><dd>{e(cr[k])}</dd></div>' for k in ["director", "producer", "production", "cg", "cast"])
    depts = "".join(f'<div class="dept"><h3>{e(t)}</h3><ul>' + "".join(f'<li><span>{e(r)}</span> <bdi>{e(nm)}</bdi></li>' for r, nm in people) + "</ul></div>"
                    for t, people in F["depts"])
    others = [x for x in FILMS if x["slug"] != slug]
    idx = [x["slug"] for x in FILMS].index(slug)
    nxt = FILMS[(idx + 1) % len(FILMS)]
    others.sort(key=lambda x: 0 if x["slug"] == nxt["slug"] else 1)
    more = "".join(film_card(L, x, next_label=C["next"] if x["slug"] == nxt["slug"] else None) for x in others)
    paras = lambda ps: "".join(f"<p>{e(p)}</p>" for p in ps)  # noqa: E731

    return f"""<section class="hero player case-hero" id="hero" data-film="{slug}" data-autoplay="1" aria-label="{e(title)}">
  <canvas class="film" aria-hidden="true"></canvas>
  <div class="hero-shade"></div>
  <div class="wrap hero-in">
    <p class="kicker mono">{e(F['kicker'])}</p>
    <h1 dir="ltr"{' class="h1-mid"' if len(title) > 11 else ''}>{title}</h1>
    <p class="hero-sub">{e(F['sub'])}</p>
    <div class="hero-row">{watch_btn(L, slug)}<span class="mono dim">{e(fm['meta'].format(r=f['runtime']))}</span></div>
  </div>
  <div class="wrap">{controls(L)}</div>
</section>

<div class="wrap">
  <nav class="crumb mono" aria-label="Breadcrumb"><a href="{href('films', L)}">{e(C['crumb'])}</a><span class="dim">/</span><span class="dim" dir="ltr">{title}</span></nav>
</div>

<section class="lvl">
  <div class="wrap grid">
    <div class="span-6 stack">
      {datum('L01', D['details'])}
      <h2 class="lightwords">{e(F['details_h'])}</h2>
      <div class="copy">{paras(F['details'])}</div>
      <div>{watch_btn(L, slug)}</div>
    </div>
    <div class="start-8 stack">
      {datum('L02', D['facts'])}
      <dl class="spec">{spec}</dl>
    </div>
  </div>
</section>

<div class="wrap band">{bands['band1']}</div>

<section class="lvl">
  <div class="wrap grid">
    <div class="span-7 stack">{datum('L03', D['story'])}<h2 class="lightwords">{e(F['story_h'])}</h2></div>
    <div class="start-8 copy end">{paras(F['story'])}</div>
  </div>
</section>

<div class="wrap band">{bands['band2']}</div>

<section class="lvl">
  <div class="wrap grid">
    <div class="span-6 stack">{datum('L04', D['intent'])}<h2 class="lightwords">{e(F['intent_h'])}</h2></div>
    <div class="start-7 copy end">{paras(F['intent'])}</div>
  </div>
</section>

<div class="wrap band">{bands['band3']}</div>

<section class="lvl">
  <div class="wrap grid">
    <div class="span-5 stack">
      {datum('L05', D['refs'])}
      <h2 class="lightwords">{e(F['refs_h'])}</h2>
      <div class="copy">{paras(F['refs'])}</div>
    </div>
    <div class="start-7">{elevation(L, f, slug)}</div>
  </div>
</section>

<section class="lvl">
  <div class="wrap stack s4">
    <div class="grid">
      <div class="span-6 stack">{datum('L06', D['flow'])}<h2>{e(L['flow']['h'])}</h2></div>
      <p class="start-7 copy end">{e(L['flow']['p'])}</p>
    </div>
    {flow_block(L, f)}
  </div>
</section>

<section class="lvl">
  <div class="wrap stack s4">
    <div class="grid">
      <div class="span-6 stack">{datum('L07', D['process'])}<h2>{e(L['process']['h'])}</h2></div>
      <p class="start-7 copy end">{e(L['process']['p'])}</p>
    </div>
    {contact_sheet(L, slug)}
  </div>
</section>

<section class="lvl" id="credits">
  <div class="wrap credits">
    <div class="main stack">
      {datum('L08', D['credits'])}
      <h2>{e(C['credits_h'])}</h2>
      <p class="dim small">{e(C['commissioned_line'].format(c=f['commissioned'], cl=f['client']))}</p>
      <dl class="spec">{crow}</dl>
    </div>
    <div class="depts">{depts}</div>
  </div>
</section>

<section class="lvl more">
  <div class="wrap stack s5">
    <h2 class="more-h"><small>{e(C['more_small'])}</small>{e(C['more_big'])}</h2>
    <div class="cards c3">{more}</div>
  </div>
</section>
""" + dialog(L)


def meta_for(L, page):
    if page.startswith("films/"):
        slug = page.split("/")[1]
        F = L["film"][slug]
        return f"{TITLES[slug]} · Vaneholm", F["sub"]
    key = {"index": "home"}.get(page, page)
    return L[key]["title"], L[key]["desc"]


def build_page(L, page):
    if page == "index":
        body = page_home(L)
    elif page == "films":
        body = page_films(L)
    elif page == "studio":
        body = page_studio(L)
    elif page == "contact":
        body = page_contact(L)
    else:
        body = page_case(L, page.split("/")[1])
    title, desc = meta_for(L, page)
    return head(L, page, title, desc) + header(L, page) + body + footer(L, page) + end(L)


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def build():
    for lang, L in T.items():
        for page in PAGES:
            write(os.path.join(OUT, lang, f"{page}.html"), build_page(L, page))

    write(os.path.join(OUT, "index.html"), f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vaneholm</title>
<meta name="description" content="{e(T['en']['home']['desc'])}">
<link rel="canonical" href="{SITE_URL}/en/">
<link rel="alternate" hreflang="en" href="{SITE_URL}/en/">
<link rel="alternate" hreflang="he" href="{SITE_URL}/he/">
<link rel="alternate" hreflang="x-default" href="{SITE_URL}/en/">
<meta property="og:title" content="Vaneholm">
<meta property="og:image" content="{SITE_URL}/assets/img/og-en.jpg">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<script>try{{var l=(navigator.languages||[navigator.language||'']).join(',').toLowerCase();location.replace(/(^|,)(he|iw)\\b/.test(l)?'/he/':'/en/');}}catch(e){{}}</script>
<style>body{{margin:0;background:#08090b;color:#ebe6dc;font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:320px;padding:48px 16px}}a{{color:#ebe6dc;margin:0 12px;font-size:20px}}</style>
</head>
<body><p><a href="/en/">English</a><a href="/he/" lang="he">עברית</a></p></body>
</html>
""")

    en, he = T["en"]["notfound"], T["he"]["notfound"]
    write(os.path.join(OUT, "404.html"), f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(en['title'])}</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="/assets/css/site.css">
</head>
<body class="p-404">
<main class="wrap nf">
  <section class="stack s3"><p class="datum"><span class="tri" aria-hidden="true"></span><b>404</b></p><h1>{e(en['h1'])}</h1><p class="lead">{e(en['p'])}</p><p class="nf-links"><a class="btn" href="/en/">{e(en['home'])}</a><a class="btn ghost" href="/en/films">{e(en['films'])}</a></p></section>
  <section class="stack s3" lang="he" dir="rtl"><p class="datum"><span class="tri" aria-hidden="true"></span><b>404</b></p><h2>{e(he['h1'])}</h2><p class="lead">{e(he['p'])}</p><p class="nf-links"><a class="btn" href="/he/">{e(he['home'])}</a><a class="btn ghost" href="/he/films">{e(he['films'])}</a></p></section>
</main>
</body>
</html>
""")

    urls = []
    for page in PAGES:
        s = "" if page == "index" else page
        for lang in T:
            other = T[lang]["other"]
            urls.append(f"""  <url><loc>{SITE_URL}/{lang}/{s}</loc>
    <xhtml:link rel="alternate" hreflang="{lang}" href="{SITE_URL}/{lang}/{s}"/>
    <xhtml:link rel="alternate" hreflang="{other}" href="{SITE_URL}/{other}/{s}"/>
  </url>""")
    write(os.path.join(OUT, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
          + "\n".join(urls) + "\n</urlset>\n")
    write(os.path.join(OUT, "robots.txt"), f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n")
    print("built", len(PAGES) * len(T), "pages into", OUT)


if __name__ == "__main__":
    build()
