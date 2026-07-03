import { GameState, GameMode, Character } from '@/types';
import { createInitialState } from './initialState';

export class GameStateManager {
  private state: GameState;
  private subscribers: ((state: GameState) => void)[] = [];

  constructor() {
    this.state = createInitialState();
  }

  init(): void {
    // Initialize game state
    // Load initial data, characters, etc.
  }

  getState(): GameState {
    return this.state;
  }

  setState(newState: GameState): void {
    this.state = newState;
    this.notifySubscribers();
  }

  setMode(mode: GameMode): void {
    this.setState({
      ...this.state,
      mode,
    });
  }

  updatePlaytime(deltaTime: number): void {
    this.setState({
      ...this.state,
      playtime: this.state.playtime + deltaTime,
    });
  }

  addPartyMember(character: Character): void {
    if (this.state.party.length < 4) {
      this.setState({
        ...this.state,
        party: [...this.state.party, character],
      });
    }
  }

  removePartyMember(characterId: string): void {
    this.setState({
      ...this.state,
      party: this.state.party.filter(c => c.id !== characterId),
    });
  }

  setCurrentPartyIndex(index: number): void {
    if (index >= 0 && index < this.state.party.length) {
      this.setState({
        ...this.state,
        currentPartyIndex: index,
      });
    }
  }

  addMoney(amount: number): void {
    this.setState({
      ...this.state,
      money: Math.max(0, this.state.money + amount),
    });
  }

  subscribe(callback: (state: GameState) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.state));
  }
}
