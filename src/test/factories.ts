import { BattleCharacter, BattleEnemy, Persona, Item, ElementResistances } from '@/types';

export function createPersona(overrides: Partial<Persona> = {}): Persona {
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

export function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item1',
    name: 'Medicine',
    type: 'consumable',
    description: 'Restores HP',
    ...overrides,
  };
}

export function createCharacter(overrides: Partial<BattleCharacter> = {}): BattleCharacter {
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

export function createEnemy(resistances: ElementResistances = {}, overrides: Partial<BattleEnemy> = {}): BattleEnemy {
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
