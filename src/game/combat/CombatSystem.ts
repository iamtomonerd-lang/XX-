import {
  BattleState,
  BattleCharacter,
  BattleEnemy,
  Skill,
  Combatant,
  ElementResistances,
  Element,
  Resistance,
  InventoryItem,
  StatusType,
} from '@/types';

export interface AnalysisResult {
  weaknesses: Element[];
  resists: Element[];
  blocks: Element[];
  absorbs: Element[];
}

export interface ItemUseResult {
  success: boolean;
  healedHp: number;
  healedMp: number;
  curedStatus: StatusType[];
  revived: boolean;
}

export interface ActionResult {
  hit: boolean;
  damage: number;
  healed: number;
  resistance: Resistance;
  critical: boolean;
  exploitedWeakness: boolean;
  /** True when the attacker earned an extra ("1 MORE") action this round. */
  bonusTurn: boolean;
  knockedDown: boolean;
}

const MISS_RESULT: ActionResult = {
  hit: false,
  damage: 0,
  healed: 0,
  resistance: 'normal',
  critical: false,
  exploitedWeakness: false,
  bonusTurn: false,
  knockedDown: false,
};

export class CombatSystem {
  private readonly TICKS_PER_TURN = 100;

  update(battleState: BattleState, deltaTime: number): void {
    if (battleState.status !== 'active') {
      return;
    }

    // Update turn timers
    for (const combatant of battleState.combatants) {
      combatant.nextTurnIn = Math.max(0, combatant.nextTurnIn - deltaTime * 1000);
    }

    // Process turns in order
    this.processTurns(battleState);
  }

  private processTurns(battleState: BattleState): void {
    // Find combatants ready to act
    const readyCombatants = battleState.combatants.filter(c => c.nextTurnIn <= 0);

    for (const combatant of readyCombatants) {
      if (combatant.type === 'character') {
        const character = battleState.allies.find(a => a.id === combatant.id);
        if (character && character.battleHp > 0) {
          this.executeCharacterTurn(character, combatant, battleState);
        } else {
          combatant.nextTurnIn = this.calculateTurnDelay(combatant.agility);
        }
      } else {
        const enemy = battleState.enemies.find(e => e.id === combatant.id);
        if (enemy && enemy.battleHp > 0) {
          this.executeEnemyTurn(enemy, combatant, battleState);
        } else {
          combatant.nextTurnIn = this.calculateTurnDelay(combatant.agility);
        }
      }
    }
  }

  private calculateTurnDelay(agility: number): number {
    const agilityBonus = Math.min(0.9, agility / 100);
    return this.TICKS_PER_TURN * (1 - agilityBonus);
  }

  private executeCharacterTurn(character: BattleCharacter, _combatant: Combatant, _battleState: BattleState): void {
    // A guard only lasts until the guarder's own next turn comes up.
    this.beginTurn(character);

    // Player-controlled turn: the UI layer selects the action and calls
    // performAction/guard/useItem/etc. directly, then advances
    // combatant.nextTurnIn (see applyBonusTurn). Nothing to do here while
    // waiting for input.
  }

  private executeEnemyTurn(enemy: BattleEnemy, combatant: Combatant, battleState: BattleState): void {
    // A guard only lasts until the guarder's own next turn comes up.
    this.beginTurn(enemy);

    // Simple AI: pick a random skill and target
    if (enemy.skills.length === 0) {
      combatant.nextTurnIn = this.calculateTurnDelay(combatant.agility);
      return;
    }

    const aliveAllies = battleState.allies.filter(a => a.battleHp > 0);
    if (aliveAllies.length === 0) {
      combatant.nextTurnIn = this.calculateTurnDelay(combatant.agility);
      return;
    }

    const skill = enemy.skills[Math.floor(Math.random() * enemy.skills.length)];
    const target = aliveAllies[Math.floor(Math.random() * aliveAllies.length)];

    const result = this.performAction(enemy, target, skill);
    this.applyBonusTurn(combatant, result);
  }

  /**
   * Advances a combatant's turn timer, respecting "1 MORE": exploiting a
   * weakness or landing a critical hit grants an immediate follow-up action
   * instead of waiting out the normal agility-based delay.
   */
  applyBonusTurn(combatant: Combatant, result: ActionResult): void {
    combatant.nextTurnIn = result.bonusTurn ? 0 : this.calculateTurnDelay(combatant.agility);
  }

