/**
 * Player trays: the column beside the map with one card per player, in play order. Each card
 * has a row per engine token (its type, cargo, stats, and effects) and the Railyard while unplaced.
 * The token stays on its row at full color even when on the map: it is the key to which
 * token is which engine type.
 */
import React from 'react';
import { Swatch } from './BoardChrome';
import type { BoardPlayer } from './boardPlayers';
import { playerCargo, playerEngineTypes, type BoardOp, type BoardState, type EngineSlot } from './boardOps';
import { formatCommodity, formatSegments, getEngineType, type EngineTypeId } from './playerBoardData';
import { TokenIcon } from './TokenIcon';
import { sameToken, tokenCity, tokenId, tokenLabel, type TokenRef } from './tokens';
import { CommodityIcon, CommodityOptions, EngineOptions, TrayPicker } from './TrayPicker';

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

interface EngineRowProps {
  player: BoardPlayer;
  token: TokenRef;
  engineType: EngineTypeId | null;
  cargo: string | null;
  city: string | null;
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
  dragging,
  onTokenPointerDown,
  openPicker,
  onTogglePicker,
}: EngineRowProps): React.ReactElement {
  const engine = engineType ? getEngineType(engineType) : null;
  const label = tokenLabel(token);
  const cargoName = cargo ? formatCommodity(cargo) : 'No commodity';
  const stats = [engine && `Travels ${formatSegments(engine.distance)}`, city && `on ${city}`].filter(Boolean).join(' · ');
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

export function PlayerTrays({
  players,
  currentPlayer,
  board,
  dragging,
  dropTarget,
  onTokenPointerDown,
  onBoardOp,
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
                    dragging={dragging}
                    onTokenPointerDown={onTokenPointerDown}
                    openPicker={picker?.playerID === player.id && picker.slot === slot ? picker.kind : null}
                    onTogglePicker={onBoardOp ? (kind, event) => togglePicker(kind, player.id, slot, event) : null}
                  />
                );
              })}
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
