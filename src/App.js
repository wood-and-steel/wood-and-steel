import { Client } from 'boardgame.io/react';
import { Local } from 'boardgame.io/multiplayer';
import { WoodAndSteel } from './Game';
import { WoodAndSteelState } from './Board';

const WoodAndSteelClient = Client({ 
  game: WoodAndSteel,
  numPlayers: 3,
  board: WoodAndSteelState,
  multiplayer: Local(),
  debug: true,
});

const App = () => (
  <div>
    <WoodAndSteelClient playerID="0" />
  </div>
);

export default App;
