import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeroSky from '../../components/sky/HeroSky';
import { LivingSky } from '../../components/sky/LivingSky';
import { SkyRenderer } from '../../components/sky/skyRenderer';
import type { SkyCondition, SkyPhase, SkyScene } from '../../components/sky/skyScene';

const sunrise = Date.UTC(2026, 7, 28, 3, 0);
const sunset = Date.UTC(2026, 7, 28, 16, 0);
const scene = (overrides: Partial<SkyScene> = {}): SkyScene => ({
  condition: 'clear',
  phase: 'day',
  cloudCover: 0.2,
  intensity: 0,
  windSpeed: 4,
  sunrise,
  sunset,
  ...overrides,
});

// ── A recording Canvas 2D context ──
const make2d = () => {
  const calls: string[] = [];
  const gradient = { addColorStop: vi.fn() };
  const record =
    (name: string) =>
    (..._args: unknown[]) => {
      calls.push(name);
      return name.startsWith('create') ? gradient : undefined;
    };
  const ctx: Record<string, unknown> = { calls };
  for (const name of [
    'arc',
    'beginPath',
    'createLinearGradient',
    'createRadialGradient',
    'fill',
    'fillRect',
    'lineTo',
    'moveTo',
    'setTransform',
    'stroke',
  ])
    ctx[name] = record(name);
  return ctx as Record<string, unknown> & { calls: string[] };
};

// ── A minimal WebGL context that reports a chosen renderer ──
const makeGl = (renderer: string) => {
  const draws = { count: 0 };
  const lose = vi.fn();
  const gl: Record<string, unknown> = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLES: 8,
    RENDERER: 9,
    draws,
    lose,
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info'
        ? { UNMASKED_RENDERER_WEBGL: 10 }
        : name === 'WEBGL_lose_context'
          ? { loseContext: lose }
          : null,
    getParameter: () => renderer,
    createShader: () => ({}),
    shaderSource: () => undefined,
    compileShader: () => undefined,
    getShaderParameter: () => true,
    createProgram: () => ({}),
    attachShader: () => undefined,
    linkProgram: () => undefined,
    getProgramParameter: () => true,
    useProgram: () => undefined,
    createBuffer: () => ({}),
    bindBuffer: () => undefined,
    bufferData: () => undefined,
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => undefined,
    vertexAttribPointer: () => undefined,
    getUniformLocation: () => ({}),
    viewport: () => undefined,
    uniform1f: () => undefined,
    uniform2f: () => undefined,
    uniform3f: () => undefined,
    drawArrays: () => {
      draws.count += 1;
    },
  };
  return gl;
};

let idleCallbacks: Array<() => void>;
let rafCallbacks: Array<(now: number) => void>;
let reducedMotion = false;

const flushIdle = () =>
  act(() => {
    const pending = idleCallbacks;
    idleCallbacks = [];
    pending.forEach(callback => callback());
  });

beforeEach(() => {
  idleCallbacks = [];
  rafCallbacks = [];
  reducedMotion = false;
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
    idleCallbacks.push(callback);
    return idleCallbacks.length;
  });
  vi.stubGlobal('cancelIdleCallback', vi.fn());
  vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) => {
    rafCallbacks.push(callback);
    return rafCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('reduced-motion') ? reducedMotion : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SkyRenderer', () => {
  const draw = (overrides: Partial<SkyScene>, phase: SkyPhase = 'day') => {
    const ctx = make2d();
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const renderer = new SkyRenderer(canvas, scene({ phase, ...overrides }));
    renderer.resize(800, 600);
    renderer.draw(12_000);
    return ctx.calls;
  };

  it('paints every condition at every phase without throwing', () => {
    const conditions: SkyCondition[] = [
      'clear',
      'partly',
      'cloudy',
      'rain',
      'storm',
      'snow',
      'fog',
    ];
    const phases: SkyPhase[] = ['dawn', 'day', 'dusk', 'night'];
    for (const condition of conditions) {
      for (const phase of phases) {
        const calls = draw({ condition, intensity: 0.8, cloudCover: 0.7 }, phase);
        expect(calls.length, `${condition}/${phase}`).toBeGreaterThan(0);
      }
    }
  });

  it('draws rain streaks only when it rains', () => {
    expect(
      draw({ condition: 'rain', intensity: 0.9 }).filter(c => c === 'stroke').length
    ).toBeGreaterThan(draw({ condition: 'clear' }).filter(c => c === 'stroke').length);
  });

  it('draws stars only on a clear night', () => {
    const arcs = (phase: SkyPhase) =>
      draw({ condition: 'clear' }, phase).filter(c => c === 'arc').length;
    expect(arcs('night')).toBeGreaterThan(arcs('day'));
  });

  it('follows a scene change', () => {
    const ctx = make2d();
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const renderer = new SkyRenderer(canvas, scene());
    renderer.resize(400, 300);
    renderer.setScene(scene({ condition: 'snow', intensity: 1 }));
    renderer.draw(5_000);
    expect(ctx.calls).toContain('arc');
  });

  it('refuses to start without Canvas 2D', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    expect(() => new SkyRenderer(canvas, scene())).toThrow();
  });
});

