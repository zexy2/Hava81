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
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let renderer: SkyRenderer;
    try {
      renderer = new SkyRenderer(canvas, sceneRef.current);
    } catch {
      return undefined;
    }
    rendererRef.current = renderer;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const start = performance.now();

    const paint = () => renderer.draw(performance.now() - start);
    const loop = () => {
      paint();
      frame = window.requestAnimationFrame(loop);
    };
    const run = () => {
      window.cancelAnimationFrame(frame);
      if (reduceMotion.matches || document.visibilityState !== 'visible') {
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
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', run);
      reduceMotion.removeEventListener('change', run);
      rendererRef.current = null;
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
