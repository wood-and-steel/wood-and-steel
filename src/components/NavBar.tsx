import React from "react";
import hamburgerIcon from "../shared/assets/images/hamburger-icon.svg";
import { PopupMenu, PopupMenuItem, PopupMenuSeparator } from "./PopupMenu";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export interface NavBarGameManager {
  currentGameCode?: string | null;
}

export interface NavBarProps {
  gameManager: NavBarGameManager;
  onNavigateToLobby: () => void;
  onOpenEditPlaytest: () => void;
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
  onFillMarket,
  onDiscardContract,
  onDrawPrivateContract,
  canActFromMenu,
  hasPrivateContract,
}: NavBarProps): React.ReactElement {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const menuButtonDesktopRef = React.useRef<HTMLButtonElement>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // The board app isn't laid out for phones, so the menu leaves it out there.
  const isPhone = useMediaQuery("(max-width: 767px)");

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

  const handleOpenBoard = React.useCallback(() => {
    const code = gameManager?.currentGameCode;
    if (!code) return;
    const url = new URL("/board", window.location.origin);
    url.searchParams.set("game", code);
    window.open(url.toString(), "_blank", "noopener");
    setIsMenuOpen(false);
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
        {__INCLUDE_BOARD__ && !isPhone && gameManager?.currentGameCode && (
          <PopupMenuItem onClick={handleOpenBoard} aria-label="Open Board (opens in a new tab)">
            Open Board
            <svg
              className="popupMenu__itemIcon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </PopupMenuItem>
        )}
        {gameManager?.currentGameCode && (
          <>
            <PopupMenuItem onClick={handleCopyGameCode}>
              Copy Game Code ({gameManager.currentGameCode})
            </PopupMenuItem>
            <PopupMenuSeparator />
          </>
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
            Fill Market Tableau
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
