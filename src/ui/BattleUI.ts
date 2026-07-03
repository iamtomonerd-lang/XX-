import {
  BattleState,
  BattleCharacter,
  BattleEnemy,
  Skill,
  InventoryItem,
  PersonaSlot,
  Combatant,
} from '@/types';
import { CombatSystem, ActionResult, AnalysisResult, ItemUseResult, AllOutAttackResult } from '@/game/combat/CombatSystem';

export type BattleCommandType = 'analyze' | 'guard' | 'physical' | 'skill' | 'persona' | 'item' | 'escape';

export type BattleMenuMode =
  | 'all-out-prompt'
  | 'command'
  | 'select-skill'
  | 'select-item'
  | 'select-persona'
  | 'select-target'
  | 'turn-end';

export interface BattleCommandOption {
  type: BattleCommandType;
  label: string;
  enabled: boolean;
  disabledReason?: string;
}

export interface BattleLogEntry {
  message: string;
  turn: number;
}

export interface BattleViewModel {
  mode: BattleMenuMode;
  actingCharacterId: string | null;
  commands: BattleCommandOption[];
  skillOptions: Skill[];
  itemOptions: InventoryItem[];
  personaOptions: PersonaSlot[];
  targetOptions: (BattleCharacter | BattleEnemy)[];
  allies: BattleCharacter[];
  enemies: BattleEnemy[];
  log: BattleLogEntry[];
  battleStatus: BattleState['status'];
}

const COMMAND_LABELS: Record<BattleCommandType, string> = {
  analyze: 'アナライズ',
  guard: 'ガード',
  physical: '物理',
  skill: 'スキル',
  persona: 'ペルソナ',
  item: 'アイテム',
  escape: '逃走',
};

/**
 * Drives the player-facing battle command menu on top of CombatSystem.
 * Produces plain view-model data (no DOM); a rendering layer consumes it.
 */
export class BattleUI {
  private mode: BattleMenuMode = 'command';
  private actingCharacter: BattleCharacter | null = null;
  private actingCombatant: Combatant | null = null;
  private pendingCommand: BattleCommandType | null = null;
  private pendingSkill: Skill | null = null;
  private pendingItem: InventoryItem | null = null;
  private log: BattleLogEntry[] = [];

  constructor(
    private readonly combatSystem: CombatSystem,
    private readonly battleState: BattleState
  ) {}

  /** Finds a character combatant whose turn has come up and isn't already being handled. */
  getReadyCharacter(): BattleCharacter | null {
    if (this.actingCharacter) {
      return null;
    }
    const ready = this.battleState.combatants.find(
      c => c.type === 'character' && c.nextTurnIn <= 0
    );
    if (!ready) {
      return null;
    }
    return this.battleState.allies.find(a => a.id === ready.id && a.battleHp > 0) ?? null;
  }

  /** Call once a character is ready to act; opens the command menu (or All-Out Attack prompt) for them. */
  beginTurn(character: BattleCharacter): void {
    this.actingCharacter = character;
    this.actingCombatant = this.battleState.combatants.find(c => c.id === character.id) ?? null;
    this.pendingCommand = null;
    this.pendingSkill = null;
    this.pendingItem = null;
    this.mode = this.combatSystem.canAllOutAttack(this.battleState) ? 'all-out-prompt' : 'command';
  }

  /** Declines the All-Out Attack prompt and falls through to the normal command menu. */
  declineAllOutAttack(): void {
    if (this.mode === 'all-out-prompt') {
      this.mode = 'command';
    }
  }

  /** Accepts the All-Out Attack prompt; this consumes the current actor's turn. */
  triggerAllOutAttack(): AllOutAttackResult {
    const result = this.combatSystem.performAllOutAttack(this.battleState);
    if (result.attempted) {
      this.log.push({
        message: result.success
          ? `総攻撃！ 敵全体に大ダメージ！`
          : `総攻撃は外れてしまった…`,
        turn: this.battleState.turn,
      });
      this.endTurn({ bonusTurn: false });
    }
    return result;
  }

