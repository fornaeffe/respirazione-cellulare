export type StepId =
  | 'import-glucose'
  | 'glycolysis'
  | 'import-pyruvate'
  | 'import-nadh'
  | 'krebs'
  | 'etc'
  | 'atp-synthase';

export type TokenKind =
  | 'glucose'
  | 'pyruvate'
  | 'adp'
  | 'atp'
  | 'nad'
  | 'nadh'
  | 'fad'
  | 'fadh2'
  | 'proton'
  | 'oxygen'
  | 'co2'
  | 'water';

export interface Team {
  id: number;
  name: string;
  score: number;
  color: string;
}

export interface Resources {
  extGlucose: number;
  cytGlucose: number;
  cytPyruvate: number;
  cytAdp: number;
  cytAtp: number;
  cytNad: number;
  cytNadh: number;
  mitPyruvate: number;
  mitAdp: number;
  mitAtp: number;
  mitNad: number;
  mitNadh: number;
  mitFad: number;
  mitFadh2: number;
  mitH: number;
  intH: number;
  freeOxygen: number;
  freeCo2: number;
  freeWater: number;
}

export interface ReactionProgress {
  glucose: number;
  oxygen: number;
  co2: number;
  water: number;
  atp: number;
}

export interface MoveResult {
  success: boolean;
  stepId: StepId;
  stepLabel: string;
  teamName: string;
  teamColor: string;
  pointsDelta: number;
  message: string;
  missing: string[];
  gameOver: boolean;
  winnerNames: string[];
}

export interface GameState {
  teams: Team[];
  activeTeamIndex: number;
  resources: Resources;
  turn: number;
  history: MoveResult[];
  lastResult: MoveResult | null;
  completed: boolean;
  winnerIds: number[];
}

export interface StepDefinition {
  id: StepId;
  label: string;
  shortLabel: string;
  prize: number;
  area: 'Esterno' | 'Citoplasma' | 'Matrice' | 'Membrana interna';
  equation: string;
  summary: string;
}

export type ResourceLocation = 'Esterno' | 'Citoplasma' | 'Matrice' | 'Spazio intermembrana' | 'Plancia';

export interface StepResourceItem {
  count: number;
  kind: TokenKind;
  label: string;
  location: ResourceLocation;
}

export interface StepResourceVariant {
  id: string;
  label: string;
  consumes: StepResourceItem[];
  produces: StepResourceItem[];
  note?: string;
}

export interface StepResourceGuide {
  stepId: StepId;
  variants: StepResourceVariant[];
  note?: string;
}

export interface ResourceToken {
  id: string;
  label: string;
  count: number;
  kind: TokenKind;
  infinite?: boolean;
}

export interface CompartmentView {
  id: 'outside' | 'cytosol' | 'matrix' | 'intermembrane' | 'board' | 'balance';
  label: string;
  detail: string;
  tokens: ResourceToken[];
}

const TEAM_COLORS = [
  '#e84d5b',
  '#2f9e8f',
  '#f2a23a',
  '#4d7fd8',
  '#8a5ad9',
  '#d95c9f',
  '#4f8f3a',
  '#60707d'
];

export const TARGET_ATP = 32;

const INITIAL_FREE_OXYGEN = 6;
const INITIAL_FREE_WATER = 6;

