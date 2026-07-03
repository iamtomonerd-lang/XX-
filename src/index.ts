import { GameEngine } from './game/GameEngine';

// Initialize the game engine
const engine = new GameEngine();

// Start the game
engine.init();

// Make engine available globally for debugging
(window as any).gameEngine = engine;
