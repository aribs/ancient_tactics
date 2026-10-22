// Generador pseudoaleatorio con semilla (mulberry32). Determinista: la misma
// semilla produce la misma batalla, lo que permite reproducir y equilibrar.

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Flotante en [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Flotante en [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Entero en [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}
