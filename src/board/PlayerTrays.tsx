/**
 * Player trays: the column beside the map with one card per player, in play order. Each card
 * has a row per engine token (its type, cargo, stats, and effects), the upgrades bought, and the
 * Railyard while unplaced.
 * The token stays on its row at full color even when on the map: it is the key to which
 * token is which engine type.
 */
import React from 'react';
import { Swatch } from './BoardChrome';
import type { BoardPlayer } from './boardPlayers';
import { playerCargo, playerEngineTypes, type BoardOp, type BoardState, type EngineSlot } from './boardOps';
import {
  UPGRADES,
  engineDistance,
  formatCommodity,
  formatSegments,
  getEngineType,
  type EngineTypeId,
  type UpgradeId,
} from './playerBoardData';
import { TokenIcon } from './TokenIcon';
import { sameToken, tokenCity, tokenId, tokenLabel, type TokenRef } from './tokens';
import { CommodityIcon, CommodityOptions, EngineOptions, TrayPicker } from './TrayPicker';
import type { BotTrayInfo } from './botNarration';

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
  /** Null when tray values can't be edited yet (board state not ready) */
  onBoardOp: ((op: BoardOp) => void) | null;
  /** Narration for players who are bots, by playerID. */
  bots?: Record<string, BotTrayInfo>;
}

type PickerKind = 'engine' | 'cargo';

interface OpenPicker {
  kind: PickerKind;
  playerID: string;
  slot: EngineSlot;
  trigger: HTMLElement;
  clientX: number;
  clientY: number;
}

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
  /** Which of this row's pickers is open, if any */
  openPicker: PickerKind | null;
  /** Null when tray values can't be edited yet */
  onTogglePicker: ((kind: PickerKind, event: React.MouseEvent<HTMLButtonElement>) => void) | null;
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
  openPicker,
  onTogglePicker,
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
          <button
            type="button"
            className={`boardEngine__type${engine ? '' : ' boardEngine__type--none'}`}
            aria-label={`${player.name}'s ${label} type: ${engine?.name ?? 'No engine'}`}
            aria-haspopup="dialog"
            aria-expanded={openPicker === 'engine'}
            data-popover-trigger
            disabled={!onTogglePicker}
            onClick={onTogglePicker ? (event) => onTogglePicker('engine', event) : undefined}
          >
            {engine?.name ?? 'No engine'}
          </button>
          {engine && (
            <button
              type="button"
              className={`boardEngine__cargo${cargo ? '' : ' boardEngine__cargo--none'}`}
              aria-label={`${player.name}'s ${label} cargo: ${cargoName}`}
              aria-haspopup="dialog"
              aria-expanded={openPicker === 'cargo'}
              data-popover-trigger
              disabled={!onTogglePicker}
              onClick={onTogglePicker ? (event) => onTogglePicker('cargo', event) : undefined}
            >
              {cargo && <CommodityIcon commodity={cargo} />}
              <span>{cargoName}</span>
            </button>
          )}
        </div>
        {stats && <p className="boardEngine__stats">{stats}</p>}
        {engine?.effects && <p className="boardEngine__effects">{engine.effects}</p>}
      </div>
    </div>
  );
}

interface UpgradeChecksProps {
  player: BoardPlayer;
  owned: readonly UpgradeId[];
  /** Null when tray values can't be edited yet */
  onBoardOp: ((op: BoardOp) => void) | null;
}

function UpgradeChecks({ player, owned, onBoardOp }: UpgradeChecksProps): React.ReactElement {
  return (
    <div className="boardUpgrades" role="group" aria-label={`${player.name}'s upgrades`}>
      {UPGRADES.map((upgrade) => (
        <label
          key={upgrade.id}
          className="boardUpgrades__item"
          title={`$${upgrade.price.toLocaleString('en-US')}: ${upgrade.effect}`}
        >
          <input
            type="checkbox"
            checked={owned.includes(upgrade.id)}
            disabled={!onBoardOp}
            onChange={(event) =>
              onBoardOp?.({ type: 'setUpgrade', playerID: player.id, upgrade: upgrade.id, owned: event.target.checked })
            }
          />
          {upgrade.name}
        </label>
      ))}
    </div>
  );
}

