import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CombatSystem } from './CombatSystem';
import { BattleCharacter, BattleEnemy, Skill, Combatant, ElementResistances, Persona, InventoryItem, Item } from '@/types';

function createPersona(overrides: Partial<Persona> = {}): Persona {
  return {
    id: 'persona1',
    name: 'Jack Frost',
    arcana: 'Fool',
    level: 1,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    stats: { strength: 10, magic: 10, endurance: 10, agility: 10, luck: 10 },
    skills: [],
    resistances: {},
    ...overrides,
  };
}

function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item1',
    name: 'Medicine',
    type: 'consumable',
    description: 'Restores HP',
    ...overrides,
  };
}

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
      weaknessNegated: false,
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
      weaknessNegated: false,
      bonusTurn: false,
      knockedDown: false,
    });
    expect(combatant.nextTurnIn).toBeGreaterThan(0);
  });

  it('物理: performBasicAttack deals damage for free without consuming MP', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // accuracy roll
      .mockReturnValueOnce(0.5) // randomFactor -> 1.0
      .mockReturnValueOnce(0.9); // crit roll -> no crit

    const attacker = createCharacter({ battleMp: 10 });
    const target = createEnemy({});

    const result = combatSystem.performBasicAttack(attacker, target);

    expect(result.hit).toBe(true);
    expect(attacker.battleMp).toBe(10); // unchanged, basic attack is free
    expect(target.battleHp).toBeLessThan(100);
  });

  it('ガード: halves incoming damage and clears at the start of the guarder\'s next turn', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.5) // randomFactor -> 1.0
      .mockReturnValueOnce(0.9); // no crit

    const attacker = createEnemy({});
    const target = createEnemy({}, { id: 'enemy2' });
    combatSystem.guard(target);

    const result = combatSystem.performAction(attacker, target, fireballSkill);

    // baseDamage 9 * randomFactor(1.0) * guard(0.5) = 4.5 -> floor 4
    expect(result.damage).toBe(4);
    expect(target.isGuarding).toBe(true);

    const combatant: Combatant = { id: target.id, type: 'enemy', agility: target.stats.agility, nextTurnIn: 0 };
    const battleState = { allies: [], enemies: [target], turn: 1, currentTurnIndex: 0, combatants: [combatant], status: 'active' as const };
    combatSystem.update(battleState, 0);

    expect(target.isGuarding).toBe(false);
  });

  it('ガード: negates an elemental weakness entirely (no bonus damage, no down, no 1 MORE)', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // accuracy roll
      .mockReturnValueOnce(0.5) // randomFactor -> 1.0
      .mockReturnValueOnce(0.9); // crit roll -> no crit

    const attacker = createEnemy({});
    const target = createEnemy({ fire: 'weak' }, { id: 'enemy2' });
    combatSystem.guard(target);

    const result = combatSystem.performAction(attacker, target, fireballSkill);

    // baseDamage 9 * randomFactor(1.0) x guard(0.5) only -> floor 4 (no x1.5 weak bonus)
    expect(result.resistance).toBe('weak');
    expect(result.weaknessNegated).toBe(true);
    expect(result.exploitedWeakness).toBe(false);
    expect(result.bonusTurn).toBe(false);
    expect(result.knockedDown).toBe(false);
    expect(result.damage).toBe(4);
    expect(target.battleStatus).toHaveLength(0);
  });

  it('アナライズ: categorizes an enemy\'s elemental resistances and marks it analyzed', () => {
    const target = createEnemy({ fire: 'weak', ice: 'resist', electric: 'block', dark: 'absorb', wind: 'normal' });

    const result = combatSystem.analyze(target);

    expect(result.weaknesses).toEqual(['fire']);
    expect(result.resists).toEqual(['ice']);
    expect(result.blocks).toEqual(['electric']);
    expect(result.absorbs).toEqual(['dark']);
    expect(target.isAnalyzed).toBe(true);
  });

  it('ペルソナ: switches the active persona, rejecting an out-of-range index', () => {
    const character = createCharacter({
      personas: [{ persona: createPersona({ id: 'p1' }) }, { persona: createPersona({ id: 'p2' }) }],
      currentPersona: 0,
    });

    expect(combatSystem.switchPersona(character, 1)).toBe(true);
    expect(character.currentPersona).toBe(1);

    expect(combatSystem.switchPersona(character, 5)).toBe(false);
    expect(character.currentPersona).toBe(1); // unchanged
  });

  it('アイテム: heals HP and consumes one item, but fails on a downed target without revive', () => {
    const medicine: InventoryItem = { item: createItem({ battleEffect: { healHp: 30 } }), quantity: 2 };
    const target = createCharacter({ battleHp: 50 });

    const result = combatSystem.useItem(medicine, target);

    expect(result.success).toBe(true);
    expect(result.healedHp).toBe(30);
    expect(target.battleHp).toBe(80);
    expect(medicine.quantity).toBe(1);

    const downedTarget = createCharacter({ id: 'char3', battleHp: 0 });
    const failResult = combatSystem.useItem(medicine, downedTarget);
    expect(failResult.success).toBe(false);
    expect(medicine.quantity).toBe(1); // not consumed on failure
  });

  it('アイテム: revives a downed target and cures status effects', () => {
    const revivalBead: InventoryItem = {
      item: createItem({ battleEffect: { revive: true, cureStatus: ['poison'] } }),
      quantity: 1,
    };
    const target = createCharacter({
      battleHp: 0,
      battleStatus: [{ status: 'poison', turnsRemaining: 2 }],
    });

    const result = combatSystem.useItem(revivalBead, target);

    expect(result.success).toBe(true);
    expect(result.revived).toBe(true);
    expect(target.battleHp).toBe(50); // 50% of maxHp
    expect(result.curedStatus).toEqual(['poison']);
    expect(target.battleStatus).toHaveLength(0);
  });

  it('逃走: succeeds immediately when no enemies remain', () => {
    const battleState = {
      allies: [createCharacter()],
      enemies: [createEnemy({}, { battleHp: 0 })],
      turn: 1,
      currentTurnIndex: 0,
      combatants: [],
      status: 'active' as const,
    };

    const escaped = combatSystem.attemptEscape(battleState);

    expect(escaped).toBe(true);
    expect(battleState.status).toBe('escaped');
  });

  it('逃走: fails against a much faster enemy and leaves the battle active', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99); // above any realistic escape chance

    const battleState = {
      allies: [createCharacter({ stats: { strength: 10, magic: 10, endurance: 10, agility: 1, luck: 10 } })],
      enemies: [createEnemy({}, { stats: { strength: 10, magic: 10, endurance: 10, agility: 99, luck: 10 } })],
      turn: 1,
      currentTurnIndex: 0,
      combatants: [],
      status: 'active' as const,
    };

    const escaped = combatSystem.attemptEscape(battleState);

    expect(escaped).toBe(false);
    expect(battleState.status).toBe('active');
  });
});
