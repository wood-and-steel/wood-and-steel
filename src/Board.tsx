import React from 'react';
import { NavBar } from './components/NavBar';
import { PlayerBoard } from './components/PlayerBoard';
import { PlayerToolbar } from './components/PlayerToolbar';
import { MoneyStrip } from './components/MoneyStrip';
import { PrivateContractOfferSheet } from './components/PrivateContractOfferSheet';
import { EditPlaytestDialog } from './components/EditPlaytestDialog';
import { LoansSheet } from './components/LoansSheet';
import { ActionsSheet } from './components/ActionsSheet';
import { DeliveryReceipt } from './components/DeliveryReceipt';
import { ClaimSheet } from './components/ClaimSheet';
import { DiscardSheet } from './components/DiscardSheet';
import { PlayerSheet } from './components/PlayerSheet';
import { RoundReportSheet } from './components/RoundReportSheet';
import { useRoundReport } from './hooks/useRoundReport';
import type { Contract } from './Contract';
import { contractTies } from './utils/ties';
import { bestEngineLevel, engineLevel } from './rules/engines';
import { MARKET_CONTRACT_MIN_ENGINE } from './rules/rulesData';
import { useGame } from './hooks/useGame';
import { useLobbyStore } from './stores/lobbyStore';

/** Minimal game manager shape passed from App (currentGameCode for NavBar). */
export interface GameManagerProps {
  currentGameCode?: string;
}

export interface WoodAndSteelStateProps {
  gameManager?: GameManagerProps;
}

