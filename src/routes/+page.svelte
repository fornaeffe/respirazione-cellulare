<script lang="ts">
  import {
    Activity,
    CheckCircle2,
    FlaskConical,
    History,
    Minus,
    Play,
    Plus,
    RotateCcw,
    Settings2,
    Trophy,
    Users,
    XCircle,
    Zap
  } from '@lucide/svelte';
  import {
    STEP_DEFINITIONS,
    attemptStep as runStep,
    clampTeamCount,
    createGame,
    defaultTeamNames,
    getCompartmentViews,
    getTeamColor,
    scaledParticleCount,
    type GameState,
    type ResourceToken,
    type StepId
  } from '$lib/game';

  let teamCount = 5;
  let teamNames = defaultTeamNames(teamCount);
  let started = false;
  let game: GameState = createGame(teamNames);

  $: activeTeam = game.teams[game.activeTeamIndex];
  $: compartments = getCompartmentViews(game.resources);
  $: gradientGap = game.resources.intH - game.resources.mitH;
  $: leadingScore = Math.max(...game.teams.map((team) => team.score));

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
    started = true;
  }

  function resetBoard() {
    game = createGame(game.teams.map((team) => team.name));
  }

  function openSetup() {
    teamCount = game.teams.length;
    teamNames = game.teams.map((team) => team.name);
    started = false;
  }

  function chooseStep(stepId: StepId) {
    game = runStep(game, stepId);
  }

  function countLabel(token: ResourceToken) {
    return token.infinite ? 'inf' : token.count.toString();
  }

  function particleList(token: ResourceToken) {
    return Array.from({ length: scaledParticleCount(token) }, (_, index) => `${token.id}-${index}`);
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
    <header class="topbar">
      <div class="brand-block">
        <div class="icon-tile"><Activity size={23} /></div>
        <div>
          <p class="eyebrow">Plancia interattiva</p>
          <h1>Respirazione cellulare</h1>
        </div>
      </div>

      <div class="turn-indicator" style={`--team-color: ${activeTeam.color}`}>
        <span>Turno {game.turn}</span>
        <strong>{activeTeam.name}</strong>
      </div>

      <div class="top-actions">
        <button type="button" class="ghost-action" onclick={openSetup}>
          <Settings2 size={18} />
          Squadre
        </button>
        <button type="button" class="ghost-action" onclick={resetBoard}>
          <RotateCcw size={18} />
          Reset
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
          {#if team.score === leadingScore && leadingScore > 0}
            <Trophy size={18} />
          {/if}
        </article>
      {/each}
    </section>

    <section class="main-grid">
      <section class="cell-stage" aria-label="Cellula e compartimenti">
        <svg class="cell-art" viewBox="0 0 1000 680" aria-hidden="true">
          <defs>
            <linearGradient id="cellFill" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stop-color="#d6f5ef" />
              <stop offset="55%" stop-color="#e9f7ff" />
              <stop offset="100%" stop-color="#fff2c7" />
            </linearGradient>
            <linearGradient id="mitoFill" x1="0" x2="1">
              <stop offset="0%" stop-color="#ffdd8a" />
              <stop offset="100%" stop-color="#ff8b5f" />
            </linearGradient>
          </defs>
          <path
            class="cell-shape"
            d="M96 357 C44 243 93 105 246 70 C395 35 443 121 553 94 C742 48 915 170 930 332 C948 523 759 637 566 606 C430 584 337 646 213 578 C125 530 120 410 96 357 Z"
          />
          <path
            class="cell-rim"
            d="M121 344 C87 243 123 130 263 99 C392 70 449 151 557 126 C713 90 871 190 887 333 C903 486 748 590 571 563 C430 541 351 601 236 548 C159 512 143 405 121 344 Z"
          />
          <g class="mito-art">
            <ellipse cx="641" cy="344" rx="226" ry="128" />
            <path d="M469 343 C528 285 580 399 640 341 C701 282 760 401 824 337" />
            <path d="M493 391 C553 334 606 441 665 384 C720 331 773 423 817 380" />
            <path d="M498 294 C560 244 613 344 673 291 C732 241 781 329 816 288" />
          </g>
        </svg>

        <div class="compartment-grid">
          {#each compartments as compartment}
            <article class={`compartment ${compartment.id}`}>
              <div class="compartment-heading">
                <h2>{compartment.label}</h2>
                <span>{compartment.detail}</span>
              </div>

              <div class="token-grid">
                {#each compartment.tokens as token}
                  <div class={`resource-token ${token.kind}`} class:negative={token.count < 0}>
                    <div class="particle-field" aria-hidden="true">
                      {#each particleList(token) as particle}
                        <span class={`particle ${token.kind}`} title={particle}></span>
                      {/each}
                    </div>
                    <div class="token-label">
                      <span>{token.label}</span>
                      <strong>{countLabel(token)}</strong>
                    </div>
                  </div>
                {/each}
              </div>
            </article>
          {/each}
        </div>
      </section>

      <aside class="control-panel" aria-label="Azioni di gioco">
        <section
          class:success={game.lastResult?.success}
          class:failure={game.lastResult && !game.lastResult.success}
          class="result-banner"
          style={`--team-color: ${game.lastResult?.teamColor ?? activeTeam.color}`}
        >
          {#if game.lastResult}
            {#if game.lastResult.success}
              <CheckCircle2 size={22} />
            {:else}
              <XCircle size={22} />
            {/if}
            <div>
              <p>
                {game.lastResult.teamName}:
                {game.lastResult.pointsDelta > 0 ? '+' : ''}{game.lastResult.pointsDelta} punti
              </p>
              <strong>{game.lastResult.stepLabel}</strong>
              <span>{game.lastResult.message}</span>
            </div>
          {:else}
            <Zap size={22} />
            <div>
              <p>Primo turno</p>
              <strong>{activeTeam.name}</strong>
              <span>Scegli uno step della respirazione cellulare.</span>
            </div>
          {/if}
        </section>

        <section class="gradient-meter">
          <div>
            <span>Gradiente H+</span>
            <strong>{gradientGap}</strong>
          </div>
          <div class="meter-track">
            <span style={`width: ${Math.min(100, Math.max(0, gradientGap * 2))}%`}></span>
          </div>
        </section>

        <section class="step-list">
          <div class="section-heading">
            <Users size={18} />
            <h2>Step disponibili</h2>
          </div>

          {#each STEP_DEFINITIONS as step}
            <button type="button" class="step-button" onclick={() => chooseStep(step.id)}>
              <span class="step-points">+{step.prize}</span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.area}</small>
              </span>
            </button>
          {/each}
        </section>

        <section class="reference-panel">
          <div class="section-heading">
            <FlaskConical size={18} />
            <h2>Reazioni</h2>
          </div>
          <div class="reaction-list">
            {#each STEP_DEFINITIONS as step}
              <details>
                <summary>{step.shortLabel}</summary>
                <p>{step.equation}</p>
                <span>{step.summary}</span>
              </details>
            {/each}
          </div>
        </section>

        <section class="history-panel">
          <div class="section-heading">
            <History size={18} />
            <h2>Ultime mosse</h2>
          </div>
          {#if game.history.length === 0}
            <p class="empty-history">Nessuna mossa registrata.</p>
          {:else}
            <ol>
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
      </aside>
    </section>
  </main>
{/if}
