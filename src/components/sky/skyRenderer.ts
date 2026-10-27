import type { SkyCondition, SkyPhase, SkyScene } from './skyScene';

/**
 * Procedural sky renderer (Canvas 2D). Everything is drawn from gradients and particles —
 * no image assets — and every frame derives from the scene, so the sky always matches the
 * reported weather. `draw(t)` renders one frame at time `t` (ms); the caller owns the loop.
 */

type Rgb = readonly [number, number, number];

const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];
const rgb = (c: Rgb, alpha = 1) =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;

/** Clear-sky gradient stops (top, horizon) per phase. */
const CLEAR_SKY: Record<SkyPhase, readonly [Rgb, Rgb]> = {
  dawn: [
    [52, 84, 142],
    [244, 176, 140],
  ],
  day: [
    [42, 116, 204],
    [152, 204, 240],
  ],
  dusk: [
    [46, 58, 120],
    [236, 128, 96],
  ],
  night: [
    [6, 14, 34],
    [24, 44, 78],
  ],
};
/** Overcast tint the sky moves towards with cloud cover / precipitation. */
const OVERCAST: Record<SkyPhase, readonly [Rgb, Rgb]> = {
  dawn: [
    [96, 104, 122],
    [168, 160, 158],
  ],
  day: [
    [110, 128, 148],
    [176, 188, 200],
  ],
  dusk: [
    [70, 74, 98],
    [130, 112, 116],
  ],
  night: [
    [18, 24, 36],
    [36, 44, 58],
  ],
};

/** Deterministic pseudo-random sequence so the sky is stable between frames and reloads. */
const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

interface Cloud {
  x: number;
  y: number;
  scale: number;
  layer: number;
  puffs: { dx: number; dy: number; r: number }[];
}
interface Drop {
  x: number;
  y: number;
  speed: number;
  length: number;
  drift: number;
}
interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
}

const overcastAmount = (scene: SkyScene) => {
  const weather: Partial<Record<SkyCondition, number>> = {
    rain: 0.75,
    storm: 0.95,
    snow: 0.6,
    fog: 0.7,
    cloudy: 0.65,
  };
  return Math.min(1, Math.max(scene.cloudCover * 0.7, weather[scene.condition] ?? 0));
};

