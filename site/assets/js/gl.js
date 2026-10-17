/* Vaneholm: everything that draws. One offscreen WebGL context renders the tower; its frames are copied into
   2D canvases for the hero player, the teaser dialog and every still. The elevation drawing is plain canvas 2D.
   Page data (films, reel, shot names, UI labels) comes from <script id="vh-data">. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function each(sel, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), fn); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function safe(name, fn) { try { fn(); } catch (e) { if (window.console) console.warn('vaneholm ' + name + ':', e && e.message); } }
  var DATA = { films: {}, reel: [], shots: ['Arrival', 'Waterline', 'Facade', 'Crown', 'Sea fog'], lenses: ['24 mm', '35 mm', '85 mm', '50 mm', '28 mm'], ui: { play: 'Play', pause: 'Pause', sound_on: 'Sound on', sound_off: 'Sound off', seconds: 'seconds' } };
  safe('data', function () { var el = document.getElementById('vh-data'); if (el) DATA = JSON.parse(el.textContent); });

  /* ---------------------------------------------------------------- tower shader */
  var FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uT; uniform vec3 uCam; uniform vec3 uTgt; uniform float uFov;
uniform float uTod; uniform float uMono; uniform vec3 uKind; uniform float uFade;
const float BASE=0.28; const float FH=0.13;
float wD, wN, wA;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}
float sizeAt(float fi){return 0.56*(1.0-uKind.y*fi/uKind.z);}
float topY(){return BASE+uKind.z*FH;}
vec2 map(vec3 p){
  float n=uKind.z;
  float fi=clamp(floor((p.y-BASE)/FH),0.0,n-1.0);
  float ly=p.y-BASE-(fi+0.5)*FH;
  vec2 q=rot(fi*uKind.x)*p.xz;
  float s=sizeAt(fi);
  float slab=sdBox(vec3(q.x,ly+FH*0.5-0.012,q.y),vec3(s+0.035,0.012,s+0.035))-0.003;
  float glass=sdBox(vec3(q.x,ly,q.y),vec3(s-0.012,FH*0.5,s-0.012));
  vec2 r=vec2(slab,1.0);
  if(glass<r.x) r=vec2(glass,2.0);
  float tp=topY();
  vec2 qt=rot(n*uKind.x)*p.xz; float st=sizeAt(n);
  float roof=sdBox(vec3(qt.x,p.y-tp-0.02,qt.y),vec3(st+0.035,0.02,st+0.035));
  if(roof<r.x) r=vec2(roof,1.0);
  float mast=max(length(p.xz)-0.016,abs(p.y-tp-0.42)-0.42);
  if(mast<r.x) r=vec2(mast,4.0);
  float pod=sdBox(p-vec3(0.0,0.08,0.3),vec3(1.45,0.2,1.3))-0.02;
  if(pod<r.x) r=vec2(pod,3.0);
  return r;
}
vec3 calcN(vec3 p){vec2 e=vec2(0.0015,-0.0015);return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
vec2 boxHit(vec3 ro,vec3 rd){vec3 lo=vec3(-1.6,-0.2,-1.6),hi=vec3(1.6,topY()+0.95,1.75);vec3 inv=1.0/rd;vec3 t0=(lo-ro)*inv,t1=(hi-ro)*inv;vec3 a=min(t0,t1),b=max(t0,t1);return vec2(max(max(a.x,a.y),a.z),min(min(b.x,b.y),b.z));}
vec2 march(vec3 ro,vec3 rd,float t0,float t1){
  float t=max(t0,0.01); float m=-1.0;
  for(int i=0;i<120;i++){ vec2 h=map(ro+rd*t); if(h.x<0.0012*t){m=h.y;break;} t+=h.x*0.8; if(t>t1) break; }
  return vec2(t,m);
}
vec3 sunDir(){
  vec3 dusk=normalize(vec3(-0.92,0.07,-0.38)); vec3 dawn=normalize(vec3(0.8,0.07,-0.6)); vec3 moon=normalize(vec3(-0.35,0.5,-0.8));
  return normalize(dusk*wD+moon*wN+dawn*wA);
}
vec3 horizonC(){return wD*vec3(0.78,0.40,0.2)+wN*vec3(0.03,0.04,0.065)+wA*vec3(0.56,0.57,0.6);}
vec3 env(vec3 d){
  float h=clamp(d.y,0.0,1.0);
  vec3 hor=horizonC();
  vec3 zen=wD*vec3(0.06,0.075,0.19)+wN*vec3(0.004,0.006,0.014)+wA*vec3(0.30,0.35,0.42);
  vec3 c=mix(hor,zen,pow(h,mix(0.32,0.2,wD)));
  vec3 L=sunDir(); float sd=max(dot(d,L),0.0);
  c+=(wD*vec3(1.0,0.6,0.3)*2.2+wA*vec3(1.0,0.9,0.8)*0.6)*pow(sd,320.0);
  c+=(wD*vec3(1.0,0.42,0.16)*0.32+wA*vec3(0.9,0.85,0.8)*0.18)*pow(sd,10.0);
  c+=wN*vec3(0.8,0.85,0.95)*smoothstep(0.99975,0.9999,sd);
  if(wN>0.02){ vec2 g=floor(vec2(atan(d.z,d.x)*240.0,d.y*240.0)); c+=wN*vec3(0.85)*step(0.9965,hash(g))*smoothstep(0.03,0.25,d.y); }
  float az=atan(d.x,-d.z);
  float band=smoothstep(-1.6,-1.0,az)*(1.0-smoothstep(1.0,1.7,az));
  float bx=floor(az*70.0);
  float bh=(0.004+0.026*hash(vec2(bx,3.1))*hash(vec2(floor(az*23.0),1.7)))*band;
  if(d.y>-0.003&&d.y<bh){
    vec3 city=hor*0.28+vec3(0.006);
    float win=step(0.83,hash(floor(vec2(az*1100.0,d.y*1100.0))));
    city+=(wN*1.0+wD*0.18+wA*0.03)*vec3(1.0,0.62,0.28)*win*0.9;
    c=city;
  }
  return c;
}
vec3 shade(vec3 p,vec3 rd,float m){
  vec3 n=calcN(p); vec3 L=sunDir();
  float dif=max(dot(n,L),0.0); float sky=0.5+0.5*n.y;
  vec3 sunC=wD*vec3(1.0,0.58,0.3)*1.7+wN*vec3(0.25,0.3,0.42)*0.3+wA*vec3(0.85,0.84,0.82)*0.55;
  vec3 amb=wD*vec3(0.17,0.15,0.2)+wN*vec3(0.02,0.024,0.036)+wA*vec3(0.34,0.36,0.4);
  float fi=clamp(floor((p.y-BASE)/FH),0.0,uKind.z-1.0);
  vec3 col;
  if(m<1.5){
    vec3 alb=vec3(0.66,0.65,0.62);
    col=alb*(sunC*dif+amb*sky);
    col+=wN*vec3(1.0,0.6,0.28)*0.12*max(-n.y,0.0)+wD*vec3(1.0,0.6,0.3)*0.04*max(-n.y,0.0);
  } else if(m<2.5){
    vec2 q=rot(fi*uKind.x)*p.xz; float s=sizeAt(fi);
    bool xf=abs(q.x)>abs(q.y);
    float u=xf?q.y:q.x; float face=xf?sign(q.x):2.0+sign(q.y);
    float cu=(u/s*0.5+0.5)*11.0; float ci=floor(cu);
    float ly=(p.y-BASE-(fi+0.5)*FH)/(FH*0.5);
    float band=smoothstep(-0.62,-0.52,ly)*smoothstep(0.86,0.76,ly);
    float mull=smoothstep(0.0,0.09,fract(cu))*smoothstep(1.0,0.91,fract(cu));
    vec3 r=reflect(rd,n); float fr=0.1+0.9*pow(1.0-max(dot(-rd,n),0.0),4.0);
    vec3 refl=env(r)*0.75;
    float hv=hash(vec2(fi*1.7+face*13.0,floor(ci*0.5)));
    float lit=step(0.8-0.34*wN+0.14*wA,hv)*band;
    float lvl=0.45+0.55*hash(vec2(fi+3.0,ci+face*5.0));
    vec3 lamp=mix(vec3(1.0,0.58,0.24),vec3(0.86,0.88,0.95),step(0.82,hash(vec2(ci,fi+face))));
    vec3 inner=lamp*lvl*lit*(0.16*wD+0.95*wN+0.04*wA)*(0.75+0.25*ly)+vec3(0.01,0.013,0.018);
    col=mix(inner,refl,fr*(0.55+0.45*(1.0-lit)));
    col*=mix(0.25,1.0,mull*mix(0.55,1.0,band));
  } else if(m<3.5){
    col=vec3(0.26,0.25,0.24)*(sunC*dif+amb*sky);
    float lamp=smoothstep(0.96,1.0,fract(p.x*3.0))*step(0.27,p.y);
    col+=(wN+0.4*wD)*vec3(1.0,0.62,0.28)*lamp*0.5;
  } else {
    col=vec3(0.45)*(amb+sunC*dif*0.5);
    float blink=step(0.55,fract(uT*0.45));
    col+=vec3(1.0,0.12,0.06)*3.0*blink*smoothstep(0.93,0.98,(p.y-topY())/0.84);
  }
  return col;
}
void main(){
  wD=clamp(1.0-uTod,0.0,1.0); wA=clamp(uTod-1.0,0.0,1.0); wN=1.0-wD-wA;
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec3 ro=uCam; vec3 f=normalize(uTgt-ro); vec3 r=normalize(cross(f,vec3(0.0,1.0,0.0))); vec3 up=cross(r,f);
  vec3 rd=normalize(f*uFov+uv.x*r+uv.y*up);
  vec3 hor=horizonC();
  float dens=0.03*wD+0.026*wN+0.2*wA;
  float tw=rd.y<-0.0001?-ro.y/rd.y:1e5;
  vec2 bb=boxHit(ro,rd); vec2 h=vec2(1e5,-1.0);
  if(bb.y>max(bb.x,0.0)) h=march(ro,rd,bb.x,min(bb.y,tw));
  vec3 col; float tt=1e5;
  if(h.y>0.0){ tt=h.x; col=shade(ro+rd*h.x,rd,h.y); }
  else if(tw<1e4){
    tt=tw; vec3 p=ro+rd*tw;
    vec2 w=p.xz*vec2(2.6,7.0);
    float a1=noise(w+vec2(0.0,uT*0.55)), a2=noise(w*1.9+vec2(4.1,-uT*0.8));
    vec3 n=normalize(vec3((a1-0.5)*0.10,1.0,(a2-0.5)*0.45));
    vec3 rr=reflect(rd,n); float fr=0.03+0.97*pow(1.0-max(dot(-rd,n),0.0),5.0);
    vec3 rc; vec2 b2=boxHit(p,rr); vec2 h2=vec2(1e5,-1.0);
    if(b2.y>max(b2.x,0.0)) h2=march(p+vec3(0.0,0.01,0.0),rr,b2.x,b2.y);
    if(h2.y>0.0) rc=shade(p+rr*h2.x,rr,h2.y); else rc=env(rr);
    vec3 deep=hor*0.03+vec3(0.003,0.007,0.012);
    col=mix(deep,rc,clamp(fr*1.7,0.0,1.0));
  } else { col=env(rd); }
  if(tt<1e4) col=mix(col,hor*0.85,1.0-exp(-tt*dens));
  vec3 bp=vec3(1.38,0.36,1.52);
  float tb=max(dot(bp-ro,rd),0.0); float db=length(ro+rd*tb-bp);
  if(tb<tt+0.2) col+=vec3(1.0,0.66,0.3)*(0.0018/(db*db+0.0005))*(0.6+0.4*sin(uT*2.0));
  col=max(col,0.0);
  col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);
  float l=dot(col,vec3(0.299,0.587,0.114));
  vec3 mono=vec3(smoothstep(0.02,0.92,l))*vec3(1.02,1.0,0.96);
  col=mix(col,mono,uMono);
  vec2 q=gl_FragCoord.xy/uRes;
  col*=1.0-0.42*pow(length(q-0.5)*1.3,2.2);
  col=pow(clamp(col,0.0,1.0),vec3(0.86));
  col+=(hash(gl_FragCoord.xy+fract(uT*7.13)*91.0)-0.5)*(0.04+0.05*uMono);
  gl_FragColor=vec4(col*uFade,1.0);
}`;
  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

  var R = null;
  function renderer() {
    if (R !== null) return R;
    R = false;
    var off = document.createElement('canvas'); off.width = 4; off.height = 4;
    var gl = off.getContext('webgl', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true });
    if (!gl) return R;
    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {}; function u(n) { if (!(n in U)) U[n] = gl.getUniformLocation(p, n); return U[n]; }
    R = {
      /* draws one frame into a 2D canvas; maxPx caps the render buffer and CSS scales it up */
      draw: function (dst, o, maxPx) {
        var cw = dst.clientWidth || 640, ch = dst.clientHeight || 360;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var w = Math.round(cw * dpr), hgt = Math.round(ch * dpr);
        var k = Math.min(1, Math.sqrt((maxPx || 900000) / (w * hgt)));
        w = Math.max(2, Math.round(w * k)); hgt = Math.max(2, Math.round(hgt * k));
        if (dst.width !== w || dst.height !== hgt) { dst.width = w; dst.height = hgt; }
        if (off.width !== w || off.height !== hgt) { off.width = w; off.height = hgt; }
        gl.viewport(0, 0, w, hgt);
        gl.uniform2f(u('uRes'), w, hgt);
        gl.uniform1f(u('uT'), o.t || 0);
        gl.uniform3f(u('uCam'), o.cam[0], o.cam[1], o.cam[2]);
        gl.uniform3f(u('uTgt'), o.tgt[0], o.tgt[1], o.tgt[2]);
        gl.uniform1f(u('uFov'), o.fov || 1.4);
        gl.uniform1f(u('uTod'), o.tod || 0);
        gl.uniform1f(u('uMono'), o.mono ? 1 : 0);
        gl.uniform1f(u('uFade'), o.fade == null ? 1 : o.fade);
        var kd = o.kind || [0.035, 0.18, 40];
        gl.uniform3f(u('uKind'), kd[0], kd[1], kd[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        var g = dst._g || (dst._g = dst.getContext('2d'));
        g.drawImage(off, 0, 0);
      }
    };
    return R;
  }
  function getR() { var r = null; safe('webgl', function () { r = renderer(); }); return r || null; }

  /* ---------------------------------------------------------------- the five shot grammar. y values scale with tower height */
  var SHOT_LEN = 6, FILM_LEN = 30, REF_TOP = 5.48;
  var CAMS = [
    function (u) { var a = 0.5 + 0.42 * u, d = 9.6 - 1.4 * u; return { cam: [Math.sin(a) * d, 3.4 - 0.7 * u, Math.cos(a) * d], tgt: [0, 2.75, 0], fov: 1.25 }; },
    function (u) { return { cam: [2.3 - 0.9 * u, 0.17, 7.6 - 3.0 * u], tgt: [0, 1.7 + 0.7 * u, 0.2], fov: 1.45, water: 1 }; },
    function (u) { var a = 0.82 + 0.12 * u; return { cam: [Math.sin(a) * 2.5, 1.0 + 2.8 * u, Math.cos(a) * 2.5], tgt: [0, 1.9 + 3.0 * u, 0], fov: 2.2 }; },
    function (u) { var a = 2.3 + 0.55 * u; return { cam: [Math.sin(a) * 4.3, 7.7 - 0.5 * u, Math.cos(a) * 4.3], tgt: [0, 4.5, 0], fov: 1.6 }; },
    function (u) { return { cam: [-5.2 - 2.8 * u, 1.0 + 0.7 * u, 7.6 + 2.8 * u], tgt: [0, 2.7, 0], fov: 1.5 }; }
  ];
  function film(slug) { return DATA.films[slug] || { kind: [0.035, 0.18, 40], tods: [0.12, 0.95, 0.42, 1.05, 1.72], title: '' }; }
  function shotFrame(slug, i, u, extra) {
    var f = film(slug), o = CAMS[i](clamp(u, 0, 1));
    var sc = (0.28 + f.kind[2] * 0.13) / REF_TOP;
    if (!o.water) o.cam[1] *= sc;
    o.tgt[1] *= sc;
    o.tod = f.tods[i]; o.kind = f.kind; o.t = i * SHOT_LEN + u * SHOT_LEN;
    if (extra) for (var k in extra) if (extra[k] != null) o[k] = extra[k];
    return o;
  }
  /* mode: { film: slug } or { reel: [[shot, slug], ...] } */
  function filmFrame(mode, t) {
    t = ((t % FILM_LEN) + FILM_LEN) % FILM_LEN;
    var i = Math.min(4, Math.floor(t / SHOT_LEN)), lt = t - i * SHOT_LEN;
    var slug = mode.reel ? mode.reel[i][1] : mode.film;
    var shot = mode.reel ? mode.reel[i][0] : i;
    var o = shotFrame(slug, shot, lt / SHOT_LEN);
    o.t = t; o.fade = clamp(lt / 0.35, 0, 1) * clamp((SHOT_LEN - lt) / 0.3, 0, 1);
    o.idx = i; o.shot = shot; o.slug = slug;
    return o;
  }
  function tc(t) {
    var s = Math.floor(t), f = Math.floor((t - s) * 24), m = Math.floor(s / 60);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(m) + ':' + p(s % 60) + ':' + p(f);
  }
  function shotLabel(mode, o) {
    var base = 'SH0' + (o.shot + 1) + ' · ' + DATA.shots[o.shot];
    return mode.reel ? base + ' · ' + film(o.slug).title : base + ' · ' + DATA.lenses[o.shot];
  }

  /* ---------------------------------------------------------------- sound: synthesized harbour, starts only from a button */
  var AC = window.AudioContext || window.webkitAudioContext;
  var snd = { on: false, ctx: null, gain: null };
  function soundInit() {
    var ctx = snd.ctx = new AC();
    snd.gain = ctx.createGain(); snd.gain.gain.value = 0; snd.gain.connect(ctx.destination);
    var len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), prev = 0;
    for (var i = 0; i < len; i++) { prev = (prev + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = prev * 3.4; }
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 620;
    var swell = ctx.createGain(); swell.gain.value = 0.55;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; var depth = ctx.createGain(); depth.gain.value = 0.4;
    lfo.connect(depth); depth.connect(swell.gain); lfo.start();
    src.connect(lp); lp.connect(swell); swell.connect(snd.gain); src.start();
    [49, 73.4].forEach(function (fq, k) { var o = ctx.createOscillator(); o.frequency.value = fq; var g = ctx.createGain(); g.gain.value = k ? 0.02 : 0.035; o.connect(g); g.connect(snd.gain); o.start(); });
  }
  function soundSet(on) {
    if (!snd.ctx) return;
    var now = snd.ctx.currentTime;
    snd.gain.gain.cancelScheduledValues(now);
    snd.gain.gain.setTargetAtTime(on ? 0.85 : 0, now, on ? 0.6 : 0.15);
    if (on && snd.ctx.resume) { var r = snd.ctx.resume(); if (r && r.catch) r.catch(function () {}); }
  }
  var players = [];
  function anyPlaying() { return players.some(function (p) { return p.playing; }); }

  /* ---------------------------------------------------------------- player: hero and dialog share this */
  function Player(root, mode) {
    var canvas = root.querySelector('canvas.film'), btn = root.querySelector('.toggle'), lbl = btn.querySelector('.lbl');
    var time = root.querySelector('.tc .time'), shotEl = root.querySelector('.tc .shot'), ruler = root.querySelector('.ruler');
    var ph = ruler.querySelector('.ph'), sbtn = root.querySelector('.snd'), cap = root.querySelector('.cap');
    var maxPx = root.classList.contains('hero') ? 520000 : 760000;
    var self = { playing: false, t: 0.8, root: root, mode: mode };
    var last = 0, raf = 0, lastKey = '';
    function frame() {
      var r = getR(); var o = filmFrame(self.mode, self.t);
      if (r && canvas.clientWidth) r.draw(canvas, o, maxPx);
      time.textContent = tc(self.t) + ' / ' + tc(FILM_LEN);
      var key = o.idx + o.slug;
      if (key !== lastKey) { var s = shotLabel(self.mode, o); shotEl.textContent = s; if (cap) cap.textContent = s; lastKey = key; }
      ph.style.left = (self.t / FILM_LEN * 100) + '%';
      ruler.setAttribute('aria-valuenow', String(Math.round(self.t)));
      ruler.setAttribute('aria-valuetext', Math.round(self.t) + ' ' + DATA.ui.seconds + ', ' + DATA.shots[o.shot]);
    }
    function loop(now) {
      if (!self.playing) return;
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      self.t = (self.t + dt) % FILM_LEN;
      frame();
      raf = requestAnimationFrame(loop);
    }
    self.set = function (v) {
      if (v === self.playing) return;
      self.playing = v;
      btn.setAttribute('aria-pressed', v ? 'true' : 'false'); lbl.textContent = v ? DATA.ui.pause : DATA.ui.play;
      if (v) { players.forEach(function (p) { if (p !== self) p.set(false); }); last = performance.now(); raf = requestAnimationFrame(loop); }
      else cancelAnimationFrame(raf);
      soundSet(snd.on && anyPlaying());
    };
    self.frame = function () { lastKey = ''; frame(); };
    btn.addEventListener('click', function () { self.set(!self.playing); });
    function seekX(x) { var b = ruler.getBoundingClientRect(); self.t = clamp((x - b.left) / b.width, 0, 0.9999) * FILM_LEN; frame(); }
    var dragging = false;
    ruler.addEventListener('pointerdown', function (e) { dragging = true; if (ruler.setPointerCapture) ruler.setPointerCapture(e.pointerId); seekX(e.clientX); });
    ruler.addEventListener('pointermove', function (e) { if (dragging) seekX(e.clientX); });
    ruler.addEventListener('pointerup', function () { dragging = false; });
    ruler.addEventListener('pointercancel', function () { dragging = false; });
    ruler.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? SHOT_LEN : 1;
      if (e.key === 'ArrowRight') self.t = Math.min(FILM_LEN - 0.01, self.t + step);
      else if (e.key === 'ArrowLeft') self.t = Math.max(0, self.t - step);
      else if (e.key === 'Home') self.t = 0;
      else if (e.key === 'End') self.t = FILM_LEN - 0.01;
      else if (e.key === ' ' || e.key === 'Enter') self.set(!self.playing);
      else return;
      e.preventDefault(); frame();
    });
    if (AC && sbtn) {
      sbtn.hidden = false;
      sbtn.addEventListener('click', function () {
        snd.on = !snd.on;
        if (snd.on && !snd.ctx) { try { soundInit(); } catch (err) { snd.on = false; } }
        each('.snd', function (b) { b.textContent = snd.on ? DATA.ui.sound_on : DATA.ui.sound_off; b.setAttribute('aria-pressed', snd.on ? 'true' : 'false'); });
        soundSet(snd.on && anyPlaying());
      });
    }
    if (window.ResizeObserver) new ResizeObserver(function () { if (!self.playing) frame(); }).observe(canvas);
    players.push(self);
    return self;
  }

  function modeOf(el) {
    if (el.dataset.reel) { try { return { reel: JSON.parse(el.dataset.reel) }; } catch (e) { /* fall through */ } }
    return { film: el.dataset.film || 'saltglass' };
  }

  function playersInit() {
    var heroEl = document.getElementById('hero'), dlg = document.getElementById('film-dlg');
    var hero = null;
    if (heroEl && heroEl.classList.contains('player')) { hero = Player(heroEl, modeOf(heroEl)); hero.frame(); }
    if (dlg && typeof dlg.showModal === 'function') {
      var dp = Player(dlg, { film: 'saltglass' });
      var title = dlg.querySelector('.dlg-title');
      each('.open-film', function (b) {
        b.addEventListener('click', function () {
          var slug = b.dataset.film || 'saltglass';
          dp.mode = { film: slug }; title.textContent = film(slug).title;
          if (hero) hero.set(false);
          dlg.showModal();
          dp.t = 0; dp.frame(); dp.set(true);
        });
      });
      dlg.querySelector('.dlg-x').addEventListener('click', function () { dlg.close(); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', function () { dp.set(false); });
    } else if (hero) {
      each('.open-film', function (b) { b.addEventListener('click', function () { heroEl.scrollIntoView(); hero.set(true); }); });
    }
    /* the hero plays itself only while it is on screen, never with reduced motion */
    if (hero && !reduce && 'IntersectionObserver' in window) {
      var userPaused = false;
      heroEl.querySelector('.toggle').addEventListener('click', function () { userPaused = !hero.playing; });
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio > 0.35) { if (!userPaused && !(dlg && dlg.open)) hero.set(true); }
          else hero.set(false);
        });
      }, { threshold: [0, 0.35, 0.6] }).observe(heroEl);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) players.forEach(function (p) { p.set(false); }); });
  }

  /* ---------------------------------------------------------------- stills: rendered once, when they come near the screen */
  function stills() {
    var r = getR(); if (!r) return;
    var list = Array.prototype.slice.call(document.querySelectorAll('canvas.still'));
    function drawOne(el) {
      if (!el.clientWidth) return;
      var d = el.dataset, slug = d.film || 'saltglass', shot = +d.shot || 0;
      var extra = { mono: d.mono === '1' };
      if (d.shift != null) extra.tod = clamp(film(slug).tods[shot] + parseFloat(d.shift), 0, 2);
      r.draw(el, shotFrame(slug, shot, parseFloat(d.u) || 0, extra), 1100000);
      el._w = el.clientWidth;
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && e.target._w !== e.target.clientWidth) drawOne(e.target); }); }, { rootMargin: '600px 600px' });
      list.forEach(function (el) { io.observe(el); });
    } else list.forEach(drawOne);
    var tm = 0;
    window.addEventListener('resize', function () {
      clearTimeout(tm);
      tm = setTimeout(function () {
        var vh = window.innerHeight || 800;
        list.forEach(function (el) { var b = el.getBoundingClientRect(); if (b.bottom > -600 && b.top < vh + 600) drawOne(el); else el._w = 0; });
      }, 250);
    });
  }

  /* ---------------------------------------------------------------- elevation drawing, canvas 2D, driven by data-kind */
  function elevation() {
    var css = getComputedStyle(document.documentElement);
    var C = { bone: css.getPropertyValue('--bone').trim(), dust: css.getPropertyValue('--dust').trim(), rule: css.getPropertyValue('--rule').trim(), sodium: css.getPropertyValue('--sodium').trim() };
    var mono = '"IBM Plex Mono","Noto Sans Hebrew",monospace';
    each('canvas.elev', function (cv) {
      var d = cv.dataset, kind = String(d.kind || '0.035,0.18,40').split(',').map(Number);
      var N = kind[2], TW = kind[0], TAPER = kind[1], MARK = +d.mark || -1;
      function draw() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
        if (!W || !H) return;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        g.direction = 'ltr';
        var ground = H * 0.86, topPx = H * 0.14, lv = (ground - topPx) / (N + 1.2);
        var cx = W * 0.42, sc = Math.min(W * 0.2, lv * 9);
        var fs = Math.max(9, Math.round(W / 52));
        g.font = fs + 'px ' + mono; g.textBaseline = 'middle';
        g.strokeStyle = C.rule; g.lineWidth = 1;
        for (var r = 0; r < 6; r++) for (var x = 12 + (r % 2) * 14; x < W - 12; x += 28) { var y = ground + 10 + r * 9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y); g.stroke(); }
        g.strokeStyle = C.dust; g.beginPath(); g.moveTo(10, ground); g.lineTo(W - 10, ground); g.stroke();
        g.strokeStyle = C.bone; g.lineWidth = 1.2; g.strokeRect(cx - sc * 2.2, ground - lv * 1.2, sc * 4.4, lv * 1.2);
        var L = [], Rr = [], Cc = [];
        for (var i = 0; i <= N; i++) {
          var a = i * TW, s = (1 - TAPER * i / N), half = sc * s * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))) * 0.9;
          var y2 = ground - lv * 1.2 - i * lv;
          L.push([cx - half, y2]); Rr.push([cx + half, y2]); Cc.push([cx + sc * s * 0.9 * (Math.cos(a) - Math.sin(a)), y2]);
          var hl = i === MARK;
          g.strokeStyle = hl ? C.sodium : C.bone; g.lineWidth = hl ? 2 : (i % 5 === 0 ? 1.1 : 0.7);
          g.beginPath(); g.moveTo(cx - half - 3, y2); g.lineTo(cx + half + 3, y2); g.stroke();
        }
        function poly(pts, col, lw, dash) { g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); pts.forEach(function (p, k) { if (k) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke(); g.setLineDash([]); }
        poly(L, C.bone, 1.1); poly(Rr, C.bone, 1.1);
        if (TW !== 0) poly(Cc, C.dust, 0.8, [3, 3]);
        var topY = ground - lv * 1.2 - N * lv;
        g.strokeStyle = C.bone; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, topY); g.lineTo(cx, topY - lv * 6); g.stroke();
        g.fillStyle = '#ff3d22'; g.beginPath(); g.arc(cx, topY - lv * 6, 2.5, 0, Math.PI * 2); g.fill();
        var dx = Math.min(W - 78, cx + sc * 1.55);
        g.strokeStyle = C.dust; g.lineWidth = 1; g.beginPath(); g.moveTo(dx, ground); g.lineTo(dx, topY); g.stroke();
        g.textAlign = 'left';
        for (var k = 0; k <= N; k += 5) {
          var yy = ground - lv * 1.2 - k * lv;
          g.beginPath(); g.moveTo(dx - 4, yy); g.lineTo(dx + 4, yy); g.stroke();
          g.fillStyle = C.dust; g.fillText('L' + (k < 10 ? '0' : '') + k + '  +' + (4 + k * 3.6).toFixed(1), dx + 9, yy);
        }
        g.fillStyle = C.bone; g.fillText('+' + (4 + N * 3.6).toFixed(1) + ' M', dx + 9, topY - lv * 2.2);
        if (MARK >= 0 && MARK <= N) {
          var ym = ground - lv * 1.2 - MARK * lv, lx = W * 0.08;
          g.strokeStyle = C.sodium; g.fillStyle = C.sodium; g.lineWidth = 1;
          g.beginPath(); g.moveTo(cx - sc * 1.05, ym); g.lineTo(lx, ym); g.stroke();
          g.beginPath(); g.moveTo(lx, ym); g.lineTo(lx - 6, ym - 9); g.lineTo(lx + 6, ym - 9); g.closePath(); g.fill();
          g.fillText(d.noa || ('L' + MARK), lx - 6, ym - 20);
        }
        var sx = W * 0.1, sy = topY - lv * 3;
        g.strokeStyle = C.dust; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(sx, sy); g.lineTo(cx - sc * 0.6, sy + lv * 14); g.stroke(); g.setLineDash([]);
        g.beginPath(); g.arc(sx, sy, 7, 0, Math.PI * 2); g.stroke();
        g.fillStyle = C.dust; g.fillText((d.sun || 'SUN') + ' ' + (d.clock || '19:42'), sx + 14, sy - 16);
        var bw = Math.min(200, W * 0.44), bh = fs * 5.2, bx = W - bw - 12, by = H - bh - 12;
        g.strokeStyle = C.dust; g.lineWidth = 1; g.strokeRect(bx, by, bw, bh);
        g.beginPath(); g.moveTo(bx, by + bh * 0.5); g.lineTo(bx + bw, by + bh * 0.5); g.stroke();
        g.fillStyle = C.bone; g.fillText(d.building || '', bx + 8, by + bh * 0.25);
        if (document.documentElement.dir === 'rtl') { g.direction = 'rtl'; g.textAlign = 'right'; g.fillStyle = C.dust; g.fillText(d.sheet || '', bx + bw - 8, by + bh * 0.75); g.direction = 'ltr'; g.textAlign = 'left'; }
        else { g.fillStyle = C.dust; g.fillText(d.sheet || 'ELEVATION A  1:800', bx + 8, by + bh * 0.75); }
      }
      draw();
      var tm = 0; window.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(draw, 150); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    });
  }

  function start() {
    safe('elevation', elevation);
    safe('players', playersInit);
    safe('stills', stills);
  }
  window.VaneholmGL = { renderer: getR, shotFrame: shotFrame, filmFrame: filmFrame };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
