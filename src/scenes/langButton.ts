import Phaser from 'phaser';
import { t } from '../i18n';
import type { View } from './layout';

type TextFactory = (
  x: number,
  y: number,
  str: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
) => Phaser.GameObjects.Text;

/**
 * Botón de idioma en la esquina superior izquierda visible. El fondo va en el
 * propio texto, así que se destruye y recrea con el resto del HUD; la escena
 * hace el hit-test con `getBounds()`.
 */
export function addLanguageButton(
  text: TextFactory,
  view: View,
  px: (size: number) => string,
): Phaser.GameObjects.Text {
  const pad = Math.round(6 * view.ui);
  return text(view.x0 + 20, 16, t('lang.switch'), {
    fontSize: px(14),
    color: '#bfe9ff',
    backgroundColor: '#26323f',
    padding: { x: pad + 2, y: pad },
  });
}
