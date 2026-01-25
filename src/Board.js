import React from "react";
import { TopButtonBar } from "./components/TopButtonBar";
import { PlayerBoard } from "./components/PlayerBoard";
import { MarketContracts } from "./components/MarketContracts";
import { IndependentRailroads } from "./components/IndependentRailroads";
import { CommoditiesPage } from "./components/CommoditiesPage";
import { CitiesPage } from "./components/CitiesPage";
import { EditPlaytestDialog } from "./components/EditPlaytestDialog";
import { useGame } from "./hooks/useGame";
import { useLobbyStore } from "./stores/lobbyStore";

// Main Component
export function WoodAndSteelState({ gameManager }) {
  // Get game state and moves from useGame hook instead of props
  const { G, ctx, moves, playerID } = useGame();
  const { clearSelection, setLobbyMode } = useLobbyStore();

  // React hooks must be at the top of the component
  const [input, setInput] = React.useState('');
  const [isEditPlaytestDialogOpen, setIsEditPlaytestDialogOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('board');
  
  // Handler to navigate to lobby
  const handleNavigateToLobby = React.useCallback(() => {
    clearSelection();
    setLobbyMode(true);
  }, [clearSelection, setLobbyMode]);
  
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
        // This case is kept for backwards compatibility but should not be used
        // Manual contracts are now created via EditPlaytestDialog
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
            startingContractExists={startingContractExists}
            currentPhase={currentPhase}
            G={G}
            gameManager={gameManager}
            onNavigateToLobby={handleNavigateToLobby}
            onOpenEditPlaytest={() => setIsEditPlaytestDialogOpen(true)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <EditPlaytestDialog
            isOpen={isEditPlaytestDialogOpen}
            onClose={() => setIsEditPlaytestDialogOpen(false)}
            G={G}
            ctx={ctx}
            moves={moves}
          />
          <div className="padding-xl text-center">
            <h1>Scoring Phase</h1>
            <p>Game scoring will be implemented here.</p>
          </div>
        </form>
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
            startingContractExists={startingContractExists}
            currentPhase={currentPhase}
            G={G}
            gameManager={gameManager}
            onNavigateToLobby={handleNavigateToLobby}
            onOpenEditPlaytest={() => setIsEditPlaytestDialogOpen(true)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <EditPlaytestDialog
            isOpen={isEditPlaytestDialogOpen}
            onClose={() => setIsEditPlaytestDialogOpen(false)}
            G={G}
            ctx={ctx}
            moves={moves}
          />
          {activeTab === 'board' && (
            <>
              <PlayerBoard G={G} ctx={ctx} startingContractExists={startingContractExists} />
              {/* Only show market contracts and independent railroads during play phase */}
              {currentPhase === 'play' && <MarketContracts G={G} ctx={ctx} />}
              {currentPhase === 'play' && <IndependentRailroads G={G} />}
            </>
          )}
          {activeTab === 'commodities' && <CommoditiesPage />}
          {activeTab === 'cities' && <CitiesPage G={G} ctx={ctx} />}
        </div>
      </form>
    </div>
  );
}
