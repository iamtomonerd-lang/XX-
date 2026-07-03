import { GameState } from '@/types';

export function createInitialState(): GameState {
  return {
    mode: 'menu',
    party: [],
    currentPartyIndex: 0,
    money: 0,
    playtime: 0,
    inventory: [],
    visited: new Set(),
  };
}
