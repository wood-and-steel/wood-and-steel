import { Client } from 'boardgame.io/react';
import { Local } from 'boardgame.io/multiplayer';
import { WoodAndSteel } from '../Game';
import { WoodAndSteelState } from '../Board';

const WoodAndSteelClient = Client({ 
  game: WoodAndSteel,
  multiplayer: Local({ persist: true }),
  numPlayers: 2,
  board: WoodAndSteelState,
  debug: false,
});

const App = () => (
  <div>
    <WoodAndSteelClient playerID="0" />
    <WoodAndSteelClient playerID="1" />
  </div>
);

export default App;
