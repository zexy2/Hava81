import { useEffect, useRef } from 'react';
import { paletteFor, smooth, type Rgb } from './skyPalette';
import { sunAt, type SkyScene } from './skyScene';

/**
 * A filmed-looking cloud sky behind the weather field, in the spirit of Apple Weather's
 * condition videos — but generated live, so it matches every condition and hour without
 * shipping video. Domain-warped fractal noise gives the slow folding motion of real
 * clouds; a second sample towards the light gives each cloud a lit and a shaded side.
 *
 * Decorative only (aria-hidden). Runs at half resolution and 30 fps, pauses when the tab
 * is hidden or the field is off screen, draws a single still frame for reduced motion and
 * renders nothing when WebGL is unavailable (the field's own colour shows instead).
 */

const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uCover;
uniform float uWind;
uniform float uRain;
uniform float uSnow;
uniform float uStars;
uniform vec2 uSunPos;
uniform vec3 uSunColor;
uniform float uSunGlow;
uniform float uHorizonGlow;
uniform vec2 uLightDir;
uniform float uFog;
uniform float uFlash;
uniform float uPuffy;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uLit;
uniform vec3 uShade;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) { v += a * noise(p); p = r * p * 2.02; a *= 0.5; }
  return v;
}
float clouds(vec2 uv, float t) {
  // Stratus (uPuffy 0): long, wind-combed decks stretched sideways.
  // Cumulus (uPuffy 1): rounder, larger, separate cells with less folding.
  vec2 p = mix(vec2(uv.x * 0.55, uv.y * 1.25), vec2(uv.x * 0.9, uv.y * 1.05), uPuffy);
  float warp = mix(1.8, 0.9, uPuffy);
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.02)), fbm(p + vec2(5.2, 1.3) - t * 0.015));
  return fbm(p * 1.6 + warp * q + vec2(t * uWind, 0.0));
}

// One depth layer of rain: thin streaks in sparse columns, slanted by the wind.
// The pattern scrolls up in its own space, so on screen the streaks fall.
float rainLayer(vec2 uv, float t, float scale, float speed, float seed) {
  vec2 p = uv * vec2(scale, scale * 0.12);
  p.x += p.y * uWind * 9.0;
  float column = floor(p.x);
  float r = hash(vec2(column, seed));
  float y = p.y + t * speed * (0.75 + 0.5 * r) + r * 7.0;
  float cell = fract(y);
  float across = abs(fract(p.x) - 0.5);
  float line = smoothstep(0.16, 0.0, across);
  float streak = smoothstep(0.0, 0.08, cell) * smoothstep(0.55, 0.12, cell);
  float present = step(0.62, hash(vec2(column, floor(y) + seed)));
  return line * streak * present;
}

