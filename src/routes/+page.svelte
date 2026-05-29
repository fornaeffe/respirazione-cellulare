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

  type BoardIcon = {
    key: string;
    kind: TokenKind;
    x: number;
    y: number;
    scale?: number;
    dimmed?: boolean;
  };

  const BOARD_ACTIONS: BoardAction[] = [
    {
      id: 'import-glucose',
      x: 72,
      y: 236,
      width: 170,
      height: 58,
      label: 'Importa glucosio',
      hint: 'membrana cellulare'
    },
    {
      id: 'glycolysis',
      x: 300,
      y: 332,
      width: 146,
      height: 58,
      label: 'Glicolisi',
      hint: 'citoplasma'
    },
    {
      id: 'import-pyruvate',
      x: 486,
      y: 482,
      width: 188,
      height: 58,
      label: 'Importa piruvato',
      hint: 'membrana mitocondriale'
    },
    {
      id: 'import-nadh',
      x: 512,
      y: 240,
      width: 150,
      height: 58,
      label: 'Importa NADH',
      hint: 'shuttle'
    },
    {
      id: 'krebs',
      x: 756,
      y: 354,
      width: 140,
      height: 58,
      label: 'Krebs',
      hint: 'matrice'
    },
    {
      id: 'etc',
      x: 930,
      y: 184,
      width: 196,
      height: 58,
      label: 'Catena di trasporto',
      hint: 'membrana interna'
    },
    {
      id: 'atp-synthase',
      x: 962,
      y: 560,
      width: 156,
      height: 58,
      label: 'ATP sintasi',
      hint: 'membrana interna'
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
    feedback = null;
  }

  function openSetup() {
    teamCount = game.teams.length;
    teamNames = game.teams.map((team) => team.name);
    feedback = null;
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

  function getBoardIcons(state: GameState): BoardIcon[] {
    const resources = state.resources;

    return [
      ...makeIcons('glucose', resources.extGlucose, 100, 150, 'ext-glucose', {
        cols: 1,
        max: 1,
        scale: 1.1
      }),
      ...makeIcons('oxygen', 4, 95, 324, 'oxygen', { cols: 2, max: 4, scale: 0.92, dimmed: true }),
      ...makeIcons('water', 4, 95, 438, 'water-out', { cols: 2, max: 4, scale: 0.92, dimmed: true }),
      ...makeIcons('glucose', resources.cytGlucose, 284, 184, 'cyt-glucose', {
        cols: 2,
        max: 2,
        scale: 1.05
      }),
      ...makeIcons('pyruvate', resources.cytPyruvate, 284, 442, 'cyt-pyruvate', {
        cols: 2,
        max: 4
      }),
      ...makeIcons('adp', resources.cytAdp, 285, 282, 'cyt-adp', { cols: 2, dx: 40, dy: 38, max: 4, scale: 0.72 }),
      ...makeIcons('atp', resources.cytAtp, 210, 406, 'cyt-atp', { cols: 2, dx: 40, dy: 38, max: 4, scale: 0.76 }),
      ...makeIcons('nad', resources.cytNad, 374, 240, 'cyt-nad', { cols: 2, dx: 48, max: 4, scale: 0.72 }),
      ...makeIcons('nadh', resources.cytNadh, 376, 410, 'cyt-nadh', { cols: 2, dx: 48, max: 4, scale: 0.72 }),
      ...makeIcons('pyruvate', resources.mitPyruvate, 618, 326, 'mit-pyruvate', {
        cols: 2,
        max: 4,
        scale: 0.76
      }),
      ...makeIcons('adp', resources.mitAdp, 890, 432, 'mit-adp', { cols: 3, dx: 40, dy: 35, max: 6, scale: 0.58 }),
      ...makeIcons('atp', resources.mitAtp, 1018, 438, 'mit-atp', { cols: 2, dx: 40, dy: 35, max: 6, scale: 0.58 }),
      ...makeIcons('nad', resources.mitNad, 646, 408, 'mit-nad', { cols: 3, dx: 43, dy: 37, max: 6, scale: 0.58 }),
      ...makeIcons('nadh', resources.mitNadh, 704, 496, 'mit-nadh', { cols: 3, dx: 43, dy: 37, max: 6, scale: 0.58 }),
      ...makeIcons('fad', resources.mitFad, 1056, 352, 'mit-fad', { cols: 1, dy: 38, max: 4, scale: 0.62 }),
      ...makeIcons('fadh2', resources.mitFadh2, 1112, 352, 'mit-fadh2', { cols: 1, dy: 38, max: 4, scale: 0.62 }),
      ...makeIcons('proton', resources.mitH, 806, 274, 'mit-h', {
        cols: 6,
        dx: 22,
        dy: 20,
        max: 18,
        scale: 0.46
      }),
      ...makeIcons('proton', resources.intH, 990, 274, 'int-h', {
        cols: 6,
        dx: 22,
        dy: 20,
        max: 18,
        scale: 0.46
      }),
      ...makeIcons('co2', resources.nCo2, 1148, 500, 'co2', { cols: 2, dx: 40, dy: 42, max: 6, scale: 0.78 }),
      ...makeIcons('water', Math.max(0, resources.nWater), 1110, 422, 'water-product', {
        cols: 2,
        max: 6,
        scale: 0.82
      })
    ];
  }

  function makeIcons(
    kind: TokenKind,
    count: number,
    x: number,
    y: number,
    key: string,
    options: {
      cols?: number;
      dx?: number;
      dy?: number;
      max?: number;
      scale?: number;
      dimmed?: boolean;
    } = {}
  ): BoardIcon[] {
    const cols = options.cols ?? 3;
    const dx = options.dx ?? 58;
    const dy = options.dy ?? 48;
    const max = options.max ?? 8;
    const visibleCount =
      kind === 'proton'
        ? Math.min(max, Math.max(0, Math.round(count / 7)))
        : Math.min(max, Math.max(0, Math.round(count)));

    return Array.from({ length: visibleCount }, (_, index) => ({
      key: `${key}-${index}`,
      kind,
      x: x + (index % cols) * dx,
      y: y + Math.floor(index / cols) * dy,
      scale: options.scale,
      dimmed: options.dimmed
    }));
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
        <div class="icon-tile"><FlaskConical size={22} /></div>
        <div>
          <p class="eyebrow">Plancia interattiva</p>
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
          <symbol id="icon-proton" viewBox="-15 -15 30 30">
            <circle cx="0" cy="0" r="12" fill="#e84d5b" stroke="#af2b39" stroke-width="3" />
            <text class="molecule-text light small" x="0" y="5">H+</text>
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

        <text class="zone-label outside-label" x="88" y="96">Esterno</text>
        <text class="zone-label cytosol-label" x="280" y="126">Citoplasma</text>
        <text class="zone-label matrix-label" x="742" y="178">Matrice mitocondriale</text>
        <text class="zone-label membrane-label" x="932" y="196">Membrana interna</text>

        <path
          class="cell-shape"
          d="M156 378 C96 246 158 95 328 72 C474 52 544 128 650 102 C846 55 1124 124 1190 314 C1258 508 1024 654 806 620 C655 596 536 648 383 612 C246 580 213 474 156 378 Z"
        />
        <path
          class="cell-rim"
          d="M190 371 C146 255 191 125 337 103 C474 82 553 157 660 132 C828 91 1070 151 1137 318 C1194 462 1010 594 813 565 C650 541 544 601 405 568 C292 541 246 454 190 371 Z"
        />

        <g class="mito-art" filter="url(#softShadow)">
          <path
            class="outer-mito"
            d="M526 366 C526 266 640 207 795 204 C910 201 1026 217 1101 272 C1174 326 1214 407 1172 482 C1129 560 986 583 822 562 C658 541 526 478 526 366 Z"
          />
          <path
            class="inner-membrane"
            d="M604 368 C604 296 696 250 820 250 C922 250 1024 265 1085 314 C1138 357 1150 430 1102 475 C1049 527 931 536 813 520 C684 503 604 454 604 368 Z"
          />
          <path class="crista" d="M602 360 C670 294 723 430 790 359 C861 284 921 436 1000 356" />
          <path class="crista" d="M626 425 C698 354 754 482 825 413 C890 350 954 459 1010 405" />
          <path class="crista" d="M630 300 C704 242 764 363 835 298 C907 234 963 344 1012 292" />
        </g>

        <text class="h-label" x="806" y="252">H+ matrice</text>
        <text class="h-label" x="990" y="252">H+ intermembrana</text>

        <path class="process-arrow glucose-arrow" d="M142 184 C182 190 205 214 222 246" />
        <path class="process-arrow pyruvate-arrow" d="M424 448 C486 456 520 448 552 426" />
        <path class="process-arrow nadh-arrow" d="M454 332 C510 306 536 268 562 254" />
        <path class="process-arrow proton-arrow" d="M914 328 C978 300 1034 268 1082 246" />
        <path class="process-arrow atp-arrow" d="M1085 498 C1034 526 972 528 920 500" />

        {#each boardIcons as icon}
          <g
            class={`molecule ${icon.kind}`}
            class:dimmed={icon.dimmed}
            transform={`translate(${icon.x} ${icon.y}) scale(${icon.scale ?? 1})`}
          >
            <use href={`#icon-${icon.kind}`} x="-38" y="-38" width="76" height="76" />
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
        <section
          class:success={feedback.success}
          class:failure={!feedback.success}
          class="feedback-pop"
          style={`--team-color: ${feedback.teamColor}`}
          aria-live="polite"
        >
          <p>{feedback.success ? 'Operazione riuscita!' : 'Non puoi farlo!'}</p>
          <strong>{feedback.teamName}</strong>
          <span>{feedback.pointsDelta > 0 ? '+' : ''}{feedback.pointsDelta} punti</span>
          <small>{feedback.stepLabel}</small>
        </section>
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
