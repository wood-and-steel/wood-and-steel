import React from 'react';
import { NavBar } from './components/NavBar';
import { PlayerBoard } from './components/PlayerBoard';
import { PrivateContractOfferModal } from './components/PrivateContractOfferModal';
import { CommoditiesPage } from './components/CommoditiesPage';
import { CitiesPage } from './components/CitiesPage';
import { IndependentRailroadsPage } from './components/IndependentRailroadsPage';
import { EditPlaytestDialog } from './components/EditPlaytestDialog';
import type { Contract } from './Contract';
import { useGame } from './hooks/useGame';
import { useLobbyStore } from './stores/lobbyStore';

/** Minimal game manager shape passed from App (currentGameCode for NavBar). */
export interface GameManagerProps {
  currentGameCode?: string;
}

export interface WoodAndSteelStateProps {
  gameManager?: GameManagerProps;
  isBYODMode?: boolean;
}

type TabId = 'board' | 'commodities' | 'cities' | 'indies';

/** Main game board: tabs (Contracts, Commodities, Cities, Independent Railroads), NavBar, and form-driven moves. */
export function WoodAndSteelState({
  gameManager,
  isBYODMode = false,
}: WoodAndSteelStateProps) {
  const { G, ctx, moves, playerID } = useGame();
  const { clearSelection, setLobbyMode } = useLobbyStore();
  const [input, setInput] = React.useState('');
  const [isEditPlaytestDialogOpen, setIsEditPlaytestDialogOpen] =
    React.useState(false);
  const [privateContractModal, setPrivateContractModal] = React.useState({
    open: false,
    count: 2,
  });
  const [activeTab, setActiveTab] = React.useState<TabId>('board');
  const [showRailroadHint, setShowRailroadHint] = React.useState(false);
  const prevPhaseRef = React.useRef(ctx.phase);

  // On transition setup → play, switch to Independent Railroads tab and show hint
  React.useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const currentPhase = ctx.phase;

    if (prevPhase === 'setup' && currentPhase === 'play') {
      setActiveTab('indies');
      setShowRailroadHint(true);
    }

    prevPhaseRef.current = currentPhase;
  }, [ctx.phase]);

  const handleTabChange = React.useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    setShowRailroadHint(false);
  }, []);

  const handleDismissHint = React.useCallback(() => {
    setShowRailroadHint(false);
  }, []);

  const handleNavigateToLobby = React.useCallback(() => {
    clearSelection();
    setLobbyMode(true);
  }, [clearSelection, setLobbyMode]);

  // Sync document data-theme with system preference
  React.useEffect(() => {
    const updateTheme = (e: MediaQueryListEvent) => {
      const systemTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', systemTheme);
    };

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const initialTheme = darkModeQuery.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', initialTheme);

    darkModeQuery.addEventListener('change', updateTheme);
    return () => darkModeQuery.removeEventListener('change', updateTheme);
  }, []);

  const startingContractExists =
    G.contracts.filter((contract: Contract) => contract.playerID === playerID).length > 0;
  const currentPhase = ctx.phase as 'play' | 'setup' | 'scoring';

  const handleStartingPairSelect = React.useCallback(
    (pair: [string, string]) => {
      moves.generateStartingContract(pair, playerID ?? '');
      setInput('');
    },
    [moves, playerID]
  );

  const handleToggleFulfilled = React.useCallback(
    (contractId: string) => moves.toggleContractFulfilled(contractId),
    [moves]
  );

  const handleDelete = React.useCallback(
    (contractId: string) => {
      const c = G.contracts.find((x: Contract) => x.id === contractId);
      if (!c) return;
      if (!window.confirm(`Delete "${c.commodity} to ${c.destinationKey}"?`))
        return;
      setInput(`${c.commodity}, ${c.destinationKey}, ${c.type}`);
      moves.deleteContract(contractId);
    },
    [G.contracts, moves]
  );

  // Form submit: action determined by the clicked button's name
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const inputParameters = input.split(',').map((i: string) => i.trim());
    const submitter = (e.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    const name = submitter?.name ?? '';
    const id = submitter?.id ?? '';

    switch (name) {
      case 'startingContract':
        moves.generateStartingContract(
          inputParameters as [string, string],
          playerID ?? ''
        );
        setInput('');
        break;
      case 'marketContract':
        moves.generateMarketContract();
        break;
      case 'manualContract':
        moves.addContract(
          inputParameters[0],
          inputParameters[1],
          inputParameters[2] as 'private' | 'market'
        );
        break;
      case 'acquireIndependentRailroad': {
        const railroadName = id;
        const railroad = G.independentRailroads[railroadName];
        if (
          railroad &&
          window.confirm(`Is the current player buying ${railroad.name}?`)
        ) {
          moves.acquireIndependentRailroad(railroadName);
        }
        break;
      }
      case 'endTurn':
        moves.endTurn();
        break;
      default:
        break;
    }
  }

  // In hotseat, hide board when it's not this player's turn
  const isHidden = !isBYODMode && ctx.currentPlayer !== playerID;

  if (currentPhase === 'scoring') {
    return (
      <div className={`boardPage ${isHidden ? 'boardPage--hidden' : ''}`}>
        <form className="form" method="post" onSubmit={handleSubmit}>
          <NavBar
            gameManager={gameManager ?? {}}
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
            gameManager={gameManager ?? {}}
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
          <PrivateContractOfferModal
            isOpen={privateContractModal.open}
            onClose={() => setPrivateContractModal({ open: false, count: 2 })}
            offerCount={privateContractModal.count}
            G={G}
            ctx={ctx}
            onSelect={(commodity: string, destinationKey: string) => {
              moves.addContract(commodity, destinationKey, 'private');
              setPrivateContractModal({ open: false, count: 2 });
            }}
          />
          {activeTab === 'board' && (
            <PlayerBoard
              G={G}
              ctx={ctx}
              playerID={playerID ?? ''}
              isBYODMode={isBYODMode}
              startingContractExists={startingContractExists}
              currentPhase={currentPhase}
              onStartingPairSelect={handleStartingPairSelect}
              onOpenPrivateContractModal={(count: number) =>
                setPrivateContractModal({ open: true, count })
              }
              onToggleFulfilled={handleToggleFulfilled}
              onDelete={handleDelete}
            />
          )}
          {activeTab === 'commodities' && <CommoditiesPage />}
          {activeTab === 'cities' && (
            <CitiesPage G={G} ctx={ctx} playerID={playerID ?? ''} />
          )}
          {activeTab === 'indies' && <IndependentRailroadsPage />}
        </div>
      </form>
    </div>
  );
}
