import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem } from './CombatSystem';
import { BattleState, BattleCharacter, Skill } from '@/types';

describe('CombatSystem', () => {
  let combatSystem: CombatSystem;

  beforeEach(() => {
    combatSystem = new CombatSystem();
  });

  it('should be initialized', () => {
    expect(combatSystem).toBeDefined();
  });

  it('should deduct MP when skill is used', () => {
    const attacker: BattleCharacter = {
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
    };

    const target: BattleCharacter = {
      ...attacker,
      id: 'char2',
      battleHp: 100,
      battleMp: 50,
    };

    const skill: Skill = {
      id: 'skill1',
      name: 'Fireball',
      type: 'magic',
      element: 'fire',
      power: 100,
      accuracy: 1,
      costMp: 30,
      targetType: 'single',
    };

    combatSystem.applySkill(attacker, target, skill);

    expect(attacker.battleMp).toBe(20);
  });

  it('should not use skill if MP is insufficient', () => {
    const attacker: BattleCharacter = {
      id: 'char1',
      name: 'Hero',
      level: 1,
      exp: 0,
      hp: 100,
      maxHp: 100,
      mp: 20,
      maxMp: 50,
      stats: { strength: 10, magic: 10, endurance: 10, agility: 10, luck: 10 },
      personas: [],
      currentPersona: 0,
      skills: [],
      items: [],
      equipment: {},
      battleHp: 100,
      battleMp: 20,
      battleStatus: [],
    };

    const target: BattleCharacter = {
      ...attacker,
      id: 'char2',
      battleHp: 100,
      battleMp: 50,
    };

    const skill: Skill = {
      id: 'skill1',
      name: 'Fireball',
      type: 'magic',
      element: 'fire',
      power: 100,
      accuracy: 1,
      costMp: 30,
      targetType: 'single',
    };

    combatSystem.applySkill(attacker, target, skill);

    expect(attacker.battleMp).toBe(20);
    expect(target.battleHp).toBe(100); // No damage dealt
  });
});