export class SkyRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private clouds: Cloud[] = [];
  private drops: Drop[] = [];
  private stars: Star[] = [];
  private nextFlash = 0;
  private flashStart = -1;
  private scene: SkyScene;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    scene: SkyScene
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.scene = scene;
  }

  setScene(scene: SkyScene) {
    const changed =
      scene.condition !== this.scene.condition ||
      Math.abs(scene.intensity - this.scene.intensity) > 0.1 ||
      Math.abs(scene.cloudCover - this.scene.cloudCover) > 0.1;
    this.scene = scene;
    if (changed) this.populate();
  }

  /** Size in CSS pixels; the backing store is capped at 2× for battery and memory. */
  resize(width: number, height: number) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.populate();
  }

  private populate() {
    const { width, height, scene } = this;
    if (!width || !height) return;
    const random = seeded(81);
    const area = (width * height) / (1280 * 800);

    // Clouds: three depth layers; nearer layers are larger, lower and faster.
    const cloudCount = Math.round((2 + scene.cloudCover * 9) * Math.max(0.6, Math.sqrt(area)));
    this.clouds = Array.from({ length: cloudCount }, (_, index) => {
      const layer = index % 3;
      const scale = (0.6 + random() * 0.7) * (0.7 + layer * 0.35) * Math.max(0.7, width / 1280);
      return {
        x: random() * (width + 600) - 300,
        y: height * (0.04 + random() * 0.42) + layer * height * 0.06,
        scale,
        layer,
        puffs: Array.from({ length: 5 + Math.floor(random() * 4) }, () => ({
          dx: (random() - 0.5) * 260,
          dy: (random() - 0.5) * 50,
          r: 50 + random() * 70,
        })),
      };
    });

    const wet =
      scene.condition === 'rain' || scene.condition === 'storm' || scene.condition === 'snow';
    const dropCount = wet
      ? Math.round(
          (scene.condition === 'snow' ? 90 : 160) * (0.4 + scene.intensity) * Math.max(0.5, area)
        )
      : 0;
    this.drops = Array.from({ length: dropCount }, () => ({
      x: random() * width,
      y: random() * height,
      speed: scene.condition === 'snow' ? 0.03 + random() * 0.04 : 0.9 + random() * 0.7,
      length: scene.condition === 'snow' ? 1.4 + random() * 2.4 : 10 + random() * 16,
      drift: random() * Math.PI * 2,
    }));

    this.stars = Array.from({ length: Math.round(140 * Math.max(0.5, area)) }, () => ({
      x: random() * width,
      y: random() * height * 0.7,
      r: 0.4 + random() * 1.1,
      phase: random() * Math.PI * 2,
    }));
  }

  draw(t: number) {
    const { ctx, width, height, scene } = this;
    if (!width || !height) return;
    const overcast = overcastAmount(scene);
    const [clearTop, clearHorizon] = CLEAR_SKY[scene.phase];
    const [greyTop, greyHorizon] = OVERCAST[scene.phase];
    const top = mix(clearTop, greyTop, overcast);
    const horizon = mix(clearHorizon, greyHorizon, overcast);

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, rgb(top));
    sky.addColorStop(1, rgb(horizon));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    this.drawLight(overcast);
    if (scene.phase === 'night' && overcast < 0.6) this.drawStars(t, 1 - overcast / 0.6);
    this.drawClouds(t, overcast);
    if (scene.condition === 'fog') this.drawFog(t);
    if (scene.condition === 'snow') this.drawSnow(t);
    else if (this.drops.length) this.drawRain(t);
    if (scene.condition === 'storm') this.drawLightning(t);
  }

  /** Sun or moon glow; washed out as the sky clouds over. */
  private drawLight(overcast: number) {
    const { ctx, width, height, scene } = this;
    const strength = 1 - overcast * 0.85;
    if (strength <= 0.05) return;
    const night = scene.phase === 'night';
    const x = width * (scene.phase === 'dawn' ? 0.18 : scene.phase === 'dusk' ? 0.82 : 0.78);
    const y = height * (scene.phase === 'day' || night ? 0.14 : 0.42);
    const radius = Math.max(width, height) * (night ? 0.22 : 0.45);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const color: Rgb = night
      ? [210, 225, 255]
      : scene.phase === 'day'
        ? [255, 248, 225]
        : [255, 196, 150];
    glow.addColorStop(0, rgb(color, (night ? 0.22 : 0.55) * strength));
    glow.addColorStop(1, rgb(color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    if (night) {
      ctx.fillStyle = rgb([236, 242, 255], 0.85 * strength);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(10, width * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawStars(t: number, visibility: number) {
    const { ctx } = this;
    for (const star of this.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(t / 900 + star.phase);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * twinkle * visibility})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Volumetric-looking clouds: each puff is drawn twice — a darker underside, then a lit top
   * offset upwards — so clouds read as lit from above. They drift with the wind; nearer
   * layers are larger and faster (parallax).
   */
  private drawClouds(t: number, overcast: number) {
    const { ctx, width, scene } = this;
    const phase = scene.phase;
    const lit: Rgb =
      phase === 'night' ? [104, 120, 150] : phase === 'day' ? [255, 255, 255] : [255, 214, 190];
    const shadow: Rgb =
      phase === 'night' ? [22, 30, 46] : phase === 'day' ? [168, 182, 202] : [150, 120, 130];
    // Heavier weather darkens both sides of the cloud.
    const litTone = mix(lit, shadow, overcast * 0.45);
    const shadowTone = mix(shadow, [60, 68, 82], overcast * 0.5);
    const wind = 4 + scene.windSpeed * 3;
    const span = width + 700;
    for (const cloud of this.clouds) {
      const speed = wind * (0.35 + cloud.layer * 0.4);
      const x = ((((cloud.x + (t / 1000) * speed) % span) + span) % span) - 350;
      const alpha = (0.32 + cloud.layer * 0.16) * (0.6 + overcast * 0.5);
      for (const [tone, lift, weight] of [
        [shadowTone, 0.12, 0.9],
        [litTone, -0.22, 1],
      ] as const) {
        for (const puff of cloud.puffs) {
          const r = puff.r * cloud.scale;
          const px = x + puff.dx * cloud.scale;
          const py = cloud.y + puff.dy * cloud.scale + r * lift;
          const g = ctx.createRadialGradient(px, py, r * 0.05, px, py, r);
          g.addColorStop(0, rgb(tone, Math.min(1, alpha * weight)));
          g.addColorStop(0.55, rgb(tone, Math.min(1, alpha * weight * 0.55)));
          g.addColorStop(1, rgb(tone, 0));
          ctx.fillStyle = g;
          ctx.fillRect(px - r, py - r, r * 2, r * 2);
        }
      }
    }
  }

  /** Rain streaks slanted by the wind, faster and longer in the foreground. */
  private drawRain(t: number) {
    const { ctx, width, height, scene } = this;
    const slant = Math.min(0.55, scene.windSpeed * 0.035);
    const fallPerMs = height / 900;
    ctx.lineCap = 'round';
    ctx.strokeStyle =
      scene.phase === 'night' ? 'rgba(190, 210, 235, 0.35)' : 'rgba(235, 242, 252, 0.5)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const drop of this.drops) {
      const travel = (t * fallPerMs * drop.speed) % (height + 40);
      const y = ((drop.y + travel) % (height + 40)) - 20;
      const x = (((drop.x + y * slant) % width) + width) % width;
      ctx.moveTo(x, y);
      ctx.lineTo(x + drop.length * slant, y + drop.length);
    }
    ctx.stroke();
  }

  /** Snowflakes fall slowly and sway. */
  private drawSnow(t: number) {
    const { ctx, height, width } = this;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const flake of this.drops) {
      const y = ((flake.y + t * flake.speed) % (height + 20)) - 10;
      const x = flake.x + Math.sin(t / 1400 + flake.drift) * 18;
      ctx.beginPath();
      ctx.arc(((x % width) + width) % width, y, flake.length, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Low drifting haze bands. */
  private drawFog(t: number) {
    const { ctx, width, height } = this;
    for (let band = 0; band < 4; band += 1) {
      const y = height * (0.35 + band * 0.16);
      const shift = Math.sin(t / 9000 + band) * width * 0.08;
      const g = ctx.createLinearGradient(0, y - 80, 0, y + 80);
      g.addColorStop(0, 'rgba(225, 230, 236, 0)');
      g.addColorStop(0.5, `rgba(225, 230, 236, ${0.28 - band * 0.03})`);
      g.addColorStop(1, 'rgba(225, 230, 236, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-width * 0.1 + shift, y - 80, width * 1.2, 160);
    }
  }

  /**
   * Distant lightning: a soft, brief glow behind the clouds every 6–14 s. Never a full-screen
   * white flash, and far below three flashes per second (photosensitivity guidance).
   */
  private drawLightning(t: number) {
    const { ctx, width, height } = this;
    if (this.nextFlash === 0) this.nextFlash = t + 4000;
    if (this.flashStart < 0 && t >= this.nextFlash) {
      this.flashStart = t;
      this.nextFlash = t + 6000 + ((t * 7919) % 8000);
    }
    if (this.flashStart < 0) return;
    const age = t - this.flashStart;
    if (age > 420) {
      this.flashStart = -1;
      return;
    }
    const strength = age < 70 ? age / 70 : Math.max(0, 1 - (age - 70) / 350);
    const x = width * 0.3 + ((this.flashStart * 13) % (width * 0.4));
    const g = ctx.createRadialGradient(x, height * 0.2, 0, x, height * 0.2, width * 0.6);
    g.addColorStop(0, `rgba(220, 228, 255, ${0.32 * strength})`);
    g.addColorStop(1, 'rgba(220, 228, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
}
