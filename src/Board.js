import React from "react";
import { TopButtonBar } from "./components/TopButtonBar";
import { PlayerBoard } from "./components/PlayerBoard";
import { MarketContracts } from "./components/MarketContracts";
import { IndependentRailroads } from "./components/IndependentRailroads";
import { ReferenceTables } from "./components/ReferenceTables";
import { GameListDialog } from "./components/GameListDialog";

// Main Component
export function WoodAndSteelState({ ctx, G, moves, playerID, gameManager }) {
  // React hooks must be at the top of the component
  const [input, setInput] = React.useState('');
  const [cityInput, setCityInput] = React.useState('');
  const [showGameList, setShowGameList] = React.useState(false);
  
  // Theme management
  const [theme, setTheme] = React.useState(() => {
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });

  // Apply theme to document on mount and when it changes
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

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
            theme={theme}
            onThemeToggle={toggleTheme}
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
            theme={theme}
            onThemeToggle={toggleTheme}
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
