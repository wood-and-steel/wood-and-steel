# Copilot Instructions for Wood and Steel

**Cursor users:** See also [AGENTS.md](../AGENTS.md) (or agent guides in `docs/`) for state map and anti-patterns.

## Project Overview

Wood and Steel is a board game web application built with React and Zustand. It's a train game for 1-6 players set in the age of steam engines (1830-1940), where players act as railroad owners expanding their networks across the eastern United States and southern Canada.

### Hybrid Gameplay Model

This is a **hybrid board game** that combines:
- **Physical components**: Map board, player boards, cards, and counters for hands-on gameplay
- **Web app**: Handles random behavior (virtual card decks), contract generation, and tracking player progress

The app delegates grunt work while players focus on the interesting decisions.

## Technology Stack

- **Framework**: React 18.3.1
- **Build Tool**: react-scripts 5.0.1 (Create React App)
- **Testing**: Jest + React Testing Library
- **State Management**: Zustand
- **Styling**: Centralized CSS (no inline styles)

## Development Setup

### Prerequisites
- Node.js and npm installed
- Modern web browser

### Installation and Running

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test

# Build for production
npm run build
```

### Running Tests
- Tests run in watch mode by default
- Use `a` to run all tests in watch mode
- Press `q` to quit watch mode

## Project Structure

```
wood-and-steel/
├── .github/              # GitHub configuration (workflows, templates)
├── docs/                 # Project documentation
│   ├── Game rules.md     # Complete game rules and mechanics
│   ├── CSS_ARCHITECTURE.md   # CSS styling guidelines (IMPORTANT!)
│   └── PHASES_AGENT_GUIDE.md # Game phase system (source of truth for agents)
├── public/              # Static assets
├── src/
│   ├── app/             # Main App component
│   │   └── App.tsx
│   ├── components/      # React components (UI elements; mix of .js and .tsx)
│   │   ├── ContractDisplay.js
│   │   ├── ContractsList.js
│   │   ├── GameListDialog.js
│   │   ├── IndependentRailroads.js
│   │   ├── MarketContracts.js
│   │   ├── PlayerBoard.js
│   │   ├── ReferenceTables.js
│   │   ├── ThemeToggle.js
│   │   └── TopButtonBar.js
│   ├── config/          # Configuration files
│   ├── data/            # Game data (cities, routes, etc.)
│   ├── providers/       # React context providers
│   │   ├── GameProvider.tsx
│   │   └── StorageProvider.tsx
│   ├── shared/          # Shared utilities and styles
│   │   └── styles/      # Centralized CSS
│   ├── stores/          # Zustand stores and phase logic
│   │   ├── gameStore.ts
│   │   ├── gameActions.js
│   │   ├── lobbyStore.js
│   │   ├── phaseConfig.ts
│   │   ├── phaseManager.ts
│   │   └── moveValidation.js
│   ├── utils/           # Utility functions
│   ├── Board.tsx        # Main game board component
│   ├── Contract.js      # Contract generation logic
│   ├── independentRailroads.js  # Independent railroad logic
│   └── index.tsx        # Entry point
├── package.json
└── README.md
```

## Key Files and Their Purposes

- **Board.tsx**: Main React component that renders the game UI
- **Contract.js**: Logic for generating different types of contracts (starting, private, market)
- **independentRailroads.js**: Management of AI-controlled railroad companies
- **stores/gameActions.js**: Game move implementations that modify game state
- **stores/phaseConfig.ts**: Phase definitions; **stores/phaseManager.ts**: Phase transition logic
- **components/**: Presentational React components for UI elements

## Coding Conventions

### CSS and Styling

**CRITICAL**: This project has a strict CSS architecture. Read `/docs/CSS_ARCHITECTURE.md` before making any style changes.

#### Key Rules:
1. **NO inline styles** - Use CSS classes only
2. **NO JavaScript style objects** - All styles in `/src/shared/styles/index.css`
3. **Use CSS variables** for colors, spacing, and z-index values
4. **BEM-inspired naming**: `.componentName__element--modifier`
5. **Utility classes** for common patterns (`.flex`, `.gap-md`, `.hidden`)

#### Example:
```jsx
// ❌ WRONG - No inline styles
<div style={{ padding: '2rem', display: 'flex' }}>

