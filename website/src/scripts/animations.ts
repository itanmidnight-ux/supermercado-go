/**
 * Sistema de animación compartido — GSAP + ScrollTrigger + Lenis.
 * Importar `initSmoothScroll()` e `initScrollReveal()` una vez por página
 * (típicamente desde layout.ts o el entry script de cada página).
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

/** Smooth scroll (Lenis) sincronizado con el ticker de GSAP/ScrollTrigger. */
export function initSmoothScroll(): Lenis {
  if (lenis) return lenis;

  lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/** Fade-in-up genérico. opts sobreescribe duración/distancia/delay/ease. */
export function fadeInUp(
  selector: string | Element,
  opts: { y?: number; duration?: number; delay?: number; ease?: string } = {}
): gsap.core.Tween {
  const { y = 40, duration = 0.8, delay = 0, ease = 'power3.out' } = opts;
  return gsap.from(selector, { opacity: 0, y, duration, delay, ease });
}

/** Revelado escalonado de una lista de elementos (grids de producto, nav, etc). */
export function staggerReveal(
  selector: string | Element[],
  opts: { y?: number; duration?: number; stagger?: number; ease?: string; scrollTrigger?: boolean } = {}
): gsap.core.Tween {
  const { y = 30, duration = 0.6, stagger = 0.08, ease = 'power2.out', scrollTrigger = false } = opts;
  const vars: gsap.TweenVars = { opacity: 0, y, duration, stagger, ease };

  if (scrollTrigger) {
    const target = typeof selector === 'string' ? document.querySelector(selector) : selector[0];
    vars.scrollTrigger = {
      trigger: target as Element,
      start: 'top 85%',
      toggleActions: 'play none none reverse',
    };
  }

  return gsap.from(selector, vars);
}

/**
 * Auto-detecta elementos con `data-reveal` y los anima al entrar en viewport.
 * Variantes vía `data-reveal="up|fade|stagger"` (default: "up").
 * Uso: <section data-reveal="up">...</section>
 *      <div data-reveal="stagger"><div data-reveal-item>...</div>...</div>
 */
export function initScrollReveal(): void {
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const variant = el.dataset.reveal || 'up';

    const scrollTrigger = {
      trigger: el,
      start: 'top 85%',
      toggleActions: 'play none none reverse',
    };

    if (variant === 'stagger') {
      const items = el.querySelectorAll('[data-reveal-item]');
      gsap.from(items.length ? items : el.children, {
        opacity: 0,
        y: 30,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger,
      });
    } else if (variant === 'fade') {
      gsap.from(el, { opacity: 0, duration: 0.8, ease: 'power2.out', scrollTrigger });
    } else {
      gsap.from(el, { opacity: 0, y: 40, duration: 0.8, ease: 'power3.out', scrollTrigger });
    }
  });
}

export { gsap, ScrollTrigger };
