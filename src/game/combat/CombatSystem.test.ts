import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CombatSystem } from './CombatSystem';
import { BattleCharacter, BattleEnemy, Skill, Combatant, ElementResistances } from '@/types';

function createCharacter(overrides: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    id: 'char1',
    name: 'Hero',
    level: 1,
    exp: 0,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    stats: { strength: 10, magic: 10, endurance: 10, agility: 10, luck: 10 },
    personas: [],
    currentPersona: 0,
    skills: [],
    items: [],
    equipment: {},
    battleHp: 100,
    battleMp: 50,
    battleStatus: [],
    ...overrides,
  };
}

function createEnemy(resistances: ElementResistances = {}, overrides: Partial<BattleEnemy> = {}): BattleEnemy {
  return {
    id: 'enemy1',
    name: 'Shadow',
    level: 1,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    stats: { strength: 10, magic: 10, endurance: 10, agility: 10, luck: 10 },
    skills: [],
    resistances,
    dropExp: 0,
    dropItems: [],
    battleHp: 100,
    battleMp: 50,
    battleStatus: [],
    ...overrides,
  };
}

const fireballSkill: Skill = {
  id: 'skill1',
  name: 'Fireball',
  type: 'magic',
  element: 'fire',
  power: 100,
  accuracy: 1,
  costMp: 30,
  targetType: 'single',
};

describe('CombatSystem', () => {
  let combatSystem: CombatSystem;

  beforeEach(() => {
    combatSystem = new CombatSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be initialized', () => {
    expect(combatSystem).toBeDefined();
  });

  it('should deduct MP when skill is used', () => {
    const attacker = createCharacter();
    const target = createCharacter({ id: 'char2' });

    combatSystem.performAction(attacker, target, fireballSkill);

    expect(attacker.battleMp).toBe(20);
  });

  it('should not use skill if MP is insufficient', () => {
    const attacker = createCharacter({ mp: 20, battleMp: 20 });
    const target = createCharacter({ id: 'char2' });

    const result = combatSystem.performAction(attacker, target, fireballSkill);

    expect(result.hit).toBe(false);
    expect(attacker.battleMp).toBe(20);
    expect(target.battleHp).toBe(100); // No damage dealt
  });

  it('exploits an elemental weakness for bonus damage and grants a 1 MORE turn', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // accuracy roll (irrelevant, accuracy is 1)
      .mockReturnValueOnce(0.5) // randomFactor -> 0.85 + 0.5*0.3 = 1.0
      .mockReturnValueOnce(0.9); // crit roll -> above crit chance, no crit

    const attacker = createEnemy({});
    const target = createEnemy({ fire: 'weak' });

    const result = combatSystem.performAction(attacker, target, fireballSkill);

    // baseDamage = floor((10*100)/100 - 10/10) = 9; weak multiplier x1.5 x randomFactor(1.0)
    expect(result.exploitedWeakness).toBe(true);
    expect(result.bonusTurn).toBe(true);
    expect(result.knockedDown).toBe(true);
    expect(result.damage).toBe(13);
    expect(target.battleHp).toBe(87);
    expect(target.battleStatus).toContainEqual({ status: 'knockdown', turnsRemaining: 1 });
  });

  it('blocks damage entirely and grants no bonus turn when target blocks the element', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1); // accuracy roll only

    const attacker = createEnemy({});
    const target = createEnemy({ fire: 'block' });

    const result = combatSystem.performAction(attacker, target, fireballSkill);

    expect(result.resistance).toBe('block');
    expect(result.damage).toBe(0);
    expect(result.bonusTurn).toBe(false);
    expect(target.battleHp).toBe(100);
  });

  it('heals the target when it absorbs the element', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1); // accuracy roll only

    const attacker = createEnemy({});
    const target = createEnemy({ fire: 'absorb' }, { battleHp: 50 });

    const result = combatSystem.performAction(attacker, target, fireballSkill);

    // baseDamage = floor((10*100)/100 - 10/10) = 9
    expect(result.resistance).toBe('absorb');
    expect(result.healed).toBe(9);
    expect(target.battleHp).toBe(59);
  });

  it('halves damage when the target resists the element', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // accuracy roll
      .mockReturnValueOnce(0.5) // randomFactor -> 1.0
      .mockReturnValueOnce(0.9); // crit roll -> no crit

    const attacker = createEnemy({});
    const target = createEnemy({ fire: 'resist' });

    const result = combatSystem.performAction(attacker, target, fireballSkill);

    // baseDamage 9 * randomFactor(1.0) * resist(0.5) = 4.5 -> floor 4
    expect(result.exploitedWeakness).toBe(false);
    expect(result.bonusTurn).toBe(false);
    expect(result.damage).toBe(4);
  });

  it('applyBonusTurn resets the timer immediately on a bonus turn, otherwise uses the agility delay', () => {
    const combatant: Combatant = { id: 'char1', type: 'character', agility: 10, nextTurnIn: 0 };

    combatSystem.applyBonusTurn(combatant, {
      hit: true,
      damage: 10,
      healed: 0,
      resistance: 'weak',
      critical: false,
      exploitedWeakness: true,
      bonusTurn: true,
      knockedDown: true,
    });
    expect(combatant.nextTurnIn).toBe(0);

    combatSystem.applyBonusTurn(combatant, {
      hit: true,
      damage: 10,
      healed: 0,
      resistance: 'normal',
      critical: false,
      exploitedWeakness: false,
      bonusTurn: false,
      knockedDown: false,
    });
    expect(combatant.nextTurnIn).toBeGreaterThan(0);
  });
});