/** Main game board: NavBar, the player's board, its sheets, and form-driven moves. */
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
  // Opened from Actions' "Discard and draw new contract": picking an offer replaces the private contract.
  const [replacePrivateContract, setReplacePrivateContract] = React.useState(false);
  const [openSheet, setOpenSheet] = React.useState<'actions' | 'buyEngine' | 'discard' | null>(null);
  // Loans opens from the money strip over whatever sheet is open,
  // so it has its own state and the sheet underneath keeps its place.
  const [isLoansOpen, setIsLoansOpen] = React.useState(false);
  const openLoans = React.useCallback(() => setIsLoansOpen(true), []);
  const [receiptContractId, setReceiptContractId] = React.useState<string | null>(null);
  const [claimContractId, setClaimContractId] = React.useState<string | null>(null);
  const [viewPlayerId, setViewPlayerId] = React.useState<string | null>(null);
  const handleNavigateToLobby = React.useCallback(() => {
    clearSelection();
    setLobbyMode(true);
  }, [clearSelection, setLobbyMode]);

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
  const roundReport = useRoundReport(currentPhase === 'play' ? G.roundReport : undefined, gameManager?.currentGameCode ?? '');
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
    setOpenSheet(null);
    // New contracts go to the current player, so offers from a finished turn must not be picked.
    setIsPrivateContractModalOpen(false);
    setReplacePrivateContract(false);
  }, [isMyTurn]);
  /** Why the player can't claim a market contract now, or null. */
  const claimRefusal = !myProps
    ? null
    : bestEngineLevel(myProps.engines) < engineLevel(MARKET_CONTRACT_MIN_ENGINE)
      ? 'Claiming market contracts needs a Mogul or better.'
      : G.contracts.some((c: Contract) => c.type === 'market' && !c.fulfilled && c.playerID === playerID)
        ? 'You already hold a claimed market contract. Fulfill it before claiming another.'
        : null;

  // What the menu's Discard Contract offers, and whether Draw Private Contract applies.
  const myContracts = G.contracts.filter((c: Contract) => c.playerID === playerID && !c.fulfilled);
  const openMarket = G.contracts.filter((c: Contract) => c.type === 'market' && c.playerID === null && !c.fulfilled);
  const hasPrivateContract = myContracts.some((c: Contract) => c.type === 'private');

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
            roundReportAutoOpen={roundReport.autoOpen}
            onRoundReportAutoOpenChange={roundReport.setAutoOpen}
            onFillMarket={currentPhase === 'play' && isMyTurn ? () => moves.fillMarketTableau() : undefined}
            onDiscardContract={currentPhase === 'play' ? () => setOpenSheet('discard') : undefined}
            onDrawPrivateContract={currentPhase === 'play' ? () => setIsPrivateContractModalOpen(true) : undefined}
            canActFromMenu={isMyTurn}
            hasPrivateContract={hasPrivateContract}
          />
          <EditPlaytestDialog
            isOpen={isEditPlaytestDialogOpen}
            onClose={() => setIsEditPlaytestDialogOpen(false)}
            G={G}
            ctx={ctx}
            moves={moves}
          />
          {isPrivateContractModalOpen && (
            <PrivateContractOfferSheet
              G={G}
              ctx={ctx}
              onSelect={(commodity: string, destinationKey: string) => {
                if (isMyTurn && playerID) {
                  if (replacePrivateContract) moves.replacePrivateContract(playerID, commodity, destinationKey);
                  else moves.addContract(commodity, destinationKey, 'private');
                }
                setIsPrivateContractModalOpen(false);
                setReplacePrivateContract(false);
              }}
              onClose={() => {
                setIsPrivateContractModalOpen(false);
                setReplacePrivateContract(false);
              }}
            />
          )}
          {myProps && playerID && (
            <MoneyStrip
              player={myProps}
              playerID={playerID}
              isCurrentTurn={isMyTurn}
              showMoney={currentPhase === 'play'}
              onOpenLoans={openLoans}
            />
          )}
          <PlayerToolbar
            G={G}
            ctx={ctx}
            playerID={playerID}
            startingContractExists={startingContractExists}
            currentPhase={currentPhase}
            onOpenActions={() => setOpenSheet('actions')}
            onOpenPlayer={setViewPlayerId}
            onOpenRoundReport={G.roundReport ? roundReport.open : undefined}
            roundReportUnseen={roundReport.unseen}
          />
          {roundReport.isOpen && G.roundReport && (
            <RoundReportSheet
              report={G.roundReport}
              G={G}
              ctx={ctx}
              player={myProps}
              autoOpen={roundReport.autoOpen}
              onAutoOpenChange={roundReport.setAutoOpen}
              onClose={roundReport.close}
            />
          )}
          {viewPlayerId && <PlayerSheet G={G} playerID={viewPlayerId} onClose={() => setViewPlayerId(null)} />}
          {claimContract && myProps && isMyTurn && (
            <ClaimSheet
              contract={claimContract}
              player={myProps}
              playerID={playerID ?? ''}
              refusal={claimRefusal}
              onClaim={(cargoSlot) => moves.claimMarketContract(claimContract.id, cargoSlot)}
              onClose={() => setClaimContractId(null)}
            />
          )}
          {(openSheet === 'actions' || openSheet === 'buyEngine') && myProps && playerID && isMyTurn && (
            <ActionsSheet
              initialView={openSheet === 'buyEngine' ? 'engine' : 'menu'}
              G={G}
              playerID={playerID}
              player={myProps}
              moves={moves}
              onNewPrivateContract={() => {
                setReplacePrivateContract(true);
                setIsPrivateContractModalOpen(true);
              }}
              onClose={() => setOpenSheet(null)}
            />
          )}
          {openSheet === 'discard' && isMyTurn && (
            <DiscardSheet
              mine={myContracts}
              market={openMarket}
              onDiscard={moves.deleteContract}
              onClose={() => setOpenSheet(null)}
            />
          )}
          {receiptContract && myProps && isMyTurn && (
            <DeliveryReceipt
              contract={receiptContract}
              player={myProps}
              playerID={playerID ?? ''}
              ties={myTies}
              onDeliver={(engineSlot) => {
                const delivered = moves.toggleContractFulfilled(receiptContract.id, engineSlot);
                if (delivered && receiptContract.type === 'private') setIsPrivateContractModalOpen(true);
                return delivered;
              }}
              onClose={() => setReceiptContractId(null)}
            />
          )}
          {isLoansOpen && myProps && (
            <LoansSheet
              player={myProps}
              isMyTurn={isMyTurn}
              onBorrow={moves.borrow}
              onRepay={moves.repay}
              onClose={() => setIsLoansOpen(false)}
            />
          )}
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
            onClaimContract={handleClaimContract}
            onSetCargo={moves.setCargo}
            onOpenBuyEngine={() => setOpenSheet('buyEngine')}
          />
        </div>
      </form>
    </div>
  );
}
