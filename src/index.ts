import './main.css';
import { CombatSystem } from './game/combat/CombatSystem';
import { createDemoBattle } from './game/demoBattle';
import { BattleUI } from './ui/BattleUI';
import { BattleRenderer } from './ui/BattleRenderer';

// GameEngine will own mode switching (menu/exploration/battle) once those
// systems exist; for now this boots straight into a demo encounter so the
// battle system can be exercised in a real browser.
const combatSystem = new CombatSystem();
const { allies, enemies } = createDemoBattle();
const battleState = combatSystem.startBattle(allies, enemies);
const battleUI = new BattleUI(combatSystem, battleState);

const app = document.getElementById('app');
if (!app) {
  throw new Error('Missing #app root element.');
}

const renderer = new BattleRenderer(app, combatSystem, battleState, battleUI);
renderer.start();
