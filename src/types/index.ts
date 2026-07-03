export interface Character {
  id: string;
  name: string;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  stats: Stats;
  personas: PersonaSlot[];
  currentPersona: number; // Index into personas array
  skills: Skill[];
  items: InventoryItem[];
  equipment: Equipment;
}

export interface Stats {
  strength: number;
  magic: number;
  endurance: number;
  agility: number;
  luck: number;
}

export interface Persona {
  id: string;
  name: string;
  arcana: Arcana;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  stats: Stats;
  skills: Skill[];
  resistances: ElementResistances;
}

export type Arcana =
  | 'Fool' | 'Magician' | 'Priestess' | 'Empress' | 'Emperor'
  | 'Hierophant' | 'Lovers' | 'Chariot' | 'Strength' | 'Hermit'
  | 'Wheel' | 'Justice' | 'Hanged' | 'Death' | 'Temperance'
  | 'Devil' | 'Tower' | 'Star' | 'Moon' | 'Sun' | 'Aeon' | 'Universe';

export interface PersonaSlot {
  persona: Persona;
  fusion?: FusionData;
}

export interface FusionData {
  parentPersonas: string[]; // IDs of fused personas
  fusionLevel: number;
}

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  element: Element;
  power: number;
  accuracy: number;
  costMp: number;
  targetType: TargetType;
  effect?: StatusEffect[];
}

export type SkillType = 'physical' | 'magic' | 'support' | 'passive';
export type Element = 'physical' | 'fire' | 'ice' | 'wind' | 'electric' | 'light' | 'dark' | 'almighty';
export type TargetType = 'single' | 'party' | 'all_enemy' | 'self' | 'party_except_self';

export interface StatusEffect {
  type: StatusType;
  duration: number; // turns
  potency: number;
}

export type StatusType = 'poison' | 'charm' | 'sleep' | 'stun' | 'bind' | 'curse' | 'knockdown';

export type ElementResistances = {
  [element in Element]?: Resistance;
};

export type Resistance = 'weak' | 'normal' | 'resist' | 'block' | 'absorb';

export interface Equipment {
  weapon?: Item;
  armor?: Item;
  accessory?: Item;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  stats?: Partial<Stats>;
  resistances?: ElementResistances;
  battleEffect?: ItemBattleEffect;
}

export interface ItemBattleEffect {
  healHp?: number;
  healHpPercent?: number; // 0-1, fraction of target's maxHp
  healMp?: number;
  healMpPercent?: number; // 0-1, fraction of target's maxMp
  cureStatus?: StatusType[];
  revive?: boolean;
}

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material';

export interface InventoryItem {
  item: Item;
  quantity: number;
}

export interface Enemy {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  stats: Stats;
  skills: Skill[];
  resistances: ElementResistances;
  dropExp: number;
  dropItems: DropItem[];
}

export interface DropItem {
  item: Item;
  chance: number; // 0-1
  quantity: number;
}

export interface BattleState {
  allies: BattleCharacter[];
  enemies: BattleEnemy[];
  turn: number;
  currentTurnIndex: number;
  combatants: Combatant[]; // Sorted by turn order
  status: 'active' | 'victory' | 'defeat' | 'escaped';
}

export interface BattleCharacter extends Character {
  battleHp: number;
  battleMp: number;
  battleStatus: BattleStatus[];
  isGuarding?: boolean;
}

export interface BattleEnemy extends Enemy {
  battleHp: number;
  battleMp: number;
  battleStatus: BattleStatus[];
  aiPattern?: string;
  isGuarding?: boolean;
  isAnalyzed?: boolean;
}

export interface BattleStatus {
  status: StatusType;
  turnsRemaining: number;
}

export interface Combatant {
  id: string;
  type: 'character' | 'enemy';
  agility: number;
  nextTurnIn: number; // ticks until can act
}

export type GameMode = 'menu' | 'exploration' | 'battle' | 'dialogue' | 'pause';

export interface GameState {
  mode: GameMode;
  party: Character[];
  currentPartyIndex: number;
  money: number;
  playtime: number; // in seconds
  battleState?: BattleState;
  currentMap?: MapInstance;
  inventory: InventoryItem[];
  visited: Set<string>; // visited location IDs
}

export interface MapInstance {
  mapId: string;
  playerPos: Vector2;
  exploredTiles: Set<string>;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface MapData {
  id: string;
  name: string;
  width: number;
  height: number;
  tileTypes: TileType[][];
  encounters: EncounterZone[];
  npc: NPC[];
  exits: MapExit[];
}

export type TileType = 'floor' | 'wall' | 'water' | 'hazard';

export interface EncounterZone {
  id: string;
  pos: Vector2;
  radius: number;
  enemies: string[]; // enemy IDs
  encounterRate: number; // 0-1, per step
}

export interface NPC {
  id: string;
  name: string;
  pos: Vector2;
  dialogue: DialogueNode[];
  giveItems?: InventoryItem[];
}

export interface MapExit {
  pos: Vector2;
  targetMapId: string;
  targetPos: Vector2;
}

export interface DialogueNode {
  id: string;
  text: string;
  choices?: DialogueChoice[];
  nextNodeId?: string;
}

export interface DialogueChoice {
  text: string;
  nextNodeId: string;
}

export interface SaveData {
  version: number;
  playtime: number;
  party: Character[];
  inventory: InventoryItem[];
  money: number;
  visitedLocations: string[];
  gameState: GameState;
  timestamp: number;
}