export const STEP_DEFINITIONS: StepDefinition[] = [
  {
    id: 'import-glucose',
    label: 'Importa glucosio',
    shortLabel: 'Glucosio dentro',
    prize: 1,
    area: 'Esterno',
    equation: 'C6H12O6 esterno -> C6H12O6 citoplasma',
    summary: 'Trasporta una molecola di glucosio dentro la cellula.'
  },
  {
    id: 'glycolysis',
    label: 'Glicolisi',
    shortLabel: 'Glicolisi',
    prize: 3,
    area: 'Citoplasma',
    equation: 'Glucosio + 2 ADP + 2 Pi + 2 NAD+ -> 2 piruvato + 2 ATP + 2 NADH',
    summary: 'Scinde il glucosio nel citoplasma e produce ATP e NADH.'
  },
  {
    id: 'import-pyruvate',
    label: 'Importa acido piruvico',
    shortLabel: 'Piruvato dentro',
    prize: 1,
    area: 'Citoplasma',
    equation: 'Piruvato citoplasma -> piruvato matrice',
    summary: 'Porta una molecola di piruvato nella matrice mitocondriale.'
  },
  {
    id: 'import-nadh',
    label: 'Importa NADH',
    shortLabel: 'NADH shuttle',
    prize: 1,
    area: 'Citoplasma',
    equation: 'NADH citoplasma + NAD+ matrice -> NAD+ citoplasma + NADH matrice',
    summary: 'Scambia un NADH citoplasmatico con un NAD+ mitocondriale.'
  },
  {
    id: 'krebs',
    label: 'Ciclo di Krebs',
    shortLabel: 'Krebs',
    prize: 2,
    area: 'Matrice',
    equation: 'Piruvato + ADP + Pi + 4 NAD+ + FAD + 3 H2O -> 3 CO2 + ATP + 4 NADH + FADH2',
    summary: 'Ossida un piruvato nella matrice e carica i trasportatori di elettroni.'
  },
  {
    id: 'etc',
    label: 'Catena di trasporto',
    shortLabel: 'ETC',
    prize: 1,
    area: 'Membrana interna',
    equation: 'NADH/FADH2 + O2 -> NAD+/FAD + H2O + gradiente H+',
    summary: 'Usa NADH o FADH2 per accumulare protoni nello spazio intermembrana.'
  },
  {
    id: 'atp-synthase',
    label: 'ATP sintasi',
    shortLabel: 'ATP sintasi',
    prize: 2,
    area: 'Membrana interna',
    equation: 'ADP + Pi + gradiente H+ -> ATP',
    summary: 'Fa rientrare protoni nella matrice e sintetizza ATP.'
  }
];

export const STEP_RESOURCE_GUIDE: StepResourceGuide[] = [
  guide('import-glucose', [
    variant('trasporto', 'Trasporto', [resource(1, 'glucose', 'Glucosio', 'Esterno')], [
      resource(1, 'glucose', 'Glucosio', 'Citoplasma')
    ])
  ]),
  guide('glycolysis', [
    variant(
      'reazione',
      'Reazione',
      [
        resource(1, 'glucose', 'Glucosio', 'Citoplasma'),
        resource(2, 'adp', 'ADP', 'Citoplasma'),
        resource(2, 'nad', 'NAD+', 'Citoplasma')
      ],
      [
        resource(2, 'pyruvate', 'Piruvato', 'Citoplasma'),
        resource(2, 'atp', 'ATP', 'Citoplasma'),
        resource(2, 'nadh', 'NADH', 'Citoplasma')
      ]
    )
  ]),
  guide('import-pyruvate', [
    variant('trasporto', 'Trasporto', [resource(1, 'pyruvate', 'Piruvato', 'Citoplasma')], [
      resource(1, 'pyruvate', 'Piruvato', 'Matrice')
    ])
  ]),
  guide('import-nadh', [
    variant(
      'shuttle',
      'Shuttle',
      [
        resource(1, 'nadh', 'NADH', 'Citoplasma'),
        resource(1, 'nad', 'NAD+', 'Matrice')
      ],
      [
        resource(1, 'nad', 'NAD+', 'Citoplasma'),
        resource(1, 'nadh', 'NADH', 'Matrice')
      ]
    )
  ]),
  guide('krebs', [
    variant(
      'reazione',
      'Reazione',
      [
        resource(1, 'pyruvate', 'Piruvato', 'Matrice'),
        resource(1, 'adp', 'ADP', 'Matrice'),
        resource(4, 'nad', 'NAD+', 'Matrice'),
        resource(1, 'fad', 'FAD', 'Matrice'),
        resource(3, 'water', 'H2O', 'Plancia')
      ],
      [
        resource(3, 'co2', 'CO2', 'Plancia'),
        resource(1, 'atp', 'ATP', 'Matrice'),
        resource(4, 'nadh', 'NADH', 'Matrice'),
        resource(1, 'fadh2', 'FADH2', 'Matrice')
      ]
    )
  ]),
  guide(
    'etc',
    [
      variant(
        'nadh',
        'Via NADH',
        [
          resource(2, 'nadh', 'NADH', 'Matrice'),
          resource(1, 'oxygen', 'O2', 'Plancia'),
          resource(20, 'proton', 'H+', 'Matrice')
        ],
        [
          resource(2, 'nad', 'NAD+', 'Matrice'),
          resource(2, 'water', 'H2O', 'Plancia'),
          resource(20, 'proton', 'H+', 'Spazio intermembrana')
        ]
      ),
      variant(
        'fadh2',
        'Via FADH2',
        [
          resource(2, 'fadh2', 'FADH2', 'Matrice'),
          resource(1, 'oxygen', 'O2', 'Plancia'),
          resource(12, 'proton', 'H+', 'Matrice')
        ],
        [
          resource(2, 'fad', 'FAD', 'Matrice'),
          resource(2, 'water', 'H2O', 'Plancia'),
          resource(12, 'proton', 'H+', 'Spazio intermembrana')
        ]
      )
    ],
    'Se entrambe le vie sono possibili, il gioco usa prima NADH.'
  ),
  guide(
    'atp-synthase',
    [
      variant(
        'reazione',
        'Reazione',
        [resource(1, 'adp', 'ADP', 'Matrice'), resource(4, 'proton', 'H+', 'Spazio intermembrana')],
        [resource(1, 'atp', 'ATP', 'Matrice'), resource(4, 'proton', 'H+', 'Matrice')]
      )
    ],
    'Richiede che gli H+ nello spazio intermembrana siano maggiori degli H+ nella matrice.'
  )
];