// ✅ CORRECT - Use CSS classes
<div className="modal__content flex gap-md">
```

### React Patterns

1. **Functional components**: Use function declarations for components
2. **Props destructuring**: Destructure props in function parameters
3. **Conditional rendering**: Use ternary operators or logical AND
4. **Event handlers**: Prefix with `handle` (e.g., `handleClick`)

Example:
```jsx
export function MyComponent({ isActive, onAction }) {
  const handleClick = () => {
    onAction();
  };

  return (
    <div className={`component ${isActive ? 'component--active' : ''}`}>
      <button className="button" onClick={handleClick}>
        Action
      </button>
    </div>
  );
}
```

### Game State Patterns

1. **Game state (G)**: Always treat as immutable; use Zustand's setState to update; must be a JSON-serializable object
2. **Moves**: Define as functions in `stores/gameActions.js` that update the Zustand store
3. **Phases**: Use for different game stages (setup, play, scoring) - configured in `stores/phaseConfig.ts`
4. **Context (ctx)**: Access game metadata (currentPlayer, phase, turn) from the Zustand store

Example:
```javascript
// In stores/gameActions.js
export function myMove(arg) {
  const { G, ctx } = useGameStore.getState();
  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      someProperty: newValue
    }
  }));
}
```

### File Organization

1. **Component files**: One component per file, named same as component
2. **Utility files**: Group related utilities together
3. **Data files**: Static game data separate from logic
4. **Imports**: React first, then third-party, then local imports

## Game Architecture

### Phase System

The game uses a custom phase system:

1. **Setup Phase**: Players choose starting cities and receive starting contracts
2. **Play Phase**: Main gameplay with all actions available
3. **Scoring Phase**: End-game scoring (stub/future implementation)

See `docs/PHASES_AGENT_GUIDE.md` for detailed flow.

### State Management

Game state (G) includes:
- `contracts`: Array of contract objects (market and private)
- `players`: Array of player objects with names and active cities
- `independentRailroads`: Object of AI-controlled railroad companies

### Contract System

Three types of contracts:
- **Starting contracts**: Generated during setup phase
- **Private contracts**: Player-specific contracts
- **Market contracts**: Publicly available contracts

Contract generation uses city pairs and routing logic from `/src/data/`.

## Testing Guidelines

### Testing Approach

- Use React Testing Library for component tests
- Focus on user-facing behavior, not implementation details
- Follow "Arrange-Act-Assert" pattern
- Mock external dependencies when necessary

### Example Test:
```javascript
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

test('renders component correctly', () => {
  // Arrange
  render(<MyComponent title="Test" />);
  
  // Act & Assert
  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

### Testing Checklist:
- [ ] Component renders without crashing
- [ ] Props are correctly displayed
- [ ] User interactions work as expected
- [ ] Conditional rendering works correctly

## Best Practices

### Code Quality

1. **Keep components small**: Single responsibility principle
2. **Extract repeated logic**: Create utility functions or custom hooks
3. **Meaningful names**: Variables and functions should be self-documenting
4. **Comments**: Use for complex logic, not obvious code
5. **Error handling**: Handle edge cases and invalid states

### Performance

1. **Avoid unnecessary re-renders**: Use React.memo for expensive components
2. **Lazy loading**: Split code with dynamic imports when needed
3. **Optimize images**: Use appropriate formats and sizes

### Accessibility

1. **Semantic HTML**: Use appropriate HTML elements
2. **ARIA labels**: Add when semantic HTML isn't enough
3. **Keyboard navigation**: Ensure all interactive elements are keyboard accessible
4. **Color contrast**: Follow WCAG guidelines

## Common Tasks

### Adding a New Component

1. Create component file in `/src/components/`
2. Add corresponding CSS section in `/src/shared/styles/index.css`
3. Use BEM naming: `.componentName__element--modifier`
4. Export as named export
5. Add basic test in `.test.js` file

### Adding a New Move

1. Add move function in `stores/gameActions.js`
2. Implement logic that modifies `G` state using the Zustand store
3. Add move validation in `stores/moveValidation.js` if needed
4. Call move from Board component or UI component via the moves object
5. Test manually in development mode

### Modifying Styles

1. Read `/docs/CSS_ARCHITECTURE.md` first
2. Use CSS variables from `:root` for colors/spacing
3. Add new classes to appropriate section in `/src/shared/styles/index.css`
4. Never use inline styles
5. Test in both light and dark themes

## Work-in-Progress Notes

This is an actively developed project. Some features described in `/docs/Game rules.md` are not yet implemented. Always check the actual code to understand current functionality.

Key areas still in development:
- Full contract fulfillment logic
- Building construction
- Independent railroad AI behavior
- End-game scoring
- Multi-player synchronization

## Git Workflow

1. Work in feature branches
2. Write commit messages per [docs/COMMIT_MESSAGE_GUIDE.md](../docs/COMMIT_MESSAGE_GUIDE.md) (imperative subject, `bug fix:` for fixes, optional body for *why*)
3. Keep commits focused and atomic
4. Test before committing

## Resources

- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [React Documentation](https://react.dev/)
- [React Testing Library](https://testing-library.com/react)

## Need Help?

- Check `/docs/` for detailed documentation
- Review similar components for patterns
- Review `stores/gameActions.js` for move implementation patterns
- Test changes thoroughly before committing
