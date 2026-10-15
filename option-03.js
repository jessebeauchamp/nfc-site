// Option 03 hero: the Ø as real-time liquid glass. The symbol is raymarched as a rounded,
// extruded solid; light refracts through it (with a slight split into colours) and picks up
// brand-coloured LED pillars behind it. It tilts toward the cursor and turns as you scroll.
(function () {
  'use strict';
  var hero = document.querySelector('.o3-hero');
  if (!hero) return;
  var canvas = hero.querySelector('.o3-gl');
  var phone = window.matchMedia('(max-width: 860px)').matches;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  var VS = '#version 300 es\nin vec2 a_pos;\nvoid main() { gl_Position = vec4(a_pos, 0.0, 1.0); }\n';
  var FS = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_center;   // the symbol's centre in canvas pixels (y from the bottom)
uniform float u_scale;   // canvas pixels per unit; the symbol's outer radius is 1 unit
uniform mat3 u_inv;      // world to symbol rotation
uniform float u_fade;
uniform vec2 u_light;    // cursor, -1 to 1
uniform vec3 u_calm;     // direction and edge of the quiet area behind the headline
uniform float u_ss;      // 2 = two samples on glass pixels, for smoother edges
out vec4 outColor;

const float CAM = 6.0;   // camera distance
const float BACK = 2.8;  // the light wall sits this far behind the symbol
const float IOR = 1.5;

vec3 lin(vec3 c) { return c * c; }
vec3 palette(float x) {                       // brand colours, cool to warm
  vec3 a = lin(vec3(0.149, 0.016, 0.922));    // #2604eb
  vec3 b = lin(vec3(0.522, 0.094, 0.812));    // #8518cf
  vec3 c = lin(vec3(0.878, 0.188, 0.416));    // #e0306a
  vec3 d = lin(vec3(1.0, 0.369, 0.0));        // #ff5e00
  vec3 e = lin(vec3(1.0, 0.69, 0.439));       // #ffb070
  x = clamp(x, 0.0, 1.0) * 4.0;
  if (x < 1.0) return mix(a, b, x);
  if (x < 2.0) return mix(b, c, x - 1.0);
  if (x < 3.0) return mix(c, d, x - 2.0);
  return mix(d, e, x - 3.0);
}
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

// ---- The Ø: ring plus slash with flat-cut ends (from NFC Symbol.svg), rounded and extruded.
float sdSym2(vec2 p) {
  float ring = abs(length(p) - 0.787) - 0.213;
  float band = abs(dot(p, vec2(0.7605, -0.6494))) - 0.135;
  float slash = max(band, abs(p.y) - 0.956);
  return min(ring, slash);
}
float map(vec3 pw) {
  vec3 p = u_inv * pw;
  float d2 = sdSym2(p.xy);
  const float h = 0.2;
  const float rr = 0.085;
  vec2 w = vec2(d2 + rr, abs(p.z) - h + rr);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - rr;
}
vec3 nrm(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0012;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

// ---- Light: a wall of LED pillars behind, a studio around for reflections.
vec3 backdrop(vec2 q) {
  q += u_light * vec2(0.18, 0.1);
  vec3 col = vec3(0.0025, 0.0025, 0.004);
  vec2 hq = q - vec2(0.3, 0.2);
  col += lin(vec3(0.20, 0.07, 0.55)) * 0.16 * exp(-dot(hq, hq) * 0.3);
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float x = -4.0 + fi * 1.0 + 0.28 * sin(u_time * 0.11 + fi * 1.9);
    float w = 0.028 + 0.026 * fract(fi * 0.618 + 0.2);
    float pulse = 0.55 + 0.45 * sin(u_time * 0.35 + fi * 2.3);
    float dx = q.x - x;
    float core = exp(-dx * dx / (w * w));
    float halo = exp(-dx * dx / (w * w * 60.0));
    float vy = smoothstep(3.4, 0.6, abs(q.y - 0.3 + 0.2 * sin(fi * 1.3)));
    col += palette(fi / 8.0) * (core * 2.6 + halo * 0.2) * pulse * vy;
  }
  float fy = q.y + 2.5;
  col += lin(vec3(1.0, 0.369, 0.0)) * 0.4 * exp(-fy * fy * 60.0) * smoothstep(4.5, 0.0, abs(q.x - 0.4));
  float calm = smoothstep(u_calm.z - 1.8, u_calm.z, dot(q, u_calm.xy));
  return col * mix(0.12, 1.0, calm);
}
vec3 env(vec3 d) {
  vec3 col = vec3(0.004, 0.004, 0.007) + lin(vec3(0.12, 0.06, 0.3)) * 0.25 * max(d.y, 0.0);
  vec3 kd = normalize(vec3(-0.55 + u_light.x * 0.35, 0.72 + u_light.y * 0.25, 0.6));
  col += vec3(1.0, 0.97, 0.94) * smoothstep(0.93, 0.99, dot(d, kd)) * 4.0;
  col += vec3(0.9, 0.95, 1.0) * smoothstep(0.985, 0.995, dot(d, normalize(vec3(0.6, 0.55, 0.6)))) * 3.0;
  float sr = smoothstep(0.22, 0.0, abs(d.x - 0.9)) * smoothstep(0.8, 0.4, abs(d.y));
  float sl = smoothstep(0.22, 0.0, abs(d.x + 0.9)) * smoothstep(0.8, 0.4, abs(d.y));
  col += lin(vec3(1.0, 0.369, 0.0)) * sr * 2.5 + lin(vec3(0.149, 0.016, 0.922)) * sl * 3.0;
  col += lin(vec3(0.878, 0.188, 0.416)) * smoothstep(0.88, 1.0, d.y) * 1.2;
  return col;
}
vec3 behind(vec3 ro, vec3 rd) {
  if (rd.z < -0.02) return backdrop(ro.xy + rd.xy * ((-BACK - ro.z) / rd.z));
  return env(rd);
}

// ---- Glass: reflect, refract in, travel through, refract out per colour.
vec3 glass(vec3 p, vec3 rd) {
  vec3 n = nrm(p);
  float cosi = clamp(dot(-rd, n), 0.0, 1.0);
  float F = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
  vec3 refl = env(reflect(rd, n));
  vec3 ri = refract(rd, n, 1.0 / IOR);
  vec3 pi = p - n * 0.003;
  vec3 pe = pi;
  float t = 0.0;
  for (int i = 0; i < 40; i++) {
    pe = pi + ri * t;
    float d = -map(pe);
    if (d < 0.0008) break;
    t += max(d, 0.003);
  }
  vec3 ne = nrm(pe);
  float ce = clamp(dot(ri, ne), 0.0, 1.0);
  vec3 pex = pe + ne * 0.004;
  vec3 tir = env(reflect(ri, ne)) * 0.55;      // light bounced back inside
  vec3 T;
  float eR = IOR - 0.045, eG = IOR, eB = IOR + 0.05;
  T.r = mix(tir.r, behind(pex, refract(ri, -ne, eR)).r, smoothstep(0.0, 0.25, 1.0 - eR * eR * (1.0 - ce * ce)));
  T.g = mix(tir.g, behind(pex, refract(ri, -ne, eG)).g, smoothstep(0.0, 0.25, 1.0 - eG * eG * (1.0 - ce * ce)));
  T.b = mix(tir.b, behind(pex, refract(ri, -ne, eB)).b, smoothstep(0.0, 0.25, 1.0 - eB * eB * (1.0 - ce * ce)));
  T *= exp(-t * vec3(0.10, 0.07, 0.03));       // barely tinted: clear glass
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + (1.0 - cosi) * 1.6 + 0.1));
  return mix(T, refl * mix(vec3(1.0), irid, 0.35), F);
}

