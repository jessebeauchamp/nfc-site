// Option 02 hero: the showreel plays as an LED wall. A lens follows the cursor and shows the
// footage without the filter. Scrolling steps back from the wall until the reel plays clean
// in its frame, with the sound and full-screen buttons.
(function () {
  'use strict';
  var hero = document.querySelector('.o2-hero');
  if (!hero) return;
  var stage = hero.querySelector('.o2-stage');
  var canvas = hero.querySelector('.o2-gl');
  var video = hero.querySelector('.o2-video');
  var frameBox = hero.querySelector('.o2-frame');
  var ctrlBox = hero.querySelector('.o2-ctrlbox');
  var copy = hero.querySelector('.o2-copy');
  var line2 = hero.querySelector('.o2-line2');
  var scrim = hero.querySelector('.o2-scrim');
  var header = hero.querySelector('.o2-header');
  var hintTxt = hero.querySelector('.o2-hint-txt');

  var phone = window.matchMedia('(max-width: 860px)').matches;
  var coarse = window.matchMedia('(hover: none)').matches;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (coarse && hintTxt) hintTxt.textContent = 'Tap to move the lens';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }

  // The reel: muted and looping. Its frames are the wall's texture.
  video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  video.poster = phone ? video.dataset.posterM : video.dataset.poster;
  video.src = phone ? video.dataset.srcM : video.dataset.src;
  function play() { var r = video.play(); if (r && r.catch) r.catch(function () {}); }
  play();
  window.addEventListener('pointerdown', play, { once: true, passive: true });

  var VS = '#version 300 es\nin vec2 a_pos;\nvoid main() { gl_Position = vec4(a_pos, 0.0, 1.0); }\n';
  var FS = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform sampler2D u_tex;
uniform vec2 u_texSize;
uniform vec4 u_rect;      // where the reel is drawn: x, y (from the bottom), w, h in canvas pixels
uniform float u_filter;   // 1 = LED wall, 0 = clean picture
uniform float u_pitch;    // LED spacing in canvas pixels
uniform vec3 u_lens;      // lens centre (x, y from the bottom) and radius
uniform float u_lensAmt;
uniform float u_power;    // 0 to 1: the wall switching on, top to bottom
uniform float u_frame;    // 0 to 1: hairline bezel as the wall becomes a screen
uniform float u_dpr;
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

// object-fit: cover inside the rect
vec2 coverUV(vec2 p) {
  vec2 uv = (p - u_rect.xy) / u_rect.zw;
  float ra = u_rect.z / u_rect.w;
  float va = u_texSize.x / u_texSize.y;
  if (ra > va) uv.y = (uv.y - 0.5) * (va / ra) + 0.5;
  else uv.x = (uv.x - 0.5) * (ra / va) + 0.5;
  return clamp(uv, vec2(0.0), vec2(1.0));
}
vec3 tap(vec2 p, float lod) { return textureLod(u_tex, coverUV(p), lod).rgb; }

void main() {
  vec2 p = gl_FragCoord.xy;
  vec3 bg = vec3(0.047, 0.047, 0.051);
  vec2 lo = u_rect.xy, hi = u_rect.xy + u_rect.zw;
  float edge = min(min(p.x - lo.x, hi.x - p.x), min(p.y - lo.y, hi.y - p.y));
  if (edge < -1.0) { outColor = vec4(bg, 1.0); return; }
  float inside = clamp(edge + 0.5, 0.0, 1.0);

  float ra = u_rect.z / u_rect.w, va = u_texSize.x / u_texSize.y;
  float k = ra > va ? u_texSize.x / u_rect.z : u_texSize.y / u_rect.w;   // texels per canvas pixel
  float lod0 = max(log2(k), 0.0);
  vec3 clean = tap(p, lod0);
  vec3 col = clean;

  float ledAmt = smoothstep(0.0, 0.3, u_filter);
  if (ledAmt > 0.0) {
    float P = u_pitch;
    vec2 c = u_rect.xy + u_rect.zw * 0.5;           // the grid is anchored at the centre
    vec2 g = (p - c) / P;
    vec2 cell = floor(g);
    float lod = max(log2(P * k), 0.0);              // each LED shows its cell's average colour
    float aa = 1.0 / P;
    vec3 glow = vec3(0.0), core = vec3(0.0);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cc = cell + vec2(float(i), float(j)) + 0.5;
        vec2 cp = c + cc * P;
        vec3 s = pow(tap(cp, lod), vec3(1.35)) * 1.12;
        float rowT = clamp((hi.y - cp.y) / u_rect.w, 0.0, 1.0);
        float on = smoothstep(0.0, 0.08, u_power * 1.25 - rowT - hash(cc) * 0.12);
        s *= on * (0.93 + 0.14 * hash(cc + 17.0));
        float d = length(g - cc);
        glow += s * exp(-d * d * 4.5);
        if (i == 0 && j == 0) core = s * (1.0 - smoothstep(0.37 - aa, 0.37 + aa, d));
      }
    }
    vec3 wall = core * 1.5 + glow * 0.15 + vec3(0.006, 0.005, 0.016);
    wall *= 1.0 + 0.05 * sin(p.y / u_res.y * 4.4 - u_time * 0.9);   // slow refresh shimmer
    col = mix(clean, wall, ledAmt);
  }

  if (u_lensAmt > 0.001) {
    vec2 tl = p - u_lens.xy;
    float dl = length(tl);
    float r = u_lens.z;
    float shade = smoothstep(r + 26.0 * u_dpr, r, dl) * step(r, dl);
    col *= 1.0 - 0.4 * shade * u_lensAmt;            // soft shadow lifts the lens off the wall
    if (dl < r + 2.0 * u_dpr) {
      float nd = dl / r;
      vec2 dir = tl / max(dl, 1e-3);
      vec2 q = u_lens.xy + tl * (1.0 - 0.14 * (1.0 - nd * nd));   // slight magnification
      float ca = smoothstep(0.5, 1.0, nd) * 6.0 * u_dpr;           // colour split toward the rim
      vec3 lc = vec3(tap(q + dir * ca, lod0).r, tap(q, lod0).g, tap(q - dir * ca, lod0).b);
      lc *= 1.0 - 0.18 * smoothstep(0.75, 1.0, nd);
      float m = (1.0 - smoothstep(r - 1.2 * u_dpr, r, dl)) * u_lensAmt;
      col = mix(col, lc, m);
    }
  }

  float bez = (1.0 - smoothstep(0.0, u_dpr, edge)) * u_frame;
  col = mix(col, vec3(0.26), bez * 0.7);
  outColor = vec4(mix(bg, col, inside), 1.0);
}
`;

  var gl = null, U = {}, tex = null, texW = 0, texH = 0, haveTex = false, haveVideo = false, powerAt = 0;
  try {
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  } catch (e) { gl = null; }
  if (gl && !initGL()) gl = null;
  if (!gl) hero.classList.add('o2-nogl');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function initGL() {
    var vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return false; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['u_res', 'u_time', 'u_tex', 'u_texSize', 'u_rect', 'u_filter', 'u_pitch', 'u_lens', 'u_lensAmt', 'u_power', 'u_frame', 'u_dpr']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([12, 12, 13, 255]));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform1i(U.u_tex, 0);
    // The poster fills the wall until the first video frame arrives.
    var img = new Image();
    img.onload = function () { if (!haveVideo) upload(img, img.naturalWidth, img.naturalHeight); };
    img.src = video.poster;
    return true;
  }
  function upload(src, w, h) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (w !== texW || h !== texH) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); texW = w; texH = h; }
    else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (!haveTex) { haveTex = true; powerAt = performance.now(); }
  }

  // New video frames only when the decoder has one.
  var rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  var fresh = true;
  if (rvfc) {
    var onFrame = function () { fresh = true; video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
  }
  function pumpVideo() {
    if (video.readyState < 2 || !video.videoWidth) return;
    if (rvfc ? !fresh : (video.paused && haveVideo)) return;
    fresh = false;
    try { upload(video, video.videoWidth, video.videoHeight); haveVideo = true; } catch (e) { /* keep the poster */ }
  }

  // ---------- Layout and scroll
  var W = 0, H = 0, dpr = 1, barH = 0;
  function resize() {
    barH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 0;
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (gl) { canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr)); }
  }
  function endRect() {
    var pad = clamp(W * 0.044, 20, 64);
    var w = W - pad * 2, h = w * 9 / 16;
    var maxH = H - Math.max(pad, 56) * 2;
    if (h > maxH) { h = maxH; w = h * 16 / 9; }
    return { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h };
  }
  function progress() {
    var total = hero.offsetHeight - stage.offsetHeight;
    return total > 0 ? clamp((barH - hero.getBoundingClientRect().top) / total, 0, 1) : 0;
  }
  function place(el, r) {
    el.style.transform = 'translate3d(' + r.x.toFixed(1) + 'px,' + r.y.toFixed(1) + 'px,0)';
    el.style.width = r.w.toFixed(1) + 'px';
    el.style.height = r.h.toFixed(1) + 'px';
  }

  // ---------- Lens
  var ptr = { x: 0, y: 0, on: false, at: 0 };
  var lens = { x: 0, y: 0, ready: false };
  function setPtr(e) {
    var b = stage.getBoundingClientRect();
    ptr.x = e.clientX - b.left; ptr.y = e.clientY - b.top; ptr.on = true; ptr.at = performance.now();
  }
  stage.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') setPtr(e); }, { passive: true });
  stage.addEventListener('pointerdown', setPtr, { passive: true });
  stage.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') ptr.on = false; });

  // ---------- Frame loop
  var t0 = performance.now(), last = t0, raf = 0, visible = true;
  function tick(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var t = (now - t0) / 1000;
    var p = progress();

    var f = 1 - smooth(0.12, 0.62, p);   // the filter dissolves
    var e = smooth(0.5, 0.93, p);        // the wall settles into the reel frame
    var er = endRect();
    var rect = { x: mix(0, er.x, e), y: mix(0, er.y, e), w: mix(W, er.w, e), h: mix(H, er.h, e) };

    var since = powerAt ? (now - powerAt) / 1000 : 0;
    var power = reduce ? 1 : clamp(since / 1.4, 0, 1);
    var lensIn = reduce ? 1 : smooth(0.9, 2.0, since);
    var usePtr = ptr.on && (!coarse || now - ptr.at < 5000);
    var tx, ty;
    if (usePtr) { tx = ptr.x; ty = ptr.y; }
    else if (reduce) { tx = W * 0.66; ty = H * 0.42; }
    else if (phone) { tx = W * (0.5 + 0.16 * Math.sin(t * 0.21)); ty = H * (0.36 + 0.12 * Math.sin(t * 0.29 + 1.2)); }
    else { tx = W * (0.64 + 0.2 * Math.sin(t * 0.21)); ty = H * (0.42 + 0.17 * Math.sin(t * 0.29 + 1.2)); }
    if (!lens.ready) { lens.x = tx; lens.y = ty; lens.ready = true; }
    var k = 1 - Math.exp(-dt * (usePtr ? 10 : 2.5));
    lens.x += (tx - lens.x) * k; lens.y += (ty - lens.y) * k;
    var r = (phone ? clamp(W * 0.3, 90, 150) : clamp(W * 0.12, 120, 210)) * (0.6 + 0.4 * lensIn);
    var lensAmt = smooth(0.35, 0.9, f) * lensIn * (haveTex ? 1 : 0);

    if (gl) {
      pumpVideo();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.u_res, canvas.width, canvas.height);
      gl.uniform1f(U.u_time, reduce ? 0 : t);
      gl.uniform2f(U.u_texSize, texW || 1, texH || 1);
      gl.uniform4f(U.u_rect, rect.x * dpr, (H - rect.y - rect.h) * dpr, rect.w * dpr, rect.h * dpr);
      gl.uniform1f(U.u_filter, f);
      var P0 = (phone ? 7 : 9) * dpr, Pmin = 1.25 * dpr;
      gl.uniform1f(U.u_pitch, Pmin + (P0 - Pmin) * Math.pow(f, 1.6));
      gl.uniform3f(U.u_lens, lens.x * dpr, (H - lens.y) * dpr, r * dpr);
      gl.uniform1f(U.u_lensAmt, lensAmt);
      gl.uniform1f(U.u_power, haveTex ? power : 0);
      gl.uniform1f(U.u_frame, e);
      gl.uniform1f(U.u_dpr, dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    place(frameBox, rect);
    place(ctrlBox, rect);
    ctrlBox.classList.toggle('is-on', p > 0.9);

    var c1 = 1 - smooth(0.0, 0.2, p);
    copy.style.opacity = c1.toFixed(3);
    copy.style.transform = 'translate3d(0,' + (-70 * (1 - c1)).toFixed(1) + 'px,0)';
    copy.style.pointerEvents = c1 < 0.05 ? 'none' : '';
    var inL2 = smooth(0.26, 0.38, p), outL2 = smooth(0.58, 0.68, p);
    line2.style.opacity = (inL2 * (1 - outL2)).toFixed(3);
    line2.style.transform = 'translate3d(0,' + (40 * (1 - inL2) - 50 * outL2).toFixed(1) + 'px,0)';
    header.style.opacity = (1 - smooth(0.42, 0.56, p)).toFixed(3);
    header.style.visibility = p > 0.56 ? 'hidden' : '';
    scrim.style.opacity = (1 - smooth(0.62, 0.78, p)).toFixed(3);

    if (visible && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function wake() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); }

  resize();
  if (window.ResizeObserver) new ResizeObserver(function () { resize(); wake(); }).observe(stage);
  else window.addEventListener('resize', function () { resize(); wake(); });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; wake(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', wake);
  wake();
})();
