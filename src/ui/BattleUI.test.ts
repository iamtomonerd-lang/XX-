import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CombatSystem } from '@/game/combat/CombatSystem';
import { BattleUI } from './BattleUI';
import { BattleState, Skill, InventoryItem } from '@/types';
import { createCharacter, createEnemy, createPersona, createItem } from '@/test/factories';

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

describe('BattleUI', () => {
  let combatSystem: CombatSystem;

  beforeEach(() => {
    combatSystem = new CombatSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the command menu once a character is ready to act', () => {
    const hero = createCharacter();
    const enemy = createEnemy({});
    const battleState = combatSystem.startBattle([hero], [enemy]);
    battleState.combatants.find(c => c.id === hero.id)!.nextTurnIn = 0;
    const ui = new BattleUI(combatSystem, battleState);

    const ready = ui.getReadyCharacter();
    expect(ready?.id).toBe(hero.id);

    expect(ui.isAwaitingInput()).toBe(false);
    ui.beginTurn(hero);
    expect(ui.isAwaitingInput()).toBe(true);

    const vm = ui.getViewModel();
    expect(vm.mode).toBe('command');
    expect(vm.actingCharacterId).toBe(hero.id);
    expect(vm.commands.find(c => c.type === 'physical')?.enabled).toBe(true);
  });

  it('isAwaitingInput stays true through a 1 MORE bonus turn and clears once the turn truly ends', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // accuracy
      .mockReturnValueOnce(0.5) // randomFactor
      .mockReturnValueOnce(0.9); // no crit

    const hero = createCharacter({ skills: [fireballSkill] });
    const weakEnemy = createEnemy({ fire: 'weak' }, { id: 'weak-enemy' });
    const toughEnemy = createEnemy({}, { id: 'tough-enemy' });
    const battleState = combatSystem.startBattle([hero], [weakEnemy, toughEnemy]);
    const ui = new BattleUI(combatSystem, battleState);
    ui.beginTurn(hero);

    ui.selectCommand('skill');
    ui.selectSkill(fireballSkill);
    ui.selectTarget(weakEnemy); // exploits the weakness -> 1 MORE

    expect(ui.getViewModel().mode).toBe('command');
    expect(ui.isAwaitingInput()).toBe(true); // still hero's turn; the ATB clock must stay paused

    ui.selectCommand('guard'); // ends the turn for real (no bonus)
    expect(ui.isAwaitingInput()).toBe(false);
  });

  it('物理: selecting physical then a target attacks and ends the turn', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // accuracy
      .mockReturnValueOnce(0.5) // randomFactor
      .mockReturnValueOnce(0.9); // no crit

    const hero = createCharacter();
    const enemy = createEnemy({});
    const battleState = combatSystem.startBattle([hero], [enemy]);
    const ui = new BattleUI(combatSystem, battleState);
    ui.beginTurn(hero);

    ui.selectCommand('physical');
    expect(ui.getViewModel().mode).toBe('select-target');
    expect(ui.getViewModel().targetOptions.map(t => t.id)).toEqual([enemy.id]);

    ui.selectTarget(enemy);

    const vm = ui.getViewModel();
    expect(vm.mode).toBe('turn-end');
    expect(vm.actingCharacterId).toBeNull();
    expect(enemy.battleHp).toBeLessThan(100);
    expect(vm.log.at(-1)?.message).toMatch(/ダメージ/);
  });

  it('弱点を突くと1 MOREでコマンド選択に戻る', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // accuracy
      .mockReturnValueOnce(0.5) // randomFactor
      .mockReturnValueOnce(0.9); // no crit

    const hero = createCharacter({
      personas: [{ persona: createPersona() }],
      currentPersona: 0,
      skills: [fireballSkill],
    });
    // A second, still-standing enemy keeps the All-Out Attack prompt from
    // taking over once the weak one goes down, isolating the "1 MORE
    // returns to the command menu" behavior under test.
    const weakEnemy = createEnemy({ fire: 'weak' }, { id: 'weak-enemy' });
    const toughEnemy = createEnemy({}, { id: 'tough-enemy' });
    const battleState = combatSystem.startBattle([hero], [weakEnemy, toughEnemy]);
    const ui = new BattleUI(combatSystem, battleState);
    ui.beginTurn(hero);

    ui.selectCommand('skill');
    ui.selectSkill(fireballSkill);
    ui.selectTarget(weakEnemy);

    const vm = ui.getViewModel();
    expect(vm.mode).toBe('command'); // bonus turn: still this character's turn
    expect(vm.actingCharacterId).toBe(hero.id);
    expect(vm.log.at(-1)?.message).toMatch(/弱点/);
  });

  it('アナライズ: 敵を選択すると弱点情報がログに出る', () => {
    const hero = createCharacter();
    const enemy = createEnemy({ ice: 'weak', fire: 'block' });
    const battleState = combatSystem.startBattle([hero], [enemy]);
    const ui = new BattleUI(combatSystem, battleState);
    ui.beginTurn(hero);

    ui.selectCommand('analyze');
    ui.selectTarget(enemy);

    expect(enemy.isAnalyzed).toBe(true);
    expect(ui.getViewModel().log.at(-1)?.message).toContain('弱点: ice');
  });

  it('ガード: 即座にターンを終了しisGuardingが立つ', () => {
    const hero = createCharacter();
    const enemy = createEnemy({});
    const battleState = combatSystem.startBattle([hero], [enemy]);
    const ui = new BattleUI(combatSystem, battleState);
    ui.beginTurn(hero);

    ui.selectCommand('guard');

    expect(hero.isGuarding).toBe(true);
    expect(ui.getViewModel().mode).toBe('turn-end');
  });

  it('アイテム: 選択→対象決定で回復し、数量が減る', () => {
    const medicine: InventoryItem = { item: createItem({ battleEffect: { healHp: 30 } }), quantity: 1 };
    const hero = createCharacter({ battleHp: 50, items: [medicine] });
    const enemy = createEnemy({});
    const battleState = combatSystem.startBattle([hero], [enemy]);
    const ui = new BattleUI(combatSystem, battleState);
    ui.beginTurn(hero);

    ui.selectCommand('item');
    expect(ui.getViewModel().itemOptions).toHaveLength(1);

    ui.selectItem(medicine);
    ui.selectTarget(hero);

    expect(hero.battleHp).toBe(80);
    expect(medicine.quantity).toBe(0);
    expect(ui.getViewModel().mode).toBe('turn-end');
  });

  it('ペルソナ: 切り替えるとターンが終了する', () => {
    const hero = createCharacter({
      personas: [{ persona: createPersona({ id: 'p1' }) }, { persona: createPersona({ id: 'p2' }) }],
      currentPersona: 0,
    });
    const enemy = createEnemy({});
    const battleState = combatSystem.startBattle([hero], [enemy]);
    const ui = new BattleUI(combatSystem, battleState);
    ui.beginTurn(hero);

    ui.selectCommand('persona');
    ui.selectPersona(1);

    expect(hero.currentPersona).toBe(1);
    expect(ui.getViewModel().mode).toBe('turn-end');
  });

  it('逃走成功時はターンを消費して戦闘を終える', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.0); // guarantee escape success

    const hero = createCharacter();
    const enemy = createEnemy({});
    const battleState = combatSystem.startBattle([hero], [enemy]);
    const ui = new BattleUI(combatSystem, battleState);
    ui.beginTurn(hero);

    ui.selectCommand('escape');

    expect(battleState.status).toBe('escaped');
    expect(ui.getViewModel().log.at(-1)?.message).toBe('戦闘から離脱した！');
  });

  it('総攻撃: 敵が全滅ダウンならプロンプトが出て、承諾すると全体にダメージが入る', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // all-out success roll
      .mockReturnValueOnce(0.5); // randomFactor

    const hero = createCharacter({ stats: { strength: 20, magic: 10, endurance: 10, agility: 10, luck: 10 } });
    const enemy = createEnemy({}, { battleStatus: [{ status: 'knockdown', turnsRemaining: 1 }] });
    const battleState: BattleState = combatSystem.startBattle([hero], [enemy]);
    // startBattle clears knockdown on init; re-apply it to simulate a down that happened mid-battle.
    enemy.battleStatus = [{ status: 'knockdown', turnsRemaining: 1 }];

    const ui = new BattleUI(combatSystem, battleState);
    ui.beginTurn(hero);

    expect(ui.getViewModel().mode).toBe('all-out-prompt');

    const result = ui.triggerAllOutAttack();

    expect(result.attempted).toBe(true);
    expect(result.success).toBe(true);
    expect(enemy.battleHp).toBeLessThan(100);
    expect(enemy.battleStatus).toHaveLength(0);
    expect(ui.getViewModel().mode).toBe('turn-end');
  });

  it('総攻撃プロンプトを断ると通常のコマンド選択に進む', () => {
    const hero = createCharacter();
    const enemy = createEnemy({});
    const battleState = combatSystem.startBattle([hero], [enemy]);
    enemy.battleStatus = [{ status: 'knockdown', turnsRemaining: 1 }];

    const ui = new BattleUI(combatSystem, battleState);
    ui.beginTurn(hero);
    expect(ui.getViewModel().mode).toBe('all-out-prompt');

    ui.declineAllOutAttack();
    expect(ui.getViewModel().mode).toBe('command');
  });
});
