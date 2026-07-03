import { BattleCharacter, BattleEnemy, Skill, Persona, InventoryItem } from '@/types';

const strike: Skill = { id: 'strike', name: '斬撃', type: 'physical', element: 'physical', power: 110, accuracy: 0.95, costMp: 0, targetType: 'single' };
const agi: Skill = { id: 'agi', name: 'アギ', type: 'magic', element: 'fire', power: 90, accuracy: 0.95, costMp: 6, targetType: 'single' };
const bufu: Skill = { id: 'bufu', name: 'ブフ', type: 'magic', element: 'ice', power: 90, accuracy: 0.95, costMp: 6, targetType: 'single' };
const zio: Skill = { id: 'zio', name: 'ジオ', type: 'magic', element: 'electric', power: 90, accuracy: 0.9, costMp: 6, targetType: 'single' };

const jackFrost: Persona = {
  id: 'jack-frost',
  name: 'ジャックフロスト',
  arcana: 'Fool',
  level: 5,
  hp: 40,
  maxHp: 40,
  mp: 30,
  maxMp: 30,
  stats: { strength: 8, magic: 14, endurance: 8, agility: 12, luck: 12 },
  skills: [bufu],
  resistances: { ice: 'absorb', fire: 'weak' },
};

const pixie: Persona = {
  id: 'pixie',
  name: 'ピクシー',
  arcana: 'Lovers',
  level: 4,
  hp: 34,
  maxHp: 34,
  mp: 34,
  maxMp: 34,
  stats: { strength: 6, magic: 13, endurance: 6, agility: 14, luck: 13 },
  skills: [zio],
  resistances: { electric: 'resist', physical: 'weak' },
};

/** A small hand-authored encounter used to demo the battle system in the browser. */
export function createDemoBattle(): { allies: BattleCharacter[]; enemies: BattleEnemy[] } {
  const medicine: InventoryItem = {
    item: { id: 'medicine', name: '薬', type: 'consumable', description: 'HPを30回復する', battleEffect: { healHp: 30 } },
    quantity: 3,
  };

  const hero: BattleCharacter = {
    id: 'hero',
    name: '主人公',
    level: 5,
    exp: 0,
    hp: 90,
    maxHp: 90,
    mp: 40,
    maxMp: 40,
    stats: { strength: 13, magic: 10, endurance: 11, agility: 11, luck: 10 },
    personas: [{ persona: jackFrost }, { persona: pixie }],
    currentPersona: 0,
    skills: [strike, agi],
    items: [medicine],
    equipment: {},
    battleHp: 90,
    battleMp: 40,
    battleStatus: [],
  };

  const ally: BattleCharacter = {
    id: 'ally',
    name: '仲間',
    level: 5,
    exp: 0,
    hp: 75,
    maxHp: 75,
    mp: 45,
    maxMp: 45,
    stats: { strength: 10, magic: 13, endurance: 9, agility: 13, luck: 11 },
    personas: [{ persona: pixie }],
    currentPersona: 0,
    skills: [strike, zio],
    items: [],
    equipment: {},
    battleHp: 75,
    battleMp: 45,
    battleStatus: [],
  };

  const shadow1: BattleEnemy = {
    id: 'shadow-1',
    name: 'マガツシャドウ',
    level: 4,
    hp: 60,
    maxHp: 60,
    mp: 20,
    maxMp: 20,
    stats: { strength: 11, magic: 9, endurance: 9, agility: 8, luck: 8 },
    skills: [strike],
    resistances: { fire: 'weak', ice: 'resist' },
    dropExp: 30,
    dropItems: [],
    battleHp: 60,
    battleMp: 20,
    battleStatus: [],
  };

  const shadow2: BattleEnemy = {
    id: 'shadow-2',
    name: 'ジャコランタン',
    level: 4,
    hp: 50,
    maxHp: 50,
    mp: 25,
    maxMp: 25,
    stats: { strength: 9, magic: 11, endurance: 8, agility: 10, luck: 9 },
    skills: [agi],
    resistances: { electric: 'weak', fire: 'block' },
    dropExp: 25,
    dropItems: [],
    battleHp: 50,
    battleMp: 25,
    battleStatus: [],
  };

  return { allies: [hero, ally], enemies: [shadow1, shadow2] };
}
