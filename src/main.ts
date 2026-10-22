import Phaser from 'phaser';
import { RandomRulesAI } from './ai/RandomRulesAI';
import { GameState } from './game/GameState';
import { WAVES, fieldFor } from './sim/data';
import { BootScene } from './scenes/BootScene';
import { DeployScene } from './scenes/DeployScene';
import { BattleScene } from './scenes/BattleScene';

// Altura extra para la franja de HUD/paleta bajo el campo.
export const HUD_HEIGHT = 0; // el HUD se dibuja dentro del campo en v0.1.

const inicial = fieldFor(WAVES.oleadas[0]);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  // El lienzo se redimensiona por oleada (el tablero crece) y se escala a la ventana.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: inicial.width,
    height: inicial.height,
  },
  backgroundColor: '#20262e',
  scene: [BootScene, DeployScene, BattleScene],
  render: {
    pixelArt: false,
    antialias: true,
  },
});

// La IA rival vive detrás de la interfaz DeploymentAI: para cambiar de nivel
// (PredefinedWaveAI = 1, RandomRulesAI = 2, contra-picking = 3) basta con
// cambiar esta única línea.
const estado = new GameState(new RandomRulesAI());
game.registry.set('estado', estado);

export default game;
