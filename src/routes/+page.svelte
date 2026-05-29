<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    BookOpen,
    FlaskConical,
    History,
    Minus,
    Play,
    Plus,
    RotateCcw,
    Settings2,
    Trophy,
    X
  } from '@lucide/svelte';
  import {
    STEP_DEFINITIONS,
    attemptStep as runStep,
    clampTeamCount,
    createGame,
    defaultTeamNames,
    getTeamColor,
    type GameState,
    type MoveResult,
    type StepId,
    type TokenKind
  } from '$lib/game';

  type BoardAction = {
    id: StepId;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    hint: string;
  };

  type Point = {
    x: number;
    y: number;
  };

  type Ellipse = {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
  };

  type MoleculeCompartment = 'outside' | 'cytosol' | 'intermembrane' | 'matrix' | 'free';

  type BoardIcon = {
    key: string;
    kind: TokenKind;
    compartment: MoleculeCompartment;
    x: number;
    y: number;
    driftX: number;
    driftY: number;
    duration: number;
    delay: number;
    spin: number;
    scale?: number;
    dimmed?: boolean;
    rotate?: number;
  };

  type MoleculeLayer = {
    id: Exclude<MoleculeCompartment, 'free'>;
    maskId: string;
  };

  type ProtonFieldId = 'matrix' | 'intermembrane';

  type ProtonField = {
    id: ProtonFieldId;
    label: string;
    path: string;
    labelX: number;
    labelY: number;
    cx: number;
    cy: number;
    outerRx: number;
    outerRy: number;
    innerRx: number;
    innerRy: number;
    startDeg: number;
    endDeg: number;
  };

  type ProtonDot = {
    key: string;
    field: ProtonFieldId;
    x: number;
    y: number;
    radius: number;
    driftX: number;
    driftY: number;
    duration: number;
    delay: number;
  };

  const BOARD = {
    width: 1280,
    height: 720
  };

  const MEMBRANES = {
    cell: { cx: 640, cy: 368, rx: 600, ry: 320 },
    mitoOuter: { cx: 800, cy: 390, rx: 400, ry: 250 },
    mitoInner: { cx: 800, cy: 390, rx: 320, ry: 200 }
  } satisfies Record<string, Ellipse>;

  const CELL_MEMBRANE_PATH = ellipsePath(MEMBRANES.cell);
  const OUTER_MITO_PATH = ellipsePath(MEMBRANES.mitoOuter);
  const INNER_MITO_PATH = ellipsePath(MEMBRANES.mitoInner);
  const CELL_RIM_PATH = ellipsePath({ ...MEMBRANES.cell, rx: MEMBRANES.cell.rx - 34, ry: MEMBRANES.cell.ry - 28 });

  const MOLECULE_LAYERS: MoleculeLayer[] = [
    { id: 'outside', maskId: 'outside-mask' },
    { id: 'cytosol', maskId: 'cytosol-mask' },
    { id: 'intermembrane', maskId: 'intermembrane-mask' },
    { id: 'matrix', maskId: 'matrix-mask' }
  ];

  const BOARD_ACTIONS: BoardAction[] = [
    placeAction('import-glucose', pointOnEllipse(MEMBRANES.cell, -155), 170, 58, 'Importa glucosio', 'membrana cellulare', 12, -2),
    placeAction('glycolysis', relativePoint(MEMBRANES.cell, -0.58, 0.3), 146, 58, 'Glicolisi', 'citoplasma'),
    placeAction(
      'import-pyruvate',
      pointOnEllipse(MEMBRANES.mitoOuter, 176),
      188,
      58,
      'Importa piruvato',
      'membrana esterna',
      18,
      0
    ),
    placeAction('import-nadh', pointOnEllipse(MEMBRANES.mitoOuter, -145), 150, 58, 'Importa NADH', 'shuttle', 18, -10),
    placeAction('krebs', relativePoint(MEMBRANES.mitoInner, -0.2, 0.02), 140, 58, 'Krebs', 'matrice'),
    placeAction(
      'etc',
      pointOnEllipse(MEMBRANES.mitoInner, -36),
      188,
      56,
      'Catena di trasporto',
      'membrana interna',
      -4,
      -4
    ),
    placeAction('atp-synthase', pointOnEllipse(MEMBRANES.mitoInner, 47), 156, 56, 'ATP sintasi', 'membrana interna', 0, 8)
  ];

  
  const PROTON_FIELDS: ProtonField[] = [
    {
      id: 'matrix',
      label: '',
      path: annularSectorPath(
        MEMBRANES.mitoInner.cx, 
        MEMBRANES.mitoInner.cy, 
        MEMBRANES.mitoInner.rx, 
        MEMBRANES.mitoInner.ry, 
        190, 
        107, 
        -38, 
        36),
      labelX: 1000,
      labelY: 404,
      cx: MEMBRANES.mitoInner.cx,
      cy: MEMBRANES.mitoInner.cy,
      outerRx: MEMBRANES.mitoInner.rx,
      outerRy: MEMBRANES.mitoInner.ry,
      innerRx: 190,
      innerRy: 107,
      startDeg: -38,
      endDeg: 36
    },
    {
      id: 'intermembrane',
      label: '',
      path: annularSectorPath(
        MEMBRANES.mitoOuter.cx, 
        MEMBRANES.mitoOuter.cy, 
        MEMBRANES.mitoOuter.rx, 
        MEMBRANES.mitoOuter.ry, 
        MEMBRANES.mitoInner.rx, 
        MEMBRANES.mitoInner.ry, 
        -38, 
        36),
      labelX: 1048,
      labelY: 326,
      cx: MEMBRANES.mitoOuter.cx,
      cy: MEMBRANES.mitoOuter.cy,
      outerRx: MEMBRANES.mitoOuter.rx,
      outerRy: MEMBRANES.mitoOuter.ry,
      innerRx: MEMBRANES.mitoInner.rx,
      innerRy: MEMBRANES.mitoInner.ry,
      startDeg: -38,
      endDeg: 36
    }
  ];

  let teamCount = 5;
  let teamNames = defaultTeamNames(teamCount);
  let started = false;
  let showInfo = false;
  let game: GameState = createGame(teamNames);
  let feedback: MoveResult | null = null;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  $: activeTeam = game.teams[game.activeTeamIndex];
  $: leadingScore = Math.max(...game.teams.map((team) => team.score));
  $: boardIcons = getBoardIcons(game);
  $: protonDots = getProtonDots(game);
  $: reactantWater = Math.max(0, -game.resources.nWater);
  $: productWater = Math.max(0, game.resources.nWater);

  onDestroy(() => {
    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
    }
  });

  function setTeamCount(nextCount: number) {
    const next = clampTeamCount(nextCount);
    teamCount = next;
    teamNames = Array.from({ length: next }, (_, index) => teamNames[index] ?? `Squadra ${index + 1}`);
  }

  function renameTeam(index: number, event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    teamNames = teamNames.map((name, nameIndex) => (nameIndex === index ? target.value : name));
  }

  function startGame() {
    game = createGame(teamNames.slice(0, teamCount));
    feedback = null;
    showInfo = false;
    started = true;
  }

  function resetBoard() {
    game = createGame(game.teams.map((team) => team.name));
    dismissFeedback();
  }

  function openSetup() {
    teamCount = game.teams.length;
    teamNames = game.teams.map((team) => team.name);
    dismissFeedback();
    showInfo = false;
    started = false;
  }

  function chooseStep(stepId: StepId) {
    game = runStep(game, stepId);
    feedback = game.lastResult;

    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
    }

    feedbackTimer = setTimeout(() => {
      feedback = null;
    }, 1900);
  }

  function dismissFeedback() {
    feedback = null;

    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
      feedbackTimer = undefined;
    }
  }

  function getBoardIcons(state: GameState): BoardIcon[] {
    const resources = state.resources;
    const waterCount = 4 + Math.min(4, Math.abs(resources.nWater));

    return [
      ...makeMoleculeIcons('glucose', resources.extGlucose, 'outside', 'ext-glucose', {
        max: 1,
        scale: 1.1
      }),
      ...makeMoleculeIcons('oxygen', 6, 'free', 'oxygen', { max: 6, scale: 0.82, dimmed: true, drift: 78 }),
      ...makeMoleculeIcons('water', waterCount, 'free', 'water-free', {
        max: 8,
        scale: 0.76,
        dimmed: resources.nWater === 0,
        drift: 72
      }),
      ...makeMoleculeIcons('co2', resources.nCo2, 'free', 'co2', { max: 8, scale: 0.68, drift: 74 }),
      ...makeMoleculeIcons('glucose', resources.cytGlucose, 'cytosol', 'cyt-glucose', {
        max: 2,
        scale: 1.05
      }),
      ...makeMoleculeIcons('pyruvate', resources.cytPyruvate, 'cytosol', 'cyt-pyruvate', {
        max: 4
      }),
      ...makeMoleculeIcons('adp', resources.cytAdp, 'cytosol', 'cyt-adp', {
        max: 4,
        scale: 0.68
      }),
      ...makeMoleculeIcons('atp', resources.cytAtp, 'cytosol', 'cyt-atp', {
        max: 4,
        scale: 0.7
      }),
      ...makeMoleculeIcons('nad', resources.cytNad, 'cytosol', 'cyt-nad', {
        max: 4,
        scale: 0.68
      }),
      ...makeMoleculeIcons('nadh', resources.cytNadh, 'cytosol', 'cyt-nadh', {
        max: 4,
        scale: 0.68
      }),
      ...makeMoleculeIcons('pyruvate', resources.mitPyruvate, 'matrix', 'mit-pyruvate', {
        max: 4,
        scale: 0.76
      }),
      ...makeMoleculeIcons('adp', resources.mitAdp, 'matrix', 'mit-adp', {
        max: 16,
        scale: 0.52
      }),
      ...makeMoleculeIcons('atp', resources.mitAtp, 'matrix', 'mit-atp', {
        max: 10,
        scale: 0.48
      }),
      ...makeMoleculeIcons('nad', resources.mitNad, 'matrix', 'mit-nad', {
        max: 10,
        scale: 0.54
      }),
      ...makeMoleculeIcons('nadh', resources.mitNadh, 'matrix', 'mit-nadh', {
        max: 10,
        scale: 0.54
      }),
      ...makeMoleculeIcons('fad', resources.mitFad, 'matrix', 'mit-fad', {
        max: 4,
        scale: 0.56
      }),
      ...makeMoleculeIcons('fadh2', resources.mitFadh2, 'matrix', 'mit-fadh2', {
        max: 4,
        scale: 0.56
      })
    ];
  }

  function makeMoleculeIcons(
    kind: TokenKind,
    count: number,
    compartment: MoleculeCompartment,
    key: string,
    options: {
      max?: number;
      scale?: number;
      dimmed?: boolean;
      drift?: number;
    } = {}
  ): BoardIcon[] {
    const max = options.max ?? 8;
    const visibleCount = count;

    return Array.from({ length: visibleCount }, (_, index) => {
      const seed = hashString(`${key}-${index}`);
      const point = randomPointInCompartment(compartment, seed);
      const drift = moleculeDrift(compartment, point, seed + 47, options.drift);

      return {
        key: `${key}-${index}`,
        kind,
        compartment,
        x: point.x,
        y: point.y,
        driftX: drift.x,
        driftY: drift.y,
        duration: 7 + pseudoRandom(seed + 59) * 8,
        delay: pseudoRandom(seed + 61) * 10,
        spin: -8 + pseudoRandom(seed + 67) * 16,
        scale: options.scale,
        dimmed: options.dimmed,
        rotate: -10 + pseudoRandom(seed + 71) * 20
      };
    });
  }

  function randomPointInCompartment(compartment: MoleculeCompartment, seed: number): Point {
    switch (compartment) {
      case 'free':
        return {
          x: roundSvg(70 + pseudoRandom(seed + 3) * (BOARD.width - 140)),
          y: roundSvg(70 + pseudoRandom(seed + 5) * (BOARD.height - 140))
        };
      case 'matrix':
        return sampleInEllipse(MEMBRANES.mitoInner, seed, 0.78);
      case 'intermembrane':
        return sampleInEllipticalBand(MEMBRANES.mitoInner, MEMBRANES.mitoOuter, seed);
      case 'cytosol':
        return randomPointByRejection(seed, (point) => pointInCompartment(point, 'cytosol'), relativePoint(MEMBRANES.cell, -0.48, 0));
      case 'outside':
        return randomPointByRejection(seed, (point) => pointInCompartment(point, 'outside'), { x: 84, y: 112 });
    }
  }

  function moleculeDrift(
    compartment: MoleculeCompartment,
    point: Point,
    seed: number,
    preferredAmplitude?: number
  ): Point {
    const amplitude =
      preferredAmplitude ??
      {
        outside: 42,
        cytosol: 34,
        intermembrane: 20,
        matrix: 26,
        free: 70
      }[compartment];
    const theta = pseudoRandom(seed) * Math.PI * 2;
    const distance = amplitude * (0.45 + pseudoRandom(seed + 1) * 0.55);
    const dx = Math.cos(theta) * distance;
    const dy = Math.sin(theta) * distance;

    for (const factor of [1, 0.74, 0.5, 0.28, 0.12]) {
      const endpoint = { x: point.x + dx * factor, y: point.y + dy * factor };

      if (pointInCompartment(endpoint, compartment)) {
        return { x: roundSvg(dx * factor), y: roundSvg(dy * factor) };
      }
    }

    return { x: 0, y: 0 };
  }

  function randomPointByRejection(seed: number, accepts: (point: Point) => boolean, fallback: Point): Point {
    for (let attempt = 0; attempt < 70; attempt += 1) {
      const point = {
        x: roundSvg(54 + pseudoRandom(seed + attempt * 11) * (BOARD.width - 108)),
        y: roundSvg(54 + pseudoRandom(seed + attempt * 17) * (BOARD.height - 108))
      };

      if (accepts(point)) {
        return point;
      }
    }

    return fallback;
  }

  function sampleInEllipse(ellipse: Ellipse, seed: number, shrink = 1): Point {
    const theta = pseudoRandom(seed + 7) * Math.PI * 2;
    const radius = Math.sqrt(pseudoRandom(seed + 13)) * shrink;

    return {
      x: roundSvg(ellipse.cx + Math.cos(theta) * ellipse.rx * radius),
      y: roundSvg(ellipse.cy + Math.sin(theta) * ellipse.ry * radius)
    };
  }

  function sampleInEllipticalBand(inner: Ellipse, outer: Ellipse, seed: number): Point {
    const theta = pseudoRandom(seed + 19) * Math.PI * 2;
    const band = 0.2 + pseudoRandom(seed + 23) * 0.68;
    const rx = inner.rx * 1.05 + (outer.rx * 0.94 - inner.rx * 1.05) * band;
    const ry = inner.ry * 1.05 + (outer.ry * 0.94 - inner.ry * 1.05) * band;

    return {
      x: roundSvg(outer.cx + Math.cos(theta) * rx),
      y: roundSvg(outer.cy + Math.sin(theta) * ry)
    };
  }

  function pointInCompartment(point: Point, compartment: MoleculeCompartment): boolean {
    switch (compartment) {
      case 'free':
        return isInsideBoard(point, 46);
      case 'outside':
        return isInsideBoard(point, 46) && !isInsideEllipse(point, MEMBRANES.cell, 1.04);
      case 'cytosol':
        return isInsideEllipse(point, MEMBRANES.cell, 0.92) && !isInsideEllipse(point, MEMBRANES.mitoOuter, 1.08);
      case 'intermembrane':
        return isInsideEllipse(point, MEMBRANES.mitoOuter, 0.96) && !isInsideEllipse(point, MEMBRANES.mitoInner, 1.05);
      case 'matrix':
        return isInsideEllipse(point, MEMBRANES.mitoInner, 0.86);
    }
  }

  function isInsideBoard(point: Point, margin: number): boolean {
    return point.x >= margin && point.x <= BOARD.width - margin && point.y >= margin && point.y <= BOARD.height - margin;
  }

  function isInsideEllipse(point: Point, ellipse: Ellipse, scale = 1): boolean {
    const normalizedX = (point.x - ellipse.cx) / (ellipse.rx * scale);
    const normalizedY = (point.y - ellipse.cy) / (ellipse.ry * scale);

    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  function hashString(value: string): number {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }

    return hash + 1;
  }

  function getProtonDots(state: GameState): ProtonDot[] {
    return [
      ...makeProtonDots('matrix', state.resources.mitH),
      ...makeProtonDots('intermembrane', state.resources.intH)
    ];
  }

  function makeProtonDots(fieldId: ProtonFieldId, count: number): ProtonDot[] {
    const field = PROTON_FIELDS.find((candidate) => candidate.id === fieldId);

    if (!field) {
      return [];
    }

    const visibleCount = count;
    return Array.from({ length: visibleCount }, (_, index) => {
      const seed = fieldId === 'matrix' ? index + 31 : index + 211;
      const theta = degreesToRadians(field.startDeg + pseudoRandom(seed) * (field.endDeg - field.startDeg));
      const band = 0.18 + pseudoRandom(seed + 17) * 0.66;
      const rx = field.innerRx + (field.outerRx - field.innerRx) * band;
      const ry = field.innerRy + (field.outerRy - field.innerRy) * band;
      const x = field.cx + Math.cos(theta) * rx;
      const y = field.cy + Math.sin(theta) * ry;

      return {
        key: `${fieldId}-h-${index}`,
        field: fieldId,
        x,
        y,
        radius: 2.4 + pseudoRandom(seed + 5) * 1.5,
        driftX: -5 + pseudoRandom(seed + 9) * 10,
        driftY: -4 + pseudoRandom(seed + 13) * 8,
        duration: 2.2 + pseudoRandom(seed + 21) * 2.8,
        delay: pseudoRandom(seed + 25) * 4
      };
    });
  }

  function pseudoRandom(seed: number): number {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  }

  function placeAction(
    id: StepId,
    center: Point,
    width: number,
    height: number,
    label: string,
    hint: string,
    offsetX = 0,
    offsetY = 0
  ): BoardAction {
    return {
      id,
      x: roundSvg(center.x - width / 2 + offsetX),
      y: roundSvg(center.y - height / 2 + offsetY),
      width,
      height,
      label,
      hint
    };
  }

  function ellipsePath(ellipse: Ellipse): string {
    return [
      `M ${roundSvg(ellipse.cx - ellipse.rx)} ${ellipse.cy}`,
      `A ${ellipse.rx} ${ellipse.ry} 0 1 1 ${roundSvg(ellipse.cx + ellipse.rx)} ${ellipse.cy}`,
      `A ${ellipse.rx} ${ellipse.ry} 0 1 1 ${roundSvg(ellipse.cx - ellipse.rx)} ${ellipse.cy}`,
      'Z'
    ].join(' ');
  }

  function pointOnEllipse(ellipse: Ellipse, deg: number): Point {
    return ellipsePoint(ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry, deg);
  }

  function relativePoint(ellipse: Ellipse, relX: number, relY: number): Point {
    return {
      x: roundSvg(ellipse.cx + ellipse.rx * relX),
      y: roundSvg(ellipse.cy + ellipse.ry * relY)
    };
  }

  function curvedPath(start: Point, end: Point, liftX = 0, liftY = 0): string {
    const c1 = {
      x: start.x + (end.x - start.x) * 0.35 + liftX,
      y: start.y + (end.y - start.y) * 0.25 + liftY
    };
    const c2 = {
      x: start.x + (end.x - start.x) * 0.72 - liftX,
      y: start.y + (end.y - start.y) * 0.78 - liftY
    };

    return `M ${start.x} ${start.y} C ${roundSvg(c1.x)} ${roundSvg(c1.y)} ${roundSvg(c2.x)} ${roundSvg(c2.y)} ${end.x} ${end.y}`;
  }

  function cristaPath(row: number, seed: number): string {
    const inner = MEMBRANES.mitoInner;
    const start = relativePoint(inner, -0.82, row);
    const end = relativePoint(inner, 0.66, row + 0.02);
    const wave = 38 + (seed % 3) * 5;
    const midY = inner.cy + inner.ry * row;

    return [
      `M ${start.x} ${start.y}`,
      `C ${roundSvg(inner.cx - inner.rx * 0.56)} ${roundSvg(midY - wave)}`,
      `${roundSvg(inner.cx - inner.rx * 0.34)} ${roundSvg(midY + wave)}`,
      `${roundSvg(inner.cx - inner.rx * 0.12)} ${roundSvg(midY)}`,
      `S ${roundSvg(inner.cx + inner.rx * 0.18)} ${roundSvg(midY - wave)}`,
      `${roundSvg(inner.cx + inner.rx * 0.42)} ${roundSvg(midY - 2)}`,
      `S ${roundSvg(inner.cx + inner.rx * 0.58)} ${roundSvg(midY + wave * 0.62)}`,
      `${end.x} ${end.y}`
    ].join(' ');
  }

  function annularSectorPath(
    cx: number,
    cy: number,
    outerRx: number,
    outerRy: number,
    innerRx: number,
    innerRy: number,
    startDeg: number,
    endDeg: number
  ): string {
    const start = ellipsePoint(cx, cy, outerRx, outerRy, startDeg);
    const end = ellipsePoint(cx, cy, outerRx, outerRy, endDeg);
    const innerEnd = ellipsePoint(cx, cy, innerRx, innerRy, endDeg);
    const innerStart = ellipsePoint(cx, cy, innerRx, innerRy, startDeg);
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;

    return [
      `M ${start.x} ${start.y}`,
      `A ${outerRx} ${outerRy} 0 ${largeArc} 1 ${end.x} ${end.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerRx} ${innerRy} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
      'Z'
    ].join(' ');
  }

  function ellipsePoint(cx: number, cy: number, rx: number, ry: number, deg: number): { x: number; y: number } {
    const radians = degreesToRadians(deg);

    return {
      x: roundSvg(cx + Math.cos(radians) * rx),
      y: roundSvg(cy + Math.sin(radians) * ry)
    };
  }

  function degreesToRadians(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  function roundSvg(value: number): number {
    return Math.round(value * 10) / 10;
  }
</script>

<svelte:head>
  <title>Respirazione cellulare | Gioco a squadre</title>
</svelte:head>

{#if !started}
  <main class="setup-page">
    <section class="setup-scene" aria-label="Configurazione partita">
      <div class="cell-preview" aria-hidden="true">
        <div class="preview-cell">
          <div class="preview-mitochondrion">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="preview-token glucose"></div>
          <div class="preview-token atp"></div>
          <div class="preview-token nadh"></div>
          <div class="preview-token proton"></div>
        </div>
      </div>

      <div class="setup-panel">
        <div class="panel-title">
          <div class="icon-tile"><FlaskConical size={22} /></div>
          <div>
            <p class="eyebrow">Gioco didattico</p>
            <h1>Respirazione cellulare</h1>
          </div>
        </div>

        <div class="team-count-control">
          <div>
            <label for="team-count">Numero di squadre</label>
            <strong>{teamCount}</strong>
          </div>
          <div class="stepper">
            <button
              type="button"
              class="icon-button"
              aria-label="Riduci squadre"
              onclick={() => setTeamCount(teamCount - 1)}
            >
              <Minus size={18} />
            </button>
            <input
              id="team-count"
              min="2"
              max="8"
              type="range"
              value={teamCount}
              oninput={(event) => setTeamCount(Number((event.currentTarget as HTMLInputElement).value))}
            />
            <button
              type="button"
              class="icon-button"
              aria-label="Aumenta squadre"
              onclick={() => setTeamCount(teamCount + 1)}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div class="team-name-grid">
          {#each teamNames as name, index}
            <label class="team-name-field" style={`--team-color: ${getTeamColor(index)}`}>
              <span>Squadra {index + 1}</span>
              <input value={name} oninput={(event) => renameTeam(index, event)} />
            </label>
          {/each}
        </div>

        <button type="button" class="primary-action" onclick={startGame}>
          <Play size={20} />
          Avvia partita
        </button>
      </div>
    </section>
  </main>
{:else}
  <main class="game-page">
    <header class="game-header">
      <div class="game-title">
        <div>
          <h1>Respirazione cellulare</h1>
        </div>
      </div>

      <section class="reaction-strip" aria-label="Reazione complessiva">
        <span class="coefficient">{game.resources.nGlucose}</span>
        <span>C<sub>6</sub>H<sub>12</sub>O<sub>6</sub></span>
        <span class="operator">+</span>
        <span class="coefficient">{game.resources.nOxygen}</span>
        <span>O<sub>2</sub></span>
        {#if reactantWater > 0}
          <span class="operator">+</span>
          <span class="coefficient">{reactantWater}</span>
          <span>H<sub>2</sub>O</span>
        {/if}
        <span class="arrow">-></span>
        <span class="coefficient">{game.resources.nCo2}</span>
        <span>CO<sub>2</sub></span>
        <span class="operator">+</span>
        <span class="coefficient">{productWater}</span>
        <span>H<sub>2</sub>O</span>
        <span class="operator">+</span>
        <span class="coefficient">{game.resources.nAtp}</span>
        <span>ATP</span>
      </section>

      <div class="header-actions">
        <button type="button" class="tool-button" aria-label="Apri legenda e storico" onclick={() => (showInfo = true)}>
          <BookOpen size={18} />
        </button>
        <button type="button" class="tool-button" aria-label="Configura squadre" onclick={openSetup}>
          <Settings2 size={18} />
        </button>
        <button type="button" class="tool-button" aria-label="Reset partita" onclick={resetBoard}>
          <RotateCcw size={18} />
        </button>
      </div>
    </header>

    <section class="scoreboard" aria-label="Punteggi squadre">
      {#each game.teams as team, index}
        <article
          class:active={index === game.activeTeamIndex}
          class:leading={team.score === leadingScore && leadingScore > 0}
          class="score-card"
          style={`--team-color: ${team.color}`}
        >
          <span class="team-color"></span>
          <div>
            <p>{team.name}</p>
            <strong>{team.score}</strong>
          </div>
          {#if index === game.activeTeamIndex}
            <span class="turn-chip">Tocca a voi</span>
          {:else if team.score === leadingScore && leadingScore > 0}
            <Trophy size={18} />
          {/if}
        </article>
      {/each}
    </section>

    <section class="board-shell" aria-label="Schema della cellula">
      <svg class="board-svg" viewBox="0 0 1280 720" role="img" aria-label="Cellula con mitocondrio, molecole e azioni">
        <defs>
          <linearGradient id="cellFill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#d8f3ee" />
            <stop offset="58%" stop-color="#e9f7ff" />
            <stop offset="100%" stop-color="#fff3ca" />
          </linearGradient>
          <linearGradient id="mitoFill" x1="0" x2="1">
            <stop offset="0%" stop-color="#ffe28d" />
            <stop offset="100%" stop-color="#ff9168" />
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#273241" flood-opacity="0.18" />
          </filter>
          <mask id="outside-mask" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={BOARD.width} height={BOARD.height} fill="white" />
            <path d={CELL_MEMBRANE_PATH} fill="black" />
          </mask>
          <mask id="cytosol-mask" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={BOARD.width} height={BOARD.height} fill="black" />
            <path d={CELL_MEMBRANE_PATH} fill="white" />
            <path d={OUTER_MITO_PATH} fill="black" />
          </mask>
          <mask id="intermembrane-mask" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={BOARD.width} height={BOARD.height} fill="black" />
            <path d={OUTER_MITO_PATH} fill="white" />
            <path d={INNER_MITO_PATH} fill="black" />
          </mask>
          <mask id="matrix-mask" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={BOARD.width} height={BOARD.height} fill="black" />
            <path d={INNER_MITO_PATH} fill="white" />
          </mask>
          {#each PROTON_FIELDS as field}
            <clipPath id={`proton-clip-${field.id}`}>
              <path d={field.path} />
            </clipPath>
          {/each}

          <symbol id="icon-glucose" viewBox="-34 -22 68 44">
            <path d="M-18 -18 H17 L32 0 L17 18 H-18 L-32 0 Z" fill="#eef2f5" stroke="#aeb8c2" stroke-width="3" />
            <text class="molecule-text" x="0" y="5">Glu</text>
          </symbol>
          <symbol id="icon-pyruvate" viewBox="-38 -19 76 38">
            <rect x="-34" y="-16" width="68" height="32" rx="16" fill="#cfd5da" stroke="#9aa6af" stroke-width="3" />
            <text class="molecule-text" x="0" y="5">Pir</text>
          </symbol>
          <symbol id="icon-adp" viewBox="-28 -28 56 56">
            <path
              d="M0 -26 L8 -8 L27 -7 L12 5 L17 25 L0 14 L-17 25 L-12 5 L-27 -7 L-8 -8 Z"
              fill="#b7aa73"
              stroke="#8f8044"
              stroke-width="3"
            />
            <text class="molecule-text" x="0" y="6">ADP</text>
          </symbol>
          <symbol id="icon-atp" viewBox="-28 -28 56 56">
            <path
              d="M0 -26 L8 -8 L27 -7 L12 5 L17 25 L0 14 L-17 25 L-12 5 L-27 -7 L-8 -8 Z"
              fill="#ffe05c"
              stroke="#d8a51e"
              stroke-width="3"
            />
            <text class="molecule-text" x="0" y="6">ATP</text>
          </symbol>
          <symbol id="icon-nad" viewBox="-32 -22 64 44">
            <rect x="-28" y="-17" width="56" height="34" rx="7" fill="#7f95ff" stroke="#425bd3" stroke-width="3" />
            <text class="molecule-text" x="0" y="5">NAD+</text>
          </symbol>
          <symbol id="icon-nadh" viewBox="-32 -22 64 44">
            <rect x="-28" y="-17" width="56" height="34" rx="7" fill="#3154dd" stroke="#162c91" stroke-width="3" />
            <text class="molecule-text light" x="0" y="5">NADH</text>
          </symbol>
          <symbol id="icon-fad" viewBox="-32 -22 64 44">
            <rect x="-28" y="-17" width="56" height="34" rx="7" fill="#7fdb76" stroke="#41a63d" stroke-width="3" />
            <text class="molecule-text" x="0" y="5">FAD</text>
          </symbol>
          <symbol id="icon-fadh2" viewBox="-34 -22 68 44">
            <rect x="-30" y="-17" width="60" height="34" rx="7" fill="#31b75a" stroke="#18813c" stroke-width="3" />
            <text class="molecule-text light" x="0" y="5">FADH2</text>
          </symbol>
          <symbol id="icon-oxygen" viewBox="-32 -20 64 40">
            <circle cx="-10" cy="0" r="15" fill="#9bc9ff" stroke="#4d7fd8" stroke-width="3" />
            <circle cx="12" cy="0" r="15" fill="#9bc9ff" stroke="#4d7fd8" stroke-width="3" />
            <text class="molecule-text" x="0" y="6">O2</text>
          </symbol>
          <symbol id="icon-water" viewBox="-24 -30 48 60">
            <path
              d="M0 -26 C12 -8 22 5 22 17 C22 29 12 36 0 36 C-12 36 -22 29 -22 17 C-22 5 -12 -8 0 -26 Z"
              fill="#62cbe0"
              stroke="#23879b"
              stroke-width="3"
            />
            <text class="molecule-text" x="0" y="14">H2O</text>
          </symbol>
          <symbol id="icon-co2" viewBox="-34 -22 68 44">
            <circle cx="-17" cy="0" r="14" fill="#b8c0c9" stroke="#7b8794" stroke-width="3" />
            <circle cx="0" cy="0" r="14" fill="#b8c0c9" stroke="#7b8794" stroke-width="3" />
            <circle cx="17" cy="0" r="14" fill="#b8c0c9" stroke="#7b8794" stroke-width="3" />
            <text class="molecule-text" x="0" y="6">CO2</text>
          </symbol>
        </defs>

        <rect class="board-bg" x="0" y="0" width="1280" height="720" rx="34" />

        <path class="cell-shape" d={CELL_MEMBRANE_PATH} />

        <g class="mito-art" filter="url(#softShadow)">
          <path class="outer-mito" d={OUTER_MITO_PATH} />
          <path class="inner-membrane" d={INNER_MITO_PATH} />
        </g>

        {#each PROTON_FIELDS as field}
          <g class={`proton-field ${field.id}`}>
            <path d={field.path} />
            <text x={field.labelX} y={field.labelY}>{field.label}</text>
          </g>
          <g clip-path={`url(#proton-clip-${field.id})`}>
            {#each protonDots.filter((dot) => dot.field === field.id) as dot}
              <circle
                class={`proton-dot ${dot.field}`}
                cx={dot.x}
                cy={dot.y}
                r={dot.radius}
                style={`--drift-x: ${dot.driftX}px; --drift-y: ${dot.driftY}px; --duration: ${dot.duration}s; --delay: -${dot.delay}s`}
              />
            {/each}
          </g>
        {/each}


        <g class="zone-labels">
          <text class="zone-label outside-label" x="54" y="62">Esterno</text>
          <text class="zone-label cytosol-label" x="246" y="142">Citoplasma</text>
          <text class="zone-label intermembrane-label" x="900" y="248">Spazio intermembrana</text>
          <text class="zone-label matrix-label" x="620" y="300">Matrice mitocondriale</text>
        </g>

        {#each MOLECULE_LAYERS as layer}
          <g class={`molecule-layer ${layer.id}`} mask={`url(#${layer.maskId})`}>
            {#each boardIcons.filter((icon) => icon.compartment === layer.id) as icon}
              <g transform={`translate(${icon.x} ${icon.y})`}>
                <g
                  class={`molecule ${icon.kind}`}
                  class:dimmed={icon.dimmed}
                  style={`--drift-x: ${icon.driftX}px; --drift-y: ${icon.driftY}px; --duration: ${icon.duration}s; --delay: -${icon.delay}s; --spin: ${icon.spin}deg; --base-rotate: ${icon.rotate ?? 0}deg; --scale: ${icon.scale ?? 1}`}
                >
                  <use href={`#icon-${icon.kind}`} x="-38" y="-38" width="76" height="76" />
                </g>
              </g>
            {/each}
          </g>
        {/each}

        {#each boardIcons.filter((icon) => icon.compartment === 'free') as icon}
          <g transform={`translate(${icon.x} ${icon.y})`}>
            <g
              class={`molecule ${icon.kind}`}
              class:dimmed={icon.dimmed}
              style={`--drift-x: ${icon.driftX}px; --drift-y: ${icon.driftY}px; --duration: ${icon.duration}s; --delay: -${icon.delay}s; --spin: ${icon.spin}deg; --base-rotate: ${icon.rotate ?? 0}deg; --scale: ${icon.scale ?? 1}`}
            >
              <use href={`#icon-${icon.kind}`} x="-38" y="-38" width="76" height="76" />
            </g>
          </g>
        {/each}

        {#each BOARD_ACTIONS as action}
          <foreignObject x={action.x} y={action.y} width={action.width} height={action.height}>
            <button
              type="button"
              class="board-action"
              aria-label={action.label}
              onclick={() => chooseStep(action.id)}
            >
              <strong>{action.label}</strong>
              <span>{action.hint}</span>
            </button>
          </foreignObject>
        {/each}
      </svg>

      {#if feedback}
        <button type="button" class="feedback-layer" aria-label="Chiudi feedback" onclick={dismissFeedback}>
          <span
            class:success={feedback.success}
            class:failure={!feedback.success}
            class="feedback-pop"
            style={`--team-color: ${feedback.teamColor}`}
            aria-live="polite"
          >
            <span class="feedback-title">{feedback.success ? 'Operazione riuscita!' : 'Non puoi farlo!'}</span>
            <strong>{feedback.teamName}</strong>
            <span class="feedback-points">{feedback.pointsDelta > 0 ? '+' : ''}{feedback.pointsDelta} punti</span>
            <small>{feedback.stepLabel}</small>
          </span>
        </button>
      {/if}
    </section>

    {#if showInfo}
      <div class="modal-backdrop" role="presentation">
        <button
          type="button"
          class="backdrop-dismiss"
          aria-label="Chiudi legenda e storico"
          onclick={() => (showInfo = false)}
        ></button>
        <div class="info-modal" role="dialog" aria-modal="true" aria-label="Legenda e storico">
          <header>
            <div>
              <p class="eyebrow">Supporto docente</p>
              <h2>Azioni e storico</h2>
            </div>
            <button type="button" class="tool-button" aria-label="Chiudi popup" onclick={() => (showInfo = false)}>
              <X size={18} />
            </button>
          </header>

          <div class="modal-grid">
            <section>
              <div class="modal-heading">
                <BookOpen size={18} />
                <h3>Azioni</h3>
              </div>
              <div class="action-reference">
                {#each STEP_DEFINITIONS as step}
                  <article>
                    <strong>{step.label}</strong>
                    <span>{step.area} | +{step.prize}</span>
                    <p>{step.equation}</p>
                  </article>
                {/each}
              </div>
            </section>

            <section>
              <div class="modal-heading">
                <History size={18} />
                <h3>Ultime mosse</h3>
              </div>
              {#if game.history.length === 0}
                <p class="empty-history">Nessuna mossa registrata.</p>
              {:else}
                <ol class="history-list">
                  {#each game.history as move}
                    <li class:success={move.success}>
                      <span>{move.teamName}</span>
                      <strong>{move.stepLabel}</strong>
                      <em>{move.pointsDelta > 0 ? '+' : ''}{move.pointsDelta}</em>
                    </li>
                  {/each}
                </ol>
              {/if}
            </section>
          </div>
        </div>
      </div>
    {/if}
  </main>
{/if}