vec3 tonemap(vec3 col) {
  col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);
  return sqrt(col);
}
// One camera ray. w = 1 when it touched the glass.
vec4 render(vec2 fc) {
  vec2 q0 = (fc - u_center) / u_scale;
  vec3 ro = vec3(0.0, 0.0, CAM);
  vec3 rd = normalize(vec3(q0, -CAM));
  vec3 col = behind(ro, rd);
  float touched = 0.0;
  float b = dot(ro, rd);
  float c = dot(ro, ro) - 1.44 * 1.44;          // bounding sphere
  float h = b * b - c;
  if (h > 0.0) {
    h = sqrt(h);
    float t = -b - h, tEnd = -b + h;
    float dmin = 1e9, tmin = t;
    bool hit = false;
    for (int i = 0; i < 128; i++) {
      float d = map(ro + rd * t);
      if (d < dmin) { dmin = d; tmin = t; }
      if (d < 0.0005) { hit = true; break; }
      t += d * 0.9;
      if (t > tEnd) break;
    }
    float pw = 1.4 * (tmin / CAM) / u_scale;    // one pixel, in scene units, for soft edges
    if (hit || dmin < pw) {
      vec3 g = glass(ro + rd * (hit ? t : tmin), rd);
      col = mix(col, g, hit ? 1.0 : 1.0 - smoothstep(0.0, pw, dmin));
      touched = 1.0;
    }
  }
  return vec4(tonemap(col * u_fade), touched);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec4 a = render(fc + vec2(-0.25, 0.25) * (u_ss - 1.0));
  vec3 col = a.rgb;
  if (u_ss > 1.5 && a.w > 0.5) col = 0.5 * (col + render(fc + vec2(0.25, -0.25)).rgb);
  col += (hash(fc + fract(u_time) * 97.0) - 0.5) * (1.5 / 255.0);
  outColor = vec4(col, 1.0);
}
`;

  var gl = null, U = {};
  try {
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  } catch (e) { gl = null; }
  if (!gl || !initGL()) { hero.classList.add('o3-nogl'); return; }

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
    ['u_res', 'u_time', 'u_center', 'u_scale', 'u_inv', 'u_fade', 'u_light', 'u_calm', 'u_ss']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    return true;
  }

  // ---------- Size, placement, quality
  var W = 0, H = 0, dpr = 1, quality = 1, ss = phone ? 1 : 2;
  function resize() {
    W = hero.clientWidth; H = hero.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.5) * quality;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }
  function place() {
    if (phone) return { x: W * 0.5, y: H * 0.33, r: Math.min(W * 0.34, H * 0.19) };
    return { x: W * 0.7, y: H * 0.46, r: Math.min(H * 0.29, W * 0.215) };
  }

  // ---------- Rotation (row-major R = Ry * Rx * Rz; sent as-is it reads as R transposed)
  function mul(a, b) {
    var o = new Array(9);
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
    return o;
  }
  function rotation(yaw, pitch, roll) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch), cz = Math.cos(roll), sz = Math.sin(roll);
    return mul(mul([cy, 0, sy, 0, 1, 0, -sy, 0, cy], [1, 0, 0, 0, cx, -sx, 0, sx, cx]), [cz, -sz, 0, sz, cz, 0, 0, 0, 1]);
  }

  var ptr = { x: 0, y: 0 }, ps = { x: 0, y: 0 };
  window.addEventListener('pointermove', function (e) {
    ptr.x = clamp(e.clientX / window.innerWidth * 2 - 1, -1, 1);
    ptr.y = clamp(e.clientY / window.innerHeight * 2 - 1, -1, 1);
  }, { passive: true });

  var cur = { yaw: reduce ? 0.25 : -1.25, pitch: reduce ? -0.12 : 0.3, roll: 0 };
  var t0 = performance.now(), last = t0, raf = 0, visible = true;
  var times = [], settled = false;

  function draw(now) {
    var t = (now - t0) / 1000;
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    var intro = reduce ? 1 : 1 - Math.pow(1 - clamp(t / 2.6, 0, 1), 3);
    var k = 1 - Math.exp(-dt * 2.2);
    ps.x += (ptr.x - ps.x) * k; ps.y += (ptr.y - ps.y) * k;
    var s = clamp(window.scrollY / Math.max(1, H), 0, 1.2);
    var yaw = (1 - intro) * -1.25 + (reduce ? 0.25 : 0.34 * Math.sin(t * 0.21) + ps.x * 0.5) + s * 1.2;
    var pitch = (1 - intro) * 0.3 + (reduce ? -0.12 : 0.13 * Math.sin(t * 0.16 + 1.0) - ps.y * 0.34) + s * 0.3;
    var roll = reduce ? 0 : 0.05 * Math.sin(t * 0.12);
    var follow = intro < 1 ? 1 : 1 - Math.exp(-dt * 3.0);
    cur.yaw += (yaw - cur.yaw) * follow;
    cur.pitch += (pitch - cur.pitch) * follow;
    cur.roll += (roll - cur.roll) * follow;

    var pl = place();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.u_res, canvas.width, canvas.height);
    gl.uniform1f(U.u_time, reduce ? 4.0 : t);
    gl.uniform2f(U.u_center, pl.x * dpr, (H - pl.y) * dpr);
    gl.uniform1f(U.u_scale, pl.r * dpr);
    gl.uniformMatrix3fv(U.u_inv, false, new Float32Array(rotation(cur.yaw, cur.pitch, cur.roll)));
    gl.uniform1f(U.u_fade, reduce ? 1 : smooth(0.0, 1.4, t));
    gl.uniform2f(U.u_light, ps.x, -ps.y);
    if (phone) gl.uniform3f(U.u_calm, 0, 1, -1.2); else gl.uniform3f(U.u_calm, 1, 0, -1.2);
    gl.uniform1f(U.u_ss, ss);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(now) {
    raf = 0;
    var prev = last;
    draw(now);
    // If the device struggles after the intro, render fewer pixels.
    if (!settled && now - t0 > 3000) {
      times.push(now - prev);
      if (times.length >= 45) {
        var avg = times.reduce(function (a, b) { return a + b; }, 0) / times.length;
        times = [];
        if (avg > 24 && ss > 1) ss = 1;                                   // first drop the extra edge sample
        else if (avg > 24 && quality > 0.55) { quality *= 0.8; resize(); } // then render fewer pixels
        else settled = true;
      }
    }
    if (visible && !document.hidden && !reduce) raf = requestAnimationFrame(tick);
  }
  function wake() {
    if (reduce) { draw(performance.now()); return; }
    if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  resize();
  if (window.ResizeObserver) new ResizeObserver(function () { resize(); wake(); }).observe(hero);
  else window.addEventListener('resize', function () { resize(); wake(); });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; wake(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', wake);
  wake();
})();
