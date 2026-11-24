import React from 'react';
import { NavBar } from './components/NavBar';
import { PlayerBoard } from './components/PlayerBoard';
import { PlayerToolbar } from './components/PlayerToolbar';
import { PrivateContractOfferModal } from './components/PrivateContractOfferModal';
import { CommoditiesPage } from './components/CommoditiesPage';
import { IndependentRailroadsPage } from './components/IndependentRailroadsPage';
import { EditPlaytestDialog } from './components/EditPlaytestDialog';
import { LoansSheet } from './components/LoansSheet';
import { ActionsSheet } from './components/ActionsSheet';
import { DeliveryReceipt } from './components/DeliveryReceipt';
import { ClaimSheet } from './components/ClaimSheet';
import { PlayerSheet } from './components/PlayerSheet';
import type { Contract } from './Contract';
import { contractTies } from './utils/ties';
import { bestEngineLevel, engineLevel } from './rules/engines';
import { MARKET_CONTRACT_MIN_ENGINE } from './rules/rulesData';
import { independentRailroadPrice } from './stores/gameActions';
import { formatMoney } from './utils/money';
import { useGame } from './hooks/useGame';
import { useGameStore } from './stores/gameStore';
import { useLobbyStore } from './stores/lobbyStore';

/** Minimal game manager shape passed from App (currentGameCode for NavBar). */
export interface GameManagerProps {
  currentGameCode?: string;
}

export interface WoodAndSteelStateProps {
  gameManager?: GameManagerProps;
}

type TabId = 'board' | 'commodities' | 'indies';

