/**
 * Player trays: the column beside the map with one card per player, in play order. Each card
 * has the player's money, a row per engine token (its type, cargo, and stats), the upgrades
 * bought, the Railyard while unplaced, and the player's unfulfilled private and claimed market
 * contracts. Money, engine types, cargo and upgrades are read from G (players set them in the
 * player app); the board only places tokens. The token stays on its row at full color even
 * when on the map: it is the key to which token is which engine type.
 */
import React from 'react';
import { moneyValue, railroadTieValue, type Contract } from '../Contract';
import { contractTieIcons } from '../shared/assets/icons';
import { useGameStore, type PlayerProps } from '../stores/gameStore';
import { commodityIcons } from '../shared/assets/icons';
import { Swatch } from './BoardChrome';
import type { BoardPlayer } from './boardPlayers';
import type { BoardState } from './boardOps';
import {
  UPGRADES,
  engineDistance,
  formatCommodity,
  formatSegments,
  getEngineType,
  isUpgradeId,
  type EngineTypeId,
  type UpgradeId,
} from './playerBoardData';
import { TokenIcon } from './TokenIcon';
import { sameToken, tokenCity, tokenId, tokenLabel, type TokenRef } from './tokens';
import { formatMoney, type BotTrayInfo } from './botNarration';

type TokenPointerDown = (token: TokenRef, event: React.PointerEvent<Element>) => void;

interface PlayerTraysProps {
  players: BoardPlayer[];
  currentPlayer: string;
  /** Null until board state loads; every token is then shown in its tray. */
  board: BoardState | null;
  /** Token being dragged, shown dimmed in place */
  dragging: TokenRef | null;
  /** True while a dragged token would drop back into its tray */
  dropTarget: boolean;
  /** Null when tokens can't be moved yet (board state not ready) */
  onTokenPointerDown: TokenPointerDown | null;
  /** Narration for players who are bots, by playerID. */
  bots?: Record<string, BotTrayInfo>;
}

/** Decorative: always shown next to the commodity's name. */
function CommodityIcon({ commodity }: { commodity: string }): React.ReactElement {
  return <img className="boardCommodityIcon" src={(commodityIcons as Record<string, string>)[commodity]} alt="" />;
}

const NO_ENGINES: PlayerProps['engines'] = [null, null];
const NO_CARGO: PlayerProps['cargo'] = [null, null];

interface TrayTokenButtonProps {
  token: TokenRef;
  player: BoardPlayer;
  dragging: TokenRef | null;
  onTokenPointerDown: TokenPointerDown | null;
}

function TrayTokenButton({ token, player, dragging, onTokenPointerDown }: TrayTokenButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      className={`boardTray__token${sameToken(dragging, token) ? ' boardTray__token--dragging' : ''}`}
      aria-label={`${player.name}'s ${tokenLabel(token)}`}
      title={`${tokenLabel(token)}: drag onto a city`}
      data-token={tokenId(token)}
      disabled={!onTokenPointerDown}
      onPointerDown={onTokenPointerDown ? (event) => onTokenPointerDown(token, event) : undefined}
    >
      <TokenIcon token={token} player={player} />
    </button>
  );
}

/** The distance is shown for reading only; the board does not limit how far a token moves. */
function travelText(engineType: EngineTypeId, hasServiceYard: boolean): string {
  const { base, bonus, total } = engineDistance(engineType, hasServiceYard);
  const breakdown = bonus > 0 ? ` (${base} +${bonus} Service Yard)` : '';
  return `Travels ${formatSegments(total)}${breakdown}`;
}

interface EngineRowProps {
  player: BoardPlayer;
  token: TokenRef;
  engineType: EngineTypeId | null;
  cargo: string | null;
  city: string | null;
  hasServiceYard: boolean;
  dragging: TokenRef | null;
  onTokenPointerDown: TokenPointerDown | null;
}

