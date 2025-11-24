# Copilot Instructions for Wood and Steel

## Project Overview

Wood and Steel is a board game web application built with React and boardgame.io. It's a train game for 1-6 players set in the age of steam engines (1830-1940), where players act as railroad owners expanding their networks across the eastern United States and southern Canada.

### Hybrid Gameplay Model

This is a **hybrid board game** that combines:
- **Physical components**: Map board, player boards, cards, and counters for hands-on gameplay
- **Web app**: Handles random behavior (virtual card decks), contract generation, and tracking player progress

The app delegates grunt work while players focus on the interesting decisions.

## Technology Stack

- **Framework**: React 18.3.1
- **Game Engine**: boardgame.io 0.50.2
- **Build Tool**: react-scripts 5.0.1 (Create React App)
- **Testing**: Jest + React Testing Library
- **State Management**: boardgame.io built-in state management
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
wood-and-steel-bgio/
├── .github/              # GitHub configuration (workflows, templates)
├── docs/                 # Project documentation
│   ├── Game rules.md     # Complete game rules and mechanics
│   ├── CSS_ARCHITECTURE.md   # CSS styling guidelines (IMPORTANT!)
│   └── PHASES_IMPLEMENTATION.md  # Game phase system
├── public/              # Static assets
├── src/
│   ├── app/             # Main App component
│   ├── components/      # React components (UI elements)
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
│   ├── shared/          # Shared utilities and styles
│   │   └── styles/      # Centralized CSS
│   ├── utils/           # Utility functions
│   ├── Board.js         # boardgame.io board component
│   ├── Contract.js      # Contract generation logic
│   ├── Game.js          # boardgame.io game definition
│   ├── independentRailroads.js  # Independent railroad logic
│   └── index.js         # Entry point
├── package.json
└── README.md
```

## Key Files and Their Purposes

- **Game.js**: boardgame.io game definition with setup, phases, and moves
- **Board.js**: Main React component that renders the game UI
- **Contract.js**: Logic for generating different types of contracts (starting, private, market)
- **independentRailroads.js**: Management of AI-controlled railroad companies
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

### boardgame.io Patterns

1. **Game state (G)**: Always treat as immutable; modify properties directly in moves
2. **Moves**: Define as functions in the `moves` object
3. **Phases**: Use for different game stages (setup, play, scoring)
4. **Context (ctx)**: Access game metadata (currentPlayer, phase, turn)

Example:
```javascript
moves: {
  myMove: ({ G, ctx }, arg) => {
    // Modify G directly (boardgame.io handles immutability)
    G.someProperty = newValue;
  }
}
```

### File Organization

1. **Component files**: One component per file, named same as component
2. **Utility files**: Group related utilities together
3. **Data files**: Static game data separate from logic
4. **Imports**: React first, then third-party, then local imports

## Game Architecture

### Phase System

The game uses boardgame.io's phases feature:

1. **Setup Phase**: Players choose starting cities and receive starting contracts
2. **Play Phase**: Main gameplay with all actions available
3. **Scoring Phase**: End-game scoring (stub/future implementation)

See `/docs/PHASES_IMPLEMENTATION.md` for detailed flow.

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

1. Add move function in `Game.js` under appropriate phase
2. Implement logic that modifies `G` state
3. Call move from Board component or UI component
4. Test manually in development mode

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
2. Write descriptive commit messages
3. Keep commits focused and atomic
4. Test before committing

## Resources

- [boardgame.io Documentation](https://boardgame.io/documentation/)
- [React Documentation](https://react.dev/)
- [React Testing Library](https://testing-library.com/react)

## Need Help?

- Check `/docs/` for detailed documentation
- Review similar components for patterns
- Read boardgame.io docs for game engine questions
- Test changes thoroughly before committing
