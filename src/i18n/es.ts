// Español: idioma de referencia. Las claves de `en.ts` deben coincidir con estas.
export const es = {
  'doc.title': 'Choque de Ejércitos — Prototipo',
  'doc.rotate': 'Gira el móvil para jugar en horizontal',
  'lang.switch': '🌐 English',

  'stance.ataque': 'ATAQUE',
  'stance.defensa': 'DEFENSA',
  'stance.label': 'Postura',

  'unit.legionario.name': 'Legionario',
  'unit.arquero.name': 'Arquero',
  'unit.caballeria.name': 'Caballería',
  'unit.elefante.name': 'Elefante de guerra',
  'unit.elefante.short': 'Elefante',

  'wave.1.name': 'Escaramuza',
  'wave.2.name': 'Avance',
  'wave.3.name': 'Ofensiva',
  'wave.4.name': 'Asalto',
  'wave.5.name': 'Cerco',
  'wave.6.name': 'Asalto final',

  'deploy.wave': 'Oleada {id}/{total} · {name}',
  'deploy.budget': 'Presupuesto: {spent} / {total}',
  'deploy.helpTouch': 'Toca una celda para colocar · toca una unidad para retirarla',
  'deploy.helpClick': 'Clic en una celda para colocar · clic en una unidad para retirarla',
  'deploy.palette': '{name}\n{cost} pts   ×{count}',
  'deploy.start': 'COMENZAR',

  'battle.stanceHint': 'Cambia de postura cuando quieras',
  'battle.pause': 'PAUSA',
  'battle.victoryCampaign': '¡CAMPAÑA COMPLETADA!',
  'battle.victoryWave': '¡VICTORIA EN LA OLEADA!',
  'battle.defeat': 'DERROTA',
  'battle.survivors': 'Supervivientes — tú: {mine} · rival: {rival}   ·   Duración: {seconds} s',
  'battle.nextWave': 'Siguiente oleada',
  'battle.retryWave': 'Reintentar oleada',
  'battle.restartCampaign': 'Reiniciar campaña',
  'battle.playAgain': 'Jugar de nuevo',

  'table.army': 'Tu ejército',
  'table.deployed': 'Desp.',
  'table.losses': 'Bajas',
  'table.damage': 'Daño',
  'table.kills': 'Muertes',
  'table.rival': 'Rival (total)',
} as const;

export type Dict = Record<keyof typeof es, string>;
