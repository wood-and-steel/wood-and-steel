import React from "react";
import { generatePrivateContractOffers, generatePrivateContractSpec } from "../Contract";
import { ContractCard } from "./ContractCard";
import { cities } from "../data";
import type { GameState, GameContext, RegionCode } from "../stores/gameStore";
import type { PrivateContractSpec } from "../Contract";
import { useGameStore } from "../stores/gameStore";

type PrivateContractOfferView = "offers" | "pickHubCity" | "pickRegionalOffice";

/** Region grid order: top row NW, NC, NE; bottom row SW, SC, SE */
const REGION_GRID_ORDER: [string, string, string][] = [
  ["NW", "NC", "NE"],
  ["SW", "SC", "SE"],
];

/** Display labels for region codes */
const REGION_LABELS: Record<string, string> = {
  NW: "Northwest",
  NC: "North Central",
  NE: "Northeast",
  SW: "Southwest",
  SC: "South Central",
  SE: "Southeast",
};

/** Moves used by the modal for upgrade cards. */
export interface PrivateContractOfferModalMoves {
  claimHubCity: (cityKey: string) => boolean;
  claimRegionalOffice: (regionCode: string) => boolean;
}

export interface PrivateContractOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  G: GameState;
  ctx: GameContext;
  onSelect: (commodity: string, destinationKey: string) => void;
  moves?: PrivateContractOfferModalMoves;
}

/**
 * Modal for selecting a private contract from generated offers.
 * Displays 2, 3, or 4 contract options as selectable cards.
 * Backdrop click or Escape closes without selecting.
 */
