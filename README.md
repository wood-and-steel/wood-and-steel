# Wood and Steel

Wood and Steel is a React app that is a companion to a board game in development. The game is a train-themed strategy game for 2-5 players set in the age of steam engines, spanning from 1830 to approximately 1940. Players take on the role of railroad owners, starting with small two-city routes in the eastern United States and expanding their networks through track building, contract fulfillment, and strategic acquisitions.

---

<img width="300" alt="lobby screen" src="https://github.com/user-attachments/assets/35677726-7bee-4d2e-8b5a-da97d7724ce7" />

<img width="300" alt="player contracts" src="https://github.com/user-attachments/assets/e54214a2-89dd-401e-a710-a02082bce84a" />

---

This application handles the random elements and some computational aspects of the game, such as generating contracts (both private and market contracts), managing independent railroads, tracking player progress, and determining game phases. The goal is to allow players to focus on the engaging physical components of the game while the app handles the calculations and random generation that would traditionally require cards or dice.

The project is currently in active development, with core functionality implemented for contract generation, independent railroad management, and game state tracking. Both hotseat and one-player-per-screen are currently implemented, but hotseat mode is likely to be removed before launch. For detailed information about the game rules, mechanics, and implementation status, see [Game rules.md](docs/Game%20rules.md).

## Available Scripts

In the project directory, you can run:

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)
