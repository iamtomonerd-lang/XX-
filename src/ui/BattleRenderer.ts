import { BattleState, BattleCharacter, BattleEnemy, Skill, InventoryItem, PersonaSlot } from '@/types';
import { CombatSystem } from '@/game/combat/CombatSystem';
import { BattleUI, BattleCommandType, BattleViewModel } from './BattleUI';

const RESULT_LABELS: Record<Exclude<BattleState['status'], 'active'>, string> = {
  victory: '勝利！',
  defeat: '全滅した…',
  escaped: '戦闘から離脱した',
};

/**
 * Minimal DOM renderer for BattleUI's view model. Plain HTML/CSS only —
 * no sprites or canvas — this exists to exercise the battle system in a
 * real browser, not to serve as the game's graphics layer.
 */
export class BattleRenderer {
  private animationFrameId: number | null = null;
  private lastTime = 0;
  private ticking = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly combatSystem: CombatSystem,
    private readonly battleState: BattleState,
    private readonly ui: BattleUI
  ) {}

  start(): void {
    this.render();
    this.resumeTicking();
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.ticking = false;
  }

  /**
   * Runs the real-time ATB clock (enemy turns, timer countdowns) only
   * while no character is waiting on player input. Re-rendering every
   * animation frame regardless of whether anything changed would tear
   * down and rebuild menu buttons out from under the player's click, so
   * the loop stops entirely once someone's turn opens and only resumes
   * once handlePlayerAction sees the turn has actually ended.
   */
  private resumeTicking(): void {
    if (this.ticking || this.battleState.status !== 'active' || this.ui.isAwaitingInput()) {
      return;
    }
    this.ticking = true;
    this.lastTime = 0;
    this.animationFrameId = requestAnimationFrame(time => this.tick(time));
  }

  private tick(time: number): void {
    if (this.lastTime === 0) {
      this.lastTime = time;
    }
    const deltaTime = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.combatSystem.update(this.battleState, deltaTime);
    const ready = this.ui.getReadyCharacter();
    if (ready) {
      this.ui.beginTurn(ready);
    }
    this.render();

    if (this.battleState.status === 'active' && !this.ui.isAwaitingInput()) {
      this.animationFrameId = requestAnimationFrame(t => this.tick(t));
    } else {
      this.ticking = false;
      this.animationFrameId = null;
    }
  }

  /** Called after every player interaction: re-renders immediately and resumes the ATB clock if the turn truly ended. */
  private handlePlayerAction(): void {
    this.render();
    this.resumeTicking();
  }

  private render(): void {
    const vm = this.ui.getViewModel();
    this.container.innerHTML = '';
    this.container.appendChild(this.buildScreen(vm));
  }

  private buildScreen(vm: BattleViewModel): HTMLElement {
    const screen = el('div', 'battle-screen');
    screen.appendChild(this.buildCombatantRow(vm.enemies, 'enemy'));
    screen.appendChild(this.buildCombatantRow(vm.allies, 'ally'));
    screen.appendChild(this.buildLog(vm));
    if (vm.battleStatus !== 'active') {
      screen.appendChild(this.buildResultBanner(vm.battleStatus as Exclude<BattleState['status'], 'active'>));
    } else {
      screen.appendChild(this.buildActionPanel(vm));
    }
    return screen;
  }

  private buildCombatantRow(combatants: (BattleCharacter | BattleEnemy)[], kind: 'ally' | 'enemy'): HTMLElement {
    const row = el('div', `combatant-row combatant-row--${kind}`);
    for (const c of combatants) {
      row.appendChild(this.buildCombatantCard(c, kind));
    }
    return row;
  }

  private buildCombatantCard(c: BattleCharacter | BattleEnemy, kind: 'ally' | 'enemy'): HTMLElement {
    const card = el('div', `combatant-card${c.battleHp <= 0 ? ' combatant-card--down' : ''}`);
    card.appendChild(el('div', 'combatant-name', c.name));
    card.appendChild(this.buildBar('hp', c.battleHp, c.maxHp));
    if (kind === 'ally') {
      card.appendChild(this.buildBar('mp', c.battleMp, c.maxMp));
    }

    const badges = el('div', 'combatant-badges');
    if (c.isGuarding) badges.appendChild(el('span', 'badge badge--guard', 'ガード'));
    if (c.battleStatus.some(s => s.status === 'knockdown')) badges.appendChild(el('span', 'badge badge--down', 'ダウン'));
    if ('isAnalyzed' in c && c.isAnalyzed) {
      const weaknesses = (Object.keys(c.resistances) as (keyof typeof c.resistances)[]).filter(k => c.resistances[k] === 'weak');
      if (weaknesses.length) {
        badges.appendChild(el('span', 'badge badge--weak', `弱点: ${weaknesses.join('/')}`));
      }
    }
    card.appendChild(badges);

    return card;
  }

  private buildBar(kind: 'hp' | 'mp', current: number, max: number): HTMLElement {
    const wrap = el('div', `bar bar--${kind}`);
    const fill = el('div', `bar-fill bar-fill--${kind}`);
    fill.style.width = `${max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0}%`;
    wrap.appendChild(fill);
    wrap.appendChild(el('span', 'bar-label', `${Math.max(0, current)}/${max}`));
    return wrap;
  }

  private buildLog(vm: BattleViewModel): HTMLElement {
    const log = el('div', 'battle-log');
    for (const entry of vm.log.slice(-6)) {
      log.appendChild(el('div', 'battle-log-line', entry.message));
    }
    return log;
  }

  private buildResultBanner(status: Exclude<BattleState['status'], 'active'>): HTMLElement {
    return el('div', `result-banner result-banner--${status}`, RESULT_LABELS[status]);
  }

  private buildActionPanel(vm: BattleViewModel): HTMLElement {
    const panel = el('div', 'action-panel');

    if (!vm.actingCharacterId) {
      panel.appendChild(el('div', 'waiting-message', '行動を待っています…'));
      return panel;
    }

    switch (vm.mode) {
      case 'all-out-prompt':
        panel.appendChild(this.buildAllOutPrompt());
        break;
      case 'command':
        panel.appendChild(this.buildCommandMenu(vm));
        break;
      case 'select-skill':
        panel.appendChild(this.buildSkillMenu(vm.skillOptions));
        break;
      case 'select-item':
        panel.appendChild(this.buildItemMenu(vm.itemOptions));
        break;
      case 'select-persona':
        panel.appendChild(this.buildPersonaMenu(vm.personaOptions));
        break;
      case 'select-target':
        panel.appendChild(this.buildTargetMenu(vm.targetOptions));
        break;
      case 'turn-end':
        panel.appendChild(el('div', 'waiting-message', '行動を待っています…'));
        break;
    }

    return panel;
  }

  private buildAllOutPrompt(): HTMLElement {
    const wrap = el('div', 'menu menu--all-out');
    wrap.appendChild(el('div', 'menu-title', '総攻撃のチャンス！'));
    wrap.appendChild(this.buildButton('実行する', () => {
      this.ui.triggerAllOutAttack();
      this.handlePlayerAction();
    }));
    wrap.appendChild(this.buildButton('やめる', () => {
      this.ui.declineAllOutAttack();
      this.handlePlayerAction();
    }));
    return wrap;
  }

  private buildCommandMenu(vm: BattleViewModel): HTMLElement {
    const wrap = el('div', 'menu menu--commands');
    for (const command of vm.commands) {
      const button = this.buildButton(command.label, () => {
        this.ui.selectCommand(command.type as BattleCommandType);
        this.handlePlayerAction();
      });
      if (!command.enabled) {
        (button as HTMLButtonElement).disabled = true;
        if (command.disabledReason) button.title = command.disabledReason;
      }
      wrap.appendChild(button);
    }
    return wrap;
  }

  private buildSkillMenu(skills: Skill[]): HTMLElement {
    const wrap = el('div', 'menu menu--skills');
    for (const skill of skills) {
      wrap.appendChild(this.buildButton(`${skill.name} (MP${skill.costMp})`, () => {
        this.ui.selectSkill(skill);
        this.handlePlayerAction();
      }));
    }
    wrap.appendChild(this.buildBackButton());
    return wrap;
  }

  private buildItemMenu(items: InventoryItem[]): HTMLElement {
    const wrap = el('div', 'menu menu--items');
    for (const inventoryItem of items) {
      wrap.appendChild(this.buildButton(`${inventoryItem.item.name} x${inventoryItem.quantity}`, () => {
        this.ui.selectItem(inventoryItem);
        this.handlePlayerAction();
      }));
    }
    wrap.appendChild(this.buildBackButton());
    return wrap;
  }

  private buildPersonaMenu(personas: PersonaSlot[]): HTMLElement {
    const wrap = el('div', 'menu menu--personas');
    personas.forEach((slot, index) => {
      wrap.appendChild(this.buildButton(slot.persona.name, () => {
        this.ui.selectPersona(index);
        this.handlePlayerAction();
      }));
    });
    wrap.appendChild(this.buildBackButton());
    return wrap;
  }

  private buildTargetMenu(targets: (BattleCharacter | BattleEnemy)[]): HTMLElement {
    const wrap = el('div', 'menu menu--targets');
    for (const target of targets) {
      wrap.appendChild(this.buildButton(target.name, () => {
        this.ui.selectTarget(target);
        this.handlePlayerAction();
      }));
    }
    wrap.appendChild(this.buildBackButton());
    return wrap;
  }

  private buildBackButton(): HTMLElement {
    return this.buildButton('戻る', () => {
      this.ui.cancelSelection();
      this.handlePlayerAction();
    });
  }

  private buildButton(label: string, onClick: () => void): HTMLElement {
    const button = el('button', 'menu-button', label) as HTMLButtonElement;
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
