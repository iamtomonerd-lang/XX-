# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Persona-style turn-based RPG game engine implemented in TypeScript for the web. The game focuses on all logic, mechanics, and UI implementation—graphics are handled separately.

**Core Scope:**
- Turn-based combat system with multiple characters and personas
- Dungeon exploration and map navigation
- Character/persona progression and fusion mechanics
- UI systems (menus, inventory, status displays)
- Save/load functionality
- Game state management

**Out of Scope:** Asset generation, visual rendering, and graphics engine

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Type check without emitting
npm run type-check

# Run linter
npm run lint

# Build for production
npm run build

# Run all tests
npm run test

# Run tests in UI mode (watch + interactive)
npm run test:ui

# Preview production build
npm run preview
```

## Architecture

### Core Layers

**State Management (`src/game/state/`)**
- `GameState`: Root game state manager
- `BattleState`, `ExploreState`, `MenuState`: Mode-specific state
- Immutable updates following Redux-like patterns

**Game Logic (`src/game/`)**
- `Combat.ts`: Turn-based battle rules, damage calculation, skill resolution
- `Persona.ts`: Persona definitions, abilities, fusion mechanics
- `Character.ts`: Character data, levels, equipment, persona slots
- `Map.ts`: Dungeon/world map structure, encounter management

**UI Layer (`src/ui/`)**
- `BattleUI.ts`: Combat display, action selection
- `MenuUI.ts`: Main menu, inventory, status screens
- `DialogUI.ts`: Dialogue and narrative display
- Decoupled from rendering—produces data structures that graphics layer consumes

**Data Models (`src/types/`)**
- Persona, Character, Skill, Item, Enemy definitions
- Immutable TypeScript interfaces

### Data Flow

```
Input → UI Layer → Game State → Combat/Explore Logic → State Updates → UI Output
```

Game state is the single source of truth. UI transforms user input into actions; actions update state; new state triggers UI re-renders.

## Key Implementation Notes

- **Immutable State**: Never mutate game state directly. Create new state objects with changes.
- **Turn Order**: Combat uses a queue-based turn system—track action order and execute sequentially.
- **Persona Fusion**: Persona combinations follow specific fusion recipes; validate fusion requests against a defined matrix.
- **Save Format**: Game saves are JSON serializations of the full GameState. Consider compression for web storage limits.
- **Enemy Difficulty**: Scale enemy stats and loot based on dungeon floor and story progression.
- **UI Responsiveness**: Decouple UI update frequency from game logic ticks to avoid frame rate coupling.

## File Structure

```
src/
├── game/              # Game logic and state
│   ├── state/         # State management
│   ├── combat/        # Battle system
│   ├── persona/       # Persona mechanics
│   └── world/         # Exploration and maps
├── ui/                # User interface logic
├── types/             # TypeScript definitions
├── utils/             # Helpers (math, storage, validation)
├── index.ts           # Entry point
└── main.css           # Global styles
```

## Testing Strategy

Test game logic separately from UI:
- Unit tests for Combat calculations and Persona fusion
- State transition tests (verify actions produce expected state changes)
- Integration tests for multi-turn battles
- Avoid testing UI logic unless it contains non-trivial transforms

```bash
# Run a single test file
npm run test -- src/game/combat/Combat.test.ts

# Run tests matching a pattern
npm run test -- --grep "fusion"
```

## Common Tasks

**Add a new combat ability:**
1. Define the ability in `src/types/Skill.ts`
2. Implement damage/effect logic in `src/game/combat/Combat.ts`
3. Assign it to a Persona in `src/game/persona/Personas.ts`
4. Test with `npm run test -- combat`

**Add a new dungeon:**
1. Create map structure in `src/game/world/maps/`
2. Populate enemy encounters in map config
3. Update world state navigation to point to the new map
4. Update exploration UI to render the new layout

**Adjust game balance:**
- Enemy stats: `src/game/world/enemies/`
- Experience curves: `src/game/character/Progression.ts`
- Skill power: `src/game/combat/Combat.ts` (damage formulas)
- Fusion recipes: `src/game/persona/FusionMatrix.ts`
