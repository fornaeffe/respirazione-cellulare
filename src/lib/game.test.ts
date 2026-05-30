import { describe, expect, it } from 'vitest';
import {
  STEP_DEFINITIONS,
  STEP_RESOURCE_GUIDE,
  attemptStep,
  createGame,
  getReactionProgress,
  totalAtp,
  type Resources
} from './game';

describe('cellular respiration game', () => {
  it('starts with five teams and the PowerPoint resource setup', () => {
    const game = createGame();

    expect(game.teams).toHaveLength(5);
    expect(game.activeTeamIndex).toBe(0);
    expect(game.tutorialCompleted).toBe(false);
    expect(game.resources.extGlucose).toBe(1);
    expect(game.resources.cytAdp).toBe(2);
    expect(game.resources.mitAdp).toBe(30);
    expect(game.resources.mitH).toBe(120);
    expect(game.resources.intH).toBe(120);
    expect(game.resources.freeOxygen).toBe(6);
    expect(game.resources.freeWater).toBe(6);
    expect(game.resources.freeCo2).toBe(0);
  });

  it('keeps tutorial moves unscored and starts the real game from team one', () => {
    let game = createGame(['A', 'B']);

    game = attemptStep(game, 'glycolysis');

    expect(game.lastResult?.success).toBe(false);
    expect(game.lastResult?.tutorial).toBe(true);
    expect(game.lastResult?.pointsDelta).toBe(0);
    expect(game.lastResult?.potentialPointsDelta).toBe(-1);
    expect(game.teams.map((team) => team.score)).toEqual([0, 0]);
    expect(game.activeTeamIndex).toBe(0);

    game = attemptStep(game, 'import-glucose');
    game = attemptStep(game, 'glycolysis');

    expect(game.tutorialCompleted).toBe(true);
    expect(game.teams.map((team) => team.score)).toEqual([0, 0]);
    expect(game.activeTeamIndex).toBe(0);
    expect(game.turn).toBe(1);

    game = attemptStep(game, 'import-pyruvate');

    expect(game.teams.map((team) => team.score)).toEqual([1, 0]);
    expect(game.activeTeamIndex).toBe(1);
  });

  it('penalizes an impossible real-game step and advances the active team', () => {
    let game = createGame(['A', 'B']);

    game = attemptStep(game, 'import-glucose');
    game = attemptStep(game, 'glycolysis');
    game = attemptStep(game, 'glycolysis');

    expect(game.lastResult?.success).toBe(false);
    expect(game.teams[0].score).toBe(-1);
    expect(game.activeTeamIndex).toBe(1);
  });

  it('runs glucose import and glycolysis as a neutral setup', () => {
    let game = createGame(['A', 'B']);

    game = attemptStep(game, 'import-glucose');
    game = attemptStep(game, 'glycolysis');

    expect(game.teams[0].score).toBe(0);
    expect(game.teams[1].score).toBe(0);
    expect(game.activeTeamIndex).toBe(0);
    expect(game.tutorialCompleted).toBe(true);
    expect(game.resources.cytPyruvate).toBe(2);
    expect(game.resources.cytAtp).toBe(2);
    expect(game.resources.cytNadh).toBe(2);
    expect(totalAtp(game.resources)).toBe(2);
    expect(getReactionProgress(game.resources).glucose).toBe(1);
  });

  it('keeps water, oxygen, and CO2 as visible non-negative resources distinct from reaction coefficients', () => {
    let game = createGame(['A', 'B']);

    game = attemptStep(game, 'import-glucose');
    game = attemptStep(game, 'glycolysis');
    game = attemptStep(game, 'import-pyruvate');
    game = attemptStep(game, 'import-pyruvate');
    game = attemptStep(game, 'import-nadh');
    game = attemptStep(game, 'import-nadh');
    game = attemptStep(game, 'krebs');
    game = attemptStep(game, 'krebs');

    expect(game.resources.freeWater).toBe(0);
    expect(game.resources.freeCo2).toBe(6);
    expect(getReactionProgress(game.resources)).toMatchObject({
      glucose: 1,
      oxygen: 0,
      co2: 6,
      water: -6,
      atp: 4
    });
    expectAllResourcesNonNegative(game.resources);

    game = attemptStep(game, 'etc');

    expect(game.resources.freeOxygen).toBe(5);
    expect(game.resources.freeWater).toBe(2);
    expect(getReactionProgress(game.resources)).toMatchObject({
      oxygen: 1,
      water: -4
    });
    expectAllResourcesNonNegative(game.resources);
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
    expect(totalAtp(game.resources)).toBe(5);
  });

  it('ends the game when the respiration total reaches 32 ATP', () => {
    let game = createGame(['A', 'B']);

    game = attemptStep(game, 'import-glucose');
    game = attemptStep(game, 'glycolysis');
    game = attemptStep(game, 'import-pyruvate');
    game = attemptStep(game, 'import-pyruvate');
    game = attemptStep(game, 'import-nadh');
    game = attemptStep(game, 'import-nadh');
    game = attemptStep(game, 'krebs');
    game = attemptStep(game, 'krebs');

    for (let cycle = 0; cycle < 5; cycle += 1) {
      game = attemptStep(game, 'etc');

      for (let synthase = 0; synthase < 5; synthase += 1) {
        game = attemptStep(game, 'atp-synthase');
      }
    }

    game = attemptStep(game, 'etc');

    for (let synthase = 0; synthase < 3; synthase += 1) {
      game = attemptStep(game, 'atp-synthase');
    }

    expect(totalAtp(game.resources)).toBe(32);
    expect(getReactionProgress(game.resources)).toMatchObject({
      glucose: 1,
      oxygen: 6,
      co2: 6,
      water: 6,
      atp: 32
    });
    expect(game.resources.freeOxygen).toBe(0);
    expect(game.resources.freeWater).toBe(12);
    expectAllResourcesNonNegative(game.resources);
    expect(game.completed).toBe(true);
    expect(game.lastResult?.gameOver).toBe(true);
    expect(game.lastResult?.winnerNames.length).toBeGreaterThan(0);
    expect(attemptStep(game, 'glycolysis')).toBe(game);
  });

  it('has printable resource guidance for every action', () => {
    expect(STEP_RESOURCE_GUIDE.map((guide) => guide.stepId)).toEqual(STEP_DEFINITIONS.map((step) => step.id));
    expect(STEP_RESOURCE_GUIDE.find((guide) => guide.stepId === 'etc')?.variants).toHaveLength(2);
    expect(STEP_RESOURCE_GUIDE.every((guide) => guide.variants.every((variant) => variant.consumes.length > 0))).toBe(true);
    expect(STEP_RESOURCE_GUIDE.every((guide) => guide.variants.every((variant) => variant.produces.length > 0))).toBe(true);
  });
});

function expectAllResourcesNonNegative(resources: Resources): void {
  for (const value of Object.values(resources)) {
    expect(value).toBeGreaterThanOrEqual(0);
  }
}