  /**
   * Resolves a single skill use: MP cost, accuracy, elemental resistance
   * (block/absorb/resist/weak), critical hits, and knockdown/status effects.
   */
  performAction(
    attacker: BattleCharacter | BattleEnemy,
    target: BattleCharacter | BattleEnemy,
    skill: Skill
  ): ActionResult {
    if (attacker.battleMp < skill.costMp) {
      return MISS_RESULT;
    }
    attacker.battleMp = Math.max(0, attacker.battleMp - skill.costMp);

    if (Math.random() > skill.accuracy) {
      return MISS_RESULT;
    }

    const resistance = this.getElementResistance(target, skill.element);

    if (resistance === 'block') {
      return { ...MISS_RESULT, hit: true, resistance };
    }

    if (resistance === 'absorb') {
      const healed = Math.max(0, this.calculateDamage(attacker, target, skill));
      target.battleHp = Math.min(target.maxHp, target.battleHp + healed);
      return { ...MISS_RESULT, hit: true, healed, resistance };
    }

    const baseDamage = Math.max(0, this.calculateDamage(attacker, target, skill));
    const randomFactor = 0.85 + Math.random() * 0.3; // 85-115%
    const critChance = 0.05 + attacker.stats.luck * 0.002;
    const critical = skill.type !== 'support' && Math.random() < critChance;
    const exploitedWeakness = resistance === 'weak';

    let multiplier = randomFactor;
    if (exploitedWeakness) multiplier *= 1.5;
    if (resistance === 'resist') multiplier *= 0.5;
    if (critical) multiplier *= 1.5;
    if (target.isGuarding) multiplier *= 0.5;

    const damage = Math.floor(baseDamage * multiplier);
    target.battleHp = Math.max(0, target.battleHp - damage);

    const knockedDown = (exploitedWeakness || critical) && target.battleHp > 0;
    if (knockedDown) {
      target.battleStatus.push({ status: 'knockdown', turnsRemaining: 1 });
    }

    if (skill.effect) {
      for (const effect of skill.effect) {
        target.battleStatus.push({
          status: effect.type,
          turnsRemaining: effect.duration,
        });
      }
    }

    return {
      hit: true,
      damage,
      healed: 0,
      resistance,
      critical,
      exploitedWeakness,
      bonusTurn: exploitedWeakness || critical,
      knockedDown,
    };
  }

  /** @deprecated Use performAction, which returns weakness/critical results. */
  applySkill(attacker: BattleCharacter | BattleEnemy, target: BattleCharacter | BattleEnemy, skill: Skill): ActionResult {
    return this.performAction(attacker, target, skill);
  }

  /** Clears a combatant's guard; called when it becomes their turn to act again. */
  private beginTurn(combatant: BattleCharacter | BattleEnemy): void {
    combatant.isGuarding = false;
  }

  /** 物理 — a free (no MP cost) attack using the attacker's raw strength. */
  performBasicAttack(attacker: BattleCharacter | BattleEnemy, target: BattleCharacter | BattleEnemy): ActionResult {
    const basicAttack: Skill = {
      id: 'basic-attack',
      name: '攻撃',
      type: 'physical',
      element: 'physical',
      power: 100,
      accuracy: 0.95,
      costMp: 0,
      targetType: 'single',
    };
    return this.performAction(attacker, target, basicAttack);
  }

  /** ガード — halves damage taken until the start of this combatant's next turn. */
  guard(combatant: BattleCharacter | BattleEnemy): void {
    combatant.isGuarding = true;
  }

  /** アナライズ — reveals an enemy's elemental weaknesses/resistances. */
  analyze(target: BattleEnemy): AnalysisResult {
    target.isAnalyzed = true;

    const result: AnalysisResult = { weaknesses: [], resists: [], blocks: [], absorbs: [] };
    for (const element of Object.keys(target.resistances) as Element[]) {
      switch (target.resistances[element]) {
        case 'weak':
          result.weaknesses.push(element);
          break;
        case 'resist':
          result.resists.push(element);
          break;
        case 'block':
          result.blocks.push(element);
          break;
        case 'absorb':
          result.absorbs.push(element);
          break;
      }
    }
    return result;
  }

