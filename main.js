// No Filter home page. Hero heatmap, headline push and video loading.
(function () {
  'use strict';
  var PROPS = {"accent": "#FF6126", "showNotes": true, "heroStyle": "Heatmap", "textPush": 0.3, "textSnap": 0.4, "heatSource": "Cursor", "heatPalette": "No Filter", "heatSpeed": 0.45, "heatContour": 0.54, "heatInnerGlow": 0.35, "heatOuterGlow": 0.37, "heatNoise": 0, "heatAngle": 0, "symbolSize": 39, "symbolX": 52, "symbolY": 38, "ringColor1": "#ff4d00", "ringColor2": "#ff0000", "ringColor3": "#3400ff", "ringColor4": "#ffffff", "dotSpacing": 27, "ringSize": 0.7, "ringThickness": 0.6, "dashSize": 0.8, "ringSpeed": 0.3, "cursorFollow": 1, "gradColor1": "#ff5e00", "gradColor2": "#8a162d", "gradColor3": "#000000", "gradColor4": "#8518cf", "gradColor5": "#2604eb", "speed": 1.45, "waveHeight": 0.15, "waveSize": 1.05, "softness": 0.9, "waveAngle": 0, "cameraTilt": 46, "grain": 0, "showKeynotes": false, "showMoreWork": false};
  var touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
  if (touch) PROPS.heatSource = 'Auto'; // no cursor on phones: the symbol animates by itself

  function DCLogic(props) { this.props = props; this.state = {}; }
  DCLogic.prototype.setState = function () {};
  DCLogic.prototype.forceUpdate = function () {};

  class Component extends DCLogic {
    componentDidMount() { this._syncGradient(); this._syncDots(); this._syncHeat(); this._syncPush(); }
    componentDidUpdate() {
      this._syncGradient();
      this._syncDots();
      this._syncHeat();
      if (this._heat) {
        const hopts = this._heatOptions(), hkey = JSON.stringify(hopts);
        if (hkey !== this._hKey) { this._hKey = hkey; this._heat.setOptions(hopts); }
      }
      this._syncPush();
      if (this._push) { this._push.setOptions(this._pushOptions()); this._push.refresh(); }
      if (this._dots) {
        const dopts = this._dotsOptions(), dkey = JSON.stringify(dopts);
        if (dkey !== this._dKey) { this._dKey = dkey; this._dots.setOptions(dopts); }
      }
      if (this._gradient) {
        const opts = this._gradientOptions(), key = JSON.stringify(opts);
        if (key !== this._gKey) { this._gKey = key; this._gradient.setOptions(opts); }
      }
    }
    componentWillUnmount() { this._stopGradient(); this._stopDots(); this._stopHeat(); this._stopPush(); }
  
    renderVals() {
      const p = this.props;
      if (!this._gradRef) {
        const self = this;
        this._gradRef = function (el) { self._refCanvas = el || null; self._syncGradient(); };
        this._dotsRef = function (el) { self._refDots = el || null; self._syncDots(); };
        this._heatRef = function (el) { self._refHeat = el || null; self._syncHeat(); };
        const startVideo = function (el, withControls) {
          if (!el) return;
          el.muted = true; el.defaultMuted = true; el.loop = true; el.playsInline = true; el.autoplay = true;
          el.setAttribute('muted', ''); el.setAttribute('playsinline', '');
          if (withControls) el.controls = true;
          const go = function () { const r = el.play(); if (r && r.catch) r.catch(function () {}); };
          if (el.readyState >= 2) go(); else el.addEventListener('loadeddata', go, { once: true });
          go();
        };
        this._loopRef = function (el) { startVideo(el, false); };
        this._reelRef = function (el) { startVideo(el, true); };
      }
      const heroStyle = p.heroStyle ?? 'Heatmap';
      const symbol = p.symbolSize ?? 44;
      return {
        accent: p.accent ?? '#FF6126',
        showNotes: p.showNotes ?? true,
        heroHeat: heroStyle === 'Heatmap',
        heroDots: heroStyle === 'Particles',
        heroGradient: heroStyle === 'Gradient',
        dotsRef: this._dotsRef,
        heatRef: this._heatRef,
        hmLeft: (p.symbolX ?? 74) + '%',
        hmTop: (p.symbolY ?? 38) + '%',
        hmBox: 'min(' + (symbol * 1.75).toFixed(1) + 'vh, 70vw)',
        showKeynotes: p.showKeynotes ?? false,
        showMoreWork: p.showMoreWork ?? false,
        gradRef: this._gradRef,
        loopRef: this._loopRef,
        reelRef: this._reelRef,
        keynotesOlder: this._kOlder || (this._kOlder = () => this._scrollKeynotes(1)),
        keynotesNewer: this._kNewer || (this._kNewer = () => this._scrollKeynotes(-1))
      };
    }
  
    // Arrow buttons beside the keynote row: two cards at a time.
    _scrollKeynotes(dir) {
      const el = (typeof document !== 'undefined') ? document.querySelector('.kscroll') : null;
      if (!el) return;
      const card = el.querySelector('.kcard');
      const step = card ? card.getBoundingClientRect().width + 24 : 420;
      const still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      el.scrollBy({ left: dir * step * 2, behavior: still ? 'auto' : 'smooth' });
    }
  
    // Colors and dials from the Tweaks panel. Color 5 is the base and colors 1-4 are laid over it
    // in turn, so later colors show more.
    _gradientOptions() {
      const p = this.props;
      return {
        colors: [
          p.gradColor1 ?? '#FF5E00',
          p.gradColor2 ?? '#8A162D',
          p.gradColor3 ?? '#000000',
          p.gradColor4 ?? '#8518CF',
          p.gradColor5 ?? '#2604EB'
        ],
        timeScale: p.speed ?? 1,
        amount: p.waveHeight ?? 0.2,
        waveSize: p.waveSize ?? 1,
        softness: p.softness ?? 1,
        waveAngle: p.waveAngle ?? 0,
        tilt: p.cameraTilt ?? 51,
        grain: p.grain ?? 0
      };
    }
  
    _syncGradient() {
      const found = (typeof document !== 'undefined') ? document.querySelector('canvas.nf-hero-canvas') : null;
      const canvas = (this._refCanvas && this._refCanvas.isConnected) ? this._refCanvas : found;
      if (canvas === this._gCanvas || (canvas && canvas === this._gFailed)) return;
      this._stopGradient();
      if (!canvas) return;
      const opts = this._gradientOptions();
      this._gradient = this._mount(canvas, opts);
      if (this._gradient) { this._gCanvas = canvas; this._gKey = JSON.stringify(opts); }
      else this._gFailed = canvas; // no WebGL here: the CSS gradient underneath stays visible
    }
  
    _stopGradient() {
      if (this._gradient) this._gradient.destroy();
      this._gradient = null;
      this._gCanvas = null;
    }
  
    // Heatmap hero: the Ø symbol as a heat map (adapted from Paper Shaders' Heatmap, Apache 2.0).
    _heatOptions() {
      const p = this.props;
      const palettes = {
        'Thermal': ['#11206a', '#1f3ba2', '#2f63e7', '#6bd7ff', '#ffe679', '#ff991e', '#ff4c00'],
        'No Filter': ['#14063f', '#2604eb', '#8518cf', '#e0306a', '#ff5e00', '#ffb070'],
        'Silver': ['#2a2a30', '#9a9aa4', '#ffffff']
      };
      return {
        colors: palettes[p.heatPalette] || palettes['Thermal'],
        source: (p.heatSource ?? 'Auto') === 'Cursor' ? 'cursor' : 'auto',
        speed: p.heatSpeed ?? 1,
        contour: p.heatContour ?? 0.5,
        innerGlow: p.heatInnerGlow ?? 0.5,
        outerGlow: p.heatOuterGlow ?? 0.5,
        noise: p.heatNoise ?? 0,
        angle: p.heatAngle ?? 0
      };
    }
  
    _syncHeat() {
      const found = (typeof document !== 'undefined') ? document.querySelector('canvas.nf-heat-canvas') : null;
      const canvas = (this._refHeat && this._refHeat.isConnected) ? this._refHeat : found;
      if (canvas === this._hCanvas || (canvas && canvas === this._hFailed)) return;
      this._stopHeat();
      if (!canvas) return;
      const opts = this._heatOptions();
      this._heat = this._mountHeat(canvas, opts);
      if (this._heat) { this._hCanvas = canvas; this._hKey = JSON.stringify(opts); }
      else this._hFailed = canvas;
    }
  
    _stopHeat() {
      if (this._heat) this._heat.destroy();
      this._heat = null;
      this._hCanvas = null;
    }
  
    _mountHeat(canvas, options) {
      return (
      function mountNfHeatmap(canvas, options) {
        // The Ø symbol (NFC Symbol.svg, viewBox 0 0 182.9 178.89).
        var SYMBOL = 'M182.9,89.45c0,50.86-39.59,89.45-91.45,89.45-18.54,0-35.33-4.76-49.36-13.28l-8.77,10.27H1.25l22.05-25.81C8.77,134.54,0,113.25,0,89.45,0,38.58,39.34,0,91.45,0c18.29,0,34.83,4.76,48.86,13.28l8.77-10.27h32.07l-21.8,25.56c14.78,15.78,23.55,36.83,23.55,60.88ZM49.11,120.01L115,42.84c-7.02-3.51-15.03-5.51-23.55-5.51-29.31,0-51.61,22.3-51.61,52.11,0,11.53,3.26,22.05,9.27,30.57ZM143.06,89.45c0-11.78-3.51-22.3-9.52-30.82l-66.15,77.42c7.27,3.51,15.28,5.51,24.05,5.51,29.31,0,51.61-22.3,51.61-52.11Z';
        var VIEW = [182.9, 178.89];
        var DEFAULTS = {
          // Cold to hot.
          colors: ['#11206a', '#1f3ba2', '#2f63e7', '#6bd7ff', '#ffe679', '#ff991e', '#ff4c00'],
          speed: 1,          // 0 holds the animation still
          contour: 0.5,      // heat along the symbol's inner edges
          innerGlow: 0.5,    // size of the heated area inside the symbol
          outerGlow: 0.5,    // size of the glow outside it
          noise: 0,          // grain
          angle: 0,          // direction the heat waves travel, in degrees
          source: 'auto',    // 'auto': animates itself. 'cursor': the cursor heats the part of the symbol nearest it
          heatRadius: 0.14,  // size of the cursor's heat, as a share of the symbol's frame
          maxDpr: 1.5,
          stillTime: 6       // the moment shown when the viewer prefers reduced motion
        };
        var opt = {}, k;
        for (k in DEFAULTS) opt[k] = DEFAULTS[k];
        if (options) for (k in options) {
          if (Object.prototype.hasOwnProperty.call(DEFAULTS, k) && options[k] !== undefined && options[k] !== null) opt[k] = options[k];
        }
        function num(v, d) { v = +v; return isFinite(v) ? v : d; }
        var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  
        // ---- The symbol as a texture: R = edge, G = wide blur, B = inner blur (Paper's preprocessing) ----
        function blurGray(gray, w, h, radius) {
          if (radius <= 0) return gray.slice();
          var out = new Uint8ClampedArray(w * h), integral = new Uint32Array(w * h), x, y;
          for (y = 0; y < h; y++) {
            var rowSum = 0;
            for (x = 0; x < w; x++) {
              var idx = y * w + x;
              rowSum += gray[idx];
              integral[idx] = rowSum + (y > 0 ? integral[idx - w] : 0);
            }
          }
          for (y = 0; y < h; y++) {
            var y1 = Math.max(0, y - radius), y2 = Math.min(h - 1, y + radius);
            for (x = 0; x < w; x++) {
              var x1 = Math.max(0, x - radius), x2 = Math.min(w - 1, x + radius);
              var A = integral[y2 * w + x2];
              var B = x1 > 0 ? integral[y2 * w + (x1 - 1)] : 0;
              var C = y1 > 0 ? integral[(y1 - 1) * w + x2] : 0;
              var D = (x1 > 0 && y1 > 0) ? integral[(y1 - 1) * w + (x1 - 1)] : 0;
              out[y * w + x] = Math.round((A - B - C + D) / ((x2 - x1 + 1) * (y2 - y1 + 1)));
            }
          }
          return out;
        }
        function multiPassBlur(gray, w, h, radius, passes) {
          var input = gray;
          for (var p = 0; p < Math.max(1, passes); p++) input = blurGray(input, w, h, radius);
          return input;
        }
        function buildSymbolTexture() {
          var base = 800, maxBlur = Math.floor(base * 0.15), pad = Math.ceil(maxBlur * 2.5);
          var ratio = VIEW[0] / VIEW[1];
          var iw = ratio > 1 ? base : Math.floor(base * ratio), ih = ratio > 1 ? Math.floor(base / ratio) : base;
          var w = iw + 2 * pad, h = ih + 2 * pad;
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          var g = c.getContext('2d', { willReadFrequently: true });
          g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
          g.save(); g.translate(pad, pad); g.scale(iw / VIEW[0], ih / VIEW[1]);
          g.fillStyle = '#000000'; g.fill(new Path2D(SYMBOL)); g.restore();
          var src = g.getImageData(0, 0, w, h).data, n = w * h, gray = new Uint8ClampedArray(n), i;
          for (i = 0; i < n; i++) gray[i] = (0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]) | 0;
          var wide = multiPassBlur(gray, w, h, maxBlur, 3);
          var inner = multiPassBlur(gray, w, h, Math.max(1, Math.round(0.12 * maxBlur)), 3);
          var edge = multiPassBlur(gray, w, h, Math.max(1, Math.round(5 * base / 1000)), 1);
          var out = new Uint8Array(n * 4);
          for (i = 0; i < n; i++) { out[i * 4] = edge[i]; out[i * 4 + 1] = wide[i]; out[i * 4 + 2] = inner[i]; out[i * 4 + 3] = 255; }
          return { data: out, w: w, h: h, pad: pad / w };
        }
  
        var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
        if (!gl) return fallback();
  
        var VERT = '#version 300 es\n' +
          'precision highp float;\n' +
          'layout(location = 0) in vec2 a_pos;\n' +
          'uniform float u_texAspect;\n' +
          'uniform float u_boxAspect;\n' +
          'out vec2 v_img;\n' +
          'void main() {\n' +
          '  gl_Position = vec4(a_pos, 0., 1.);\n' +
          '  vec2 uv = vec2(a_pos.x * .5 + .5, .5 - a_pos.y * .5);\n' +
          '  vec2 s = vec2(1.);\n' +
          '  if (u_boxAspect > u_texAspect) s.x = u_boxAspect / u_texAspect; else s.y = u_texAspect / u_boxAspect;\n' +
          '  v_img = (uv - .5) * s + .5;\n' +
          '}\n';
  
        var FRAG = `#version 300 es
      precision highp float;
      in vec2 v_img;
      out vec4 fragColor;
      uniform sampler2D u_image;
      uniform float u_time;
      uniform vec4 u_colorBack;
      uniform vec4 u_colors[10];
      uniform float u_colorsCount;
      uniform float u_angle;
      uniform float u_noise;
      uniform float u_innerGlow;
      uniform float u_outerGlow;
      uniform float u_contour;
      uniform float u_auto;
      uniform vec3 u_heat[12];
      uniform float u_heatCount;
      uniform float u_heatR;
      #define TWO_PI 6.28318530718
      #define PI 3.14159265358979323846
  
      float getImgFrame(vec2 uv, float th) {
        float frame = 1.;
        frame *= smoothstep(0., th, uv.y);
        frame *= 1. - smoothstep(1. - th, 1., uv.y);
        frame *= smoothstep(0., th, uv.x);
        frame *= 1. - smoothstep(1. - th, 1., uv.x);
        return frame;
      }
      float circle(vec2 uv, vec2 c, vec2 r) { return 1. - smoothstep(r[0], r[1], length(uv - c)); }
      float lst(float edge0, float edge1, float x) { return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0); }
      // Written out so reversed edges (edge0 > edge1, used throughout) behave the same on every GPU.
      float sst(float edge0, float edge1, float x) { float t = clamp((x - edge0) / (edge1 - edge0), 0., 1.); return t * t * (3. - 2. * t); }
  
      float shadowShape(vec2 uv, float t, float contour) {
        vec2 scaledUV = uv;
        float posY = mix(-1., 2., t);
        scaledUV.y -= .5;
        float mainCircleScale = sst(0., .8, posY) * lst(1.4, .9, posY);
        scaledUV *= vec2(1., 1. + 1.5 * mainCircleScale);
        scaledUV.y += .5;
        float innerR = .4;
        float outerR = 1. - .3 * (sst(.1, .2, t) * (1. - sst(.2, .5, t)));
        float s = circle(scaledUV, vec2(.5, posY - .2), vec2(innerR, outerR));
        s = pow(s, 1.4);
        s *= 1.2;
        {
          float pos = posY - uv.y;
          float edge = 1.2;
          float topFlattener = lst(-.4, 0., pos) * (1. - sst(.0, edge, pos));
          topFlattener = pow(topFlattener, 3.);
          float topFlattenerMixer = (1. - sst(.0, .3, pos));
          s = mix(topFlattener, s, topFlattenerMixer);
        }
        {
          float visibility = sst(.6, .7, t) * (1. - sst(.8, .9, t));
          float angle = -2. -t * TWO_PI;
          float rightCircle = circle(uv, vec2(.95 - .2 * cos(angle), .4 - .1 * sin(angle)), vec2(.15, .3));
          rightCircle *= visibility;
          s = mix(s, 0., rightCircle);
        }
        {
          float topCircle = circle(uv, vec2(.5, .19), vec2(.05, .25));
          topCircle += 2. * contour * circle(uv, vec2(.5, .19), vec2(.2, .5));
          float visibility = .55 * sst(.2, .3, t) * (1. - sst(.3, .45, t));
          topCircle *= visibility;
          s = mix(s, 0., topCircle);
        }
        float leafMask = circle(uv, vec2(.53, .13), vec2(.08, .19));
        leafMask = mix(leafMask, 0., 1. - sst(.4, .54, uv.x));
        leafMask = mix(0., leafMask, sst(.0, .2, uv.y));
        leafMask *= (sst(.5, 1.1, posY) * sst(1.5, 1.3, posY));
        s += leafMask;
        {
          float visibility = sst(.0, .4, t) * (1. - sst(.6, .8, t));
          s = mix(s, 0., visibility * circle(uv, vec2(.52, .92), vec2(.09, .25)));
        }
        {
          float pos = sst(.0, .6, t) * (1. - sst(.6, 1., t));
          s = mix(s, .5, circle(uv, vec2(.0, 1.2 - .5 * pos), vec2(.1, .3)));
          s = mix(s, .0, circle(uv, vec2(1., .5 + .5 * pos), vec2(.1, .3)));
          s = mix(s, 1., circle(uv, vec2(.95, .2 + .2 * sst(.3, .4, t) * sst(.7, .5, t)), vec2(.07, .22)));
          s = mix(s, 1., circle(uv, vec2(.95, .2 + .2 * sst(.3, .4, t) * (1. - sst(.5, .7, t))), vec2(.07, .22)));
          s /= max(1e-4, sst(1., .85, uv.y));
        }
        // clamp(s, 0., 1.): the original's argument order is undefined in GLSL and breaks on some GPUs.
        s = clamp(s, 0., 1.);
        return s;
      }
  
      float blurEdge3x3(sampler2D tex, vec2 uv, vec2 dudx, vec2 dudy, float radius, float centerSample) {
        vec2 texel = 1.0 / vec2(textureSize(tex, 0));
        vec2 r = radius * texel;
        float sum = 4.0 * centerSample;
        sum += 2.0 * textureGrad(tex, uv + vec2(0.0, -r.y), dudx, dudy).g;
        sum += 2.0 * textureGrad(tex, uv + vec2(0.0, r.y), dudx, dudy).g;
        sum += 2.0 * textureGrad(tex, uv + vec2(-r.x, 0.0), dudx, dudy).g;
        sum += 2.0 * textureGrad(tex, uv + vec2(r.x, 0.0), dudx, dudy).g;
        sum += textureGrad(tex, uv + vec2(-r.x, -r.y), dudx, dudy).g;
        sum += textureGrad(tex, uv + vec2(r.x, -r.y), dudx, dudy).g;
        sum += textureGrad(tex, uv + vec2(-r.x, r.y), dudx, dudy).g;
        sum += textureGrad(tex, uv + vec2(r.x, r.y), dudx, dudy).g;
        return sum / 16.0;
      }
  
      // Cursor heat: a few soft blobs (the cursor and its recent trail).
      float heatAt(vec2 p, float r) {
        float h = 0.;
        for (int i = 0; i < 12; i++) {
          if (float(i) >= u_heatCount) break;
          vec2 d = p - u_heat[i].xy;
          h += u_heat[i].z * exp(-dot(d, d) / (r * r));
        }
        return h;
      }
  
      void main() {
        vec2 imgUV = v_img;
        vec2 dudx = dFdx(imgUV);
        vec2 dudy = dFdy(imgUV);
        vec4 img = textureGrad(u_image, imgUV, dudx, dudy);
        if (imgUV.x < 0. || imgUV.y < 0. || imgUV.x > 1. || imgUV.y > 1.) { fragColor = u_colorBack; return; }
        vec2 uv = imgUV;
        float imgSoftFrame = getImgFrame(imgUV, .03);
  
        float t = .1 * u_time;
        t -= .3;
        float tCopy = t + 1. / 3.;
        float tCopy2 = t + 2. / 3.;
        t = mod(t, 1.);
        tCopy = mod(tCopy, 1.);
        tCopy2 = mod(tCopy2, 1.);
  
        vec2 animationUV = imgUV - vec2(.5);
        float angle = -u_angle * PI / 180.;
        float cosA = cos(angle);
        float sinA = sin(angle);
        animationUV = vec2(animationUV.x * cosA - animationUV.y * sinA, animationUV.x * sinA + animationUV.y * cosA) + vec2(.5);
  
        float shape = img[0];
        img[1] = blurEdge3x3(u_image, imgUV, dudx, dudy, 8., img[1]);
        float outerBlur = 1. - mix(1., img[1], shape);
        float innerBlur = mix(img[1], 0., shape);
        float contour = mix(img[2], 0., shape);
        outerBlur *= imgSoftFrame;
  
        // Self-animating heat (Paper's): cool shapes sweep through a hot symbol.
        float innerA = .8 + .8 * innerBlur;
        if (u_auto > .001) {
          float shadow = shadowShape(animationUV, t, innerBlur);
          float shadowCopy = shadowShape(animationUV, tCopy, innerBlur);
          float shadowCopy2 = shadowShape(animationUV, tCopy2, innerBlur);
          innerA = mix(innerA, 0., shadow);
          innerA = mix(innerA, 0., shadowCopy);
          innerA = mix(innerA, 0., shadowCopy2);
        }
        // Cursor heat: a cool symbol that warms where the cursor is.
        vec2 wp = imgUV + .012 * vec2(sin(imgUV.y * 23. + u_time * 1.3), cos(imgUV.x * 19. - u_time * 1.1));
        float idle = .08 * (.5 + .5 * sin(u_time * .6 + imgUV.y * 7. + imgUV.x * 3.));
        float hc = 1. - exp(-1.6 * heatAt(wp, u_heatR));   // soft saturation keeps a graded hot spot
        float innerC = (.8 + .8 * innerBlur) * clamp(.1 + idle + .95 * hc, 0., 1.);
        float inner = mix(innerC, innerA, u_auto);
  
        inner *= mix(0., 2., u_innerGlow);
        inner += (u_contour * 2.) * contour;
        inner = min(1., inner);
        inner *= (1. - shape);
  
        float outer = 0.;
        {
          float tt = mod(t * 3. - .1, 1.);
          outer = .9 * pow(outerBlur, .8);
          float y = mod(animationUV.y - tt, 1.);
          float animatedMask = .5 + sst(.3, .65, y) * (1. - sst(.65, 1., y));
          float outerC = .3 + 1.1 * (1. - exp(-1.6 * heatAt(wp, u_heatR * 1.8)));
          outer *= mix(outerC, animatedMask, u_auto);
          outer *= mix(0., 5., pow(u_outerGlow, 2.));
          outer *= imgSoftFrame;
        }
  
        inner = pow(inner, 1.2);
        float heat = clamp(inner + outer, 0., 1.);
        heat += (.005 + .35 * u_noise) * (fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453123) - .5);
  
        float mixer = heat * u_colorsCount;
        vec4 gradient = u_colors[0];
        gradient.rgb *= gradient.a;
        float outerShape = 0.;
        for (int i = 1; i < 11; i++) {
          if (i > int(u_colorsCount)) break;
          float m = clamp(mixer - float(i - 1), 0., 1.);
          if (i == 1) outerShape = m;
          vec4 c = u_colors[i - 1];
          c.rgb *= c.a;
          gradient = mix(gradient, c, m);
        }
        vec3 color = gradient.rgb * outerShape;
        float opacity = gradient.a * outerShape;
        vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
        color = color + bgColor * (1.0 - opacity);
        opacity = opacity + u_colorBack.a * (1.0 - opacity);
        color += .02 * (fract(sin(dot(uv + 1., vec2(12.9898, 78.233))) * 43758.5453123) - .5) * opacity;
        fragColor = vec4(color, opacity);
      }
      `;
  
        function compile(type, src) {
          var s = gl.createShader(type);
          gl.shaderSource(s, src);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            if (window.console) console.warn('Heatmap shader:', gl.getShaderInfoLog(s));
            return null;
          }
          return s;
        }
        var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return null;
        var prog = gl.createProgram();
        gl.attachShader(prog, vs); gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
        gl.useProgram(prog);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        var U = {};
        ['u_image', 'u_time', 'u_colorBack', 'u_colors', 'u_colorsCount', 'u_angle', 'u_noise', 'u_innerGlow', 'u_outerGlow',
         'u_contour', 'u_auto', 'u_heat', 'u_heatCount', 'u_heatR', 'u_texAspect', 'u_boxAspect'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  
        var tex = null, texAspect = 1, ready = false;
        function uploadSymbol() {
          var s = buildSymbolTexture();
          tex = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, s.w, s.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, s.data);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.uniform1i(U.u_image, 0);
          texAspect = s.w / s.h;
          gl.uniform1f(U.u_texAspect, texAspect);
          ready = true;
        }
  
        function parse(hex) {
          var h = String(hex || '').replace('#', '').trim();
          if (h.length === 3) h = h.split('').map(function (ch) { return ch + ch; }).join('');
          var v = parseInt((h + '000000').slice(0, 6), 16) || 0;
          return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, 1];
        }
        var colorKey = '';
        function applyUniforms() {
          var cols = (opt.colors && opt.colors.length ? opt.colors : DEFAULTS.colors).slice(0, 10);
          var key = cols.join('|');
          if (key !== colorKey) {
            colorKey = key;
            var flat = new Float32Array(40);
            cols.forEach(function (c, i) { flat.set(parse(c), i * 4); });
            gl.uniform4fv(U.u_colors, flat);
            gl.uniform1f(U.u_colorsCount, cols.length);
          }
          gl.uniform4f(U.u_colorBack, 0, 0, 0, 0);
          gl.uniform1f(U.u_angle, num(opt.angle, 0));
          gl.uniform1f(U.u_noise, Math.max(0, Math.min(1, num(opt.noise, 0))));
          gl.uniform1f(U.u_innerGlow, Math.max(0, Math.min(1, num(opt.innerGlow, 0.5))));
          gl.uniform1f(U.u_outerGlow, Math.max(0, Math.min(1, num(opt.outerGlow, 0.5))));
          gl.uniform1f(U.u_contour, Math.max(0, Math.min(1, num(opt.contour, 0.5))));
          gl.uniform1f(U.u_heatR, Math.max(0.03, num(opt.heatRadius, 0.14)));
        }
  
        var lastW = 0, lastH = 0;
        function resize() {
          var d = Math.min(window.devicePixelRatio || 1, num(opt.maxDpr, 1.5));
          var w = Math.max(1, Math.round(canvas.clientWidth * d)), h = Math.max(1, Math.round(canvas.clientHeight * d));
          if (w === lastW && h === lastH) return;
          lastW = w; lastH = h;
          canvas.width = w; canvas.height = h;
          gl.viewport(0, 0, w, h);
          gl.uniform1f(U.u_boxAspect, w / h);
        }
  
        // ---- Cursor heat sources, in the texture's 0..1 space ----
        var trail = [], cursor = null, lastMove = -1e9, autoMix = 1;
        var heatData = new Float32Array(36);
        function toSymbolSpace(clientX, clientY) {
          var r = canvas.getBoundingClientRect();
          if (!r.width || !r.height) return null;
          var u = (clientX - r.left) / r.width, v = (clientY - r.top) / r.height;
          var boxA = r.width / r.height, sx = 1, sy = 1;
          if (boxA > texAspect) sx = boxA / texAspect; else sy = texAspect / boxA;
          var x = (u - 0.5) * sx + 0.5, y = (v - 0.5) * sy + 0.5;
          // Far away, the heat waits on the side of the symbol facing the cursor.
          var dx = x - 0.5, dy = y - 0.5, dist = Math.sqrt(dx * dx + dy * dy), edge = 0.33;
          var strength = 0.55 + 0.45 * (1 - Math.min(1, Math.max(0, (dist - 0.3) / 1.1)));
          if (dist > edge) { x = 0.5 + dx / dist * edge; y = 0.5 + dy / dist * edge; }
          return { x: x, y: y, s: strength };
        }
        function onMove(e) {
          var p = toSymbolSpace(e.clientX, e.clientY);
          if (!p) return;
          lastMove = clock;
          var prev = trail[0];
          if (!prev || Math.abs(prev.x - p.x) + Math.abs(prev.y - p.y) > 0.012) {
            trail.unshift({ x: p.x, y: p.y, s: p.s * 0.9 });
            if (trail.length > 10) trail.pop();
          }
          cursor = p;
          wake();
        }
        function onOut(e) { if (!e.relatedTarget) cursor = null; }
        function stepHeat(dt) {
          var cursorMode = opt.source === 'cursor';
          var active = cursorMode && cursor && (clock - lastMove < 8);
          var target = cursorMode ? (active ? 0 : 1) : 1;
          autoMix += (target - autoMix) * (1 - Math.exp(-dt * 1.4));
          var fade = Math.exp(-dt / 0.6), n = 0, i;
          for (i = trail.length - 1; i >= 0; i--) { trail[i].s *= fade; if (trail[i].s < 0.03) trail.splice(i, 1); }
          if (active) { heatData[0] = cursor.x; heatData[1] = cursor.y; heatData[2] = cursor.s * 0.85; n = 1; }
          for (i = 0; i < trail.length && n < 12; i++, n++) {
            heatData[n * 3] = trail[i].x; heatData[n * 3 + 1] = trail[i].y; heatData[n * 3 + 2] = trail[i].s * 0.55;
          }
          gl.uniform3fv(U.u_heat, heatData);
          gl.uniform1f(U.u_heatCount, n);
          gl.uniform1f(U.u_auto, Math.max(0, Math.min(1, autoMix)));
        }
  
        var time = num(opt.stillTime, 6), clock = 0, last = 0, raf = 0, onScreen = true, destroyed = false;
        function draw() {
          if (destroyed || !ready) return;
          resize();
          applyUniforms();
          gl.uniform1f(U.u_time, time);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        function frame(now) {
          raf = 0;
          if (destroyed || !onScreen || document.hidden) { last = 0; return; }
          var dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
          last = now;
          clock += dt;
          time += dt * Math.max(0, num(opt.speed, 1));
          stepHeat(dt);
          draw();
          raf = requestAnimationFrame(frame);
        }
        function wake() {
          if (!destroyed && !reduce && ready && !raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
        }
        function redrawIfStill() { if (reduce || !raf) draw(); }
  
        // Build the symbol texture just after the page settles, then start.
        var startTimer = setTimeout(function () {
          if (destroyed) return;
          uploadSymbol();
          if (reduce) { autoMix = 1; gl.uniform1f(U.u_auto, 1); gl.uniform1f(U.u_heatCount, 0); }
          else stepHeat(0);
          draw();
          wake();
        }, 30);
  
        var io = null, ro = null;
        if (window.IntersectionObserver) {
          io = new IntersectionObserver(function (entries) {
            onScreen = entries.some(function (en) { return en.isIntersecting; });
            wake();
          });
          io.observe(canvas);
        }
        if (window.ResizeObserver) { ro = new ResizeObserver(redrawIfStill); ro.observe(canvas); }
        document.addEventListener('visibilitychange', wake);
        if (!reduce) {
          window.addEventListener('pointermove', onMove, { passive: true });
          window.addEventListener('pointerdown', onMove, { passive: true });
          document.addEventListener('mouseout', onOut);
        }
  
        // No WebGL2: draw the symbol flat in two of the heat colours.
        function fallback() {
          var g = canvas.getContext('2d');
          if (!g) return null;
          function paint() {
            var w = canvas.clientWidth, h = canvas.clientHeight, d = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
            g.setTransform(d, 0, 0, d, 0, 0);
            var size = Math.min(w, h) / 1.75, sc = size / VIEW[1];
            var cols = opt.colors && opt.colors.length ? opt.colors : DEFAULTS.colors;
            var grad = g.createLinearGradient(0, h / 2 - size / 2, 0, h / 2 + size / 2);
            grad.addColorStop(0, cols[Math.max(0, cols.length - 2)]); grad.addColorStop(1, cols[Math.min(cols.length - 1, 2)]);
            g.clearRect(0, 0, w, h);
            g.save(); g.translate(w / 2 - VIEW[0] * sc / 2, h / 2 - VIEW[1] * sc / 2); g.scale(sc, sc);
            g.fillStyle = grad; g.fill(new Path2D(SYMBOL)); g.restore();
          }
          paint();
          return { setOptions: function (o) { for (var key in o) if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) opt[key] = o[key]; paint(); }, redraw: paint, destroy: function () {} };
        }
  
        return {
          setOptions: function (o) {
            for (var key in o) {
              if (Object.prototype.hasOwnProperty.call(DEFAULTS, key) && o[key] !== undefined && o[key] !== null) opt[key] = o[key];
            }
            colorKey = '';
            redrawIfStill();
            wake();
          },
          redraw: draw,
          destroy: function () {
            destroyed = true;
            clearTimeout(startTimer);
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            if (io) io.disconnect();
            if (ro) ro.disconnect();
            document.removeEventListener('visibilitychange', wake);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerdown', onMove);
            document.removeEventListener('mouseout', onOut);
            var lose = gl.getExtension('WEBGL_lose_context');
            if (lose) lose.loseContext();
          }
        };
      }
      )(canvas, options);
    }
  
    // Headline letters pushed aside by the cursor: dials from the Tweaks panel.
    _pushOptions() {
      const p = this.props;
      return { strength: p.textPush ?? 1, snap: p.textSnap ?? 1 };
    }
  
    _syncPush() {
      const root = (typeof document !== 'undefined') ? document.querySelector('.hero-sec') : null;
      if (root === this._pRoot) return;
      this._stopPush();
      if (!root) return;
      this._push = this._mountPush(root, this._pushOptions());
      if (this._push) this._pRoot = root;
    }
  
    _stopPush() {
      if (this._push) this._push.destroy();
      this._push = null;
      this._pRoot = null;
    }
  
    _mountPush(root, options) {
      return (
      function mountNfTextPush(root, options) {
        var DEFAULTS = {
          strength: 1,   // how far letters are pushed; 0 turns the push off
          snap: 1,       // spring stiffness: higher snaps back faster
          radius: 1.7,   // reach of the cursor, in letter heights
          tilt: 15       // degrees of tilt for a sideways push of one letter height
        };
        var opt = {}, k;
        for (k in DEFAULTS) opt[k] = DEFAULTS[k];
        if (options) for (k in options) {
          if (Object.prototype.hasOwnProperty.call(DEFAULTS, k) && options[k] !== undefined && options[k] !== null) opt[k] = options[k];
        }
        if (!root || !root.querySelectorAll) return null;
        function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  
        var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var letters = [], destroyed = false, raf = 0, last = 0;
        var mx = -1e5, my = -1e5, active = false;
  
        // Splitting text into letters drops the font's kerning, so put it back: measure each pair
        // on a canvas and set the difference as a margin, in em so it holds at every size.
        var kernCanvas = null, kernCache = {};
        function kern() {
          if (!kernCanvas) kernCanvas = document.createElement('canvas');
          var g = kernCanvas.getContext && kernCanvas.getContext('2d');
          if (!g) return;
          var words = root.querySelectorAll('.pw');
          for (var w = 0; w < words.length; w++) {
            var ls = words[w].querySelectorAll('.pc');
            if (!ls.length) continue;
            var cs = window.getComputedStyle(ls[0]);
            var size = parseFloat(cs.fontSize) || 16;
            g.font = cs.fontStyle + ' ' + cs.fontWeight + ' 100px ' + cs.fontFamily;
            for (var i = 0; i < ls.length - 1; i++) {
              var a = ls[i].textContent, b = ls[i + 1].textContent, key = g.font + '|' + a + b;
              var kv = kernCache[key];
              if (kv === undefined) {
                kv = (g.measureText(a + b).width - g.measureText(a).width - g.measureText(b).width) / 100;
                kernCache[key] = kv;
              }
              ls[i].style.marginRight = Math.abs(kv) > 0.0005 ? kv.toFixed(4) + 'em' : '';
            }
            // The gap between words: one space, plus the letter-spacing the space would carry.
            var spacing = parseFloat(cs.letterSpacing);
            var space = g.measureText(' ').width / 100 + (isFinite(spacing) ? spacing / size : 0);
            words[w].style.marginRight = (w < words.length - 1 && words[w].nextElementSibling) ? space.toFixed(4) + 'em' : '';
          }
        }
  
        function collect() {
          var els = root.querySelectorAll('.pc'), old = letters;
          letters = [];
          for (var i = 0; i < els.length; i++) {
            var prev = null;
            for (var j = 0; j < old.length; j++) if (old[j].el === els[i]) { prev = old[j]; break; }
            letters.push(prev || { el: els[i], ox: 0, oy: 0, vx: 0, vy: 0, cx: 0, cy: 0, h: 16, set: false });
          }
          measure();
        }
        // Resting centres in page coordinates (a letter's offset is taken back out).
        function measure() {
          var sx = window.pageXOffset || 0, sy = window.pageYOffset || 0;
          for (var i = 0; i < letters.length; i++) {
            var L = letters[i], r = L.el.getBoundingClientRect();
            L.cx = r.left + r.width / 2 + sx - L.ox;
            L.cy = r.top + r.height / 2 + sy - L.oy;
            L.h = Math.max(8, L.el.offsetHeight || r.height || 16);
          }
        }
  
        function apply(L) {
          if (Math.abs(L.ox) < 0.02 && Math.abs(L.oy) < 0.02) {
            if (L.set) { L.el.style.transform = ''; L.set = false; }
            return;
          }
          var rot = Math.max(-18, Math.min(18, L.ox / L.h * num(opt.tilt, 15)));
          L.el.style.transform = 'translate(' + L.ox.toFixed(2) + 'px,' + L.oy.toFixed(2) + 'px) rotate(' + rot.toFixed(2) + 'deg)';
          L.set = true;
        }
  
        function frame(now) {
          raf = 0;
          if (destroyed) return;
          var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
          last = now;
          var sx = window.pageXOffset || 0, sy = window.pageYOffset || 0;
          var A = Math.max(0, num(opt.strength, 1)), K = 170 * Math.max(0.1, num(opt.snap, 1));
          var C = 2 * 0.45 * Math.sqrt(K), reachK = Math.max(0.2, num(opt.radius, 1.7));
          var busy = false, steps = 2, h = dt / steps;
          for (var i = 0; i < letters.length; i++) {
            var L = letters[i], tx = 0, ty = 0;
            if (active && A > 0) {
              var dx = (L.cx - sx) - mx, dy = (L.cy - sy) - my, reach = reachK * L.h;
              var d2 = dx * dx + dy * dy;
              if (d2 < reach * reach) {
                var d = Math.sqrt(d2) || 0.001, f = 1 - d / reach;
                f = f * f * (3 - 2 * f);
                var push = A * 0.42 * L.h * f;
                tx = dx / d * push; ty = dy / d * push;
              }
            }
            if (!tx && !ty && !L.set && !L.vx && !L.vy) continue;
            // A damped spring toward the pushed-aside position: no gravity, a little overshoot.
            for (var s = 0; s < steps; s++) {
              L.vx += (K * (tx - L.ox) - C * L.vx) * h;
              L.vy += (K * (ty - L.oy) - C * L.vy) * h;
              L.ox += L.vx * h;
              L.oy += L.vy * h;
            }
            if (Math.abs(tx - L.ox) < 0.03 && Math.abs(ty - L.oy) < 0.03 && Math.abs(L.vx) < 0.03 && Math.abs(L.vy) < 0.03) {
              L.ox = tx; L.oy = ty; L.vx = 0; L.vy = 0;
            } else busy = true;
            apply(L);
          }
          if (busy) raf = requestAnimationFrame(frame);
          else last = 0;
        }
        function wake() {
          if (!destroyed && !reduce && !raf && letters.length) raf = requestAnimationFrame(frame);
        }
  
        function onMove(e) { mx = e.clientX; my = e.clientY; active = true; wake(); }
        function onOut(e) { if (!e.relatedTarget) { active = false; wake(); } }
        function onBlur() { active = false; wake(); }
        function onResize() { measure(); wake(); }
  
        kern();
        collect();
        var ro = null;
        if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(root); }
        function onFonts() { if (!destroyed) { kern(); measure(); } }
        if (document.fonts) {
          if (document.fonts.ready) document.fonts.ready.then(onFonts);
          if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', onFonts);
        }
        if (!reduce) {
          window.addEventListener('pointermove', onMove, { passive: true });
          window.addEventListener('pointerdown', onMove, { passive: true });
          window.addEventListener('scroll', wake, { passive: true });
          window.addEventListener('resize', onResize);
          document.addEventListener('mouseout', onOut);
          window.addEventListener('blur', onBlur);
        }
  
        return {
          setOptions: function (o) {
            for (var key in o) {
              if (Object.prototype.hasOwnProperty.call(DEFAULTS, key) && o[key] !== undefined && o[key] !== null) opt[key] = o[key];
            }
            wake();
          },
          // Call after the headline's markup changes.
          refresh: function () { kern(); collect(); wake(); },
          destroy: function () {
            destroyed = true;
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            if (ro) ro.disconnect();
            if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', onFonts);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerdown', onMove);
            window.removeEventListener('scroll', wake);
            window.removeEventListener('resize', onResize);
            document.removeEventListener('mouseout', onOut);
            window.removeEventListener('blur', onBlur);
            for (var i = 0; i < letters.length; i++) { letters[i].el.style.transform = ''; letters[i].set = false; }
          }
        };
      }
      )(root, options);
    }
  
    // Particle hero: dials from the Tweaks panel.
    _dotsOptions() {
      const p = this.props;
      return {
        colors: [p.ringColor1 ?? '#3D5BFF', p.ringColor2 ?? '#9B4DFF', p.ringColor3 ?? '#F0365A', p.ringColor4 ?? '#FF7A1A'],
        spacing: p.dotSpacing ?? 22,
        ringSize: p.ringSize ?? 1,
        ringWidth: p.ringThickness ?? 1,
        dashSize: p.dashSize ?? 1,
        timeScale: p.ringSpeed ?? 1,
        follow: p.cursorFollow ?? 1
      };
    }
  
    _syncDots() {
      const found = (typeof document !== 'undefined') ? document.querySelector('canvas.nf-dots-canvas') : null;
      const canvas = (this._refDots && this._refDots.isConnected) ? this._refDots : found;
      if (canvas === this._dCanvas) return;
      this._stopDots();
      if (!canvas) return;
      const opts = this._dotsOptions();
      this._dots = this._mountDots(canvas, opts);
      if (this._dots) { this._dCanvas = canvas; this._dKey = JSON.stringify(opts); }
    }
  
    _stopDots() {
      if (this._dots) this._dots.destroy();
      this._dots = null;
      this._dCanvas = null;
    }
  
    // A ring of dashes that follows the cursor and keeps breathing (Canvas 2D).
    _mountDots(canvas, options) {
      return (
      function mountNfParticles(canvas, options) {
        var DEFAULTS = {
          // Ring colours. Colour 1 and colour 4 sit on opposite sides of the ring, 2 and 3 between them.
          colors: ['#3D5BFF', '#9B4DFF', '#F0365A', '#FF7A1A'],
          spacing: 22,        // px between resting dots
          ringSize: 1,        // ring radius, x 0.44 of the hero's shorter side
          ringWidth: 1,       // ring thickness
          dashSize: 1,        // dash length and weight
          timeScale: 1,       // breathing and ripple speed; 0 holds the shape still
          follow: 1,          // how quickly the ring catches up with the cursor
          dotColor: '#9A968E',
          dotAlpha: 0.2,
          rest: [0.6, 0.5],   // where the ring drifts when there's no cursor, as fractions of width and height
          maxDpr: 2,
          stillTime: 3.2      // the moment shown when the viewer prefers reduced motion
        };
        var opt = {};
        var k;
        for (k in DEFAULTS) opt[k] = DEFAULTS[k];
        if (options) for (k in options) {
          if (Object.prototype.hasOwnProperty.call(DEFAULTS, k) && options[k] !== undefined && options[k] !== null) opt[k] = options[k];
        }
        var ctx = canvas.getContext && canvas.getContext('2d');
        if (!ctx) return null;
  
        function num(v, d) { v = +v; return isFinite(v) ? v : d; }
        function rng(seed) {
          return function () {
            seed = (seed + 0x6D2B79F5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          };
        }
        function parse(hex) {
          var h = String(hex || '').replace('#', '').trim();
          if (h.length === 3) h = h.split('').map(function (ch) { return ch + ch; }).join('');
          var v = parseInt((h + '000000').slice(0, 6), 16) || 0;
          return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
        }
  
        // 16 colour steps around the ring, built from the four colours.
        var STEPS = 16, lut = [], colorKey = '';
        function buildColors() {
          var cols = (opt.colors || DEFAULTS.colors).slice(0, 4);
          while (cols.length < 4) cols.push(DEFAULTS.colors[cols.length]);
          var key = cols.join('|');
          if (key === colorKey) return;
          colorKey = key;
          var rgb = cols.map(parse);
          lut = [];
          for (var i = 0; i < STEPS; i++) {
            var v = (i + 0.5) / STEPS * 3, j = Math.min(2, Math.floor(v)), f = v - j;
            var a = rgb[j], b = rgb[j + 1];
            lut.push('rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')');
          }
        }
  
        // Resting dots on a jittered grid; the same layout on every load.
        var W = 0, H = 0, dpr = 1, N = 0, px, py, ph, bucketOf, order, segs, counts, starts, fill, builtSpacing = 0;
        var dotLayer = null, dotKey = '';
        var ALPHAS = [0.2, 0.36, 0.55], WEIGHTS = [1, 1.2, 1.5], BUCKETS = STEPS * 9;
        function build() {
          var s = Math.max(10, num(opt.spacing, 22));
          builtSpacing = s;
          var cols = Math.ceil(W / s) + 2, rows = Math.ceil(H / s) + 2;
          var offX = (W - (cols - 1) * s) / 2, offY = (H - (rows - 1) * s) / 2;
          N = cols * rows;
          px = new Float32Array(N); py = new Float32Array(N); ph = new Float32Array(N);
          bucketOf = new Int16Array(N); order = new Int32Array(N); segs = new Float32Array(N * 4);
          counts = new Int32Array(BUCKETS); starts = new Int32Array(BUCKETS); fill = new Int32Array(BUCKETS);
          var r = rng(7), i = 0;
          for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++, i++) {
              px[i] = offX + x * s + (r() - 0.5) * 0.7 * s;
              py[i] = offY + y * s + (r() - 0.5) * 0.7 * s;
              ph[i] = r() * Math.PI * 2;
            }
          }
          dotKey = '';
        }
        // The resting dots never move, so they are drawn once to a layer and copied each frame.
        function buildDots() {
          var key = [W, H, dpr, builtSpacing, opt.dotColor, opt.dotAlpha].join('|');
          if (key === dotKey && dotLayer) return;
          dotKey = key;
          if (!dotLayer) dotLayer = document.createElement('canvas');
          dotLayer.width = Math.round(W * dpr); dotLayer.height = Math.round(H * dpr);
          var g = dotLayer.getContext('2d');
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.clearRect(0, 0, W, H);
          g.globalAlpha = Math.max(0, Math.min(1, num(opt.dotAlpha, 0.32)));
          g.fillStyle = opt.dotColor || DEFAULTS.dotColor;
          g.beginPath();
          for (var i = 0; i < N; i++) g.rect(px[i] - 0.6, py[i] - 0.6, 1.2, 1.2);
          g.fill();
        }
        function resize() {
          var d = Math.min(window.devicePixelRatio || 1, num(opt.maxDpr, 2));
          var w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
          if (w === W && h === H && d === dpr && builtSpacing === Math.max(10, num(opt.spacing, 22))) return;
          var sized = (w !== W || h !== H || d !== dpr);
          W = w; H = h; dpr = d;
          if (sized) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
          build();
          if (!followInit) { fx = W * opt.rest[0]; fy = H * opt.rest[1]; followInit = true; }
        }
  
        // Where the ring is centred, and where it is heading.
        var fx = 0, fy = 0, followInit = false;
        var pointer = { x: 0, y: 0, active: false, touchUntil: 0 };
        function idleTarget(s) {
          return [
            W * num(opt.rest[0], 0.6) + W * 0.11 * Math.sin(s * 0.23) + W * 0.04 * Math.sin(s * 0.61 + 0.7),
            H * num(opt.rest[1], 0.5) + H * 0.10 * Math.sin(s * 0.19 + 1.1) + H * 0.04 * Math.sin(s * 0.53 + 2.3)
          ];
        }
        function onMove(e) {
          var r = canvas.getBoundingClientRect();
          var x = e.clientX - r.left, y = e.clientY - r.top;
          if (x < -r.width * 0.2 || x > r.width * 1.2 || y < -r.height * 0.2 || y > r.height * 1.3) { pointer.active = false; return; }
          pointer.x = x; pointer.y = y; pointer.active = true;
          pointer.touchUntil = e.pointerType === 'touch' ? clock + 3 : 0;
          wake();
        }
        function onOut(e) { if (!e.relatedTarget) pointer.active = false; }
        function onBlur() { pointer.active = false; }
  
        var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var t = num(opt.stillTime, 3.2), clock = 0, last = 0, raf = 0, onScreen = true, destroyed = false;
  
        function step(dt) {
          clock += dt;
          t += dt * Math.max(0, num(opt.timeScale, 1));
          if (pointer.active && pointer.touchUntil && clock > pointer.touchUntil) pointer.active = false;
          var target = pointer.active ? [pointer.x, pointer.y] : idleTarget(clock);
          var kf = 1 - Math.exp(-dt * 2.4 * Math.max(0.05, num(opt.follow, 1)));
          fx += (target[0] - fx) * kf;
          fy += (target[1] - fy) * kf;
        }
  
        function draw() {
          if (destroyed) return;
          resize();
          buildColors();
          buildDots();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
          ctx.drawImage(dotLayer, 0, 0);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
          var minS = Math.min(W, H);
          var R = num(opt.ringSize, 1) * 0.44 * minS * (1 + 0.06 * Math.sin(t * 0.55) + 0.03 * Math.sin(t * 1.37 + 1.3));
          var hw = Math.max(8, num(opt.ringWidth, 1) * 0.17 * minS * (1 + 0.12 * Math.sin(t * 0.8 + 2.1)));
          var k2 = 2 * Math.PI / (0.085 * minS);
          var rot = t * 0.04, wave = t * 1.5;
          // Dashes scale down a little on small screens so a phone doesn't look busier than a desktop.
          var dash = Math.max(0.2, num(opt.dashSize, 1)) * Math.max(0.65, Math.min(1, minS / 800));
          var TAU = Math.PI * 2, i, b;
  
          // Sort the ring's dashes into colour / strength / weight buckets.
          for (b = 0; b < BUCKETS; b++) counts[b] = 0;
          for (i = 0; i < N; i++) {
            var dx = px[i] - fx, dy = py[i] - fy;
            var d = Math.sqrt(dx * dx + dy * dy) + 0.001;
            var u = (d - R) / hw, e = 0;
            if (u > -1 && u < 1) {
              var band = 1 - u * u; band *= band;
              e = band * (0.62 + 0.38 * Math.sin(d * k2 - wave)) * (0.82 + 0.18 * Math.sin(t * 1.2 + ph[i]));
            }
            if (e < 0.1) { bucketOf[i] = -1; continue; }
            var nx = dx / d, ny = dy / d;
            var off = 3 * band * Math.sin(d * k2 - wave + 1.4);
            var cx = px[i] + nx * off, cy = py[i] + ny * off, half = dash * (1.5 + 6 * e) / 2;
            var a = Math.atan2(dy, dx) / TAU + rot + 0.08 * Math.sin(d / minS * 3 - t * 0.5);
            a -= Math.floor(a);
            var ci = Math.min(STEPS - 1, Math.floor((1 - Math.abs(2 * a - 1)) * STEPS));
            var ai = e > 0.62 ? 2 : (e > 0.32 ? 1 : 0);
            var wi = e > 0.55 ? 2 : (e > 0.25 ? 1 : 0);
            var bk = (ci * 3 + ai) * 3 + wi;
            bucketOf[i] = bk; counts[bk]++;
            var o = i * 4;
            segs[o] = cx - nx * half; segs[o + 1] = cy - ny * half; segs[o + 2] = cx + nx * half; segs[o + 3] = cy + ny * half;
          }
  
          var pos = 0;
          for (b = 0; b < BUCKETS; b++) { starts[b] = pos; fill[b] = pos; pos += counts[b]; }
          for (i = 0; i < N; i++) { if (bucketOf[i] >= 0) order[fill[bucketOf[i]]++] = i; }
  
          // Draw the dashes one bucket at a time: a few dozen strokes per frame.
          ctx.lineCap = 'round';
          for (b = 0; b < BUCKETS; b++) {
            if (!counts[b]) continue;
            ctx.globalAlpha = ALPHAS[Math.floor(b / 3) % 3];
            ctx.strokeStyle = lut[Math.floor(b / 9)];
            ctx.lineWidth = WEIGHTS[b % 3] * dash;
            ctx.beginPath();
            for (var j = starts[b], end = starts[b] + counts[b]; j < end; j++) {
              var q = order[j] * 4;
              ctx.moveTo(segs[q], segs[q + 1]);
              ctx.lineTo(segs[q + 2], segs[q + 3]);
            }
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
  
        function frame(now) {
          raf = 0;
          if (destroyed || !onScreen || document.hidden) { last = 0; return; }
          var dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
          last = now;
          step(dt);
          draw();
          raf = requestAnimationFrame(frame);
        }
        function wake() {
          if (!destroyed && !reduce && !raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
        }
        function redrawIfStill() { if (reduce || !raf) draw(); }
  
        resize();
        draw();
        wake();
  
        var io = null, ro = null;
        if (window.IntersectionObserver) {
          io = new IntersectionObserver(function (entries) {
            onScreen = entries.some(function (en) { return en.isIntersecting; });
            wake();
          });
          io.observe(canvas);
        }
        if (window.ResizeObserver) {
          ro = new ResizeObserver(redrawIfStill);
          ro.observe(canvas);
        }
        document.addEventListener('visibilitychange', wake);
        if (!reduce) {
          window.addEventListener('pointermove', onMove, { passive: true });
          window.addEventListener('pointerdown', onMove, { passive: true });
          document.addEventListener('mouseout', onOut);
          window.addEventListener('blur', onBlur);
        }
  
        return {
          setOptions: function (o) {
            for (var key in o) {
              if (Object.prototype.hasOwnProperty.call(DEFAULTS, key) && o[key] !== undefined && o[key] !== null) opt[key] = o[key];
            }
            colorKey = ''; dotKey = '';
            redrawIfStill();
          },
          redraw: draw,
          destroy: function () {
            destroyed = true;
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            if (io) io.disconnect();
            if (ro) ro.disconnect();
            document.removeEventListener('visibilitychange', wake);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerdown', onMove);
            document.removeEventListener('mouseout', onOut);
            window.removeEventListener('blur', onBlur);
          }
        };
      }
      )(canvas, options);
    }
  
    // The same mountNfGradient() as the exported nf-hero-gradient.html; keep the two identical.
    _mount(canvas, options) {
      return (
      function mountNfGradient(canvas, options) {
        var DEFAULTS = {
          // Five colors. Color 5 is the base; colors 1-4 are laid over it in order, so later colors show more.
          colors: ['#FF5E00', '#8A162D', '#000000', '#8518CF', '#2604EB'],
          // The dials
          timeScale: 1,         // overall speed; 0 freezes the motion
          amount: 0.2,          // wave height: how far the surface folds
          waveSize: 1,          // above 1 = broader, fewer waves; below 1 = smaller, busier waves
          softness: 1,          // how gradually one color melts into the next; low = crisp bands
          waveAngle: 0,         // degrees; turns the direction the waves run
          tilt: null,           // degrees above the surface for the camera (90 = straight down); null uses eye
          grain: 0,             // film grain, 0 to about 0.2
          // Base values the dials work from
          speed: 0.02,          // how fast the folds evolve in place
          frequency: [3, 6],    // noise scale across / along the surface before waveSize
          fov: 35,              // camera lens, vertical, in degrees
          eye: [0, 0.5, 0.4],   // camera position; it looks at the center of the plane
          segments: 128,        // mesh resolution; 128 keeps indices 16-bit
          maxDpr: 1.5,          // device-pixel-ratio cap; the image is soft, so more buys nothing
          stillTime: 6,         // the frame shown to people who prefer reduced motion
          timeOffset: 0         // seconds; start further along the loop
        };
        var opt = {};
        for (var key in DEFAULTS) opt[key] = (options && options[key] !== undefined && options[key] !== null) ? options[key] : DEFAULTS[key];
  
        var gl = null;
        try {
          gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
        } catch (e) { gl = null; }
        if (!gl) return null;
  
        var NOISE = [
          'vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}',
          'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
          'float snoise(vec3 v){',
          '  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);',
          '  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);',
          '  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);',
          '  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+2.0*C.xxx; vec3 x3=x0-1.0+3.0*C.xxx;',
          '  i=mod(i,289.0);',
          '  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
          '  float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;',
          '  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);',
          '  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);',
          '  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);',
          '  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));',
          '  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
          '  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);',
          '  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
          '  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;',
          '  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;',
          '  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
          '}'
        ].join('\n');
  
        // Vertex stage: fold the plane, then blend the five colors with four noise layers.
        var VERT = [
          'attribute vec2 aUv;',
          'uniform mat4 uProj; uniform mat4 uView;',
          'uniform vec2 uFrequency; uniform float uTime; uniform float uAmount; uniform float uSpeed;',
          'uniform float uAngle; uniform float uSoftness;',
          'uniform vec3 uColor[5];',
          'varying vec3 vColor;',
          NOISE,
          'void main(){',
          '  vec2 r=aUv-0.5; float ca=cos(uAngle), sa=sin(uAngle);',
          '  vec2 nc=(vec2(ca*r.x-sa*r.y, sa*r.x+ca*r.y)+0.5)*uFrequency;',
          '  float n=snoise(vec3(nc.x+uTime*0.02,nc.y,uTime*uSpeed));',
          '  vec3 pos=vec3((aUv.x-0.5)*1.5, n*uAmount, -(aUv.y-0.5)*1.5);',
          '  vec3 col=uColor[4];',
          '  for(int i=0;i<4;i++){',
          '    float fi=float(i);',
          '    float k=smoothstep(0.1,0.1+(0.5+fi*0.08)*uSoftness,snoise(vec3(nc.x*0.3+uTime*(0.0002+fi*0.05),nc.y*0.6,uTime*(0.0001+fi*0.03)+1.0+fi*10.0)));',
          '    col=mix(col,uColor[i],k);',
          '  }',
          '  vColor=col;',
          '  gl_Position=uProj*uView*vec4(pos,1.0);',
          '}'
        ].join('\n');
        // Fragment stage: the interpolated color, plus optional film grain.
        var FRAG = [
          '#ifdef GL_FRAGMENT_PRECISION_HIGH',
          'precision highp float;',
          '#else',
          'precision mediump float;',
          '#endif',
          'varying vec3 vColor;',
          'uniform float uGrain; uniform float uSeed;',
          'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
          'void main(){',
          '  vec3 c=vColor;',
          '  if(uGrain>0.0){ c+=(hash(gl_FragCoord.xy+uSeed)-0.5)*uGrain; }',
          '  gl_FragColor=vec4(c,1.0);',
          '}'
        ].join('\n');
  
        function compile(type, src) {
          var s = gl.createShader(type);
          gl.shaderSource(s, src);
          gl.compileShader(s);
          return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
        }
        var vs = compile(gl.VERTEX_SHADER, VERT);
        var fs = compile(gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return null;
        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
        gl.useProgram(prog);
  
        // A 1.5 x 1.5 plane lying flat; positions are built in the shader from uv.
        var N = Math.max(8, Math.min(254, opt.segments | 0)), V = N + 1;
        var uv = new Float32Array(V * V * 2), q = 0, x, y;
        for (y = 0; y <= N; y++) { for (x = 0; x <= N; x++) { uv[q++] = x / N; uv[q++] = y / N; } }
        var idx = new Uint16Array(N * N * 6);
        q = 0;
        for (y = 0; y < N; y++) {
          for (x = 0; x < N; x++) {
            var a = y * V + x, b = a + 1, c = a + V, d = c + 1;
            idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c;
          }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
        var aUv = gl.getAttribLocation(prog, 'aUv');
        gl.enableVertexAttribArray(aUv);
        gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  
        function U(name) { return gl.getUniformLocation(prog, name); }
        var uProj = U('uProj'), uView = U('uView'), uTime = U('uTime'), uColor = U('uColor');
        var uFrequency = U('uFrequency'), uAmount = U('uAmount'), uSpeed = U('uSpeed');
        var uAngle = U('uAngle'), uSoftness = U('uSoftness'), uGrain = U('uGrain'), uSeed = U('uSeed');
  
        function num(v, fallback) { v = +v; return isFinite(v) ? v : fallback; }
  
        function applyShape() {
          var f = opt.frequency || DEFAULTS.frequency;
          var size = Math.max(0.05, num(opt.waveSize, 1));
          gl.uniform2f(uFrequency, num(f[0], 3) / size, num(f[1], 6) / size);
          gl.uniform1f(uAmount, num(opt.amount, 0.2));
          gl.uniform1f(uSpeed, num(opt.speed, 0.02));
          gl.uniform1f(uAngle, num(opt.waveAngle, 0) * Math.PI / 180);
          gl.uniform1f(uSoftness, Math.max(0.02, num(opt.softness, 1)));
          gl.uniform1f(uGrain, Math.max(0, num(opt.grain, 0)));
        }
  
        // Camera: look at the origin, y up. tilt (degrees above the surface) overrides eye when set.
        function applyCamera() {
          var e = opt.eye || DEFAULTS.eye;
          if (opt.tilt !== null && opt.tilt !== undefined && isFinite(+opt.tilt)) {
            var dist = Math.hypot(e[0], e[1], e[2]) || 0.64;
            var t = Math.max(1, Math.min(90, +opt.tilt)) * Math.PI / 180;
            e = [0, dist * Math.sin(t), dist * Math.cos(t)];
          }
          var len = Math.hypot(e[0], e[1], e[2]) || 1;
          var z = [e[0] / len, e[1] / len, e[2] / len];
          var up = Math.abs(z[1]) > 0.999 ? [0, 0, -1] : [0, 1, 0];
          var xa = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
          var xl = Math.hypot(xa[0], xa[1], xa[2]) || 1;
          xa = [xa[0] / xl, xa[1] / xl, xa[2] / xl];
          var ya = [z[1] * xa[2] - z[2] * xa[1], z[2] * xa[0] - z[0] * xa[2], z[0] * xa[1] - z[1] * xa[0]];
          function dot(u, v) { return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]; }
          gl.uniformMatrix4fv(uView, false, new Float32Array([
            xa[0], ya[0], z[0], 0,
            xa[1], ya[1], z[1], 0,
            xa[2], ya[2], z[2], 0,
            -dot(xa, e), -dot(ya, e), -dot(z, e), 1
          ]));
        }
        function projection(aspect) {
          var fovy = num(opt.fov, 35) * Math.PI / 180, near = 0.1, far = 100;
          var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
          return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
        }
  
        // Colors are drawn exactly as given (sRGB hex, no color-space conversion).
        function parse(hex) {
          var h = String(hex || '').replace('#', '').trim();
          if (h.length === 3) h = h.split('').map(function (ch) { return ch + ch; }).join('');
          var v = parseInt((h + '000000').slice(0, 6), 16) || 0;
          return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
        }
        var colorKey = '';
        function applyColors() {
          var cols = (opt.colors || DEFAULTS.colors).slice(0, 5);
          while (cols.length < 5) cols.push(DEFAULTS.colors[cols.length]);
          var key = cols.join('|');
          if (key === colorKey) return;
          colorKey = key;
          var flat = [];
          cols.forEach(function (c) { flat.push.apply(flat, parse(c)); });
          gl.uniform3fv(uColor, new Float32Array(flat));
        }
  
        var lastW = 0, lastH = 0;
        function resize() {
          var dpr = Math.min(window.devicePixelRatio || 1, num(opt.maxDpr, 1.5));
          var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
          var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
          if (w === lastW && h === lastH) return;
          lastW = w; lastH = h;
          canvas.width = w; canvas.height = h;
          gl.viewport(0, 0, w, h);
          gl.uniformMatrix4fv(uProj, false, projection(w / h));
        }
  
        applyShape();
        applyCamera();
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0, 0, 0, 1);
  
        var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var elapsed = num(opt.timeOffset, 0), last = 0, raf = 0, onScreen = true, destroyed = false;
  
        function draw() {
          if (destroyed) return;
          resize();
          applyColors();
          var t = reduce ? num(opt.stillTime, 6) : elapsed;
          gl.uniform1f(uTime, t);
          gl.uniform1f(uSeed, reduce ? 1 : (Math.floor(t * 24) % 997) + 1);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
        }
        function frame(now) {
          raf = 0;
          if (destroyed || !onScreen || document.hidden) { last = 0; return; }
          if (last) elapsed += Math.min((now - last) / 1000, 0.1) * Math.max(0, num(opt.timeScale, 1));
          last = now;
          draw();
          raf = requestAnimationFrame(frame);
        }
        function wake() {
          if (!destroyed && !reduce && !raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
        }
        function redrawIfStill() { if (reduce || !raf) draw(); }
  
        draw();
        wake();
  
        // Pause when scrolled away or when the tab is hidden; redraw on resize.
        var io = null, ro = null;
        if (window.IntersectionObserver) {
          io = new IntersectionObserver(function (entries) {
            onScreen = entries.some(function (en) { return en.isIntersecting; });
            wake();
          });
          io.observe(canvas);
        }
        if (window.ResizeObserver) {
          ro = new ResizeObserver(redrawIfStill);
          ro.observe(canvas);
        }
        document.addEventListener('visibilitychange', wake);
  
        return {
          setColors: function (colors) { opt.colors = (colors || []).slice(0, 5); redrawIfStill(); },
          setOptions: function (o) {
            for (var k in o) { if (Object.prototype.hasOwnProperty.call(DEFAULTS, k) && k !== 'segments') opt[k] = o[k]; }
            applyShape(); applyCamera(); lastW = 0; colorKey = '';
            redrawIfStill();
          },
          redraw: draw,
          destroy: function () {
            destroyed = true;
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            if (io) io.disconnect();
            if (ro) ro.disconnect();
            document.removeEventListener('visibilitychange', wake);
            var lose = gl.getExtension('WEBGL_lose_context');
            if (lose) lose.loseContext();
          }
        };
      }
      )(canvas, options);
    }
  }

  // Videos: phone or desktop file, loaded only near the screen, paused off screen.
  function setupVideos() {
    var phone = window.matchMedia('(max-width: 860px)').matches;
    var vids = document.querySelectorAll('video.nf-video');
    var start = function (el) {
      if (!el.src) {
        el.poster = phone ? el.dataset.posterM : el.dataset.poster;
        el.src = phone ? el.dataset.srcM : el.dataset.src;
      }
      var r = el.play(); if (r && r.catch) r.catch(function () {});
    };
    vids.forEach(function (el) {
      el.muted = true; el.defaultMuted = true;
      el.poster = phone ? el.dataset.posterM : el.dataset.poster;
      if (el.hasAttribute('data-controls') && !phone) el.controls = true;
    });
    if (!('IntersectionObserver' in window)) { vids.forEach(start); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) start(e.target); else if (e.target.src) e.target.pause(); });
    }, { rootMargin: '400px 0px' });
    vids.forEach(function (el) { io.observe(el); });
  }

  function boot() {
    var page = new Component(PROPS);
    page.componentDidMount();
    setupVideos();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
