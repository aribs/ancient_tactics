import Phaser from 'phaser';
import type { DeployContext } from '../ai/DeploymentAI';
import {
  CELL_HALF_H,
  CELL_HALF_W,
  cells,
  type Cell,
} from '../deploy/grid';
import type { GameState } from '../game/GameState';
import { HUD_BAND, UNITS, unlockedTypes, WAVES } from '../sim/data';
import { defensiveAnchor, type Stance } from '../sim/stance';
import { Rng } from '../sim/rng';
import { generateTerrain, type TerrainFeature } from '../sim/terrain';
import type { Battlefield, PlacedUnit, UnitType } from '../sim/types';
import { drawTerrain, drawUnitShape, TEAM_TINT } from './draw';

interface PaletteButton {
  type: UnitType;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Pantalla de preparación: el jugador gasta su presupuesto colocando unidades
// en las celdas de su cuadrícula. La composición rival (nivel 1) se muestra
// como fantasma para que el jugador sepa a qué se enfrenta.
export class DeployScene extends Phaser.Scene {
  private estado!: GameState;
  private field!: Battlefield;
  private gBoard!: Phaser.GameObjects.Graphics;
  private gUnits!: Phaser.GameObjects.Graphics;
  private gUi!: Phaser.GameObjects.Graphics;

  private playerCells: Cell[] = [];
  private placed = new Map<number, UnitType>();
  private selected: UnitType = 'legionario';
  private rivalPreview: PlacedUnit[] = [];
  private terrain: TerrainFeature[] = [];

  private palette: PaletteButton[] = [];
  private stanceBtns: { stance: Stance; x: number; y: number; w: number; h: number }[] = [];
  private stanceLabels: Phaser.GameObjects.Text[] = [];
  private startBtn = { x: 0, y: 0, w: 150, h: 48 };

  private hudText!: Phaser.GameObjects.Text;
  private budgetText!: Phaser.GameObjects.Text;
  private paletteLabels: Phaser.GameObjects.Text[] = [];
  private startLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('Deploy');
  }

  create(): void {
    this.estado = this.registry.get('estado') as GameState;
    this.field = this.estado.field;
    // El lienzo se ajusta al tablero de esta oleada (crece con el nivel).
    this.scale.resize(this.field.width, this.field.height);
    this.startBtn.x = this.field.width - 166;
    this.startBtn.y = this.field.height - 64;
    // Phaser reutiliza la instancia de la escena al reiniciarla: todo el estado
    // que apunte a objetos de la ejecución anterior (ya destruidos) se vacía aquí.
    this.placed.clear();
    this.paletteLabels = [];
    this.stanceLabels = [];
    this.selected = 'legionario';
    this.playerCells = cells(this.field, 'jugador');

    // Previsualización del despliegue rival (nivel 1: composición fija).
    const ctx: DeployContext = {
      wave: this.estado.wave,
      field: this.field,
      composicionJugador: {},
      seed: this.estado.seed,
    };
    this.rivalPreview = this.estado.ai.deploy(ctx);

    // Terreno determinista desde la semilla de la oleada: lo que se ve aquí
    // es exactamente el campo de la batalla.
    this.terrain = generateTerrain(this.estado.seed, this.field, this.estado.wave.terreno);

    this.gBoard = this.add.graphics();
    this.gUnits = this.add.graphics();
    this.gUi = this.add.graphics();

    this.buildPalette();
    this.buildStance();
    this.buildTexts();
    this.drawBoard();
    this.redraw();

    this.input.on('pointerdown', this.onPointerDown, this);
  }

  // --- Construcción de UI --------------------------------------------------

  private buildPalette(): void {
    const w = 118;
    const h = 60;
    const y = this.field.height - 70;
    this.palette = unlockedTypes(this.estado.wave.id).map((type, i) => ({
      type,
      x: 20 + i * (w + 6),
      y,
      w,
      h,
    }));
  }

  private buildStance(): void {
    const defs: { stance: Stance; text: string }[] = [
      { stance: 'ataque', text: 'ATAQUE' },
      { stance: 'defensa', text: 'DEFENSA' },
    ];
    this.stanceBtns = defs.map((d, i) => ({ stance: d.stance, x: 660 + i * 86, y: this.field.height - 70, w: 80, h: 60 }));
    this.stanceBtns.forEach((b, i) => {
      this.stanceLabels.push(
        this.add
          .text(b.x + b.w / 2, b.y + b.h / 2, defs[i].text, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '15px',
            color: '#f2f6fa',
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      );
    });
    this.add
      .text(660 + 83, this.field.height - 84, 'Postura', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#9fb0c0',
      })
      .setOrigin(0.5, 0.5);
  }