function EngineRow({
  player,
  token,
  engineType,
  cargo,
  city,
  hasServiceYard,
  dragging,
  onTokenPointerDown,
}: EngineRowProps): React.ReactElement {
  const engine = engineType ? getEngineType(engineType) : null;
  const label = tokenLabel(token);
  const cargoName = cargo ? formatCommodity(cargo) : 'No commodity';
  const stats = [engine && travelText(engine.id, hasServiceYard), city && `on ${city}`].filter(Boolean).join(' · ');
  return (
    <div className="boardEngine" role="group" aria-label={`${player.name}'s ${label}`}>
      {city === null ? (
        <TrayTokenButton token={token} player={player} dragging={dragging} onTokenPointerDown={onTokenPointerDown} />
      ) : (
        <span className="boardTray__token boardTray__token--placed" title={`${label} on ${city}`}>
          <TokenIcon token={token} player={player} />
        </span>
      )}
      <div className="boardEngine__details">
        <div className="boardEngine__head">
          <span className={`boardEngine__type${engine ? '' : ' boardEngine__type--none'}`}>
            {engine?.name ?? 'No engine'}
          </span>
          {engine && (
            <span
              className={`boardEngine__cargo${cargo ? '' : ' boardEngine__cargo--none'}`}
              aria-label={`Cargo: ${cargoName}`}
            >
              {cargo && <CommodityIcon commodity={cargo} />}
              <span>{cargoName}</span>
            </span>
          )}
        </div>
        {stats && <p className="boardEngine__stats">{stats}</p>}
      </div>
    </div>
  );
}

interface UpgradeChecksProps {
  player: BoardPlayer;
  owned: readonly UpgradeId[];
}

/** The six upgrades with a box on the player board, checked when owned. Read-only: bought in the player app. */
function UpgradeChecks({ player, owned }: UpgradeChecksProps): React.ReactElement {
  return (
    <div className="boardUpgrades" role="group" aria-label={`${player.name}'s upgrades`}>
      {UPGRADES.map((upgrade) => (
        <label
          key={upgrade.id}
          className="boardUpgrades__item"
          title={`$${upgrade.price.toLocaleString('en-US')}: ${upgrade.effect}`}
        >
          <input type="checkbox" checked={owned.includes(upgrade.id)} disabled readOnly />
          {upgrade.name}
        </label>
      ))}
    </div>
  );
}

/** Private contracts first, then market; oldest first within each. */
function activeContracts(contracts: readonly Contract[], playerID: string): Contract[] {
  return contracts
    .filter((c) => c.playerID === playerID && !c.fulfilled)
    .sort((a, b) => (a.type === b.type ? a.creationTime - b.creationTime : a.type === 'private' ? -1 : 1));
}

/** Railroad ties earned: the tie value of every contract the player has fulfilled, as the app scores it. */
function earnedTies(contracts: readonly Contract[], playerID: string): number {
  return contracts
    .filter((c) => c.playerID === playerID && c.fulfilled)
    .reduce((sum, c) => sum + railroadTieValue(c), 0);
}

function TieCount({ ties }: { ties: number }): React.ReactElement {
  const label = `${ties} railroad ${ties === 1 ? 'tie' : 'ties'}`;
  return (
    <span className="boardTray__ties" title={label} aria-label={label}>
      {ties} RR ties
    </span>
  );
}

/** A contract's tie value, as the app's 1–4 tie icon. */
function ContractTies({ ties }: { ties: number }): React.ReactElement {
  const label = `${ties} railroad ${ties === 1 ? 'tie' : 'ties'}`;
  return (
    <img
      className="boardContracts__ties"
      src={(contractTieIcons as Record<string, string>)[String(ties)]}
      alt={label}
      title={label}
    />
  );
}

