<script lang="ts">
  import type { TokenKind } from './game';

  let { kind, size = 38 }: { kind: TokenKind; size?: number } = $props();
</script>

<svg
  class={`resource-icon ${kind}`}
  viewBox="-38 -38 76 76"
  aria-hidden="true"
  focusable="false"
  style={`--icon-size: ${size}px`}
>
  {#if kind === 'proton'}
    <circle class="resource-proton-core" cx="0" cy="0" r="11" />
    <circle class="resource-proton-highlight" cx="-4" cy="-4" r="3.4" />
  {:else}
    <use href={`#icon-${kind}`} x="-38" y="-38" width="76" height="76" />
  {/if}
</svg>

<style>
  .resource-icon {
    display: block;
    width: var(--icon-size);
    height: var(--icon-size);
    overflow: visible;
    flex: 0 0 auto;
  }

  .resource-proton-core {
    fill: #e84d5b;
    stroke: #af2b39;
    stroke-width: 2.2;
    filter: drop-shadow(0 3px 4px rgba(175, 43, 57, 0.22));
  }

  .resource-proton-highlight {
    fill: rgba(255, 255, 255, 0.72);
  }
</style>
