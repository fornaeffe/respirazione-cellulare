import { describe, expect, it } from 'vitest';
import { attemptStep, createGame } from './game';

describe('cellular respiration game', () => {
  it('starts with five teams and the PowerPoint resource setup', () => {
    const game = createGame();

    expect(game.teams).toHaveLength(5);
    expect(game.activeTeamIndex).toBe(0);
    expect(game.resources.extGlucose).toBe(1);
    expect(game.resources.cytAdp).toBe(2);
    expect(game.resources.mitAdp).toBe(30);
    expect(game.resources.mitH).toBe(120);
    expect(game.resources.intH).toBe(120);
  });

  it('penalizes an impossible step and advances the active team', () => {
    const game = attemptStep(createGame(['A', 'B']), 'glycolysis');

    expect(game.lastResult?.success).toBe(false);
    expect(game.teams[0].score).toBe(-1);
    expect(game.activeTeamIndex).toBe(1);
  });

  it('runs glucose import and glycolysis with the original scoring', () => {
    let game = createGame(['A', 'B']);

    game = attemptStep(game, 'import-glucose');
    game = attemptStep(game, 'glycolysis');

    expect(game.teams[0].score).toBe(1);
    expect(game.teams[1].score).toBe(3);
    expect(game.resources.cytPyruvate).toBe(2);
    expect(game.resources.cytAtp).toBe(2);
    expect(game.resources.cytNadh).toBe(2);
    expect(game.resources.nAtp).toBe(2);
  });

  it('uses the proton gradient for ATP synthase only after electron transport', () => {
    let game = createGame(['A', 'B']);

    game = attemptStep(game, 'import-glucose');
    game = attemptStep(game, 'glycolysis');
    game = attemptStep(game, 'import-pyruvate');
    game = attemptStep(game, 'import-pyruvate');
    game = attemptStep(game, 'import-nadh');
    game = attemptStep(game, 'import-nadh');
    game = attemptStep(game, 'krebs');
    game = attemptStep(game, 'krebs');
    game = attemptStep(game, 'etc');
    game = attemptStep(game, 'atp-synthase');

    expect(game.lastResult?.success).toBe(true);
    expect(game.resources.mitAtp).toBe(3);
    expect(game.resources.nAtp).toBe(5);
  });
});
