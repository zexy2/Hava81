import { useEffect, useRef } from 'react';
import type { SkyScene } from './skyScene';
import { SkyRenderer } from './skyRenderer';

interface Props {
  scene: SkyScene;
}

/**
 * Full-page living sky behind the interface. Decorative only (aria-hidden). Animates while the
 * tab is visible; with reduced motion it paints a single still frame. Without Canvas 2D the
 * CSS gradient underneath remains.
 */
export function LivingSky({ scene }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SkyRenderer | null>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    const begin = () => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      let renderer: SkyRenderer;
      try {
        renderer = new SkyRenderer(canvas, sceneRef.current);
      } catch {
        return;
      }
      rendererRef.current = renderer;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      let frame = 0;
      let last = 0;
      let slow = 0;
      let still = false;
      const start = performance.now();

      const paint = () => renderer.draw(performance.now() - start);
      // 30 fps is plenty for drifting clouds and halves the cost of a full-screen canvas.
      // If frames keep arriving very late (a busy or weak device), settle on a still sky.
      const loop = (now: number) => {
        const gap = now - last;
        if (gap >= 33) {
          if (last > 0 && gap > 120) slow += 1;
          last = now;
          paint();
          // Too slow to animate smoothly: keep this frame and stop for good.
          if (slow > 10) {
            still = true;
            return;
          }
        }
        frame = window.requestAnimationFrame(loop);
      };
      const run = () => {
        window.cancelAnimationFrame(frame);
        last = 0;
        if (still || reduceMotion.matches || document.visibilityState !== 'visible') {
          paint();
          return;
        }
        frame = window.requestAnimationFrame(loop);
      };
      const resize = () => {
        renderer.resize(window.innerWidth, window.innerHeight);
        paint();
      };

      resize();
      run();
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', run);
      reduceMotion.addEventListener('change', run);
      cleanup = () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', run);
        reduceMotion.removeEventListener('change', run);
        rendererRef.current = null;
      };
    };

    // The sky waits for an idle moment so it never competes with first paint; the CSS
    // gradient underneath shows until then.
    const idle =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(begin, { timeout: 2500 })
        : window.setTimeout(begin, 1200);
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setScene(scene);
    // The loop picks it up on the next frame; a still (reduced-motion) sky needs a repaint.
    renderer.draw(performance.now());
  }, [scene]);

  return (
    <div className="living-sky" aria-hidden="true">
      <canvas ref={canvasRef} className="living-sky__canvas" />
    </div>
  );
}

export default LivingSky;