  private buildTexts(): void {
    this.hudText = this.add
      .text(this.field.width / 2, 24, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#eef3f8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    this.budgetText = this.add
      .text(this.field.width - 20, 24, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffe08a',
      })
      .setOrigin(1, 0);

    this.add
      .text(this.field.width / 2, 62, 'Clic en una celda para colocar · clic en una unidad para retirarla', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#9fb0c0',
      })
      .setOrigin(0.5, 0);

    for (const btn of this.palette) {
      const u = UNITS[btn.type];
      const label = this.add
        .text(btn.x + btn.w / 2, btn.y + btn.h / 2, '', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: '#f2f6fa',
          align: 'center',
        })
        .setOrigin(0.5);
      label.setData('type', btn.type);
      void u;
      this.paletteLabels.push(label);
    }

    this.startLabel = this.add
      .text(this.startBtn.x + this.startBtn.w / 2, this.startBtn.y + this.startBtn.h / 2, 'COMENZAR', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#0d1b12',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
  }

  // --- Dibujo --------------------------------------------------------------

  private drawBoard(): void {
    const g = this.gBoard;
    g.clear();

    // Mitades del campo.
    g.fillStyle(0x253040, 1);
    const play = this.field.playBottom - this.field.playTop;
    g.fillRect(0, HUD_BAND, this.field.width / 2, play);
    g.fillStyle(0x3a2832, 1);
    g.fillRect(this.field.width / 2, HUD_BAND, this.field.width / 2, play);

    // Línea central.
    g.lineStyle(2, 0x55606e, 0.8);
    g.beginPath();
    g.moveTo(this.field.width / 2, this.field.playTop);
    g.lineTo(this.field.width / 2, this.field.playBottom);
    g.strokePath();

    // Accidentes de terreno (deterministas desde la semilla).
    const drng = new Rng((this.estado.seed ^ 0x51ed2701) >>> 0);
    for (const f of this.terrain) drawTerrain(g, f, () => drng.next());

    // Bases.
    this.drawBase(g, this.field.playerBaseX, this.field.baseY, TEAM_TINT.jugador);
    this.drawBase(g, this.field.rivalBaseX, this.field.baseY, TEAM_TINT.rival);

    // Celdas del jugador.
    g.lineStyle(1, 0x5fd3ff, 0.35);
    for (const c of this.playerCells) {
      g.strokeRect(c.x - CELL_HALF_W, c.y - CELL_HALF_H, CELL_HALF_W * 2, CELL_HALF_H * 2);
    }
  }

  private drawBase(g: Phaser.GameObjects.Graphics, x: number, y: number, tint: number): void {
    g.fillStyle(0x1a1f27, 1);
    g.lineStyle(3, tint, 1);
    g.fillCircle(x, y, 26);
    g.strokeCircle(x, y, 26);
  }

  private redraw(): void {
    const gu = this.gUnits;
    gu.clear();

    // Fantasmas del rival.
    for (const r of this.rivalPreview) {
      drawUnitShape(gu, r.type, 'rival', r.x, r.y, UNITS[r.type].radius, 0.45);
    }

    // Unidades del jugador ya colocadas.
    for (const [cellIndex, type] of this.placed) {
      const c = this.playerCells[cellIndex];
      if (this.estado.stance === 'defensa') {
        // Puesto defensivo: la unidad se replegará aquí antes de la batalla.
        const a = defensiveAnchor(this.field, c.x, c.y);
        gu.lineStyle(1, 0x5fd3ff, 0.5);
        gu.beginPath();
        gu.moveTo(c.x, c.y);
        gu.lineTo(a.x, a.y);
        gu.strokePath();
        drawUnitShape(gu, type, 'jugador', c.x, c.y, UNITS[type].radius, 0.3);
        drawUnitShape(gu, type, 'jugador', a.x, a.y, UNITS[type].radius, 1);
      } else {
        drawUnitShape(gu, type, 'jugador', c.x, c.y, UNITS[type].radius, 1);
      }
    }

    this.drawUi();
    this.updateTexts();
  }

  private drawUi(): void {
    const g = this.gUi;
    g.clear();

    // Botones de la paleta.
    for (const btn of this.palette) {
      const isSel = btn.type === this.selected;
      g.fillStyle(isSel ? 0x33465c : 0x202a36, 1);
      g.lineStyle(isSel ? 3 : 1, isSel ? 0x5fd3ff : 0x3c4a59, 1);
      g.fillRoundedRect(btn.x, btn.y, btn.w, btn.h, 8);
      g.strokeRoundedRect(btn.x, btn.y, btn.w, btn.h, 8);
      // Icono del tipo.
      drawUnitShape(g, btn.type, 'jugador', btn.x + 20, btn.y + btn.h / 2, 11, 1);
    }

    // Selector de postura.
    for (const b of this.stanceBtns) {
      const isSel = b.stance === this.estado.stance;
      g.fillStyle(isSel ? 0x33465c : 0x202a36, 1);
      g.lineStyle(isSel ? 3 : 1, isSel ? 0x5fd3ff : 0x3c4a59, 1);
      g.fillRoundedRect(b.x, b.y, b.w, b.h, 8);
      g.strokeRoundedRect(b.x, b.y, b.w, b.h, 8);
    }
    this.stanceLabels.forEach((l, i) =>
      l.setColor(this.stanceBtns[i].stance === this.estado.stance ? '#ffffff' : '#8fa0b0'),
    );

    // Botón comenzar.
    const canStart = this.placed.size > 0;
    g.fillStyle(canStart ? 0x46c08a : 0x2c3a33, 1);
    g.lineStyle(2, canStart ? 0x7fe9b8 : 0x3c4a44, 1);
    g.fillRoundedRect(this.startBtn.x, this.startBtn.y, this.startBtn.w, this.startBtn.h, 8);
    g.strokeRoundedRect(this.startBtn.x, this.startBtn.y, this.startBtn.w, this.startBtn.h, 8);
    this.startLabel.setColor(canStart ? '#0d1b12' : '#6b7a72');
  }

  private updateTexts(): void {
    const w = this.estado.wave;
    this.hudText.setText(`Oleada ${w.id}/${WAVES_COUNT} · ${w.nombre}`);

    const gastado = this.gastado();
    const total = this.estado.presupuesto;
    this.budgetText.setText(`Presupuesto: ${gastado} / ${total}`);
    this.budgetText.setColor(gastado > total ? '#ff8a8a' : '#ffe08a');

    for (const label of this.paletteLabels) {
      const type = label.getData('type') as UnitType;
      const u = UNITS[type];
      const count = this.countPlaced(type);
      label.setText(`${u.nombreCorto ?? u.nombre}\n${u.cost} pts   ×${count}`);
      label.setColor(type === this.selected ? '#ffffff' : '#c4d0dc');
      // Reposicionar el texto a la derecha del icono.
      const btn = this.palette.find((b) => b.type === type)!;
      label.setPosition(btn.x + 40, btn.y + btn.h / 2 - 2);
      label.setOrigin(0, 0.5);
    }
  }

  // --- Lógica de colocación ------------------------------------------------

  private gastado(): number {
    let total = 0;
    for (const type of this.placed.values()) total += UNITS[type].cost;
    return total;
  }

  private countPlaced(type: UnitType): number {
    let n = 0;
    for (const t of this.placed.values()) if (t === type) n++;
    return n;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const { x, y } = pointer;

    // ¿Botón comenzar?
    if (this.inRect(x, y, this.startBtn) && this.placed.size > 0) {
      this.comenzar();
      return;
    }

    // ¿Selector de postura?
    for (const b of this.stanceBtns) {
      if (this.inRect(x, y, b)) {
        this.estado.stance = b.stance;
        this.redraw();
        return;
      }
    }

    // ¿Botón de paleta?
    for (const btn of this.palette) {
      if (this.inRect(x, y, btn)) {
        this.selected = btn.type;
        this.redraw();
        return;
      }
    }

    // ¿Celda del jugador?
    const cell = this.cellAt(x, y);
    if (cell) {
      this.toggleCell(cell);
      this.redraw();
    }
  }

  private toggleCell(cell: Cell): void {
    if (this.placed.has(cell.index)) {
      // Retirar.
      this.placed.delete(cell.index);
      return;
    }
    // Colocar si hay presupuesto.
    const coste = UNITS[this.selected].cost;
    if (this.gastado() + coste > this.estado.presupuesto) {
      this.flashBudget();
      return;
    }
    this.placed.set(cell.index, this.selected);
  }

  private flashBudget(): void {
    this.budgetText.setColor('#ff5555');
    this.tweens.add({
      targets: this.budgetText,
      scale: { from: 1.25, to: 1 },
      duration: 220,
      onComplete: () => this.budgetText.setScale(1),
    });
  }

  private cellAt(x: number, y: number): Cell | null {
    for (const c of this.playerCells) {
      if (
        x >= c.x - CELL_HALF_W &&
        x <= c.x + CELL_HALF_W &&
        y >= c.y - CELL_HALF_H &&
        y <= c.y + CELL_HALF_H
      ) {
        return c;
      }
    }
    return null;
  }

  private inRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private comenzar(): void {
    const playerUnits: PlacedUnit[] = [];
    for (const [cellIndex, type] of this.placed) {
      const c = this.playerCells[cellIndex];
      playerUnits.push({ type, team: 'jugador', x: c.x, y: c.y });
    }
    this.input.off('pointerdown', this.onPointerDown, this);
    this.scene.start('Battle', {
      playerUnits,
      rivalUnits: this.rivalPreview,
      seed: this.estado.seed,
      terrain: this.terrain,
    });
  }
}

// Número de oleadas definidas (para el HUD).
const WAVES_COUNT = WAVES.oleadas.length;
