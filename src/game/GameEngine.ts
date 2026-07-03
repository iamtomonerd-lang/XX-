import { GameState, GameMode } from '@/types';
import { GameStateManager } from './state/GameStateManager';
import { CombatSystem } from './combat/CombatSystem';

export class GameEngine {
  private stateManager: GameStateManager;
  private combatSystem: CombatSystem;
  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;

  constructor() {
    this.stateManager = new GameStateManager();
    this.combatSystem = new CombatSystem();
  }

  async init(): Promise<void> {
    // Initialize game
    this.stateManager.init();

    // Start game loop
    this.startGameLoop();
  }

  private startGameLoop(): void {
    const loop = (currentTime: number) => {
      if (this.lastUpdateTime === 0) {
        this.lastUpdateTime = currentTime;
      }

      const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
      this.lastUpdateTime = currentTime;

      this.update(deltaTime);
      this.render();

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private update(deltaTime: number): void {
    const state = this.stateManager.getState();

    switch (state.mode) {
      case 'menu':
        // Menu updates handled by UI
        break;
      case 'exploration':
        // Exploration updates
        break;
      case 'battle':
        if (state.battleState) {
          this.combatSystem.update(state.battleState, deltaTime);
        }
        break;
      case 'dialogue':
        // Dialogue updates
        break;
      case 'pause':
        // Pause state
        break;
    }

    // Update playtime
    this.stateManager.updatePlaytime(deltaTime);
  }

  private render(): void {
    // UI layer subscribes to GameStateManager directly and renders on state changes.
  }

  public getState(): GameState {
    return this.stateManager.getState();
  }

  public setMode(mode: GameMode): void {
    this.stateManager.setMode(mode);
  }

  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