  /** ペルソナ — switches the character's active persona. Returns false if the index is invalid. */
  switchPersona(character: BattleCharacter, personaIndex: number): boolean {
    if (personaIndex < 0 || personaIndex >= character.personas.length) {
      return false;
    }
    character.currentPersona = personaIndex;
    return true;
  }

  /** アイテム — consumes an inventory item on a target (heal HP/MP, cure status, or revive). */
  useItem(inventoryItem: InventoryItem, target: BattleCharacter | BattleEnemy): ItemUseResult {
    const effect = inventoryItem.item.battleEffect;
    const failure: ItemUseResult = { success: false, healedHp: 0, healedMp: 0, curedStatus: [], revived: false };

    if (!effect || inventoryItem.quantity <= 0) {
      return failure;
    }

    let revived = false;
    if (target.battleHp <= 0) {
      if (!effect.revive) {
        return failure;
      }
      target.battleHp = Math.max(1, Math.floor(target.maxHp * 0.5));
      revived = true;
    }

    const healedHp = Math.min(
      target.maxHp - target.battleHp,
      (effect.healHp ?? 0) + Math.floor(target.maxHp * (effect.healHpPercent ?? 0))
    );
    target.battleHp += healedHp;

    const healedMp = Math.min(
      target.maxMp - target.battleMp,
      (effect.healMp ?? 0) + Math.floor(target.maxMp * (effect.healMpPercent ?? 0))
    );
    target.battleMp += healedMp;

    const curedStatus: StatusType[] = [];
    if (effect.cureStatus?.length) {
      target.battleStatus = target.battleStatus.filter(status => {
        if (effect.cureStatus!.includes(status.status)) {
          curedStatus.push(status.status);
          return false;
        }
        return true;
      });
    }

    inventoryItem.quantity -= 1;

    return { success: true, healedHp, healedMp, curedStatus, revived };
  }

  /** 逃走 — attempts to flee; odds favor the side with higher average agility. */
  attemptEscape(battleState: BattleState): boolean {
    const aliveAllies = battleState.allies.filter(a => a.battleHp > 0);
    const aliveEnemies = battleState.enemies.filter(e => e.battleHp > 0);

    if (aliveEnemies.length === 0) {
      battleState.status = 'escaped';
      return true;
    }

    const avgAllyAgility = aliveAllies.reduce((sum, a) => sum + a.stats.agility, 0) / Math.max(1, aliveAllies.length);
    const avgEnemyAgility = aliveEnemies.reduce((sum, e) => sum + e.stats.agility, 0) / Math.max(1, aliveEnemies.length);
    const chance = Math.min(0.95, Math.max(0.1, 0.5 + (avgAllyAgility - avgEnemyAgility) / 100));

    const success = Math.random() < chance;
    if (success) {
      battleState.status = 'escaped';
    }
    return success;
  }

  /**
   * A character's resistances come from their currently equipped persona;
   * an enemy carries its own resistance table directly.
   */
  private getElementResistance(combatant: BattleCharacter | BattleEnemy, element: Element): Resistance {
    const resistances: ElementResistances = this.isBattleCharacter(combatant)
      ? combatant.personas[combatant.currentPersona]?.persona.resistances ?? {}
      : combatant.resistances;

    return resistances[element] ?? 'normal';
  }

  private isBattleCharacter(combatant: BattleCharacter | BattleEnemy): combatant is BattleCharacter {
    return 'personas' in combatant;
  }

  private calculateDamage(attacker: BattleCharacter | BattleEnemy, target: BattleCharacter | BattleEnemy, skill: Skill): number {
    if (skill.type === 'physical') {
      return Math.floor(
        ((attacker.stats.strength * skill.power) / 100) - (target.stats.endurance / 10)
      );
    } else if (skill.type === 'magic') {
      return Math.floor(
        ((attacker.stats.magic * skill.power) / 100) - (target.stats.endurance / 10)
      );
    }
    return 0;
  }

  checkBattleEnd(battleState: BattleState): void {
    const alliesDefeated = battleState.allies.every(a => a.battleHp <= 0);
    const enemiesDefeated = battleState.enemies.every(e => e.battleHp <= 0);

    if (alliesDefeated) {
      battleState.status = 'defeat';
    } else if (enemiesDefeated) {
      battleState.status = 'victory';
    }
  }
}