export function PrivateContractOfferModal({
  isOpen,
  onClose,
  G,
  ctx,
  onSelect,
  moves,
}: PrivateContractOfferModalProps): React.ReactElement | null {
  const [offers, setOffers] = React.useState<PrivateContractSpec[]>([]);
  const [view, setView] = React.useState<PrivateContractOfferView>("offers");

  const currentPlayer = React.useMemo(
    () => G?.players?.find(([id]) => id === ctx?.currentPlayer)?.[1],
    [G, ctx]
  );

  const otherPlayersHubCities = React.useMemo(() => {
    if (!G?.players || ctx?.currentPlayer == null) return [];
    return G.players
      .filter(([id]) => id !== ctx.currentPlayer)
      .map(([, p]) => p.hubCity)
      .filter((hub): hub is string => hub != null);
  }, [G?.players, ctx?.currentPlayer]);

  const pickableCities = React.useMemo(
    () => [...cities.keys()].filter((key) => !otherPlayersHubCities.includes(key)),
    [otherPlayersHubCities]
  );

  const otherPlayersRegionalOffices = React.useMemo(() => {
    if (!G?.players || ctx?.currentPlayer == null) return [];
    return G.players
      .filter(([id]) => id !== ctx.currentPlayer)
      .map(([, p]) => p.regionalOffice)
      .filter((region): region is RegionCode => region != null);
  }, [G?.players, ctx?.currentPlayer]);

  const prevIsOpenRef = React.useRef(false);
  React.useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (justOpened && G && ctx) {
      const generated = generatePrivateContractOffers(G, ctx);
      setOffers(generated);
      setView("offers");
    }
  }, [isOpen, G, ctx]);

  const handleOfferClick = React.useCallback(
    (commodity: string, destinationKey: string) => {
      onSelect(commodity, destinationKey);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleBuyHub = React.useCallback(() => {
    setView("pickHubCity");
  }, []);

  const handlePickHubBack = React.useCallback(() => {
    setView("offers");
  }, []);

  const handleBuyRegionalOffice = React.useCallback(() => {
    setView("pickRegionalOffice");
  }, []);

  const handlePickRegionalOfficeBack = React.useCallback(() => {
    setView("offers");
  }, []);

  const handleBackdropClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (view === "pickHubCity") {
        handlePickHubBack();
        return;
      }
      if (view === "pickRegionalOffice") {
        handlePickRegionalOfficeBack();
        return;
      }
      onClose();
    },
    [onClose, view, handlePickHubBack, handlePickRegionalOfficeBack]
  );

  const showBuyHub = moves && currentPlayer && currentPlayer.hubCity === null;
  const showBuyRegionalOffice =
    moves && currentPlayer && currentPlayer.regionalOffice === null;

  if (!isOpen) return null;

  return (
    <div
      className="modal"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-contract-offer-title"
      tabIndex={-1}
    >
      <div
        className="modal__content privateContractOfferModal__content"
        onClick={(e) => e.stopPropagation()}
      >
        {view === "pickHubCity" ? (
          <>
            <h2
              className="privateContractOfferModal__instruction"
              id="private-contract-offer-title"
            >
              Choose your hub city
            </h2>
            <div
              className="privateContractOfferModal__cityList"
              role="list"
              aria-label="Pickable cities"
            >
              {pickableCities.map((cityKey: string) => (
                <button
                  key={cityKey}
                  type="button"
                  className="privateContractOfferModal__cityItem"
                  onClick={() => {
                    if (!moves?.claimHubCity(cityKey)) return;
                    const { G: updatedG, ctx: updatedCtx } = useGameStore.getState();
                    const seen = new Set(
                      offers.map((s: PrivateContractSpec) => `${s.commodity}|${s.destinationKey}`)
                    );
                    const maxAttempts = 20;
                    for (let i = 0; i < maxAttempts; i++) {
                      const spec = generatePrivateContractSpec(updatedG, updatedCtx);
                      if (!spec) continue;
                      const key = `${spec.commodity}|${spec.destinationKey}`;
                      if (seen.has(key)) continue;
                      setOffers((prev: PrivateContractSpec[]) => [...prev, spec]);
                      setView("offers");
                      return;
                    }
                    setView("offers");
                  }}
                  role="listitem"
                >
                  {cities.get(cityKey)?.label ?? cityKey}
                </button>
              ))}
            </div>
            <div className="privateContractOfferModal__pickHubActions">
              <button
                type="button"
                className="privateContractOfferModal__backButton"
                onClick={handlePickHubBack}
              >
                Back
              </button>
            </div>
          </>
        ) : view === "pickRegionalOffice" ? (
          <>
            <h2
              className="privateContractOfferModal__instruction"
              id="private-contract-offer-title"
            >
              Choose a Regional Office
            </h2>
            <div
              className="privateContractOfferModal__regionGrid"
              role="group"
              aria-label="Regions"
            >
              {REGION_GRID_ORDER.map((row, rowIndex) =>
                row.map((regionCode) => {
                  const disabled = otherPlayersRegionalOffices.includes(regionCode);
                  return (
                    <button
                      key={regionCode}
                      type="button"
                      className="privateContractOfferModal__regionItem"
                      disabled={disabled}
                      onClick={() => {
                        if (!moves?.claimRegionalOffice(regionCode)) return;
                        const { G: updatedG, ctx: updatedCtx } = useGameStore.getState();
                        const seen = new Set(
                          offers.map(
                            (s: PrivateContractSpec) =>
                              `${s.commodity}|${s.destinationKey}`
                          )
                        );
                        const maxAttempts = 20;
                        for (let i = 0; i < maxAttempts; i++) {
                          const spec = generatePrivateContractSpec(
                            updatedG,
                            updatedCtx,
                            regionCode as RegionCode
                          );
                          if (!spec) continue;
                          const key = `${spec.commodity}|${spec.destinationKey}`;
                          if (seen.has(key)) continue;
                          setOffers((prev: PrivateContractSpec[]) => [
                            ...prev,
                            spec,
                          ]);
                          setView("offers");
                          return;
                        }
                        setView("offers");
                      }}
                    >
                      {REGION_LABELS[regionCode] ?? regionCode}
                    </button>
                  );
                })
              )}
            </div>
            <div className="privateContractOfferModal__pickHubActions">
              <button
                type="button"
                className="privateContractOfferModal__backButton"
                onClick={handlePickRegionalOfficeBack}
              >
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              className="privateContractOfferModal__instruction"
              id="private-contract-offer-title"
            >
              Choose a new contract
            </h2>
            <div className="privateContractOfferModal__grid">
              {offers.map((spec: PrivateContractSpec, index: number) => {
                const specKey = `${spec.commodity}|${spec.destinationKey}|${index}`;
                return (
                  <ContractCard
                    key={specKey}
                    commodity={spec.commodity}
                    destinationKey={spec.destinationKey}
                    variant="private"
                    className="privateContractOfferModal__card"
                    onClick={() => handleOfferClick(spec.commodity, spec.destinationKey)}
                  />
                );
              })}
              {showBuyHub && (
                <button
                  type="button"
                  className="contract contract--private privateContractOfferModal__card"
                  onClick={handleBuyHub}
                >
                  <div className="contract__header" aria-hidden="true">
                    <span style={{ visibility: "hidden" }}>0</span>
                    <div className="contract__moneyValue">Costs $15K</div>
                  </div>
                  <div className="contract__body privateContractOfferModal__cardBody">Buy a Hub</div>
                </button>
              )}
              {showBuyRegionalOffice && (
                <button
                  type="button"
                  className="contract contract--private privateContractOfferModal__card"
                  onClick={handleBuyRegionalOffice}
                >
                  <div className="contract__header" aria-hidden="true">
                    <span style={{ visibility: "hidden" }}>0</span>
                    <div className="contract__moneyValue">Costs $20K</div>
                  </div>
                  <div className="contract__body privateContractOfferModal__cardBody">Buy a Regional Office</div>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
