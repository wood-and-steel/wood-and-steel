import React from "react";
import type { Contract } from "../Contract";
import { routes as ROUTES } from "../data/routes";
import type { GameContext, GameState, PlayerProps, ReportedContract, RoundReport } from "../stores/gameStore";
import { independentRailroadPrice } from "../stores/gameActions";
import { isOpenMarketContract } from "../stores/marketExpiration";
import { formatMoney } from "../utils/money";
import { miniMapsFor, type MiniMap } from "../utils/miniMap";
import { displayRound } from "../utils/rounds";
import { payoutFor } from "./ContractRows";
import { Sheet } from "./Sheet";

export interface RoundReportSheetProps {
  report: RoundReport;
  G: GameState;
  ctx: GameContext;
  /** The viewing player, for what new market contracts would pay them. */
  player?: PlayerProps;
  autoOpen: boolean;
  onAutoOpenChange: (on: boolean) => void;
  onClose: () => void;
}

function routeName(key: string): string {
  return ROUTES.get(key)?.cities.join(" – ") ?? key;
}

function contractName(c: Pick<Contract, "commodity" | "destinationKey">): string {
  return `${c.commodity.charAt(0).toUpperCase()}${c.commodity.slice(1)} to ${c.destinationKey}`;
}

function MiniMapView({ map, label }: { map: MiniMap; label: string }): React.ReactElement {
  return (
    <svg className="miniMap" viewBox={map.viewBox} role="img" aria-label={label}>
      {map.routes
        .filter((r) => !r.isNew)
        .map((r) => (
          <line key={r.key} className="miniMap__route" x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} strokeWidth={map.cityRadius * 0.45} />
        ))}
      {map.routes
        .filter((r) => r.isNew)
        .map((r) => (
          <line
            key={r.key}
            className="miniMap__route miniMap__route--new"
            x1={r.x1}
            y1={r.y1}
            x2={r.x2}
            y2={r.y2}
            strokeWidth={map.cityRadius * 1.1}
          />
        ))}
      {map.cities.map((c) => (
        <g key={c.name}>
          <circle className="miniMap__city" cx={c.x} cy={c.y} r={map.cityRadius} strokeWidth={map.cityRadius * 0.35} />
          <text className="miniMap__label" x={c.x} y={c.labelY} fontSize={map.fontSize} textAnchor="middle">
            {c.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

function RailroadGrowth({ name, added, G }: { name: string; added: string[]; G: GameState }): React.ReactElement {
  const railroad = G.independentRailroads[name];
  const newKeys = new Set(added);
  // A railroad acquired since the report is gone from G; its new routes are all there is to draw.
  const allKeys = railroad ? [...railroad.routes.map((r) => r.key), ...added] : added;
  const maps = miniMapsFor(allKeys, newKeys);
  const existing = railroad ? railroad.routes.filter((r) => !newKeys.has(r.key)).map((r) => routeName(r.key)) : [];
  const label = `${name}: ${existing.length > 0 ? `existing routes ${existing.join(", ")}; ` : ""}new ${
    added.length === 1 ? "route" : "routes"
  } ${added.map(routeName).join(", ")}`;
  const routeCount = railroad?.routes.length ?? 0;

  return (
    <div className="sheet__box roundReport__railroad">
      <div className="sheet__row">
        <strong>{name}</strong>
        <span className="sheet__label">
          {railroad
            ? `${routeCount} ${routeCount === 1 ? "route" : "routes"} · ${formatMoney(independentRailroadPrice(G, name))}`
            : "Acquired since"}
        </span>
      </div>
      {maps.map((map, i) => (
        <MiniMapView key={i} map={map} label={label} />
      ))}
      <span className="sheet__label">New: {added.map(routeName).join(", ")}</span>
    </div>
  );
}

/**
 * What changed at the end of a round: the independent railroads that grew, each on a mini
 * map cropped to it (new routes thick, existing ones thin), the market contracts that expired
 * and replaced them, and who starts the next round. A switch at the foot turns off opening it
 * after every round, on this device.
 */
export function RoundReportSheet({
  report,
  G,
  ctx,
  player,
  autoOpen,
  onAutoOpenChange,
  onClose,
}: RoundReportSheetProps): React.ReactElement {
  const grew = Object.entries(report.routesAdded);
  const lastRound = G.contracts.filter((c) => isOpenMarketContract(c) && c.roundsLeft !== undefined && c.roundsLeft <= 1);
  const hasMarketNews = report.marketExpired.length > 0 || report.marketAdded.length > 0 || lastRound.length > 0;
  const firstID = ctx.playOrder[0];
  const firstName = G.players.find(([id]) => id === firstID)?.[1].name ?? `Player ${firstID}`;
  const switchId = React.useId();
  // What a new contract pays depends only on its commodity and destination.
  const value = (c: ReportedContract) => payoutFor(c as Contract, player).net;

  return (
    <Sheet title={`End of round ${displayRound(report.round)}`} onClose={onClose}>
      {grew.length > 0 ? (
        <>
          <p className="sheet__note">Independent railroads grew. Draw the new routes on the map.</p>
          {grew.map(([name, added]) => (
            <RailroadGrowth key={name} name={name} added={added} G={G} />
          ))}
          <div className="roundReport__legend" aria-hidden="true">
            <span>
              <i className="roundReport__swatch roundReport__swatch--new" />
              New
            </span>
            <span>
              <i className="roundReport__swatch" />
              Existing
            </span>
          </div>
        </>
      ) : (
        <p className="sheet__note">
          {report.round === 0
            ? `Independent railroads start growing at the end of round ${displayRound(1)}.`
            : "No independent railroads grew."}
        </p>
      )}

      {hasMarketNews && (
        <div>
          <div className="sheet__subhead">Market</div>
          <div className="sheet__box">
            {report.marketExpired.map((c) => (
              <div key={c.id} className="sheet__row">
                <span>{contractName(c)}</span>
                <span className="contractRow__chip">Expired</span>
              </div>
            ))}
            {report.marketAdded.map((c) => (
              <div key={c.id} className="sheet__row">
                <span>New: {contractName(c)}</span>
                <span>{value(c)}</span>
              </div>
            ))}
            {lastRound.map((c) => (
              <div key={c.id} className="sheet__row">
                <span>{contractName(c)}</span>
                <span className="contractRow__chip contractRow__chip--expiring contractRow__chip--last">Last round</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sheet__box">
        <div className="sheet__row">
          <span className="sheet__label">Round {displayRound(report.round + 1)} starts with</span>
          <strong>{firstName}</strong>
        </div>
      </div>

      <label className="roundReport__switch" htmlFor={switchId}>
        <span>Open this after every round</span>
        <input
          id={switchId}
          type="checkbox"
          role="switch"
          className="roundReport__switchInput"
          checked={autoOpen}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAutoOpenChange(e.target.checked)}
        />
      </label>

      <button type="button" className="button sheet__primary" onClick={onClose}>
        Done
      </button>
    </Sheet>
  );
}