/** A bot's narration: its last (or current) turn, and whether the host's app is running it. */
function BotTurn({ player, info }: { player: BoardPlayer; info: BotTrayInfo }): React.ReactElement {
  return (
    <section className="boardBot" aria-label={`${player.name}'s narration`}>
      {info.waiting && (
        <p className="boardBot__waiting" role="status">
          Waiting for the host's app
        </p>
      )}
      {info.heading ? (
        <>
          <h3 className="boardBot__heading">{info.heading}</h3>
          <ul className="boardBot__lines">
            {info.lines.map((line, index) => (
              <li key={index} className="boardBot__line">
                {line}
              </li>
            ))}
          </ul>
        </>
      ) : (
        !info.waiting && <p className="boardBot__none">No turns yet</p>
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
  onBoardOp,
  bots,
}: PlayerTraysProps): React.ReactElement {
  const trayColumnRef = React.useRef<HTMLElement>(null);
  const [picker, setPicker] = React.useState<OpenPicker | null>(null);

  const closePicker = React.useCallback(() => {
    picker?.trigger.focus({ preventScroll: true });
    setPicker(null);
  }, [picker]);

  const togglePicker = (
    kind: PickerKind,
    playerID: string,
    slot: EngineSlot,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (picker?.kind === kind && picker.playerID === playerID && picker.slot === slot) {
      closePicker();
      return;
    }
    const trigger = event.currentTarget;
    const rect = trigger.getBoundingClientRect();
    setPicker({ kind, playerID, slot, trigger, clientX: rect.left, clientY: rect.top });
  };

  // The picker is anchored to screen coordinates, so close it when the column moves.
  React.useEffect(() => {
    const el = trayColumnRef.current;
    if (!el || !picker) return;
    el.addEventListener('scroll', closePicker, { passive: true });
    return () => el.removeEventListener('scroll', closePicker);
  }, [picker, closePicker]);

  const pickerPlayer = picker && players.find((p) => p.id === picker.playerID);

  return (
    <>
      <aside
        ref={trayColumnRef}
        className={`boardTrays${dropTarget ? ' boardTrays--dropTarget' : ''}`}
        aria-label="Player trays"
        data-token-drop="tray"
      >
        {players.map((player) => {
          const engineTypes = playerEngineTypes(board, player.id);
          const cargo = playerCargo(board, player.id);
          const upgrades = board?.upgrades[player.id] ?? [];
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
                    openPicker={picker?.playerID === player.id && picker.slot === slot ? picker.kind : null}
                    onTogglePicker={onBoardOp ? (kind, event) => togglePicker(kind, player.id, slot, event) : null}
                  />
                );
              })}
              <UpgradeChecks player={player} owned={upgrades} onBoardOp={onBoardOp} />
            </section>
          );
        })}
      </aside>
      {picker && pickerPlayer && (
        <TrayPicker
          key={`${picker.kind}-${picker.playerID}-${picker.slot}`}
          label={`${pickerPlayer.name}'s ${tokenLabel({ kind: 'engine', playerID: picker.playerID, slot: picker.slot })} ${
            picker.kind === 'engine' ? 'type' : 'cargo'
          }`}
          clientX={picker.clientX}
          clientY={picker.clientY}
          onClose={closePicker}
        >
          {picker.kind === 'engine' ? (
            <EngineOptions
              value={playerEngineTypes(board, picker.playerID)[picker.slot]}
              onPick={(engineType) => {
                if (engineType !== playerEngineTypes(board, picker.playerID)[picker.slot]) {
                  onBoardOp?.({ type: 'setEngineType', playerID: picker.playerID, slot: picker.slot, engineType });
                }
                closePicker();
              }}
            />
          ) : (
            <CommodityOptions
              value={playerCargo(board, picker.playerID)[picker.slot]}
              onPick={(commodity) => {
                if (commodity !== playerCargo(board, picker.playerID)[picker.slot]) {
                  onBoardOp?.({ type: 'setCargo', playerID: picker.playerID, slot: picker.slot, commodity });
                }
                closePicker();
              }}
            />
          )}
        </TrayPicker>
      )}
    </>
  );
}
