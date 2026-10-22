# Choque de Ejércitos — Prototipo gris (v0.1)

Tower defense de choque de ejércitos romanos/griegos en vista cenital 2D para
navegador, hecho con Phaser 3 + TypeScript + Vite. Antes de cada oleada gastas
un presupuesto de puntos en desplegar tropas sobre una **cuadrícula**; el rival
hace lo mismo y el combate se resuelve solo. Arte de prototipo: formas y
colores simples.

Seis oleadas, cuatro tipos de unidad, terreno generado por semilla, IA rival de
**nivel 2** (aleatorio con reglas) y resumen de la batalla al terminar.

## Arrancar

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # typecheck + build estático en dist/
npm run preview    # sirve el build
npm run sim        # equilibrado headless (sin gráficos)
```

Requiere Node 18+.

## Cómo se juega

1. **Preparación:** gasta tu presupuesto colocando unidades en las celdas de tu
   zona (izquierda). Clic en una celda para colocar la unidad seleccionada en la
   paleta; clic en una unidad ya puesta para retirarla. Los fantasmas de la
   derecha muestran el ejército rival de esta oleada.
2. **Batalla:** pulsa *Comenzar*. El combate se resuelve solo. Puedes acelerar
   (x1/x2/x4, o las teclas `1`, `2`, `4`), pausar (`Espacio`) y cambiar de
   postura (ataque/defensa). Ganas la oleada si aniquilas al rival; pierdes si cae tu base o tu
   ejército.
3. **Resumen:** al acabar ves por tipo de unidad las bajas, el daño y las
   muertes, con una ★ en la más destacada.
4. **Progresión:** cada victoria suma puntos extra para la siguiente oleada.

### Unidades (piedra-papel-tijera)

| Unidad | Forma | Papel | Fuerte contra | Débil contra | Desde oleada |
| --- | --- | --- | --- | --- | --- |
| **Legionario** | cuadrado | Aguanta la línea | Caballería | Arqueros | 1 |
| **Arquero** | triángulo | Daño a distancia, frágil | Legionarios | Caballería | 1 |
| **Caballería** | rombo | Rápida, flanquea | Arqueros | Legionarios | 1 |
| **Elefante de guerra** | círculo con colmillos | Tanque lento y carísimo | Caballería | Muchos arqueros (×1,3 de daño recibido) | 3 |

El **elefante** entra en **pánico** por debajo del 25 % de vida: ataca a la
unidad más cercana, sea aliada o enemiga. Se avisa con un aro rojo y un «!».

### Accidentes de terreno

Cada oleada genera terreno aleatorio (determinista desde la semilla) en la
franja central; se ve ya en la preparación para poder planificar:

- **Roca** (gris): impasable, las unidades la rodean y **bloquea las flechas**
  (sin línea de visión, los arqueros no disparan: hay que reposicionarse).
- **Bosque** (verde): ralentiza y da **cobertura** (reduce el daño a distancia recibido).
- **Barro** (marrón): ralentiza.

Tipos y efectos en `src/data/terrain.json`; generación en `src/sim/terrain.ts`.

## Arquitectura

```
src/
  data/            units.json, waves.json  → estadísticas y oleadas (equilibrado sin tocar código)
  sim/             simulación pura, SIN Phaser (corre en Node para equilibrar)
    Simulation.ts  resolución de combate por pasos fijos (determinista con semilla)
    headless.ts    miles de batallas en consola → verifica el triángulo y la dificultad
  ai/              DeploymentAI (interfaz) + PredefinedWaveAI (nivel 1) + RandomRulesAI (nivel 2)
  deploy/grid.ts   geometría de las cuadrículas de despliegue
  game/            GameState: oleada actual, presupuesto, progresión
  scenes/          Phaser: Boot, Deploy, Battle (solo render + input)
```

Principios de diseño:

- **La simulación no importa Phaser**, para ejecutar batallas sin gráficos.
- **Datos en JSON** cargados en runtime.
- **IA rival detrás de una interfaz intercambiable** (`DeploymentAI`): cambiar
  de nivel (1 predefinido, 2 aleatorio con reglas, 3 contra-picking pendiente)
  es cambiar una línea en `main.ts`.

## Equilibrar

Edita `src/data/units.json` o `src/data/waves.json` y ejecuta `npm run sim`.
El script imprime la matriz de enfrentamientos (confirma el piedra-papel-tijera)
y, por oleada, la mejor composición encontrada y su tasa de victoria, además de
cómo rinde un ejército de referencia frente a las IA de nivel 1 y 2.

## Hoja de ruta

- Hecho: prototipo gris, cuatro unidades, IA nivel 1 y 2, terreno, pánico del elefante.
- Pendiente: IA nivel 3 (contra-picking), mejoras entre oleadas, hoplitas y
  catapultas, arte y sonido reales, publicación en la web.
