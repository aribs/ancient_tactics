import Phaser from 'phaser';
import type { GameState } from '../game/GameState';
import { HUD_BAND, UNITS, UNIT_TYPES } from '../sim/data';
import { Rng } from '../sim/rng';
import { Simulation, SIM_DT } from '../sim/Simulation';
import type { TerrainFeature } from '../sim/terrain';
import type { Battlefield, PlacedUnit, SimOutcome } from '../sim/types';
import { drawTerrain, drawUnitShape, TEAM_TINT } from './draw';

interface BattleData {
  playerUnits: PlacedUnit[];
  rivalUnits: PlacedUnit[];
  seed: number;
  terrain?: TerrainFeature[];
}

interface Fx {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  ranged: boolean;
  life: number;
}

const FX_LIFE = 0.14;

interface Clickable {
  x: number;
  y: number;
  w: number;
  h: number;
  onClick: () => void;
  rect?: Phaser.GameObjects.Rectangle;
  base?: number;
  hover?: number;
}

// Escena de batalla: construye la simulación con los dos ejércitos y la avanza
// con paso fijo, dibujando el estado cada frame. No hay órdenes del jugador
// durante el combate (se resuelve solo).
export class BattleScene extends Phaser.Scene {
  private estado!: GameState;
  private field!: Battlefield;
  private sim!: Simulation;
  private gField!: Phaser.GameObjects.Graphics;
  private gUnits!: Phaser.GameObjects.Graphics;
  private gFx!: Phaser.GameObjects.Graphics;
  private acc = 0;
  private fx: Fx[] = [];
  private terminado = false;
  private speed = 1;
  private paused = false;
  private clickables: Clickable[] = [];

  constructor() {
    super('Battle');
  }

  create(data: BattleData): void {
    this.estado = this.registry.get('estado') as GameState;
    this.field = this.estado.field;
    this.scale.resize(this.field.width, this.field.height);
    this.acc = 0;
    this.fx = [];
    this.terminado = false;
    this.speed = 1;
    this.paused = false;
    this.clickables = [];

    const placed = [...data.playerUnits, ...data.rivalUnits];
    this.sim = new Simulation(this.field, placed, data.seed, data.terrain, this.estado.stance);

    this.gField = this.add.graphics();
    this.gUnits = this.add.graphics();
    this.gFx = this.add.graphics();

    this.drawField(data.seed);

    this.add
      .text(this.field.width / 2, 24, 'Cambia de postura cuando quieras', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#dfe7ef',
      })
      .setOrigin(0.5, 0);

