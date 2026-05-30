<script lang="ts">
  import { ArrowLeft, Printer } from '@lucide/svelte';
  import { base } from '$app/paths';
  import MoleculeIcon from '$lib/MoleculeIcon.svelte';
  import MoleculeSymbols from '$lib/MoleculeSymbols.svelte';
  import { STEP_DEFINITIONS, STEP_RESOURCE_GUIDE, type StepId } from '$lib/game';

  const guideByStep = new Map(STEP_RESOURCE_GUIDE.map((guide) => [guide.stepId, guide]));
  const printableSteps = STEP_DEFINITIONS.map((step) => ({
    step,
    guide: guideByStep.get(step.id)
  }));

  function printCheatsheet() {
    window.print();
  }

  function guideMissing(stepId: StepId): never {
    throw new Error(`Guida risorse mancante per ${stepId}`);
  }
</script>

<svelte:head>
  <title>Cheatsheet azioni | Respirazione cellulare</title>
</svelte:head>

<main class="cheatsheet-page">
  <svg class="svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <MoleculeSymbols />
    </defs>
  </svg>

  <div class="cheatsheet-sheet">
    <header class="cheatsheet-topbar">
      <div>
        <p class="eyebrow">Respirazione cellulare</p>
        <h1>Cheatsheet azioni</h1>
        <p class="cheatsheet-subtitle">Risorse consumate e molecole prodotte per ogni azione della plancia.</p>
      </div>
      <div class="cheatsheet-controls no-print">
        <a class="cheatsheet-control" href={`${base}/`}>
          <ArrowLeft size={18} />
          Plancia
        </a>
        <button type="button" class="cheatsheet-control print" onclick={printCheatsheet}>
          <Printer size={18} />
          Stampa
        </button>
      </div>
    </header>

    <section class="cheatsheet-grid" aria-label="Azioni disponibili">
      {#each printableSteps as { step, guide }}
        {@const resourceGuide = guide ?? guideMissing(step.id)}
        <article class="cheatsheet-card">
          <header>
            <div>
              <p class="action-meta">{step.area} | +{step.prize} punti</p>
              <h2>{step.label}</h2>
            </div>
          </header>

          <div class="variant-list">
            {#each resourceGuide.variants as variant}
              <section class="variant-block">
                {#if resourceGuide.variants.length > 1}
                  <h3>{variant.label}</h3>
                {/if}

                <div class="resource-columns">
                  <div class="resource-column consumes">
                    <h4>Serve / consuma</h4>
                    <div class="resource-stack">
                      {#each variant.consumes as item}
                        <span class="resource-pill">
                          <span class="resource-count">{item.count}</span>
                          <MoleculeIcon kind={item.kind} />
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.location}</small>
                          </span>
                        </span>
                      {/each}
                    </div>
                  </div>

                  <div class="resource-column produces">
                    <h4>Produce</h4>
                    <div class="resource-stack">
                      {#each variant.produces as item}
                        <span class="resource-pill">
                          <span class="resource-count">{item.count}</span>
                          <MoleculeIcon kind={item.kind} />
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.location}</small>
                          </span>
                        </span>
                      {/each}
                    </div>
                  </div>
                </div>

                {#if variant.note}
                  <p class="variant-note">{variant.note}</p>
                {/if}
              </section>
            {/each}
          </div>

          {#if resourceGuide.note}
            <p class="guide-note">{resourceGuide.note}</p>
          {/if}
        </article>
      {/each}
    </section>
  </div>
</main>
