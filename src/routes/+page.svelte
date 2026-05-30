<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    BookOpen,
    ExternalLink,
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
  import { base } from '$app/paths';
  import MoleculeSymbols from '$lib/MoleculeSymbols.svelte';
  import {
    STEP_DEFINITIONS,
    TARGET_ATP,
    attemptStep as runStep,
    clampTeamCount,
    createGame,
    defaultTeamNames,
    getReactionProgress,
    getTeamColor,
    type GameState,
    type MoveResult,
    type Resources,
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

  type MoleculePhase =
    | {
        kind: 'drift';
      }
    | {
        kind: 'to-action' | 'from-action';
        start: Point;
        target: Point;
        startedAt: number;
        duration: number;
      };

  type BoardIcon = {
    id: string;
    specId: string;
    kind: TokenKind;
    compartment: MoleculeCompartment;
    x: number;
    y: number;
    vx: number;
    vy: number;
    spin: number;
    rotate: number;
    scale?: number;
    dimmed?: boolean;
    phase: MoleculePhase;
  };

  type MoleculeDisplaySpec = {
    id: string;
    kind: TokenKind;
    compartment: MoleculeCompartment;
    resource: keyof Resources;
    scale?: number;
    dimmed?: boolean;
  };

  type MoleculeChange = {
    spec: MoleculeDisplaySpec;
    amount: number;
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

  type ProtonTransitDot = {
    id: string;
    field: ProtonFieldId;
    phase: 'to-action' | 'from-action';
    x: number;
    y: number;
    dx: number;
    dy: number;
    radius: number;
    duration: number;
    delay: number;
  };

  type ProtonFlow = {
    source: ProtonFieldId;
    target: ProtonFieldId;
    count: number;
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
    placeAction('import-glucose', pointOnEllipse(MEMBRANES.cell, -155), 170, 40, 'Importa glucosio', 'membrana cellulare', 12, -2),
    placeAction('glycolysis', relativePoint(MEMBRANES.cell, -0.58, 0.3), 146, 40, 'Glicolisi', 'citoplasma'),
    placeAction(
      'import-pyruvate',
      pointOnEllipse(MEMBRANES.mitoOuter, 176),
      188,
      40,
      'Importa piruvato',
      'membrana esterna',
      18,
      0
    ),
    placeAction('import-nadh', pointOnEllipse(MEMBRANES.mitoOuter, -145), 150, 40, 'Importa NADH', 'shuttle', 18, -10),
    placeAction('krebs', relativePoint(MEMBRANES.mitoInner, -0.2, 0.02), 150, 40, 'Ciclo di Krebs', 'matrice'),
    placeAction(
      'etc',
      pointOnEllipse(MEMBRANES.mitoInner, -40),
      188,
      40,
      'Catena di trasporto',
      'membrana interna',
      -4,
      -4
    ),
    placeAction('atp-synthase', pointOnEllipse(MEMBRANES.mitoInner, 40), 156, 40, 'ATP sintasi', 'membrana interna', 0, 8)
  ];

  const MOLECULE_SPECS: MoleculeDisplaySpec[] = [
    moleculeSpec('ext-glucose', 'glucose', 'outside', 'extGlucose', { scale: 1.1 }),
    moleculeSpec('oxygen', 'oxygen', 'free', 'freeOxygen', { scale: 0.82 }),
    moleculeSpec('water-free', 'water', 'free', 'freeWater', { scale: 0.76 }),
    moleculeSpec('co2', 'co2', 'free', 'freeCo2', { scale: 0.68 }),
    moleculeSpec('cyt-glucose', 'glucose', 'cytosol', 'cytGlucose', { scale: 1.05 }),
    moleculeSpec('cyt-pyruvate', 'pyruvate', 'cytosol', 'cytPyruvate'),
    moleculeSpec('cyt-adp', 'adp', 'cytosol', 'cytAdp', { scale: 0.68 }),
    moleculeSpec('cyt-atp', 'atp', 'cytosol', 'cytAtp', { scale: 0.7 }),
    moleculeSpec('cyt-nad', 'nad', 'cytosol', 'cytNad', { scale: 0.68 }),
    moleculeSpec('cyt-nadh', 'nadh', 'cytosol', 'cytNadh', { scale: 0.68 }),
    moleculeSpec('mit-pyruvate', 'pyruvate', 'matrix', 'mitPyruvate', { scale: 0.76 }),
    moleculeSpec('mit-adp', 'adp', 'matrix', 'mitAdp', { scale: 0.52 }),
    moleculeSpec('mit-atp', 'atp', 'matrix', 'mitAtp', { scale: 0.48 }),
    moleculeSpec('mit-nad', 'nad', 'matrix', 'mitNad', { scale: 0.54 }),
    moleculeSpec('mit-nadh', 'nadh', 'matrix', 'mitNadh', { scale: 0.54 }),
    moleculeSpec('mit-fad', 'fad', 'matrix', 'mitFad', { scale: 0.56 }),
    moleculeSpec('mit-fadh2', 'fadh2', 'matrix', 'mitFadh2', { scale: 0.56 })
  ];

  const MOLECULE_TO_ACTION_MS = 640;
  const MOLECULE_FROM_ACTION_MS = 780;
  const PROTON_TO_ACTION_MS = 620;
  const PROTON_FROM_ACTION_MS = 760;

  
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
  let boardIcons: BoardIcon[] = [];
  let transitProtons: ProtonTransitDot[] = [];
  let feedback: MoveResult | null = null;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let moleculeTransitioning = false;
  let ambientPaused = false;
  let moleculeSerial = 0;
  let animationRun = 0;
  let frameRequest: number | undefined;
  let lastFrameAt = 0;

  const moleculeElements = new Map<string, SVGGElement>();

  $: activeTeam = game.teams[game.activeTeamIndex];
  $: leadingScore = Math.max(...game.teams.map((team) => team.score));
  $: gameFinished = game.completed;
  $: tutorialActive = !game.tutorialCompleted;
  $: protonDots = getProtonDots(game);
  $: reaction = getReactionProgress(game.resources);

  onMount(() => {
    lastFrameAt = performance.now();
    frameRequest = requestAnimationFrame(runMoleculeFrame);
  });

  onDestroy(() => {
    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
    }

    animationRun += 1;

    if (frameRequest !== undefined) {
      cancelAnimationFrame(frameRequest);
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
    const nextGame = createGame(teamNames.slice(0, teamCount));

    cancelMoleculeTransition();
    game = nextGame;
    boardIcons = createMoleculesFromGame(nextGame);
    feedback = null;
    showInfo = false;
    started = true;
  }

  function resetBoard() {
    const nextGame = createGame(game.teams.map((team) => team.name));

    cancelMoleculeTransition();
    game = nextGame;
    boardIcons = createMoleculesFromGame(nextGame);
    dismissFeedback();
  }

  function openSetup() {
    cancelMoleculeTransition();
    teamCount = game.teams.length;
    teamNames = game.teams.map((team) => team.name);
    boardIcons = [];
    dismissFeedback();
    showInfo = false;
    started = false;
  }

  async function chooseStep(stepId: StepId) {
    if (gameFinished || feedback || moleculeTransitioning) {
      return;
    }

    const previousGame = game;
    const nextGame = runStep(game, stepId);
    const result = nextGame.lastResult;

    if (!result) {
      return;
    }

    if (!result.success) {
      game = nextGame;
      showFeedback(result, result.gameOver);
      return;
    }

    const completed = await playSuccessfulStep(stepId, previousGame, nextGame);

    if (!completed) {
      return;
    }

    game = nextGame;
    showFeedback(result, result.gameOver);
  }

  function dismissFeedback() {
    feedback = null;

    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
      feedbackTimer = undefined;
    }
  }

  function showFeedback(result: MoveResult, keepVisible = false) {
    feedback = result;

    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
      feedbackTimer = undefined;
    }

    if (keepVisible) {
      return;
    }

    feedbackTimer = setTimeout(() => {
      feedback = null;
    }, 1900);
  }

  function moleculeSpec(
    id: string,
    kind: TokenKind,
    compartment: MoleculeCompartment,
    resource: keyof Resources,
    options: {
      scale?: number;
      dimmed?: boolean;
    } = {}
  ): MoleculeDisplaySpec {
    return {
      id,
      kind,
      compartment,
      resource,
      scale: options.scale,
      dimmed: options.dimmed
    };
  }

  function createMoleculesFromGame(state: GameState): BoardIcon[] {
    moleculeSerial = 0;

    return MOLECULE_SPECS.flatMap((spec) =>
      Array.from({ length: state.resources[spec.resource] }, () => createMolecule(spec))
    );
  }

  function createMolecule(
    spec: MoleculeDisplaySpec,
    options: {
      start?: Point;
      target?: Point;
      phase?: 'drift' | 'from-action';
      startedAt?: number;
      duration?: number;
    } = {}
  ): BoardIcon {
    const seed = randomSeed();
    const point = options.start ?? randomPointInCompartment(spec.compartment, seed);
    const velocity = randomVelocity(spec.compartment, seed + 37);
    const target = options.target;

    return {
      id: `${spec.id}-${moleculeSerial++}`,
      specId: spec.id,
      kind: spec.kind,
      compartment: spec.compartment,
      x: point.x,
      y: point.y,
      vx: velocity.x,
      vy: velocity.y,
      spin: -10 + pseudoRandom(seed + 67) * 20,
      rotate: -14 + pseudoRandom(seed + 71) * 28,
      scale: spec.scale,
      dimmed: spec.dimmed,
      phase:
        options.phase === 'from-action' && target
          ? {
              kind: 'from-action',
              start: point,
              target,
              startedAt: options.startedAt ?? performance.now(),
              duration: options.duration ?? MOLECULE_FROM_ACTION_MS
            }
          : { kind: 'drift' }
    };
  }

  async function playSuccessfulStep(stepId: StepId, before: GameState, after: GameState): Promise<boolean> {
    const runId = animationRun + 1;
    animationRun = runId;
    moleculeTransitioning = true;
    ambientPaused = true;

    const actionPoint = actionDropPoint(stepId);
    const changes = getMoleculeChanges(before.resources, after.resources);
    const reactants = selectReactants(changes.consumed);
    const protonFlow = getProtonFlow(before.resources, after.resources);
    const now = performance.now();

    reactants.forEach((molecule, index) => {
      molecule.phase = {
        kind: 'to-action',
        start: { x: molecule.x, y: molecule.y },
        target: pointNear(actionPoint, index, reactants.length, 7),
        startedAt: now,
        duration: MOLECULE_TO_ACTION_MS + pseudoRandom(hashString(molecule.id)) * 140
      };
    });

    transitProtons = protonFlow ? createProtonTransitDots(protonFlow, actionPoint, 'to-action') : [];
    boardIcons = [...boardIcons];
    await tick();
    await wait(MOLECULE_TO_ACTION_MS + 180);

    if (runId !== animationRun) {
      return false;
    }

    const reactantIds = new Set(reactants.map((molecule) => molecule.id));
    boardIcons = boardIcons.filter((molecule) => !reactantIds.has(molecule.id));
    await tick();

    transitProtons = protonFlow ? createProtonTransitDots(protonFlow, actionPoint, 'from-action') : [];
    const productStartAt = performance.now();
    const products = changes.produced.flatMap(({ spec, amount }) =>
      Array.from({ length: amount }, (_, index) => {
        const start = pointNear(actionPoint, index, amount, 6);
        const target = randomPointInCompartment(spec.compartment, randomSeed());

        return createMolecule(spec, {
          start,
          target,
          phase: 'from-action',
          startedAt: productStartAt,
          duration: MOLECULE_FROM_ACTION_MS + pseudoRandom(hashString(`${spec.id}-${index}-${productStartAt}`)) * 140
        });
      })
    );

    boardIcons = [...boardIcons, ...products];
    await tick();
    await wait(MOLECULE_FROM_ACTION_MS + 180);

    if (runId !== animationRun) {
      return false;
    }

    products.forEach((molecule) => {
      if (molecule.phase.kind === 'from-action') {
        molecule.x = molecule.phase.target.x;
        molecule.y = molecule.phase.target.y;
      }

      setRandomVelocity(molecule, randomSeed());
      molecule.phase = { kind: 'drift' };
    });

    ambientPaused = false;
    moleculeTransitioning = false;
    transitProtons = [];
    boardIcons = [...boardIcons];

    return true;
  }

  function cancelMoleculeTransition() {
    animationRun += 1;
    ambientPaused = false;
    moleculeTransitioning = false;
    transitProtons = [];
  }

  function getMoleculeChanges(before: Resources, after: Resources): { consumed: MoleculeChange[]; produced: MoleculeChange[] } {
    const consumed: MoleculeChange[] = [];
    const produced: MoleculeChange[] = [];

    for (const spec of MOLECULE_SPECS) {
      const beforeCount = before[spec.resource];
      const afterCount = after[spec.resource];
      const difference = afterCount - beforeCount;

      if (difference > 0) {
        produced.push({ spec, amount: difference });
      } else if (difference < 0) {
        consumed.push({ spec, amount: Math.abs(difference) });
      }
    }

    return { consumed, produced };
  }

  function selectReactants(changes: MoleculeChange[]): BoardIcon[] {
    const selected: BoardIcon[] = [];
    const alreadySelected = new Set<string>();

    for (const change of changes) {
      const candidates = boardIcons
        .filter((molecule) => molecule.specId === change.spec.id && molecule.phase.kind === 'drift' && !alreadySelected.has(molecule.id))
        .slice(-change.amount);

      for (const molecule of candidates) {
        selected.push(molecule);
        alreadySelected.add(molecule.id);
      }
    }

    return selected;
  }

  function getProtonFlow(before: Resources, after: Resources): ProtonFlow | null {
    const matrixDelta = after.mitH - before.mitH;
    const intermembraneDelta = after.intH - before.intH;

    if (matrixDelta < 0 && intermembraneDelta > 0) {
      return {
        source: 'matrix',
        target: 'intermembrane',
        count: Math.min(Math.abs(matrixDelta), intermembraneDelta)
      };
    }

    if (intermembraneDelta < 0 && matrixDelta > 0) {
      return {
        source: 'intermembrane',
        target: 'matrix',
        count: Math.min(Math.abs(intermembraneDelta), matrixDelta)
      };
    }

    return null;
  }

  function createProtonTransitDots(flow: ProtonFlow, actionPoint: Point, phase: ProtonTransitDot['phase']): ProtonTransitDot[] {
    const count = Math.min(flow.count, 24);
    const field = phase === 'to-action' ? flow.source : flow.target;

    return Array.from({ length: count }, (_, index) => {
      const seed = randomSeed();
      const fieldPoint = randomPointInProtonField(field, seed);
      const actionTarget = pointNear(actionPoint, index, count, 12);
      const start = phase === 'to-action' ? fieldPoint : actionTarget;
      const target = phase === 'to-action' ? actionTarget : fieldPoint;

      return {
        id: `${phase}-${field}-${seed}-${index}`,
        field,
        phase,
        x: start.x,
        y: start.y,
        dx: roundSvg(target.x - start.x),
        dy: roundSvg(target.y - start.y),
        radius: 2.6 + pseudoRandom(seed + 5) * 1.5,
        duration: phase === 'to-action' ? PROTON_TO_ACTION_MS : PROTON_FROM_ACTION_MS,
        delay: pseudoRandom(seed + 11) * 90
      };
    });
  }

  function runMoleculeFrame(now: number) {
    const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1000 || 0));
    lastFrameAt = now;

    for (const molecule of boardIcons) {
      updateMolecule(molecule, now, deltaSeconds);
      moleculeElements.get(molecule.id)?.setAttribute('transform', moleculeTransform(molecule));
    }

    frameRequest = requestAnimationFrame(runMoleculeFrame);
  }

  function updateMolecule(molecule: BoardIcon, now: number, deltaSeconds: number) {
    if (molecule.phase.kind === 'to-action' || molecule.phase.kind === 'from-action') {
      const progress = clamp01((now - molecule.phase.startedAt) / molecule.phase.duration);
      const eased = easeInOut(progress);

      molecule.x = lerp(molecule.phase.start.x, molecule.phase.target.x, eased);
      molecule.y = lerp(molecule.phase.start.y, molecule.phase.target.y, eased);
      molecule.rotate += molecule.spin * deltaSeconds * 2.4;
      return;
    }

    if (ambientPaused) {
      return;
    }

    const next = {
      x: molecule.x + molecule.vx * deltaSeconds,
      y: molecule.y + molecule.vy * deltaSeconds
    };

    molecule.rotate += molecule.spin * deltaSeconds * 0.22;

    if (pointInCompartment(next, molecule.compartment)) {
      molecule.x = next.x;
      molecule.y = next.y;
      return;
    }

    if (bounceMoleculeOffBoundary(molecule, next)) {
      return;
    }

    steerMoleculeInside(molecule);
  }

  function bounceMoleculeOffBoundary(molecule: BoardIcon, next: Point): boolean {
    if (molecule.compartment !== 'outside') {
      return false;
    }

    if (!isInsideBoard(next, 46)) {
      molecule.vx = next.x < 46 || next.x > BOARD.width - 46 ? -molecule.vx : molecule.vx;
      molecule.vy = next.y < 46 || next.y > BOARD.height - 46 ? -molecule.vy : molecule.vy;
      molecule.x = Math.min(BOARD.width - 46, Math.max(46, molecule.x));
      molecule.y = Math.min(BOARD.height - 46, Math.max(46, molecule.y));
      return true;
    }

    if (!isInsideEllipse(next, MEMBRANES.cell, 1.04)) {
      return false;
    }

    const normal = ellipseNormalAtPoint(next, MEMBRANES.cell);
    const velocityAlongNormal = molecule.vx * normal.x + molecule.vy * normal.y;

    molecule.vx -= 2 * velocityAlongNormal * normal.x;
    molecule.vy -= 2 * velocityAlongNormal * normal.y;

    const safePoint = pointOutsideEllipse(next, MEMBRANES.cell, 1.045);
    molecule.x = safePoint.x;
    molecule.y = safePoint.y;

    return true;
  }

  function steerMoleculeInside(molecule: BoardIcon) {
    const target = randomPointInCompartment(molecule.compartment, randomSeed());
    const dx = target.x - molecule.x;
    const dy = target.y - molecule.y;
    const distance = Math.hypot(dx, dy) || 1;
    const speed = moleculeSpeed(molecule.compartment, randomSeed());

    molecule.vx = (dx / distance) * speed;
    molecule.vy = (dy / distance) * speed;
    molecule.x = lerp(molecule.x, target.x, 0.012);
    molecule.y = lerp(molecule.y, target.y, 0.012);
  }

  function randomVelocity(compartment: MoleculeCompartment, seed: number): Point {
    const angle = pseudoRandom(seed) * Math.PI * 2;
    const speed = moleculeSpeed(compartment, seed + 1);

    return {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    };
  }

  function setRandomVelocity(molecule: BoardIcon, seed: number) {
    const velocity = randomVelocity(molecule.compartment, seed);

    molecule.vx = velocity.x;
    molecule.vy = velocity.y;
  }

  function moleculeSpeed(compartment: MoleculeCompartment, seed: number): number {
    const baseSpeed =
      {
        outside: 15,
        cytosol: 12,
        intermembrane: 9,
        matrix: 10,
        free: 18
      }[compartment] ?? 12;

    return baseSpeed * (0.65 + pseudoRandom(seed) * 0.7);
  }

  function actionDropPoint(stepId: StepId): Point {
    const action = BOARD_ACTIONS.find((candidate) => candidate.id === stepId);

    if (!action) {
      return { x: BOARD.width / 2, y: BOARD.height / 2 };
    }

    return {
      x: action.x + action.width / 2,
      y: action.y + action.height + 18
    };
  }

  function pointNear(point: Point, index: number, total: number, radius: number): Point {
    if (total <= 1) {
      return point;
    }

    const angle = (index / total) * Math.PI * 2;
    const distance = radius * (0.45 + (index % 3) * 0.26);

    return {
      x: roundSvg(point.x + Math.cos(angle) * distance),
      y: roundSvg(point.y + Math.sin(angle) * distance)
    };
  }

  function winnerLabel(names: string[]): string {
    if (names.length === 0) {
      return 'Partita conclusa';
    }

    if (names.length === 1) {
      return `Vince ${names[0]}`;
    }

    return `Vincono ${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  }

  function feedbackSubjectLabel(result: MoveResult): string {
    if (result.gameOver) {
      return winnerLabel(result.winnerNames);
    }

    return result.tutorial ? 'Tutorial' : result.teamName;
  }

  function feedbackPointsLabel(result: MoveResult): string {
    const points = result.tutorial ? result.potentialPointsDelta : result.pointsDelta;
    const amount = Math.abs(points);
    const unit = amount === 1 ? 'punto' : 'punti';

    if (result.tutorial) {
      return points >= 0 ? `Avreste guadagnato ${amount} ${unit}` : `Avreste perso ${amount} ${unit}`;
    }

    return `${points > 0 ? '+' : ''}${points} ${unit}`;
  }

  function trackMolecule(node: SVGGElement, molecule: BoardIcon) {
    moleculeElements.set(molecule.id, node);
    node.setAttribute('transform', moleculeTransform(molecule));

    return {
      destroy() {
        moleculeElements.delete(molecule.id);
      }
    };
  }

  function moleculeTransform(molecule: BoardIcon): string {
    return `translate(${roundSvg(molecule.x)} ${roundSvg(molecule.y)}) rotate(${roundSvg(molecule.rotate)}) scale(${molecule.scale ?? 1})`;
  }

  function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  function easeInOut(value: number): number {
    return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }

  function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  function lerp(start: number, end: number, amount: number): number {
    return start + (end - start) * amount;
  }

  function randomSeed(): number {
    return Math.floor(Math.random() * 1_000_000_000) + 1;
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

  function ellipseNormalAtPoint(point: Point, ellipse: Ellipse): Point {
    const nx = (point.x - ellipse.cx) / (ellipse.rx * ellipse.rx);
    const ny = (point.y - ellipse.cy) / (ellipse.ry * ellipse.ry);
    const length = Math.hypot(nx, ny) || 1;

    return {
      x: nx / length,
      y: ny / length
    };
  }

  function pointOutsideEllipse(point: Point, ellipse: Ellipse, scale: number): Point {
    const dx = point.x - ellipse.cx;
    const dy = point.y - ellipse.cy;
    const normalizedDistance = Math.hypot(dx / ellipse.rx, dy / ellipse.ry) || 1;
    const factor = scale / normalizedDistance;

    return {
      x: roundSvg(ellipse.cx + dx * factor),
      y: roundSvg(ellipse.cy + dy * factor)
    };
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

  function randomPointInProtonField(fieldId: ProtonFieldId, seed: number): Point {
    const field = PROTON_FIELDS.find((candidate) => candidate.id === fieldId);

    if (!field) {
      return { x: MEMBRANES.mitoInner.cx, y: MEMBRANES.mitoInner.cy };
    }

    const theta = degreesToRadians(field.startDeg + pseudoRandom(seed) * (field.endDeg - field.startDeg));
    const band = 0.2 + pseudoRandom(seed + 17) * 0.62;
    const rx = field.innerRx + (field.outerRx - field.innerRx) * band;
    const ry = field.innerRy + (field.outerRy - field.innerRy) * band;

    return {
      x: roundSvg(field.cx + Math.cos(theta) * rx),
      y: roundSvg(field.cy + Math.sin(theta) * ry)
    };
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
        <span class="coefficient">{reaction.glucose}</span>
        <span>C<sub>6</sub>H<sub>12</sub>O<sub>6</sub></span>
        <span class="operator">+</span>
        <span class="coefficient">{reaction.oxygen}</span>
        <span>O<sub>2</sub></span>
        <span class="arrow">-></span>
        <span class="coefficient">{reaction.co2}</span>
        <span>CO<sub>2</sub></span>
        <span class="operator">+</span>
        <span class="coefficient">{reaction.water}</span>
        <span>H<sub>2</sub>O</span>
        <span class="operator">+</span>
        <span class="coefficient">{reaction.atp}</span>
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

    {#if tutorialActive}
      <section class="tutorial-banner" aria-label="Tutorial">
        <strong>Tutorial: completa la glicolisi!</strong>
      </section>
    {:else}
      <section class="scoreboard" aria-label="Punteggi squadre">
        {#each game.teams as team, index}
          <article
            class:active={!gameFinished && index === game.activeTeamIndex}
            class:leading={!gameFinished && team.score === leadingScore && leadingScore > 0}
            class:winner={gameFinished && game.winnerIds.includes(team.id)}
            class="score-card"
            style={`--team-color: ${team.color}`}
          >
            <span class="team-color"></span>
            <div>
              <p>{team.name}</p>
              <strong>{team.score}</strong>
            </div>
            {#if gameFinished && game.winnerIds.includes(team.id)}
              <span class="winner-chip"><Trophy size={16} /> Vince</span>
            {:else if !gameFinished && index === game.activeTeamIndex}
              <span class="turn-chip">Tocca a voi</span>
            {:else if !gameFinished && team.score === leadingScore && leadingScore > 0}
              <Trophy size={18} />
            {/if}
          </article>
        {/each}
      </section>
    {/if}

    <section class="board-shell" class:transitioning={moleculeTransitioning} aria-label="Schema della cellula">
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

          <MoleculeSymbols />
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
          <text class="zone-label cytosol-label" x="246" y="180">Citoplasma</text>
          <text class="zone-label intermembrane-label" x="700" y="180">Spazio intermembrana</text>
          <text class="zone-label matrix-label" x="620" y="300">Matrice mitocondriale</text>
        </g>

        {#each MOLECULE_LAYERS as layer}
          <g class={`molecule-layer ${layer.id}`} mask={`url(#${layer.maskId})`}>
            {#each boardIcons.filter((icon) => icon.compartment === layer.id && icon.phase.kind === 'drift') as icon (icon.id)}
              <g use:trackMolecule={icon} transform={moleculeTransform(icon)}>
                <g class={`molecule ${icon.kind}`} class:dimmed={icon.dimmed}>
                  <use href={`#icon-${icon.kind}`} x="-38" y="-38" width="76" height="76" />
                </g>
              </g>
            {/each}
          </g>
        {/each}

        {#each boardIcons.filter((icon) => icon.compartment === 'free' && icon.phase.kind === 'drift') as icon (icon.id)}
          <g use:trackMolecule={icon} transform={moleculeTransform(icon)}>
            <g class={`molecule ${icon.kind}`} class:dimmed={icon.dimmed}>
              <use href={`#icon-${icon.kind}`} x="-38" y="-38" width="76" height="76" />
            </g>
          </g>
        {/each}

        <g class="molecule-layer transit">
          {#each boardIcons.filter((icon) => icon.phase.kind !== 'drift') as icon (icon.id)}
            <g use:trackMolecule={icon} transform={moleculeTransform(icon)}>
              <g class={`molecule ${icon.kind} transitioning`} class:dimmed={icon.dimmed}>
                <use href={`#icon-${icon.kind}`} x="-38" y="-38" width="76" height="76" />
              </g>
            </g>
          {/each}
        </g>

        {#if transitProtons.length > 0}
          <g class="proton-transit-layer">
            {#each transitProtons as proton (proton.id)}
              <circle
                class={`proton-transit-dot ${proton.phase} ${proton.field}`}
                cx={proton.x}
                cy={proton.y}
                r={proton.radius}
                style={`--move-x: ${proton.dx}px; --move-y: ${proton.dy}px; --duration: ${proton.duration}ms; --delay: ${proton.delay}ms`}
              />
            {/each}
          </g>
        {/if}

        {#each BOARD_ACTIONS as action}
          <foreignObject x={action.x} y={action.y} width={action.width} height={action.height}>
            <button
              type="button"
              class="board-action"
              disabled={gameFinished}
              aria-label={action.label}
              onclick={() => chooseStep(action.id)}
            >
              <strong>{action.label}</strong>
            </button>
          </foreignObject>
        {/each}
      </svg>

      {#if moleculeTransitioning}
        <div class="board-blocker" aria-hidden="true"></div>
      {/if}

      {#if feedback}
        <button type="button" class="feedback-layer" aria-label="Chiudi feedback" onclick={dismissFeedback}>
          <span
            class:success={feedback.success}
            class:failure={!feedback.success}
            class="feedback-pop"
            style={`--team-color: ${feedback.teamColor}`}
            aria-live="polite"
          >
            <span class="feedback-title">{feedback.gameOver ? 'Partita conclusa!' : feedback.success ? 'Operazione riuscita!' : 'Non puoi farlo!'}</span>
            <strong>{feedbackSubjectLabel(feedback)}</strong>
            <span class="feedback-points">{feedbackPointsLabel(feedback)}</span>
            <small>{feedback.gameOver ? `${TARGET_ATP} ATP raggiunti con ${feedback.stepLabel}` : feedback.stepLabel}</small>
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
            <div class="modal-actions">
              <a class="cheatsheet-open" href={`${base}/cheatsheet`} target="_blank" rel="noreferrer">
                <ExternalLink size={17} />
                Cheatsheet squadre
              </a>
              <button type="button" class="tool-button" aria-label="Chiudi popup" onclick={() => (showInfo = false)}>
                <X size={18} />
              </button>
            </div>
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
