import { BattleState, BattleCharacter, BattleEnemy, Skill, Combatant } from '@/types';

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
      // Get the combatant's current state
      if (combatant.type === 'character') {
        const character = battleState.allies.find(a => a.id === combatant.id);
        if (character) {
          this.executeCharacterTurn(character, battleState);
        }
      } else {
        const enemy = battleState.enemies.find(e => e.id === combatant.id);
        if (enemy) {
          this.executeEnemyTurn(enemy, battleState);
        }
      }

      // Reset combatant's turn timer
      const agilityBonus = combatant.agility / 100;
      combatant.nextTurnIn = this.TICKS_PER_TURN * (1 - agilityBonus);
    }
  }

  private executeCharacterTurn(character: BattleCharacter, battleState: BattleState): void {
    // This will be controlled by player input via UI
    // For now, placeholder
  }

  private executeEnemyTurn(enemy: BattleEnemy, battleState: BattleState): void {
    // Simple AI: pick a random skill and target
    if (enemy.skills.length === 0) {
      return;
    }

    const skill = enemy.skills[Math.floor(Math.random() * enemy.skills.length)];
    const target = battleState.allies[Math.floor(Math.random() * battleState.allies.length)];

    if (target) {
      this.applySkill(enemy, target, skill);
    }
  }

  applySkill(attacker: BattleCharacter | BattleEnemy, target: BattleCharacter | BattleEnemy, skill: Skill): void {
    // Check if attacker has enough MP
    if (attacker.battleMp < skill.costMp) {
      return;
    }

    // Deduct MP
    attacker.battleMp = Math.max(0, attacker.battleMp - skill.costMp);

    // Calculate damage
    const baseDamage = this.calculateDamage(attacker, target, skill);
    const randomFactor = 0.85 + Math.random() * 0.3; // 85-115%
    const finalDamage = Math.floor(baseDamage * randomFactor);

    // Apply damage
    target.battleHp = Math.max(0, target.battleHp - finalDamage);

    // Apply status effects if any
    if (skill.effect) {
      for (const effect of skill.effect) {
        target.battleStatus.push({
          status: effect.type,
          turnsRemaining: effect.duration,
        });
      }
    }
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