  selectCommand(command: BattleCommandType): void {
    const option = this.getCommandOptions().find(c => c.type === command);
    if (!option?.enabled) {
      return;
    }

    this.pendingCommand = command;

    switch (command) {
      case 'skill':
        this.mode = 'select-skill';
        break;
      case 'item':
        this.mode = 'select-item';
        break;
      case 'persona':
        this.mode = 'select-persona';
        break;
      case 'physical':
      case 'analyze':
        this.mode = 'select-target';
        break;
      case 'guard':
        this.resolveGuard();
        break;
      case 'escape':
        this.resolveEscape();
        break;
    }
  }

  selectSkill(skill: Skill): void {
    this.pendingSkill = skill;
    this.mode = 'select-target';
  }

  selectItem(inventoryItem: InventoryItem): void {
    this.pendingItem = inventoryItem;
    this.mode = 'select-target';
  }

  selectPersona(personaIndex: number): void {
    const character = this.requireActor();
    const switched = this.combatSystem.switchPersona(character, personaIndex);
    if (switched) {
      this.log.push({
        message: `${character.name}はペルソナを切り替えた！`,
        turn: this.battleState.turn,
      });
      this.endTurn({ bonusTurn: false });
    } else {
      this.mode = 'command';
    }
  }

  /** Resolves the pending physical/skill/item/analyze action against the chosen target. */
  selectTarget(target: BattleCharacter | BattleEnemy): void {
    const character = this.requireActor();

    if (this.pendingItem) {
      this.resolveItem(character, this.pendingItem, target);
      this.endTurn({ bonusTurn: false });
      return;
    }

    const skill = this.pendingSkill;

    if (this.pendingCommand === 'analyze' && this.isEnemy(target)) {
      const result = this.combatSystem.analyze(target);
      this.logAnalysis(target, result);
      this.endTurn({ bonusTurn: false });
      return;
    }

    const result = skill
      ? this.combatSystem.performAction(character, target, skill)
      : this.combatSystem.performBasicAttack(character, target);

    this.logAction(character, target, result);
    this.endTurn({ bonusTurn: result.bonusTurn });
  }

  cancelSelection(): void {
    this.pendingCommand = null;
    this.pendingSkill = null;
    this.pendingItem = null;
    this.mode = 'command';
  }

  private resolveGuard(): void {
    const character = this.requireActor();
    this.combatSystem.guard(character);
    this.log.push({ message: `${character.name}はガードした。`, turn: this.battleState.turn });
    this.endTurn({ bonusTurn: false });
  }

  private resolveEscape(): void {
    const success = this.combatSystem.attemptEscape(this.battleState);
    this.log.push({
      message: success ? '戦闘から離脱した！' : '逃げられなかった！',
      turn: this.battleState.turn,
    });
    if (!success) {
      this.endTurn({ bonusTurn: false });
    } else {
      this.actingCharacter = null;
      this.actingCombatant = null;
      this.mode = 'turn-end';
    }
  }

  private resolveItem(character: BattleCharacter, inventoryItem: InventoryItem, target: BattleCharacter | BattleEnemy): ItemUseResult {
    const result = this.combatSystem.useItem(inventoryItem, target);
    this.log.push({
      message: result.success
        ? `${character.name}は${inventoryItem.item.name}を${target.name}に使った！`
        : `${inventoryItem.item.name}は使えなかった。`,
      turn: this.battleState.turn,
    });
    return result;
  }

  private logAction(attacker: BattleCharacter, target: BattleCharacter | BattleEnemy, result: ActionResult): void {
    if (!result.hit) {
      this.log.push({ message: `${attacker.name}の攻撃は外れた！`, turn: this.battleState.turn });
      return;
    }
    if (result.resistance === 'block') {
      this.log.push({ message: `${target.name}には効かなかった！`, turn: this.battleState.turn });
      return;
    }
    if (result.resistance === 'absorb') {
      this.log.push({ message: `${target.name}は攻撃を吸収した！`, turn: this.battleState.turn });
      return;
    }
    if (result.weaknessNegated) {
      this.log.push({ message: `${target.name}はガードで弱点を防いだ！ ${result.damage}のダメージ`, turn: this.battleState.turn });
      return;
    }
    if (result.exploitedWeakness) {
      this.log.push({ message: `弱点をついた！ ${target.name}に${result.damage}のダメージ、ダウン！`, turn: this.battleState.turn });
      return;
    }
    if (result.critical) {
      this.log.push({ message: `会心の一撃！ ${target.name}に${result.damage}のダメージ、ダウン！`, turn: this.battleState.turn });
      return;
    }
    this.log.push({ message: `${target.name}に${result.damage}のダメージ！`, turn: this.battleState.turn });
  }

