import Phaser from 'phaser';

// Escena de arranque. En el prototipo gris no hay assets que cargar (todo se
// dibuja con primitivas), así que solo encadena con el despliegue.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Deploy');
  }
}