/** Main game board: tabs, NavBar, and form-driven moves. */
export function WoodAndSteelState({
  gameManager,
}: WoodAndSteelStateProps) {
  const { G, ctx, moves, playerID } = useGame();
  const { clearSelection, setLobbyMode } = useLobbyStore();
  const [input, setInput] = React.useState('');
  const [isEditPlaytestDialogOpen, setIsEditPlaytestDialogOpen] =
    React.useState(false);
  const [isPrivateContractModalOpen, setIsPrivateContractModalOpen] =
    React.useState(false);
  const [openSheet, setOpenSheet] = React.useState<'loans' | 'actions' | null>(null);
  const [receiptContractId, setReceiptContractId] = React.useState<string | null>(null);
  const [claimContractId, setClaimContractId] = React.useState<string | null>(null);
  const [viewPlayerId, setViewPlayerId] = React.useState<string | null>(null);
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

  const handleDismissRoutesAddedHint = React.useCallback(() => {
    useGameStore.setState((s) => ({ G: { ...s.G, lastRoundRoutesAdded: undefined } }));
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

  // Fulfilling opens the delivery receipt; the move runs when the player confirms there.
  const handleToggleFulfilled = React.useCallback((contractId: string) => setReceiptContractId(contractId), []);
  const myProps = G.players.find(([id]) => id === playerID)?.[1];
  const isMyTurn = playerID === ctx.currentPlayer;
  // Only contracts the sheets still apply to: the player's own unfulfilled one, an open market one.
  const receiptContract = receiptContractId
    ? G.contracts.find((c: Contract) => c.id === receiptContractId && c.playerID === playerID && !c.fulfilled)
    : undefined;
  const myTies = playerID ? contractTies(G.contracts, playerID) : 0;
  const claimContract = claimContractId
    ? G.contracts.find(
        (c: Contract) => c.id === claimContractId && c.type === 'market' && c.playerID === null && !c.fulfilled
      )
    : undefined;

  // Turn sheets belong to this turn: when it ends (here or on another device), forget them so
  // they don't reappear on the player's next turn.
  React.useEffect(() => {
    if (isMyTurn) return;
    setReceiptContractId(null);
    setClaimContractId(null);
    setOpenSheet((sheet: 'loans' | 'actions' | null) => (sheet === 'actions' ? null : sheet));
  }, [isMyTurn]);
  /** Why the player can't claim a market contract now, or null. */
  const claimRefusal = !myProps
    ? null
    : bestEngineLevel(myProps.engines) < engineLevel(MARKET_CONTRACT_MIN_ENGINE)
      ? 'Claiming market contracts needs a Mogul or better.'
      : G.contracts.some((c: Contract) => c.type === 'market' && !c.fulfilled && c.playerID === playerID)
        ? 'You already hold a claimed market contract. Fulfill it before claiming another.'
        : null;

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

  // Claiming opens the claim sheet, where the player can also record the cargo.
  const handleClaimContract = React.useCallback((contractId: string) => setClaimContractId(contractId), []);

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
        const price = independentRailroadPrice(G, railroadName);
        if (!railroad || !myProps) break;
        if (price > myProps.cash) {
          window.alert(
            `${railroad.name} costs ${formatMoney(price)}; you have ${formatMoney(myProps.cash)}. Borrow first using Loans.`
          );
          break;
        }
        if (window.confirm(`Acquire ${railroad.name} for ${formatMoney(price)}?`)) {
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

  if (currentPhase === 'scoring') {
    return (
      <div className="boardPage">
        <form className="form" method="post" onSubmit={handleSubmit}>
          <NavBar
            gameManager={gameManager ?? {}}
            onNavigateToLobby={handleNavigateToLobby}
            onOpenEditPlaytest={() => setIsEditPlaytestDialogOpen(true)}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            showRailroadHint={showRailroadHint}
            onDismissHint={handleDismissHint}
            routesAddedCount={G.lastRoundRoutesAdded}
            onDismissRoutesAddedHint={handleDismissRoutesAddedHint}
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
    <div className="boardPage">
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
            routesAddedCount={G.lastRoundRoutesAdded}
            onDismissRoutesAddedHint={handleDismissRoutesAddedHint}
            onFillMarket={currentPhase === 'play' && isMyTurn ? () => moves.fillMarketTableau() : undefined}
          />
          <EditPlaytestDialog
            isOpen={isEditPlaytestDialogOpen}
            onClose={() => setIsEditPlaytestDialogOpen(false)}
            G={G}
            ctx={ctx}
            moves={moves}
          />
          <PrivateContractOfferModal
            isOpen={isPrivateContractModalOpen}
            onClose={() => setIsPrivateContractModalOpen(false)}
            G={G}
            ctx={ctx}
            onSelect={(commodity: string, destinationKey: string) => {
              moves.addContract(commodity, destinationKey, 'private');
              setIsPrivateContractModalOpen(false);
            }}
          />
          <PlayerToolbar
            G={G}
            ctx={ctx}
            playerID={playerID}
            startingContractExists={startingContractExists}
            currentPhase={currentPhase}
            onOpenActions={() => setOpenSheet('actions')}
            onOpenLoans={() => setOpenSheet('loans')}
            onOpenPlayer={setViewPlayerId}
          />
          {viewPlayerId && <PlayerSheet G={G} playerID={viewPlayerId} onClose={() => setViewPlayerId(null)} />}
          {claimContract && myProps && isMyTurn && (
            <ClaimSheet
              contract={claimContract}
              player={myProps}
              refusal={claimRefusal}
              onClaim={(cargoSlot) => moves.claimMarketContract(claimContract.id, cargoSlot)}
              onClose={() => setClaimContractId(null)}
            />
          )}
          {openSheet === 'loans' && myProps && (
            <LoansSheet
              player={myProps}
              isMyTurn={isMyTurn}
              onBorrow={moves.borrow}
              onRepay={moves.repay}
              onClose={() => setOpenSheet(null)}
            />
          )}
          {openSheet === 'actions' && myProps && playerID && isMyTurn && (
            <ActionsSheet
              G={G}
              playerID={playerID}
              player={myProps}
              moves={moves}
              onAcquireRailroad={() => handleTabChange('indies')}
              onNewPrivateContract={() => setIsPrivateContractModalOpen(true)}
              onClose={() => setOpenSheet(null)}
            />
          )}
          {receiptContract && myProps && isMyTurn && (
            <DeliveryReceipt
              contract={receiptContract}
              player={myProps}
              ties={myTies}
              onDeliver={(engineSlot) => {
                const delivered = moves.toggleContractFulfilled(receiptContract.id, engineSlot);
                if (delivered && receiptContract.type === 'private') setIsPrivateContractModalOpen(true);
                return delivered;
              }}
              onClose={() => setReceiptContractId(null)}
            />
          )}
          {activeTab === 'board' && (
            <PlayerBoard
              G={G}
              ctx={ctx}
              playerID={playerID ?? ''}
              startingContractExists={startingContractExists}
              currentPhase={currentPhase}
              onStartingPairSelect={handleStartingPairSelect}
              onOpenPrivateContractModal={() =>
                setIsPrivateContractModalOpen(true)
              }
              onToggleFulfilled={handleToggleFulfilled}
              onDelete={handleDelete}
              onClaimContract={handleClaimContract}
              onSetCargo={moves.setCargo}
            />
          )}
          {activeTab === 'commodities' && <CommoditiesPage />}
          {activeTab === 'indies' && <IndependentRailroadsPage />}
        </div>
      </form>
    </div>
  );
}
