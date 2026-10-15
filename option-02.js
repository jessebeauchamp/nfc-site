// Option 02 hero: "Video Spyglass & LED Matrix". The showreel plays through a dense grid of
// Three.js points, each showing one flat colour sampled from the video (an LED wall). Near the
// cursor the dots grow, are pushed outward and turn into windows onto the clean, full-resolution
// video, like a spyglass (Cavalry-style falloff). Scrolling grows every dot into the clean
// picture, which then settles into the reel frame with the sound and full-screen buttons.
// Add ?tune to the address to show live sliders for the look.
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
  if (coarse && hintTxt) hintTxt.textContent = 'Tap to move the spyglass';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }

  // The look. Sizes are CSS pixels; the radius is in screen heights (1 = half the screen height).
  var S = {
    maxSize: phone ? 70 : 95,     // spyglass size: dots at the cursor
    radius: 0.45,                 // falloff radius
    repulsion: 0.14,              // how far dots are pushed out
    spacing: phone ? 10 : 12,     // distance between dots
    baseSize: phone ? 7 : 8.5     // dots far from the cursor
  };

  // ---------- The reel: muted and looping; it is the texture for every dot.
  video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  video.poster = phone ? video.dataset.posterM : video.dataset.poster;
  video.src = phone ? video.dataset.srcM : video.dataset.src;
  function play() { var r = video.play(); if (r && r.catch) r.catch(function () {}); }
  play();
  window.addEventListener('pointerdown', play, { once: true, passive: true });

  // ---------- Three.js
  var VERT = [
    'uniform vec2 u_mouse;',
    'uniform float u_aspect;',
    'uniform float u_dpr;',
    'uniform float u_baseSize;',
    'uniform float u_maxSize;',
    'uniform float u_radius;',
    'uniform float u_repulsion;',
    'uniform float u_hover;   // 0 to 1: how present the cursor effect is',
    'uniform float u_global;  // 0 to 1: on scroll, every dot grows into the clean picture',
    'uniform float u_cover;   // dot size that covers the grid completely',
    'uniform float u_power;   // 0 to 1: the wall switching on, top to bottom',
    'attribute float aSeed;',
    'varying vec2 vUv;',
    'varying float vFalloff;',
    'void main() {',
    '  vUv = uv;',
    '  vec3 pos = position;',
    '  vec2 aspectPos = vec2(pos.x * u_aspect, pos.y);',
    '  vec2 aspectMouse = vec2(u_mouse.x * u_aspect, u_mouse.y);',
    '  vec2 diff = aspectPos - aspectMouse;',
    '  float dist = length(diff);',
    '  float rawFalloff = (1.0 - smoothstep(0.0, u_radius, dist)) * u_hover;',
    '  float falloff = pow(rawFalloff, 2.5);',
    '  if (dist > 0.0001) {',
    '    vec2 dir = diff / dist;',
    '    float centerAnchor = smoothstep(0.0, u_radius * 0.35, dist);',
    '    float push = rawFalloff * centerAnchor * u_repulsion * (1.0 - u_global);',
    '    pos.x += (dir.x / u_aspect) * push;',
    '    pos.y += dir.y * push;',
    '  }',
    '  float size = mix(u_baseSize, u_maxSize, falloff);',
    '  size = mix(size, max(size, u_cover), u_global);',
    '  vFalloff = clamp(max(falloff, u_global), 0.0, 1.0);',
    '  float on = smoothstep(0.0, 0.08, u_power * 1.25 - (1.0 - uv.y) - aSeed * 0.12);',
    '  gl_PointSize = size * u_dpr * on;',
    '  pos.z = vFalloff * 0.5;   // bigger dots sit in front, so they stay whole',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'uniform sampler2D u_texture;',
    'uniform vec2 u_resolution;',
    'uniform float u_aspect;',
    'uniform float u_videoAspect;',
    'varying vec2 vUv;',
    'varying float vFalloff;',
    '// object-fit: cover',
    'vec2 getCoverUv(vec2 uv, float screenAspect, float vidAspect) {',
    '  vec2 ratio = vec2(min(screenAspect / vidAspect, 1.0), min(vidAspect / screenAspect, 1.0));',
    '  return vec2(uv.x * ratio.x + (1.0 - ratio.x) * 0.5, uv.y * ratio.y + (1.0 - ratio.y) * 0.5);',
    '}',
    'void main() {',
    '  if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;',
    '  vec4 flatColor = texture2D(u_texture, getCoverUv(vUv, u_aspect, u_videoAspect));',
    '  vec2 screenUv = gl_FragCoord.xy / u_resolution.xy;',
    '  vec4 highResColor = texture2D(u_texture, getCoverUv(screenUv, u_aspect, u_videoAspect));',
    '  gl_FragColor = mix(flatColor, highResColor, vFalloff);',
    '}'
  ].join('\n');

  var W = 0, H = 0, dpr = 1, barH = 0, powerAt = 0;

  var gl3 = null;
  try {
    if (window.THREE) {
      var probe = document.createElement('canvas');
      if (probe.getContext('webgl2') || probe.getContext('webgl')) gl3 = initThree();
    }
  } catch (e) { gl3 = null; }
  if (!gl3) hero.classList.add('o2-nogl');

  function initThree() {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x0c0c0d, 1);
    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    var videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.generateMipmaps = false;

    var material = new THREE.ShaderMaterial({
      uniforms: {
        u_texture: { value: videoTexture },
        u_mouse: { value: new THREE.Vector2(0.3, 0.1) },
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_aspect: { value: 1 },
        u_videoAspect: { value: 16 / 9 },
        u_dpr: { value: 1 },
        u_baseSize: { value: S.baseSize },
        u_maxSize: { value: S.maxSize },
        u_radius: { value: S.radius },
        u_repulsion: { value: S.repulsion },
        u_hover: { value: 0 },
        u_global: { value: 0 },
        u_cover: { value: S.spacing * 1.5 },
        u_power: { value: 0 }
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: true,
      depthWrite: true
    });

    // The poster shows on the wall until the first video frame is ready.
    var ready = false;
    new THREE.TextureLoader().load(video.poster, function (tex) {
      tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      if (!ready) material.uniforms.u_texture.value = tex;
      if (!powerAt) powerAt = performance.now();
    });
    function useVideo() {
      if (ready || video.readyState < 2) return;
      ready = true;
      material.uniforms.u_texture.value = videoTexture;
      if (video.videoWidth) material.uniforms.u_videoAspect.value = video.videoWidth / video.videoHeight;
      if (!powerAt) powerAt = performance.now();
    }
    video.addEventListener('loadeddata', useVideo);
    video.addEventListener('playing', useVideo);
    useVideo();

    var points = null;
    function buildGrid(w, h) {
      if (points) { scene.remove(points); points.geometry.dispose(); }
      var sp = S.spacing;
      var cols = Math.ceil(w / sp) + 2, rows = Math.ceil(h / sp) + 2;
      var n = cols * rows;
      var pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), seed = new Float32Array(n);
      var k = 0;
      for (var j = 0; j < rows; j++) {
        for (var i = 0; i < cols; i++) {
          var x = ((i - (cols - 1) / 2) * sp) / (w / 2);
          var y = ((j - (rows - 1) / 2) * sp) / (h / 2);
          pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = 0;
          uv[k * 2] = (x + 1) / 2; uv[k * 2 + 1] = (y + 1) / 2;
          seed[k] = Math.random();
          k++;
        }
      }
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      scene.add(points);
    }

    return {
      renderer: renderer, scene: scene, camera: camera, material: material, buildGrid: buildGrid,
      size: function (w, h, ratio) {
        renderer.setPixelRatio(ratio);
        renderer.setSize(w, h, false);
        material.uniforms.u_resolution.value.set(Math.round(w * ratio), Math.round(h * ratio));
        material.uniforms.u_aspect.value = w / h;
        material.uniforms.u_dpr.value = ratio;
        buildGrid(w, h);
      }
    };
  }

  // ---------- Layout and scroll
  function resize() {
    barH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 0;
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (gl3 && W && H) gl3.size(W, H, dpr);
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

  // ---------- Cursor (or a slow drift when there is none; taps move it on phones)
  var ptr = { x: 0, y: 0, on: false, at: 0 };
  var spy = { x: 0, y: 0, ready: false };
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

    var global = smooth(0.12, 0.46, p);        // every dot grows into the clean picture
    var glFade = 1 - smooth(0.44, 0.52, p);    // then the canvas hands over to the plain video
    var e = smooth(0.52, 0.93, p);             // which settles into the reel frame
    var er = endRect();
    var rect = { x: mix(0, er.x, e), y: mix(0, er.y, e), w: mix(W, er.w, e), h: mix(H, er.h, e) };

    var since = powerAt ? (now - powerAt) / 1000 : 0;
    var usePtr = ptr.on && (!coarse || now - ptr.at < 5000);
    var tx, ty;
    if (usePtr) { tx = ptr.x; ty = ptr.y; }
    else if (reduce) { tx = W * 0.66; ty = H * 0.42; }
    else if (phone) { tx = W * (0.5 + 0.16 * Math.sin(t * 0.21)); ty = H * (0.36 + 0.12 * Math.sin(t * 0.29 + 1.2)); }
    else { tx = W * (0.64 + 0.2 * Math.sin(t * 0.21)); ty = H * (0.42 + 0.17 * Math.sin(t * 0.29 + 1.2)); }
    if (!spy.ready) { spy.x = tx; spy.y = ty; spy.ready = true; }
    var k = 1 - Math.exp(-dt * (usePtr ? 12 : 2.5));
    spy.x += (tx - spy.x) * k; spy.y += (ty - spy.y) * k;

    if (gl3) {
      canvas.style.opacity = glFade.toFixed(3);
      if (glFade > 0.001 && W && H) {
        var u = gl3.material.uniforms;
        u.u_mouse.value.set(spy.x / W * 2 - 1, 1 - spy.y / H * 2);
        u.u_power.value = reduce ? 1 : clamp(since / 1.4, 0, 1);
        u.u_hover.value = (reduce && !usePtr ? 0 : smooth(1.0, 2.2, since)) * (1 - global);
        u.u_global.value = global;
        u.u_baseSize.value = S.baseSize;
        u.u_maxSize.value = S.maxSize;
        u.u_radius.value = S.radius;
        u.u_repulsion.value = S.repulsion;
        u.u_cover.value = S.spacing * 1.5;
        gl3.renderer.render(gl3.scene, gl3.camera);
      }
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

  // ---------- ?tune: live sliders for presenting and tweaking (hidden otherwise)
  if (/[?&]tune\b/.test(location.search)) {
    var panel = document.createElement('div');
    panel.className = 'o2-tune';
    [
      ['maxSize', 'Spyglass size', 30, 128, 1],
      ['radius', 'Falloff radius', 0.1, 1.2, 0.05],
      ['repulsion', 'Repulsion push', 0, 0.4, 0.01],
      ['spacing', 'Dot spacing', 8, 24, 1],
      ['baseSize', 'Dot size', 2, 20, 0.5]
    ].forEach(function (r) {
      var row = document.createElement('label');
      var name = document.createElement('span'); name.textContent = r[1];
      var input = document.createElement('input');
      input.type = 'range'; input.min = r[2]; input.max = r[3]; input.step = r[4]; input.value = S[r[0]];
      var out = document.createElement('output'); out.textContent = S[r[0]];
      input.addEventListener('input', function () {
        S[r[0]] = parseFloat(input.value); out.textContent = input.value;
        if (r[0] === 'spacing' && gl3) gl3.buildGrid(W, H);
      });
      row.appendChild(name); row.appendChild(input); row.appendChild(out);
      panel.appendChild(row);
    });
    document.body.appendChild(panel);
  }
})();