    // Entrada a nivel de escena con detección manual (igual que en despliegue,
    // que funciona de forma fiable). Evita el input por objeto, que no estaba
    // registrando clics aquí.
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);

    this.addSpeedControl();
    this.addStanceControl();
    this.renderState();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    for (const c of this.clickables) {
      if (this.inRect(pointer.x, pointer.y, c)) {
        c.onClick();
        return;
      }
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    for (const c of this.clickables) {
      if (!c.rect || c.base === undefined || c.hover === undefined) continue;
      c.rect.setFillStyle(this.inRect(pointer.x, pointer.y, c) ? c.hover : c.base);
    }
  }

  private inRect(x: number, y: number, c: Clickable): boolean {
    return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h;
  }

  update(_time: number, deltaMs: number): void {
    if (this.terminado) return;
    if (this.paused) {
      this.renderState();
      return;
    }

    this.acc += (deltaMs / 1000) * this.speed;
    // Avanzar la simulación en pasos fijos (determinista e independiente de FPS).
    let guard = 0;
    while (this.acc >= SIM_DT && this.sim.outcome === 'en_curso' && guard < 10) {
      this.sim.step();
      for (const e of this.sim.events) {
        this.fx.push({
          fromX: e.fromX,
          fromY: e.fromY,
          toX: e.toX,
          toY: e.toY,
          ranged: e.ranged,
          life: FX_LIFE,
        });
      }
      this.acc -= SIM_DT;
      guard++;
    }

    // Decaer efectos.
    const dt = deltaMs / 1000;
    for (const f of this.fx) f.life -= dt;
    this.fx = this.fx.filter((f) => f.life > 0);

    this.renderState();

    if (this.sim.outcome !== 'en_curso') {
      this.finalizar(this.sim.outcome);
    }
  }

  // --- Dibujo --------------------------------------------------------------

  private drawField(seed: number): void {
    const g = this.gField;
    g.clear();
    g.fillStyle(0x253040, 1);
    const play = this.field.playBottom - this.field.playTop;
    g.fillRect(0, HUD_BAND, this.field.width / 2, play);
    g.fillStyle(0x3a2832, 1);
    g.fillRect(this.field.width / 2, HUD_BAND, this.field.width / 2, play);
    g.lineStyle(2, 0x55606e, 0.6);
    g.beginPath();
    g.moveTo(this.field.width / 2, this.field.playTop);
    g.lineTo(this.field.width / 2, this.field.playBottom);
    g.strokePath();

    // Terreno bajo las unidades (mismo estilo/semilla que la previsualización).
    const drng = new Rng((seed ^ 0x51ed2701) >>> 0);
    for (const f of this.sim.terrain) drawTerrain(g, f, () => drng.next());
  }

  private renderState(): void {
    const g = this.gUnits;
    g.clear();

    // Bases con barra de vida.
    for (const team of ['jugador', 'rival'] as const) {
      const b = this.sim.bases[team];
      if (!b.alive) continue;
      g.fillStyle(0x1a1f27, 1);
      g.lineStyle(3, TEAM_TINT[team], 1);
      g.fillCircle(b.x, b.y, b.radius);
      g.strokeCircle(b.x, b.y, b.radius);
      this.hpBar(g, b.x, b.y - b.radius - 10, 54, b.hp / b.maxHp, TEAM_TINT[team]);
    }

    // Unidades con barra de vida.
    for (const u of this.sim.units) {
      if (!u.alive) continue;
      drawUnitShape(g, u.type, u.team, u.x, u.y, u.stats.radius, 1);
      this.hpBar(g, u.x, u.y - u.stats.radius - 8, u.stats.radius * 2 + 6, u.hp / u.maxHp, TEAM_TINT[u.team]);
      if (this.sim.enPanico(u)) this.drawPanic(g, u.x, u.y, u.stats.radius);
    }

    // Efectos de ataque.
    const fg = this.gFx;
    fg.clear();
    for (const f of this.fx) {
      const a = Math.max(0, f.life / FX_LIFE);
      if (f.ranged) {
        fg.lineStyle(2, 0xffe08a, a);
        fg.beginPath();
        fg.moveTo(f.fromX, f.fromY);
        fg.lineTo(f.toX, f.toY);
        fg.strokePath();
      } else {
        fg.fillStyle(0xffd0d0, a * 0.9);
        fg.fillCircle(f.toX, f.toY, 5);
      }
    }
  }

  /** Aviso de pánico: aro rojo que late y un "!" sobre la unidad. */
  private drawPanic(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.sim.tiempo * 14);
    g.lineStyle(3, 0xff3b3b, 0.4 + 0.6 * pulse);
    g.strokeCircle(x, y, radius + 5 + pulse * 4);
    const ty = y - radius - 30;
    g.fillStyle(0xff3b3b, 1);
    g.fillRect(x - 2, ty, 4, 12);
    g.fillRect(x - 2, ty + 15, 4, 4);
  }

  private hpBar(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    y: number,
    width: number,
    frac: number,
    tint: number,
  ): void {
    const w = width;
    const h = 4;
    const x = cx - w / 2;
    g.fillStyle(0x000000, 0.5);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(0x3a4350, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(tint, 1);
    g.fillRect(x, y, w * Phaser.Math.Clamp(frac, 0, 1), h);
  }

  // --- Controles y final ---------------------------------------------------

  private addSpeedControl(): void {
    const speeds = [1, 2, 4];
    const h = 32;
    const y = 16;
    const speedW = 72;
    const pauseW = 40;
    const speedX = this.field.width - 20 - speedW;
    const pauseX = speedX - 8 - pauseW;
    const speedRect = this.add.rectangle(speedX, y, speedW, h, 0x26323f).setOrigin(0, 0);
    const speedLabel = this.add
      .text(speedX + speedW / 2, y + h / 2, '▶ x1', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#bfe9ff',
      })
      .setOrigin(0.5);
    const pauseRect = this.add.rectangle(pauseX, y, pauseW, h, 0x26323f).setOrigin(0, 0);
    const pauseLabel = this.add
      .text(pauseX + pauseW / 2, y + h / 2, '⏸', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#bfe9ff',
      })
      .setOrigin(0.5);
    const pauseBanner = this.add
      .text(this.field.width / 2, this.field.height / 2, 'PAUSA', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '44px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.55)
      .setVisible(false);

    const setSpeed = (v: number): void => {
      this.speed = v;
      speedLabel.setText(`▶ x${v}`);
    };
    const togglePause = (): void => {
      if (this.terminado) return;
      this.paused = !this.paused;
      pauseLabel.setText(this.paused ? '▶' : '⏸');
      pauseBanner.setVisible(this.paused);
    };

    this.clickables.push({
      x: speedX,
      y,
      w: speedW,
      h,
      rect: speedRect,
      base: 0x26323f,
      hover: 0x33465c,
      onClick: () => setSpeed(speeds[(speeds.indexOf(this.speed) + 1) % speeds.length]),
    });
    this.clickables.push({
      x: pauseX,
      y,
      w: pauseW,
      h,
      rect: pauseRect,
      base: 0x26323f,
      hover: 0x33465c,
      onClick: togglePause,
    });

    // Atajos: espacio pausa; 1, 2 y 4 fijan la velocidad.
    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', togglePause);
    kb?.on('keydown-ONE', () => setSpeed(1));
    kb?.on('keydown-TWO', () => setSpeed(2));
    kb?.on('keydown-FOUR', () => setSpeed(4));
    this.events.once('shutdown', () => {
      kb?.off('keydown-SPACE', togglePause);
      kb?.removeAllListeners('keydown-ONE');
      kb?.removeAllListeners('keydown-TWO');
      kb?.removeAllListeners('keydown-FOUR');
    });
  }

  private addStanceControl(): void {
    const w = 120;
    const h = 40;
    const y = this.field.height - h - 12;
    const defs = [
      { stance: 'ataque' as const, text: 'ATAQUE' },
      { stance: 'defensa' as const, text: 'DEFENSA' },
    ];
    const x0 = this.field.width / 2 - w - 5;
    const items = defs.map((d, i) => {
      const x = x0 + i * (w + 10);
      const rect = this.add.rectangle(x, y, w, h, 0x26323f).setOrigin(0, 0).setStrokeStyle(2, 0x3c4a59);
      const label = this.add
        .text(x + w / 2, y + h / 2, d.text, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      return { ...d, rect, label, x };
    });
    const refresh = (): void => {
      for (const it of items) {
        const sel = it.stance === this.estado.stance;
        it.rect.setStrokeStyle(sel ? 3 : 1, sel ? 0x5fd3ff : 0x3c4a59);
        it.rect.setFillStyle(sel ? 0x33465c : 0x26323f);
        it.label.setColor(sel ? '#ffffff' : '#8fa0b0');
      }
    };
    for (const it of items) {
      this.clickables.push({
        x: it.x,
        y,
        w,
        h,
        onClick: () => {
          this.estado.stance = it.stance;
          this.sim.setStance(it.stance);
          refresh();
        },
      });
    }
    refresh();
  }

  private finalizar(outcome: SimOutcome): void {
    if (this.terminado) return;
    this.terminado = true;
    const victoria = outcome === 'victoria';

    // Capa oscura.
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, this.field.width, this.field.height);

    const esCampania = victoria && this.estado.esUltima;
    const titulo = esCampania
      ? '¡CAMPAÑA COMPLETADA!'
      : victoria
        ? '¡VICTORIA EN LA OLEADA!'
        : 'DERROTA';
    const color = victoria ? '#7fe9b8' : '#ff8a8a';

    this.add
      .text(this.field.width / 2, this.field.height / 2 - 215, titulo, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '40px',
        color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const cx = this.field.width / 2;
    let vJ = 0;
    let vR = 0;
    for (const u of this.sim.units) {
      if (!u.alive) continue;
      if (u.team === 'jugador') vJ++;
      else vR++;
    }
    const restantes = `Supervivientes — tú: ${vJ} · rival: ${vR}   ·   Base: ${Math.max(
      0,
      Math.round(this.sim.bases.jugador.hp),
    )}/${this.sim.bases.jugador.maxHp}   ·   Duración: ${Math.round(this.sim.tiempo)} s`;
    this.add
      .text(cx, this.field.height / 2 - 165, restantes, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#cdd6e0',
      })
      .setOrigin(0.5);

    this.addSummaryTable(cx, this.field.height / 2 - 130);

    if (victoria && !esCampania) {
      this.makeButton(this.field.width / 2, this.field.height / 2 + 150, 'Siguiente oleada', 0x46c08a, () => {
        this.estado.avanzarTrasVictoria();
        this.scene.start('Deploy');
      });
    } else if (!victoria) {
      this.makeButton(this.field.width / 2 - 120, this.field.height / 2 + 150, 'Reintentar oleada', 0x4f7bd6, () => {
        this.scene.start('Deploy');
      });
      this.makeButton(this.field.width / 2 + 120, this.field.height / 2 + 150, 'Reiniciar campaña', 0x8a93a0, () => {
        this.estado.reiniciar();
        this.scene.start('Deploy');
      });
    } else {
      this.makeButton(this.field.width / 2, this.field.height / 2 + 150, 'Jugar de nuevo', 0x46c08a, () => {
        this.estado.reiniciar();
        this.scene.start('Deploy');
      });
    }
  }

  /** Tabla del balance por tipo del ejército del jugador, con su unidad más destacada. */
  private addSummaryTable(cx: number, y: number): void {
    const propias = this.sim.stats.jugador;
    const tipos = UNIT_TYPES.filter((t) => propias[t]);
    let mvp: string | null = null;
    let mejor = 0;
    for (const t of tipos) {
      if (propias[t]!.dano > mejor) {
        mejor = propias[t]!.dano;
        mvp = t;
      }
    }
    const fila = (a: string, b: string, c: string, d: string, e: string): string =>
      a.padEnd(20) + b.padStart(6) + c.padStart(7) + d.padStart(8) + e.padStart(9);
    const lineas = [fila('Tu ejército', 'Desp.', 'Bajas', 'Daño', 'Muertes')];
    for (const t of tipos) {
      const s = propias[t]!;
      const nombre = (UNITS[t].nombreCorto ?? UNITS[t].nombre) + (t === mvp ? ' ★' : '');
      lineas.push(fila(nombre, String(s.desplegadas), String(s.bajas), String(Math.round(s.dano)), String(s.muertes)));
    }
    let rDesp = 0;
    let rBajas = 0;
    let rDano = 0;
    for (const s of Object.values(this.sim.stats.rival)) {
      rDesp += s!.desplegadas;
      rBajas += s!.bajas;
      rDano += s!.dano;
    }
    lineas.push('');
    lineas.push(fila('Rival (total)', String(rDesp), String(rBajas), String(Math.round(rDano)), ''));
    this.add
      .text(cx, y, lineas.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#dfe7ef',
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0);
  }

  private makeButton(cx: number, cy: number, label: string, tint: number, onClick: () => void): void {
    const w = 210;
    const h = 52;
    const hover = Phaser.Display.Color.IntegerToColor(tint).clone().brighten(15).color;

    const rect = this.add
      .rectangle(cx, cy, w, h, tint)
      .setStrokeStyle(2, 0xffffff, 0.25);

    this.add
      .text(cx, cy, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#10171f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Registramos el botón como clickable de escena (hit-test manual fiable).
    this.clickables.push({
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      rect,
      base: tint,
      hover,
      onClick,
    });
  }
}