// One depth layer of snow: soft round flakes drifting down and swaying.
float snowLayer(vec2 uv, float t, float scale, float speed, float seed) {
  vec2 p = uv * scale;
  p.y += t * speed;
  p.x += sin(t * 0.6 + p.y * 0.7 + seed) * 0.35;
  vec2 id = floor(p);
  vec2 local = fract(p) - 0.5;
  vec2 jitter = vec2(hash(id + seed), hash(id + seed + 3.1)) - 0.5;
  float d = length(local - jitter * 0.6);
  float size = 0.06 + 0.08 * hash(id + seed + 7.7);
  return smoothstep(size, size * 0.2, d) * step(0.55, hash(id + seed + 1.3));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.y;
  float y = gl_FragCoord.y / uRes.y;
  float aspect = uRes.x / uRes.y;
  float t = uTime;
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 1.0, y));

  float n = clouds(uv, t);
  float edge = 1.0 - uCover;
  // Cumulus have crisp, defined edges; stratus fade softly into one another.
  float softness = mix(0.32, 0.12, uPuffy);
  float density = smoothstep(edge - 0.05, edge + softness, n);
  // Cumulus sit in the upper sky and thin out towards the horizon, leaving open blue.
  density *= mix(1.0, smoothstep(0.05, 0.55, y), uPuffy);

  // The sun's glow follows its arc across the sky; low suns are larger and redder.
  vec2 sunPos = vec2(uSunPos.x * aspect, uSunPos.y);
  if (uSunGlow > 0.0) {
    float d = length(uv - sunPos);
    sky += uSunColor * (exp(-d * 4.5) * 0.34 + exp(-d * 16.0) * 0.12) * uSunGlow;
  }
  // Sunrise and sunset light a warm band along the horizon, brightest under the sun.
  if (uHorizonGlow > 0.0) {
    float band = exp(-y * 4.5);
    float under = exp(-abs(uv.x - sunPos.x) * 1.6);
    sky += uSunColor * band * (0.35 + 0.65 * under) * 0.45 * uHorizonGlow;
  }
  // Clear night: stars between the clouds, each twinkling at its own pace.
  if (uStars > 0.0) {
    vec2 g = uv * 70.0;
    vec2 id = floor(g);
    float h = hash(id);
    float d = length(fract(g) - 0.5 - (vec2(hash(id + 2.0), hash(id + 5.0)) - 0.5) * 0.6);
    float twinkle = 0.6 + 0.4 * sin(t * (1.0 + h * 2.0) + h * 40.0);
    sky += vec3(0.9, 0.93, 1.0) * smoothstep(0.08, 0.0, d) * step(0.965, h) * twinkle * uStars
      * smoothstep(0.25, 0.75, y);
  }

  // Light from the upper left: the side facing it is brighter than the side away from it.
  // Each cloud is lit from the side facing the sun.
  float towardLight = clouds(uv + uLightDir * 0.06, t);
  // Cumulus: strong sunlit tops and shaded bases. Stratus: a flat, even grey.
  float contrast = mix(2.2, 6.0, uPuffy);
  float light = clamp(0.55 + (towardLight - n) * contrast, 0.0, 1.0);
  light = mix(light, light * 0.7 + 0.3 * smoothstep(0.3, 0.9, y), uPuffy);
  vec3 cloud = mix(uShade, uLit, light);
  vec3 color = mix(sky, cloud, density * 0.92);

  // Lightning lights the cloud deck from inside: dense cloud glows more than open sky.
  color += vec3(0.62, 0.68, 0.85) * uFlash * (0.25 + density * 0.75);

  // Rain darkens the sky a little and falls in three depths: far is faint and slow,
  // near is brighter and faster, which gives the sheet its depth.
  if (uRain > 0.0) {
    color *= 1.0 - 0.18 * uRain;
    float r = rainLayer(uv, t, 140.0, 2.2, 1.0) * 0.35
      + rainLayer(uv, t, 95.0, 3.0, 2.0) * 0.6
      + rainLayer(uv, t, 60.0, 4.2, 3.0);
    color = mix(color, vec3(0.78, 0.84, 0.92), clamp(r, 0.0, 1.0) * 0.42 * uRain);
  }

  if (uSnow > 0.0) {
    float f = snowLayer(uv, t, 22.0, 0.35, 1.0) * 0.5
      + snowLayer(uv, t, 14.0, 0.55, 2.0) * 0.8
      + snowLayer(uv, t, 9.0, 0.8, 3.0);
    color = mix(color, vec3(0.94, 0.96, 1.0), clamp(f, 0.0, 1.0) * 0.8 * uSnow);
  }

  // Fog: a thick, slowly drifting haze that settles towards the ground.
  if (uFog > 0.0) {
    float haze = fbm(vec2(uv.x * 1.2 + t * 0.02, uv.y * 2.5));
    float amount = uFog * (0.35 + 0.45 * smoothstep(0.9, 0.0, y)) * (0.75 + 0.5 * haze);
    color = mix(color, mix(uHorizon, uLit, 0.55), clamp(amount, 0.0, 0.85));
  }

  // Soft vignette and a darker base keep the type and metrics legible.
  vec2 c = gl_FragCoord.xy / uRes - 0.5;
  color *= 1.0 - dot(c, c) * 0.55;
  color *= mix(0.72, 1.0, smoothstep(0.0, 0.55, gl_FragCoord.y / uRes.y));
  gl_FragColor = vec4(min(color, vec3(0.86)), 1.0);
}
`;

const compile = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
};

interface HeroSkyProps {
  scene: SkyScene;
}

function startSky(
  canvas: HTMLCanvasElement,
  sceneRef: { readonly current: SkyScene }
): (() => void) | undefined {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    depth: false,
    powerPreference: 'low-power',
  });
  if (!gl) {
    canvas.hidden = true;
    return undefined;
  }

  // A software rasteriser (no GPU, or acceleration disabled) runs this shader on the CPU:
  // animating it would freeze the page. Such devices — and Save-Data users — get one
  // still frame of the same sky instead.
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(
    gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? ''
  );
  const softwareRenderer = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
  const saveData =
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
    true;
  let stillOnly = softwareRenderer || saveData;

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    canvas.hidden = true;
    return undefined;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    canvas.hidden = true;
    return undefined;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    res: uniform('uRes'),
    time: uniform('uTime'),
    cover: uniform('uCover'),
    wind: uniform('uWind'),
    rain: uniform('uRain'),
    snow: uniform('uSnow'),
    stars: uniform('uStars'),
    sunPos: uniform('uSunPos'),
    sunColor: uniform('uSunColor'),
    sunGlow: uniform('uSunGlow'),
    horizonGlow: uniform('uHorizonGlow'),
    lightDir: uniform('uLightDir'),
    fog: uniform('uFog'),
    flash: uniform('uFlash'),
    puffy: uniform('uPuffy'),
    zenith: uniform('uZenith'),
    horizon: uniform('uHorizon'),
    lit: uniform('uLit'),
    shade: uniform('uShade'),
  };

  // Half resolution: clouds are soft by nature, and it quarters the per-frame cost. The
  // adaptive step below can lower it further on slow GPUs.
  let resolution = 0.5;
  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 2) * resolution;
    const width = Math.max(1, Math.round(canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const rgb = (value: Rgb) => [value[0] / 255, value[1] / 255, value[2] / 255] as const;
  // A fixed offset so even the still frame shows a developed sky, not the noise origin.
  const startedAt = performance.now() - 40_000;
  // Lightning: a double flicker every 5–12 s, never more than ~3 flashes a second. Off for
  // reduced motion (the still frame shows none).
  let nextFlash = performance.now() + 3000;
  let flashStart = -Infinity;
  const flashAt = (now: number) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
    if (now >= nextFlash) {
      flashStart = now;
      nextFlash = now + 5000 + Math.random() * 7000;
    }
    const age = now - flashStart;
    if (age < 0 || age > 700) return 0;
    const first = Math.exp(-age / 70);
    const second = age > 260 ? Math.exp(-(age - 260) / 110) * 0.8 : 0;
    return Math.min(1, first + second) * 0.55;
  };
  const draw = (now: number) => {
    resize();
    const current = sceneRef.current;
    // Recomputed every frame from the real clock, so the sky drifts through the day.
    const sun = sunAt(Date.now(), current.sunrise, current.sunset, current.phase === 'night');
    const palette = paletteFor(current, sun);
    // Partly cloudy keeps at least half the sky open; overcast fills it.
    const cover =
      current.condition === 'clear'
        ? 0.18
        : current.condition === 'partly'
          ? Math.max(0.32, Math.min(0.48, 0.3 + current.cloudCover * 0.25))
          : current.condition === 'cloudy'
            ? Math.max(0.88, Math.min(0.96, 0.6 + current.cloudCover * 0.36))
            : Math.max(0.3, Math.min(0.92, 0.28 + current.cloudCover * 0.64));
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, (now - startedAt) / 1000);
    gl.uniform1f(u.cover, cover);
    gl.uniform1f(u.puffy, current.condition === 'partly' || current.condition === 'clear' ? 1 : 0);
    gl.uniform1f(u.wind, 0.012 + Math.min(current.windSpeed, 15) * 0.0035);
    const wetStrength = 0.45 + 0.55 * current.intensity;
    const open = current.condition === 'clear' || current.condition === 'partly';
    gl.uniform1f(
      u.rain,
      current.condition === 'storm' ? 1 : current.condition === 'rain' ? wetStrength : 0
    );
    gl.uniform1f(u.snow, current.condition === 'snow' ? wetStrength : 0);
    const darkness = smooth(-0.08, -0.45, sun.elevation);
    gl.uniform1f(u.stars, open ? darkness * (current.condition === 'clear' ? 1 : 0.6) : 0);
    // Screen position: east on the left, west on the right. A risen sun climbs quickly into
    // the band above the reading, so its glow never sits behind the big white numeral.
    const height = Math.max(sun.elevation, 0);
    const sunY = 0.1 + 0.88 * Math.sqrt(height);
    gl.uniform2f(u.sunPos, 0.1 + 0.8 * sun.azimuth, sunY);
    const highSun = smooth(0, 0.45, sun.elevation);
    gl.uniform3f(u.sunColor, 1, 0.58 + 0.36 * highSun, 0.32 + 0.5 * highSun);
    const visible = smooth(-0.12, 0.04, sun.elevation);
    gl.uniform1f(u.sunGlow, visible * (open ? (current.condition === 'clear' ? 1 : 0.55) : 0.18));
    gl.uniform1f(u.horizonGlow, Math.exp(-Math.abs(sun.elevation + 0.02) * 9) * (open ? 1 : 0.35));
    // Light direction towards the sun by day; a soft overhead moonlight by night.
    const toward =
      sun.elevation > -0.1 ? [0.1 + 0.8 * sun.azimuth - 0.5, sunY - 0.5] : [-0.35, 0.6];
    const length = Math.hypot(toward[0], toward[1]) || 1;
    gl.uniform2f(u.lightDir, toward[0] / length, toward[1] / length);
    gl.uniform1f(u.fog, current.condition === 'fog' ? 1 : 0);
    gl.uniform1f(u.flash, current.condition === 'storm' ? flashAt(now) : 0);
    gl.uniform3f(u.zenith, ...rgb(palette.zenith));
    gl.uniform3f(u.horizon, ...rgb(palette.horizon));
    gl.uniform3f(u.lit, ...rgb(palette.lit));
    gl.uniform3f(u.shade, ...rgb(palette.shade));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let last = 0;
  let visible = true;
  // Adaptive quality: if frames keep arriving late, first drop resolution and frame rate,
  // then settle on a still frame rather than ever janking the page.
  let interval = 33;
  let slowFrames = 0;
  let sampled = 0;
  const loop = (now: number) => {
    const gap = now - last;
    if (gap < interval) {
      frame = requestAnimationFrame(loop);
      return;
    }
    if (last > 0) {
      sampled += 1;
      if (gap > interval * 2.2) slowFrames += 1;
      if (sampled >= 24) {
        if (slowFrames > 8) {
          if (resolution > 0.3) {
            resolution = 0.3;
            interval = 50;
          } else {
            // Too slow even at the lower quality: stop for good on a still frame.
            stillOnly = true;
            draw(now);
            return;
          }
        }
        sampled = 0;
        slowFrames = 0;
      }
    }
    last = now;
    draw(now);
    frame = requestAnimationFrame(loop);
  };
  const start = () => {
    cancelAnimationFrame(frame);
    last = 0;
    if (stillOnly || reducedMotion?.matches || document.hidden || !visible) {
      draw(performance.now());
      return;
    }
    frame = requestAnimationFrame(loop);
  };

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? true;
          start();
        })
      : null;
  observer?.observe(canvas);
  const resizeObserver =
    typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw(performance.now())) : null;
  resizeObserver?.observe(canvas);
  document.addEventListener('visibilitychange', start);
  reducedMotion?.addEventListener?.('change', start);
  start();

  return () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', start);
    reducedMotion?.removeEventListener?.('change', start);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

export default function HeroSky({ scene }: HeroSkyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useEffect(() => {
    // Nothing runs before the page is idle: shader compilation and the first frames must
    // never compete with first paint or input.
    let teardown: (() => void) | undefined;
    let cancelled = false;
    const run = () => {
      const canvas = canvasRef.current;
      if (!cancelled && canvas) teardown = startSky(canvas, sceneRef);
    };
    const idle =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(run, { timeout: 3000 })
        : window.setTimeout(run, 1500);
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      teardown?.();
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-sky" aria-hidden="true" />;
}
