import React from "react";
import hamburgerIcon from "../shared/assets/images/hamburger-icon.svg";
import { PopupMenu, PopupMenuItem } from "./PopupMenu";

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const handler = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export interface NavBarGameManager {
  currentGameCode?: string | null;
}

export interface NavBarProps {
  gameManager: NavBarGameManager;
  onNavigateToLobby: () => void;
  onOpenEditPlaytest: () => void;
  /** Opens the latest round report. Shown in play; disabled until the first round has ended. */
  onShowRoundReport?: () => void;
  hasRoundReport?: boolean;
  /** Playtest tool: fill the market tableau (the old +M button). Shown only on the player's turn in play. */
  onFillMarket?: () => void;
  /** Opens the discard sheet. Shown in play; disabled when it's not the player's turn. */
  onDiscardContract?: () => void;
  /** Opens the private contract offers. Shown in play; disabled when it's not the player's turn. */
  onDrawPrivateContract?: () => void;
  /** Whether the player may act from the menu now (their turn in play). */
  canActFromMenu?: boolean;
  /** The player already holds an unfulfilled private contract, so can't draw another. */
  hasPrivateContract?: boolean;
}

/**
 * The game menu: a floating button on phones and tablets, and the left end of the nav row on
 * desktop (the money strip takes its right end).
 */
export function NavBar({
  gameManager,
  onNavigateToLobby,
  onOpenEditPlaytest,
  onShowRoundReport,
  hasRoundReport,
  onFillMarket,
  onDiscardContract,
  onDrawPrivateContract,
  canActFromMenu,
  hasPrivateContract,
}: NavBarProps): React.ReactElement {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const menuButtonDesktopRef = React.useRef<HTMLButtonElement>(null);
  const isDesktop = useIsDesktop();

  const placement = React.useMemo(
    () => (isDesktop ? { side: "bottom" as const, align: "start" as const } : { side: "top" as const, align: "end" as const }),
    [isDesktop]
  );

  const handleCopyGameCode = React.useCallback(async () => {
    if (gameManager?.currentGameCode) {
      try {
        await navigator.clipboard.writeText(gameManager.currentGameCode);
        setIsMenuOpen(false);
      } catch (err) {
        console.error("Failed to copy game code:", err);
      }
    }
  }, [gameManager]);

  const handleMenuClick = React.useCallback(
    (action: "lobby" | "edit") => {
      if (action === "lobby") onNavigateToLobby();
      else if (action === "edit") onOpenEditPlaytest();
      setIsMenuOpen(false);
    },
    [onNavigateToLobby, onOpenEditPlaytest]
  );

  return (
    <>
      <button
        type="button"
        className="navBar__menuButton"
        ref={menuButtonRef}
        onClick={() => setIsMenuOpen((o: boolean) => !o)}
        aria-label="Menu"
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
      >
        <img src={hamburgerIcon} alt="" className="navBar__menuIcon" />
      </button>

      <PopupMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        anchorRef={[menuButtonRef, menuButtonDesktopRef]}
        placement={placement}
      >
        <PopupMenuItem onClick={() => handleMenuClick("lobby")}>Go to Lobby</PopupMenuItem>
        {gameManager?.currentGameCode && (
          <PopupMenuItem onClick={handleCopyGameCode}>
            Copy Game Code ({gameManager.currentGameCode})
          </PopupMenuItem>
        )}
        <PopupMenuItem onClick={() => handleMenuClick("edit")}>Add Contract or City...</PopupMenuItem>
        {onDiscardContract && (
          <PopupMenuItem
            disabled={!canActFromMenu}
            onClick={() => {
              onDiscardContract();
              setIsMenuOpen(false);
            }}
          >
            Discard Contract...
          </PopupMenuItem>
        )}
        {onDrawPrivateContract && (
          <PopupMenuItem
            disabled={!canActFromMenu || hasPrivateContract}
            onClick={() => {
              onDrawPrivateContract();
              setIsMenuOpen(false);
            }}
          >
            Draw Private Contract
          </PopupMenuItem>
        )}
        {onFillMarket && (
          <PopupMenuItem
            onClick={() => {
              onFillMarket();
              setIsMenuOpen(false);
            }}
          >
            Fill Market Contracts
          </PopupMenuItem>
        )}
        {onShowRoundReport && (
          <PopupMenuItem
            disabled={!hasRoundReport}
            onClick={() => {
              onShowRoundReport();
              setIsMenuOpen(false);
            }}
          >
            Show Round Report
          </PopupMenuItem>
        )}
      </PopupMenu>

      <nav className="navBar">
        <button
          type="button"
          className="plainButton navBar__menuButton--desktop"
          ref={menuButtonDesktopRef}
          onClick={() => setIsMenuOpen((o: boolean) => !o)}
          aria-label="Menu"
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          <img src={hamburgerIcon} alt="" className="navBar__menuIcon" />
        </button>
      </nav>
    </>
  );
}