  private logAnalysis(target: BattleEnemy, result: AnalysisResult): void {
    const parts: string[] = [];
    if (result.weaknesses.length) parts.push(`弱点: ${result.weaknesses.join('/')}`);
    if (result.resists.length) parts.push(`耐性: ${result.resists.join('/')}`);
    if (result.blocks.length) parts.push(`無効: ${result.blocks.join('/')}`);
    if (result.absorbs.length) parts.push(`吸収: ${result.absorbs.join('/')}`);
    this.log.push({
      message: `${target.name}を分析した。${parts.join('、') || '目立った特性はない。'}`,
      turn: this.battleState.turn,
    });
  }

  private endTurn(opts: { bonusTurn: boolean }): void {
    if (this.actingCombatant) {
      this.combatSystem.applyBonusTurn(this.actingCombatant, this.toActionResult(opts));
    }
    this.pendingCommand = null;
    this.pendingSkill = null;
    this.pendingItem = null;
    this.mode = opts.bonusTurn ? (this.combatSystem.canAllOutAttack(this.battleState) ? 'all-out-prompt' : 'command') : 'turn-end';
    if (!opts.bonusTurn) {
      this.actingCharacter = null;
      this.actingCombatant = null;
    }
  }

  private toActionResult(opts: { bonusTurn: boolean }): ActionResult {
    return {
      hit: true,
      damage: 0,
      healed: 0,
      resistance: 'normal',
      critical: false,
      exploitedWeakness: false,
      weaknessNegated: false,
      bonusTurn: opts.bonusTurn,
      knockedDown: false,
    };
  }

  private requireActor(): BattleCharacter {
    if (!this.actingCharacter) {
      throw new Error('No character is currently taking a turn.');
    }
    return this.actingCharacter;
  }

  private isEnemy(target: BattleCharacter | BattleEnemy): target is BattleEnemy {
    return this.battleState.enemies.some(e => e.id === target.id);
  }

  private getCommandOptions(): BattleCommandOption[] {
    const character = this.actingCharacter;
    const hasUsableSkill = !!character && character.skills.some(s => s.costMp <= character.battleMp);
    const hasUsableItem = !!character && character.items.some(i => i.quantity > 0 && i.item.battleEffect);
    const hasExtraPersona = !!character && character.personas.length > 1;

    return [
      { type: 'analyze', label: COMMAND_LABELS.analyze, enabled: this.battleState.enemies.some(e => e.battleHp > 0) },
      { type: 'guard', label: COMMAND_LABELS.guard, enabled: true },
      { type: 'physical', label: COMMAND_LABELS.physical, enabled: true },
      { type: 'skill', label: COMMAND_LABELS.skill, enabled: hasUsableSkill, disabledReason: hasUsableSkill ? undefined : 'MPが足りない、または使えるスキルがない' },
      { type: 'persona', label: COMMAND_LABELS.persona, enabled: hasExtraPersona, disabledReason: hasExtraPersona ? undefined : '他に持っているペルソナがない' },
      { type: 'item', label: COMMAND_LABELS.item, enabled: hasUsableItem, disabledReason: hasUsableItem ? undefined : '使えるアイテムがない' },
      { type: 'escape', label: COMMAND_LABELS.escape, enabled: true },
    ];
  }

  getViewModel(): BattleViewModel {
    const character = this.actingCharacter;
    const targetOptions: (BattleCharacter | BattleEnemy)[] =
      this.mode === 'select-target'
        ? this.pendingItem
          ? [...this.battleState.allies.filter(a => a.battleHp > 0 || this.pendingItem?.item.battleEffect?.revive)]
          : this.battleState.enemies.filter(e => e.battleHp > 0)
        : [];

    return {
      mode: this.mode,
      actingCharacterId: character?.id ?? null,
      commands: this.getCommandOptions(),
      skillOptions: character?.skills ?? [],
      itemOptions: character?.items.filter(i => i.quantity > 0 && i.item.battleEffect) ?? [],
      personaOptions: character?.personas ?? [],
      targetOptions,
      allies: this.battleState.allies,
      enemies: this.battleState.enemies,
      log: this.log,
      battleStatus: this.battleState.status,
    };
  }
}
