import React from "react";
import { NavBar } from "./components/NavBar";
import { PlayerBoard } from "./components/PlayerBoard";
import { CommoditiesPage } from "./components/CommoditiesPage";
import { CitiesPage } from "./components/CitiesPage";
import { IndependentRailroadsPage } from "./components/IndependentRailroadsPage";
import { EditPlaytestDialog } from "./components/EditPlaytestDialog";
import { useGame } from "./hooks/useGame";
import { useLobbyStore } from "./stores/lobbyStore";

// Main Component
export function WoodAndSteelState({ gameManager, isBYODMode = false }) {
  // Get game state and moves from useGame hook instead of props
  const { G, ctx, moves, playerID } = useGame();
  const { clearSelection, setLobbyMode } = useLobbyStore();
  // React hooks must be at the top of the component
  const [input, setInput] = React.useState('');
  const [isEditPlaytestDialogOpen, setIsEditPlaytestDialogOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('board');
  const [showRailroadHint, setShowRailroadHint] = React.useState(false);
  const prevPhaseRef = React.useRef(ctx.phase);
  
  // Detect setup→play phase transition and show railroad hint
  React.useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const currentPhase = ctx.phase;
    
    if (prevPhase === 'setup' && currentPhase === 'play') {
      // Transition from setup to play: switch to Railroads tab and show hint
      setActiveTab('indies');
      setShowRailroadHint(true);
    }
    
    prevPhaseRef.current = currentPhase;
  }, [ctx.phase]);
  
  // Handle tab change: also dismiss the railroad hint
  const handleTabChange = React.useCallback((tabId) => {
    setActiveTab(tabId);
    setShowRailroadHint(false);
  }, []);
  
  // Dismiss the railroad hint (without changing tabs)
  const handleDismissHint = React.useCallback(() => {
    setShowRailroadHint(false);
  }, []);
  
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

  // Handler for starting city pair selection
  const handleStartingPairSelect = React.useCallback((pair) => {
    const inputParameters = pair;
    moves.generateStartingContract(inputParameters, playerID);
    setInput("");
  }, [moves, playerID, ctx.currentPlayer, ctx.phase, isBYODMode]);

  const handleToggleFulfilled = React.useCallback(
    (contractId) => moves.toggleContractFulfilled(contractId),
    [moves]
  );

  const handleDelete = React.useCallback(
    (contractId) => {
      const c = G.contracts.find((x) => x.id === contractId);
      if (!c) return;
      if (!window.confirm(`Delete "${c.commodity} to ${c.destinationKey}"?`)) return;
      setInput(`${c.commodity}, ${c.destinationKey}, ${c.type}`);
      moves.deleteContract(contractId);
    },
    [G.contracts, moves]
  );

  function handleSubmit(e) {
    // Prevent the browser from reloading the page
    e.preventDefault();

    const inputParameters = input.split(',').map(i => i.trim());

    switch (e.nativeEvent.submitter.name) {
      case "startingContract":
        moves.generateStartingContract(inputParameters, playerID);
        setInput("");
        break;
      case "privateContract2":
        moves.generatePrivateContract();
        moves.generatePrivateContract();
        break;
      case "privateContract3":
        moves.generatePrivateContract();
        moves.generatePrivateContract();
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

  // In BYOD mode, always show the board (each device shows one player's board)
  // In hotseat mode, only show the current player's board
  const isHidden = !isBYODMode && ctx.currentPlayer !== playerID;
  
  // Render different UI based on phase
  if (currentPhase === 'scoring') {
    return (
      <div className={`boardPage ${isHidden ? 'boardPage--hidden' : ''}`}>
        <form className="form" method="post" onSubmit={handleSubmit}>
          <NavBar 
            input={input} 
            setInput={setInput}
            startingContractExists={startingContractExists}
            currentPhase={currentPhase}
            G={G}
            gameManager={gameManager}
            onNavigateToLobby={handleNavigateToLobby}
            onOpenEditPlaytest={() => setIsEditPlaytestDialogOpen(true)}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            showRailroadHint={showRailroadHint}
            onDismissHint={handleDismissHint}
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
    <div className={`boardPage ${isHidden ? 'boardPage--hidden' : ''}`}>
      <form className="form" method="post" onSubmit={handleSubmit}>
        <div>
          <NavBar 
            input={input} 
            setInput={setInput}
            startingContractExists={startingContractExists}
            currentPhase={currentPhase}
            G={G}
            gameManager={gameManager}
            onNavigateToLobby={handleNavigateToLobby}
            onOpenEditPlaytest={() => setIsEditPlaytestDialogOpen(true)}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            showRailroadHint={showRailroadHint}
            onDismissHint={handleDismissHint}
          />
          <EditPlaytestDialog
            isOpen={isEditPlaytestDialogOpen}
            onClose={() => setIsEditPlaytestDialogOpen(false)}
            G={G}
            ctx={ctx}
            moves={moves}
          />
          {activeTab === 'board' && (
            <PlayerBoard
              G={G}
              ctx={ctx}
              playerID={playerID}
              isBYODMode={isBYODMode}
              startingContractExists={startingContractExists}
              currentPhase={currentPhase}
              onStartingPairSelect={handleStartingPairSelect}
              onToggleFulfilled={handleToggleFulfilled}
              onDelete={handleDelete}
            />
          )}
          {activeTab === 'commodities' && <CommoditiesPage />}
          {activeTab === 'cities' && <CitiesPage G={G} ctx={ctx} playerID={playerID} />}
          {activeTab === 'indies' && <IndependentRailroadsPage />}
        </div>
      </form>
    </div>
  );
}
