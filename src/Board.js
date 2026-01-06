import React from "react";
import { TopButtonBar } from "./components/TopButtonBar";
import { PlayerBoard } from "./components/PlayerBoard";
import { MarketContracts } from "./components/MarketContracts";
import { IndependentRailroads } from "./components/IndependentRailroads";
import { ReferenceTables } from "./components/ReferenceTables";
import { GameListDialog } from "./components/GameListDialog";
import { useBgioSync } from "./hooks/useBgioSync";
import { useStateDebug } from "./hooks/useStateDebug";

// Enable debug mode by setting this to true or via localStorage
const DEBUG_MODE = typeof window !== 'undefined' && (
  window.localStorage?.getItem('gameStateDebug') === 'true' ||
  new URLSearchParams(window.location.search).get('debug') === 'true'
);

// Main Component
export function WoodAndSteelState({ ctx, G, moves, playerID, gameManager }) {
  // Sync state from bgio to Zustand store (one-way sync)
  useBgioSync(G, ctx);
  
  // Optional: Debug state comparison (enable via ?debug=true in URL or localStorage)
  useStateDebug(G, ctx, DEBUG_MODE);

  // React hooks must be at the top of the component
  const [input, setInput] = React.useState('');
  const [cityInput, setCityInput] = React.useState('');
  const [showGameList, setShowGameList] = React.useState(false);
  
  // Theme management - use system preference
  React.useEffect(() => {
    // Update theme based on system preference
    const updateTheme = (e) => {
      const systemTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', systemTheme);
    };

    // Set initial theme based on system preference
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const initialTheme = darkModeQuery.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', initialTheme);

    // Listen for changes to system preference
    darkModeQuery.addEventListener('change', updateTheme);

    // Cleanup listener on unmount
    return () => darkModeQuery.removeEventListener('change', updateTheme);
  }, []);

  const startingContractExists = G.contracts.filter(contract => contract.playerID === playerID).length > 0;
  const currentPhase = ctx.phase;

  function handleSubmit(e) {
    // Prevent the browser from reloading the page
    e.preventDefault();

    const inputParameters = input.split(',').map(i => i.trim());

    switch (e.nativeEvent.submitter.name) {
      case "startingContract":
        moves.generateStartingContract(inputParameters);
        setInput("");
        break;
      case "privateContract":
        moves.generatePrivateContract();
        break;
      case "marketContract":
        moves.generateMarketContract();
        break;
      case "manualContract":
        moves.addManualContract(inputParameters[0], inputParameters[1], inputParameters[2]);
        break;
      case "toggleContractFulfilled":
        moves.toggleContractFulfilled(e.nativeEvent.submitter.id);
        break;
      case "deleteContract":
        const contractIndex = G.contracts.findIndex(c => c.id === e.nativeEvent.submitter.id);
        const contract = G.contracts[contractIndex];
        if (window.confirm(`Delete "${contract.commodity} to ${contract.destinationKey}?"`)) {
            setInput(`${contract.commodity}, ${contract.destinationKey}, ${contract.type}`); 
            moves.deleteContract(e.nativeEvent.submitter.id);
        }
        break;
      case "acquireIndependentRailroad":
        const railroadName = e.nativeEvent.submitter.id;
        const railroad = G.independentRailroads[railroadName];
        if (railroad && window.confirm(`Is the current player buying ${railroad.name}?`)) {
          moves.acquireIndependentRailroad(railroadName);
        }
        break;
      case "endTurn":
        moves.endTurn();
        break;
      default:
        break;
    }
  }

  // Render different UI based on phase
  if (currentPhase === 'scoring') {
    return (
      <div className={`boardPage ${ctx.currentPlayer === playerID ? '' : 'boardPage--hidden'}`}>
        <form className="form" method="post" onSubmit={handleSubmit}>
          <TopButtonBar 
            input={input} 
            setInput={setInput} 
            cityInput={cityInput} 
            setCityInput={setCityInput}
            startingContractExists={startingContractExists}
            currentPhase={currentPhase}
            G={G}
            gameManager={gameManager}
            onShowGameList={() => setShowGameList(true)}
          />
          <div className="padding-xl text-center">
            <h1>Scoring Phase</h1>
            <p>Game scoring will be implemented here.</p>
          </div>
        </form>
        {showGameList && gameManager && <GameListDialog gameManager={gameManager} onClose={() => setShowGameList(false)} />}
      </div>
    );
  }

  return (
    <div className={`boardPage ${ctx.currentPlayer === playerID ? '' : 'boardPage--hidden'}`}>
      <form className="form" method="post" onSubmit={handleSubmit}>
        <div>
          <TopButtonBar 
            input={input} 
            setInput={setInput} 
            cityInput={cityInput} 
            setCityInput={setCityInput}
            startingContractExists={startingContractExists}
            currentPhase={currentPhase}
            G={G}
            gameManager={gameManager}
            onShowGameList={() => setShowGameList(true)}
          />
          <PlayerBoard G={G} ctx={ctx} startingContractExists={startingContractExists} />
        </div>
        {/* Only show market contracts and independent railroads during play phase */}
        {currentPhase === 'play' && <MarketContracts G={G} ctx={ctx} />}
        {currentPhase === 'play' && <IndependentRailroads G={G} />}
        <ReferenceTables G={G} />
      </form>
      {showGameList && gameManager && <GameListDialog gameManager={gameManager} onClose={() => setShowGameList(false)} />}
    </div>
  );
}