/** The player's unfulfilled private and claimed market contracts, read from G. */
function ContractList({ player, contracts }: { player: BoardPlayer; contracts: Contract[] }): React.ReactElement {
  return (
    <section className="boardContracts" aria-label={`${player.name}'s contracts`}>
      {contracts.length > 0 ? (
        <ul className="boardContracts__list">
          {contracts.map((contract) => (
            <li key={contract.id} className="boardContracts__item">
              <CommodityIcon commodity={contract.commodity} />
              <span className="boardContracts__route">
                {formatCommodity(contract.commodity)} to {contract.destinationKey}
              </span>
              <span className="boardContracts__value">${moneyValue(contract) / 1000}K</span>
              <ContractTies ties={railroadTieValue(contract)} />
              <span className={`boardContracts__type boardContracts__type--${contract.type}`}>
                {contract.type === 'private' ? 'Private' : 'Market'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="boardContracts__none">No contracts</p>
      )}
    </section>
  );
}

/** A bot's narration: its latest turn's moves, and whether the host's app is running it. */
function BotTurn({ player, info }: { player: BoardPlayer; info: BotTrayInfo }): React.ReactElement {
  return (
    <section className="boardBot" aria-label={`${player.name}'s narration`}>
      {info.waiting && (
        <p className="boardBot__waiting" role="status">
          Waiting for the host's app
        </p>
      )}
      {info.lines.length > 0 ? (
        <ul className="boardBot__lines">
          {info.lines.map((text, index) => (
            <li key={index} className="boardBot__line">
              {text}
            </li>
          ))}
        </ul>
      ) : (
        !info.waiting && <p className="boardBot__none">{info.played ? 'No moves' : 'No turns yet'}</p>
      )}
    </section>
  );
}

export function PlayerTrays({
  players,
  currentPlayer,
  board,
  dragging,
  dropTarget,
  onTokenPointerDown,
  bots,
}: PlayerTraysProps): React.ReactElement {
  const contracts = useGameStore((state) => state.G.contracts);
  const gamePlayers = useGameStore((state) => state.G.players);
  const trayColumnRef = React.useRef<HTMLElement>(null);

  return (
    <>
      <aside
        ref={trayColumnRef}
        className={`boardTrays${dropTarget ? ' boardTrays--dropTarget' : ''}`}
        aria-label="Player trays"
        data-token-drop="tray"
      >
        {players.map((player) => {
          const props = gamePlayers.find(([id]) => id === player.id)?.[1];
          const engineTypes = props?.engines ?? NO_ENGINES;
          const cargo = props?.cargo ?? NO_CARGO;
          const upgrades = (props?.upgrades ?? []).filter(isUpgradeId);
          const railyard: TokenRef = { kind: 'railyard', playerID: player.id };
          return (
            <section
              key={player.id}
              className={`boardTray${player.id === currentPlayer ? ' boardTray--current' : ''}`}
              aria-label={`${player.name}'s tray`}
            >
              <header className="boardTray__header">
                <span className="boardTray__name">
                  <Swatch color={player.color} /> {player.name}
                  <TieCount ties={earnedTies(contracts, player.id)} />
                  {props && (
                    <>
                      <span className="boardTray__separator" aria-hidden="true">·</span>
                      <span className="boardTray__money">{formatMoney(props)}</span>
                    </>
                  )}
                </span>
                {tokenCity(board, railyard) === null && (
                  <TrayTokenButton
                    token={railyard}
                    player={player}
                    dragging={dragging}
                    onTokenPointerDown={onTokenPointerDown}
                  />
                )}
              </header>
              {bots?.[player.id] && <BotTurn player={player} info={bots[player.id]} />}
              {([0, 1] as const).map((slot) => {
                const token: TokenRef = { kind: 'engine', playerID: player.id, slot };
                return (
                  <EngineRow
                    key={slot}
                    player={player}
                    token={token}
                    engineType={engineTypes[slot]}
                    cargo={cargo[slot]}
                    city={tokenCity(board, token)}
                    hasServiceYard={upgrades.includes('service-yard')}
                    dragging={dragging}
                    onTokenPointerDown={onTokenPointerDown}
                  />
                );
              })}
              <ContractList player={player} contracts={activeContracts(contracts, player.id)} />
              <UpgradeChecks player={player} owned={upgrades} />
            </section>
          );
        })}
      </aside>
    </>
  );
}
