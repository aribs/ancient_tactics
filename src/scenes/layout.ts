import Phaser from 'phaser';
import type { Battlefield } from '../sim/types';

// Ajuste del lienzo a la pantalla. El tablero (field) se centra y el lienzo se
// estira a la proporción de la ventana, de modo que no quedan franjas vacías:
// el sobrante se rellena con fondo y el HUD se ancla a los bordes visibles.
// El lienzo se dibuja a la resolución física de la pantalla (zoom de cámara)
// para que formas y textos se vean nítidos en monitores grandes y móviles.

export interface View {
  /** Rectángulo visible en coordenadas del mundo (las del tablero). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Factor de zoom de la cámara (píxeles de lienzo por unidad de mundo). */
  zoom: number;
  /** Pantalla baja (móvil en horizontal): interfaz más grande. */
  compact: boolean;
  /** Escala de la interfaz (tamaños de letra y botones). */
  ui: number;
  /** Dispositivo táctil: textos de ayuda con «toca» en vez de «clic». */
  touch: boolean;
}

/** Tope de tamaño del lienzo para no disparar el coste de dibujo. */
const MAX_CANVAS = 4096;
const MAX_DPR = 3;

export const isTouch = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

/** Ajusta lienzo y cámara de la escena al tamaño actual de la ventana. */
export function fitToScreen(scene: Phaser.Scene, field: Battlefield): View {
  const parent = scene.scale.parent as HTMLElement | null;
  const cssW = Math.max(1, parent?.clientWidth || window.innerWidth);
  const cssH = Math.max(1, parent?.clientHeight || window.innerHeight);

  // Rectángulo de mundo visible: contiene el tablero entero y se alarga en
  // una dirección hasta igualar la proporción de la ventana.
  const fw = field.width;
  const fh = field.height;
  let vw = fw;
  let vh = fh;
  if (cssW / cssH > fw / fh) vw = (fh * cssW) / cssH;
  else vh = (fw * cssH) / cssW;

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  let zoom = (cssH * dpr) / vh;
  zoom = Math.min(zoom, MAX_CANVAS / vw, MAX_CANVAS / vh);

  scene.scale.setGameSize(Math.round(vw * zoom), Math.round(vh * zoom));
  const cam = scene.cameras.main;
  cam.setZoom(zoom);
  cam.centerOn(fw / 2, fh / 2);

  const compact = cssH < 500;
  return {
    x0: fw / 2 - vw / 2,
    y0: fh / 2 - vh / 2,
    x1: fw / 2 + vw / 2,
    y1: fh / 2 + vh / 2,
    zoom,
    compact,
    ui: compact ? 1.45 : 1,
    touch: isTouch(),
  };
}

/** Rasteriza los textos de la escena a la resolución del lienzo (evita que se vean borrosos). */
export function sharpenTexts(scene: Phaser.Scene, view: View): void {
  const res = Math.max(1, view.zoom);
  for (const o of scene.children.list) {
    if (o instanceof Phaser.GameObjects.Text && o.style.resolution !== res) o.setResolution(res);
  }
}

/**
 * Llama a `onResize` (con antirrebote) cuando cambia el tamaño de la ventana o
 * la orientación del móvil, hasta que la escena se apaga.
 */
export function onScreenResize(scene: Phaser.Scene, onResize: () => void): void {
  let timer: number | undefined;
  const handler = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(onResize, 120);
  };
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);
  scene.events.once('shutdown', () => {
    window.clearTimeout(timer);
    window.removeEventListener('resize', handler);
    window.removeEventListener('orientationchange', handler);
  });
}

/** Pide pantalla completa en móviles al primer toque (Android; iOS lo ignora). */
export function requestFullscreenOnTouch(scene: Phaser.Scene): void {
  if (!isTouch() || scene.scale.isFullscreen || !scene.sys.game.device.fullscreen.available) return;
  scene.input.once('pointerup', () => {
    if (!scene.scale.isFullscreen) scene.scale.startFullscreen();
  });
}