describe('HeroSky', () => {
  const mount = (renderer: string | null, overrides: Partial<SkyScene> = {}) => {
    const gl = renderer === null ? null : makeGl(renderer);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      gl as unknown as WebGLRenderingContext
    );
    const view = render(<HeroSky scene={scene(overrides)} />);
    const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
    return { view, canvas, gl };
  };

  it('is decorative and does not touch WebGL before the page is idle', () => {
    const { canvas, gl } = mount('ANGLE (Apple, M2)');
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect((gl!.draws as { count: number }).count).toBe(0);
    expect(idleCallbacks).toHaveLength(1);
  });

  it('animates on a hardware GPU', () => {
    const { gl } = mount('ANGLE (Apple, M2)');
    flushIdle();
    expect(rafCallbacks.length).toBeGreaterThan(0);
    act(() => rafCallbacks.splice(0).forEach(callback => callback(100)));
    act(() => rafCallbacks.splice(0).forEach(callback => callback(200)));
    expect((gl!.draws as { count: number }).count).toBeGreaterThan(0);
  });

  it('draws one still frame on a software rasteriser instead of animating', () => {
    const { gl } = mount('Google SwiftShader');
    flushIdle();
    expect((gl!.draws as { count: number }).count).toBeGreaterThan(0);
    expect(rafCallbacks).toHaveLength(0);
  });

  it('draws one still frame when the visitor prefers reduced motion', () => {
    reducedMotion = true;
    const { gl } = mount('ANGLE (Apple, M2)', { condition: 'storm', intensity: 1 });
    flushIdle();
    expect((gl!.draws as { count: number }).count).toBeGreaterThan(0);
    expect(rafCallbacks).toHaveLength(0);
  });

  it('settles on a still frame when frames keep arriving late', () => {
    const { gl } = mount('ANGLE (Apple, M2)', { condition: 'rain', intensity: 0.8 });
    flushIdle();
    // 60 frames each 200 ms apart: far beyond the 30 fps budget.
    for (let i = 1; i <= 60; i += 1) {
      act(() => rafCallbacks.splice(0).forEach(callback => callback(i * 200)));
    }
    const drawsAfterSettling = (gl!.draws as { count: number }).count;
    act(() => rafCallbacks.splice(0).forEach(callback => callback(20_000)));
    expect(rafCallbacks).toHaveLength(0);
    expect((gl!.draws as { count: number }).count).toBe(drawsAfterSettling);
  });

  it('hides itself when WebGL is unavailable', () => {
    const { canvas } = mount(null);
    flushIdle();
    expect(canvas.hidden).toBe(true);
  });

  it('cancels the pending start and releases the context on unmount', () => {
    const pending = mount('ANGLE (Apple, M2)');
    pending.view.unmount();
    expect(window.cancelIdleCallback).toHaveBeenCalled();

    const started = mount('ANGLE (Apple, M2)');
    flushIdle();
    started.view.unmount();
    expect(started.gl!.lose).toHaveBeenCalled();
  });
});

describe('LivingSky', () => {
  it('starts once the page is idle and repaints when the scene changes', () => {
    const ctx = make2d();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    );
    const view = render(<LivingSky scene={scene()} />);
    expect(view.container.querySelector('.living-sky')).toHaveAttribute('aria-hidden', 'true');
    expect(ctx.calls).toHaveLength(0);
    flushIdle();
    expect(ctx.calls.length).toBeGreaterThan(0);
    const before = ctx.calls.length;
    view.rerender(<LivingSky scene={scene({ condition: 'rain', intensity: 1 })} />);
    expect(ctx.calls.length).toBeGreaterThan(before);
    view.unmount();
  });

  it('settles on a still sky when frames keep arriving very late', () => {
    const ctx = make2d();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    );
    render(<LivingSky scene={scene()} />);
    flushIdle();
    for (let i = 1; i <= 14; i += 1) {
      act(() => rafCallbacks.splice(0).forEach(callback => callback(i * 400)));
    }
    expect(rafCallbacks).toHaveLength(0);
  });

  it('stays out of the way without Canvas 2D', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const view = render(<LivingSky scene={scene()} />);
    flushIdle();
    expect(view.container.querySelector('canvas')).toBeInTheDocument();
    view.unmount();
  });
});
