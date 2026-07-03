import { BattleState, BattleCharacter, BattleEnemy, Skill, Combatant, ElementResistances, Element, Resistance } from '@/types';

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

  private executeCharacterTurn(_character: BattleCharacter, _combatant: Combatant, _battleState: BattleState): void {
    // Player-controlled turn: the UI layer selects the action and calls
    // performAction directly, then advances combatant.nextTurnIn based on
    // the returned ActionResult (see applyBonusTurn). Nothing to do here
    // while waiting for input.
  }

  private executeEnemyTurn(enemy: BattleEnemy, combatant: Combatant, battleState: BattleState): void {
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