const STEP_BY_ID = new Map(STEP_DEFINITIONS.map((step) => [step.id, step]));

export function initialResources(): Resources {
  return {
    extGlucose: 1,
    cytGlucose: 0,
    cytPyruvate: 0,
    cytAdp: 2,
    cytAtp: 0,
    cytNad: 2,
    cytNadh: 0,
    mitPyruvate: 0,
    mitAdp: 30,
    mitAtp: 0,
    mitNad: 10,
    mitNadh: 0,
    mitFad: 2,
    mitFadh2: 0,
    mitH: 120,
    intH: 120,
    freeOxygen: INITIAL_FREE_OXYGEN,
    freeCo2: 0,
    freeWater: INITIAL_FREE_WATER
  };
}

export function clampTeamCount(count: number): number {
  return Math.min(8, Math.max(2, Math.round(count)));
}

export function defaultTeamNames(count: number): string[] {
  return Array.from({ length: clampTeamCount(count) }, (_, index) => `Squadra ${index + 1}`);
}

export function getTeamColor(index: number): string {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

export function createGame(teamNames = defaultTeamNames(5)): GameState {
  const names = teamNames.length > 0 ? teamNames : defaultTeamNames(5);
  const teams = names.slice(0, 8).map((name, index) => ({
    id: index + 1,
    name: name.trim() || `Squadra ${index + 1}`,
    score: 0,
    color: getTeamColor(index)
  }));

  return {
    teams,
    activeTeamIndex: 0,
    resources: initialResources(),
    turn: 1,
    history: [],
    lastResult: null,
    completed: false,
    winnerIds: []
  };
}

export function getStepDefinition(stepId: StepId): StepDefinition {
  const step = STEP_BY_ID.get(stepId);

  if (!step) {
    throw new Error(`Step non riconosciuto: ${stepId}`);
  }

  return step;
}

export function getReactionProgress(resources: Resources): ReactionProgress {
  const initial = initialResources();

  return {
    glucose: totalGlucose(initial) - totalGlucose(resources),
    oxygen: initial.freeOxygen - resources.freeOxygen,
    co2: resources.freeCo2 - initial.freeCo2,
    water: resources.freeWater - initial.freeWater,
    atp: totalAtp(resources) - totalAtp(initial)
  };
}

export function totalAtp(resources: Resources): number {
  return resources.cytAtp + resources.mitAtp;
}

export function attemptStep(state: GameState, stepId: StepId): GameState {
  if (state.completed) {
    return state;
  }

  const step = getStepDefinition(stepId);
  const resources = { ...state.resources };
  const teams = state.teams.map((team) => ({ ...team }));
  const activeTeam = teams[state.activeTeamIndex];
  const missing = getMissingRequirements(resources, stepId);
  const success = missing.length === 0;
  const pointsDelta = success ? step.prize : -1;

  if (success) {
    applyStep(resources, stepId);
  }

  activeTeam.score += pointsDelta;
  const completed = totalAtp(resources) >= TARGET_ATP;
  const winnerScore = Math.max(...teams.map((team) => team.score));
  const winnerIds = completed ? teams.filter((team) => team.score === winnerScore).map((team) => team.id) : [];
  const winnerNames = completed ? teams.filter((team) => winnerIds.includes(team.id)).map((team) => team.name) : [];

  const result: MoveResult = {
    success,
    stepId,
    stepLabel: step.label,
    teamName: activeTeam.name,
    teamColor: activeTeam.color,
    pointsDelta,
    missing,
    message: success ? successMessage(stepId) : `Mancano: ${missing.join(', ')}.`,
    gameOver: completed,
    winnerNames
  };

  return {
    ...state,
    teams,
    resources,
    activeTeamIndex: (state.activeTeamIndex + 1) % state.teams.length,
    turn: state.turn + 1,
    lastResult: result,
    history: [result, ...state.history].slice(0, 8),
    completed,
    winnerIds
  };
}

export function getMissingRequirements(resources: Resources, stepId: StepId): string[] {
  switch (stepId) {
    case 'import-glucose':
      return resources.extGlucose > 0 ? [] : ['glucosio esterno'];
    case 'glycolysis':
      return [
        resources.cytGlucose > 0 ? '' : 'glucosio nel citoplasma',
        resources.cytAdp > 1 ? '' : '2 ADP nel citoplasma',
        resources.cytNad > 1 ? '' : '2 NAD+ nel citoplasma'
      ].filter(Boolean);
    case 'import-pyruvate':
      return resources.cytPyruvate > 0 ? [] : ['piruvato nel citoplasma'];
    case 'import-nadh':
      return [
        resources.cytNadh > 0 ? '' : 'NADH nel citoplasma',
        resources.mitNad > 0 ? '' : 'NAD+ nella matrice'
      ].filter(Boolean);
    case 'krebs':
      return [
        resources.mitPyruvate > 0 ? '' : 'piruvato nella matrice',
        resources.mitAdp > 0 ? '' : 'ADP nella matrice',
        resources.mitNad > 3 ? '' : '4 NAD+ nella matrice',
        resources.mitFad > 0 ? '' : 'FAD nella matrice',
        resources.freeWater > 2 ? '' : '3 H2O sulla plancia'
      ].filter(Boolean);
    case 'etc': {
      const hasOxygen = resources.freeOxygen > 0;
      const nadhPath = hasOxygen && resources.mitNadh > 1 && resources.mitH > 19;
      const fadhPath = hasOxygen && resources.mitFadh2 > 1 && resources.mitH > 11;

      if (nadhPath || fadhPath) {
        return [];
      }

      return [
        hasOxygen ? '' : 'O2 sulla plancia',
        resources.mitNadh > 1 || resources.mitFadh2 > 1 ? '' : '2 NADH o 2 FADH2 nella matrice',
        resources.mitH > 19 || (resources.mitFadh2 > 1 && resources.mitH > 11) ? '' : 'protoni nella matrice'
      ].filter(Boolean);
    }
    case 'atp-synthase':
      return [
        resources.intH - resources.mitH > 7 ? '' : 'gradiente di H+ sufficiente',
        resources.mitAdp > 0 ? '' : 'ADP nella matrice'
      ].filter(Boolean);
  }
}

export function getCompartmentViews(resources: Resources): CompartmentView[] {
  const progress = getReactionProgress(resources);

  return [
    {
      id: 'outside',
      label: 'Esterno',
      detail: 'riserva e scambi',
      tokens: [
        token('ext-glucose', 'Glucosio', resources.extGlucose, 'glucose')
      ]
    },
    {
      id: 'cytosol',
      label: 'Citoplasma',
      detail: 'glicolisi e shuttle',
      tokens: [
        token('cyt-glucose', 'Glucosio', resources.cytGlucose, 'glucose'),
        token('cyt-pyruvate', 'Piruvato', resources.cytPyruvate, 'pyruvate'),
        token('cyt-adp', 'ADP', resources.cytAdp, 'adp'),
        token('cyt-atp', 'ATP', resources.cytAtp, 'atp'),
        token('cyt-nad', 'NAD+', resources.cytNad, 'nad'),
        token('cyt-nadh', 'NADH', resources.cytNadh, 'nadh')
      ]
    },
    {
      id: 'matrix',
      label: 'Matrice mitocondriale',
      detail: 'Krebs, trasportatori, ATP',
      tokens: [
        token('mit-pyruvate', 'Piruvato', resources.mitPyruvate, 'pyruvate'),
        token('mit-adp', 'ADP', resources.mitAdp, 'adp'),
        token('mit-atp', 'ATP', resources.mitAtp, 'atp'),
        token('mit-nad', 'NAD+', resources.mitNad, 'nad'),
        token('mit-nadh', 'NADH', resources.mitNadh, 'nadh'),
        token('mit-fad', 'FAD', resources.mitFad, 'fad'),
        token('mit-fadh2', 'FADH2', resources.mitFadh2, 'fadh2'),
        token('mit-h', 'H+ matrice', resources.mitH, 'proton')
      ]
    },
    {
      id: 'intermembrane',
      label: 'Spazio intermembrana',
      detail: 'gradiente protonico',
      tokens: [token('int-h', 'H+ intermembrana', resources.intH, 'proton')]
    },
    {
      id: 'board',
      label: 'Plancia intera',
      detail: 'ossigeno, acqua e prodotti diffusi',
      tokens: [
        token('free-oxygen', 'O2', resources.freeOxygen, 'oxygen'),
        token('free-water', 'H2O', resources.freeWater, 'water'),
        token('free-co2', 'CO2', resources.freeCo2, 'co2')
      ]
    },
    {
      id: 'balance',
      label: 'Bilancio globale',
      detail: 'coefficienti della reazione',
      tokens: [
        token('progress-glucose', 'Glucosio', progress.glucose, 'glucose'),
        token('progress-oxygen', 'O2', progress.oxygen, 'oxygen'),
        token('progress-co2', 'CO2', progress.co2, 'co2'),
        token('progress-water', 'H2O netta', progress.water, 'water'),
        token('progress-atp', 'ATP totale', progress.atp, 'atp')
      ]
    }
  ];
}

export function scaledParticleCount(token: ResourceToken): number {
  if (token.infinite) {
    return 10;
  }

  const count = Math.abs(token.count);

  if (token.kind === 'proton') {
    return Math.max(8, Math.min(30, Math.round(count / 5)));
  }

  return Math.min(12, count);
}

function token(
  id: string,
  label: string,
  count: number,
  kind: TokenKind,
  infinite = false
): ResourceToken {
  return { id, label, count, kind, infinite };
}

function guide(stepId: StepId, variants: StepResourceVariant[], note?: string): StepResourceGuide {
  return { stepId, variants, note };
}

function variant(
  id: string,
  label: string,
  consumes: StepResourceItem[],
  produces: StepResourceItem[],
  note?: string
): StepResourceVariant {
  return { id, label, consumes, produces, note };
}

function resource(count: number, kind: TokenKind, label: string, location: ResourceLocation): StepResourceItem {
  return { count, kind, label, location };
}

function applyStep(resources: Resources, stepId: StepId): void {
  switch (stepId) {
    case 'import-glucose':
      resources.extGlucose -= 1;
      resources.cytGlucose += 1;
      return;
    case 'glycolysis':
      resources.cytGlucose -= 1;
      resources.cytAdp -= 2;
      resources.cytNad -= 2;
      resources.cytAtp += 2;
      resources.cytNadh += 2;
      resources.cytPyruvate += 2;
      return;
    case 'import-pyruvate':
      resources.cytPyruvate -= 1;
      resources.mitPyruvate += 1;
      return;
    case 'import-nadh':
      resources.cytNadh -= 1;
      resources.cytNad += 1;
      resources.mitNadh += 1;
      resources.mitNad -= 1;
      return;
    case 'krebs':
      resources.mitPyruvate -= 1;
      resources.mitAdp -= 1;
      resources.mitNad -= 4;
      resources.mitFad -= 1;
      resources.mitAtp += 1;
      resources.mitNadh += 4;
      resources.mitFadh2 += 1;
      resources.freeCo2 += 3;
      resources.freeWater -= 3;
      return;
    case 'etc':
      if (resources.mitNadh > 1 && resources.mitH > 19) {
        resources.mitNad += 2;
        resources.mitNadh -= 2;
        resources.mitH -= 20;
        resources.intH += 20;
      } else {
        resources.mitFad += 2;
        resources.mitFadh2 -= 2;
        resources.mitH -= 12;
        resources.intH += 12;
      }

      resources.freeOxygen -= 1;
      resources.freeWater += 2;
      return;
    case 'atp-synthase':
      resources.intH -= 4;
      resources.mitH += 4;
      resources.mitAdp -= 1;
      resources.mitAtp += 1;
      return;
  }
}

function totalGlucose(resources: Resources): number {
  return resources.extGlucose + resources.cytGlucose;
}

function successMessage(stepId: StepId): string {
  switch (stepId) {
    case 'import-glucose':
      return 'Il glucosio entra nel citoplasma.';
    case 'glycolysis':
      return 'La glicolisi produce piruvato, ATP e NADH.';
    case 'import-pyruvate':
      return 'Il piruvato raggiunge la matrice mitocondriale.';
    case 'import-nadh':
      return 'Lo shuttle porta potere riducente nel mitocondrio.';
    case 'krebs':
      return 'Il ciclo di Krebs carica NADH e FADH2.';
    case 'etc':
      return 'La catena di trasporto aumenta il gradiente protonico.';
    case 'atp-synthase':
      return 'L ATP sintasi converte il gradiente in ATP.';
  }
}
