import Phaser from 'phaser';
import { UNITS } from '../sim/data';
import { TERRAIN, type TerrainFeature } from '../sim/terrain';
import type { Team, UnitType } from '../sim/types';

// Helpers de dibujo con primitivas (prototipo gris). Cada tipo tiene una forma
// distinta para distinguirlos sin arte: legionario cuadrado, arquero triángulo,
// caballería rombo. El color del equipo tiñe el borde.

export const TEAM_TINT: Record<Team, number> = {
  jugador: 0x5fd3ff,
  rival: 0xff6b6b,
};

export function unitColor(type: UnitType): number {
  return Phaser.Display.Color.HexStringToColor(UNITS[type].color).color;
}

/** Dibuja un accidente de terreno con un estilo distinto por tipo. */
export function drawTerrain(
  g: Phaser.GameObjects.Graphics,
  f: TerrainFeature,
  rng: () => number,
): void {
  const base = Phaser.Display.Color.HexStringToColor(TERRAIN[f.kind].color).color;
  const dark = Phaser.Display.Color.IntegerToColor(base).clone().darken(35).color;
  const light = Phaser.Display.Color.IntegerToColor(base).clone().brighten(18).color;

  switch (f.kind) {
    case 'roca': {
      // Peñasco: círculo sólido con reborde oscuro y una cara clara. Impasable.
      g.fillStyle(dark, 1);
      g.fillCircle(f.x, f.y, f.radius);
      g.fillStyle(base, 1);
      g.fillCircle(f.x, f.y, f.radius - 3);
      g.fillStyle(light, 0.5);
      g.fillCircle(f.x - f.radius * 0.3, f.y - f.radius * 0.3, f.radius * 0.4);
      g.lineStyle(2, dark, 1);
      g.strokeCircle(f.x, f.y, f.radius);
      break;
    }
    case 'bosque': {
      // Arboleda: mancha verde con copas más oscuras dispersas. Ralentiza/cubre.
      g.fillStyle(base, 0.85);
      g.fillCircle(f.x, f.y, f.radius);
      const copas = Math.max(5, Math.floor(f.radius / 7));
      for (let i = 0; i < copas; i++) {
        const ang = rng() * Math.PI * 2;
        const rad = rng() * (f.radius - 8);
        const cr = 6 + rng() * 6;
        g.fillStyle(i % 2 === 0 ? dark : light, 0.9);
        g.fillCircle(f.x + Math.cos(ang) * rad, f.y + Math.sin(ang) * rad, cr);
      }
      break;
    }
    case 'barro': {
      // Barrizal: mancha marrón translúcida con salpicaduras. Ralentiza.
      g.fillStyle(base, 0.7);
      g.fillCircle(f.x, f.y, f.radius);
      g.fillStyle(dark, 0.6);
      const spots = Math.max(3, Math.floor(f.radius / 10));
      for (let i = 0; i < spots; i++) {
        const ang = rng() * Math.PI * 2;
        const rad = rng() * (f.radius - 6);
        g.fillCircle(f.x + Math.cos(ang) * rad, f.y + Math.sin(ang) * rad, 4 + rng() * 5);
      }
      break;
    }
  }
}

/** Dibuja la silueta de una unidad en (x,y) sobre un objeto Graphics. */
export function drawUnitShape(
  g: Phaser.GameObjects.Graphics,
  type: UnitType,
  team: Team,
  x: number,
  y: number,
  radius: number,
  alpha = 1,
): void {
  g.fillStyle(unitColor(type), alpha);
  g.lineStyle(2, TEAM_TINT[team], alpha);

  switch (type) {
    case 'legionario': {
      const s = radius;
      g.fillRect(x - s, y - s, s * 2, s * 2);
      g.strokeRect(x - s, y - s, s * 2, s * 2);
      break;
    }
    case 'arquero': {
      const r = radius + 2;
      const pts = [x, y - r, x + r, y + r, x - r, y + r];
      g.fillTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
      g.strokeTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
      break;
    }
    case 'elefante': {
      // Círculo grande con dos colmillos hacia el frente (derecha).
      g.fillCircle(x, y, radius);
      g.strokeCircle(x, y, radius);
      const f = team === 'jugador' ? 1 : -1;
      g.lineStyle(3, 0xf2ead8, alpha);
      g.lineBetween(x + f * radius, y - 5, x + f * (radius + 8), y - 8);
      g.lineBetween(x + f * radius, y + 5, x + f * (radius + 8), y + 8);
      break;
    }
    case 'caballeria': {
      const r = radius + 2;
      g.beginPath();
      g.moveTo(x, y - r);
      g.lineTo(x + r, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r, y);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    }
  }
}
