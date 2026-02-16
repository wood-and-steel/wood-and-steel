import React from "react";
import placeholderIcon from "../shared/assets/images/placeholder-icon.svg";
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

export type NavBarTabId = "board" | "commodities" | "indies" | "cities";

export interface NavBarGameManager {
  currentGameCode?: string | null;
}

interface HintPositionDesktop {
  contentTop: number;
  contentLeft: number;
  arrowLeft: number;
  arrowTop: number;
}

interface HintPositionMobile {
  contentBottom: number;
  arrowLeft: number;
  arrowBottom: number;
}

export interface NavBarProps {
  gameManager: NavBarGameManager;
  onNavigateToLobby: () => void;
  onOpenEditPlaytest: () => void;
  activeTab: NavBarTabId;
  onTabChange: (tabId: NavBarTabId) => void;
  showRailroadHint?: boolean;
  onDismissHint?: () => void;
}

/**
 * Navigation bar component with responsive design. Shows tabs for different views on desktop and mobile,
 * and includes a hamburger menu for game management actions.
 */
export function NavBar({
  gameManager,
  onNavigateToLobby,
  onOpenEditPlaytest,
  activeTab,
  onTabChange,
  showRailroadHint,
  onDismissHint,
}: NavBarProps): React.ReactElement {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const menuButtonDesktopRef = React.useRef<HTMLButtonElement>(null);
  const contractsTabRef = React.useRef<HTMLButtonElement>(null);
  const contractsTabMobileRef = React.useRef<HTMLButtonElement>(null);
  const [hintPosition, setHintPosition] = React.useState<HintPositionDesktop | HintPositionMobile | null>(null);
  const isDesktop = useIsDesktop();

  React.useEffect(() => {
    if (!showRailroadHint) {
      setHintPosition(null);
      return;
    }

    const updatePosition = () => {
      const tabRef = isDesktop ? contractsTabRef.current : contractsTabMobileRef.current;
      if (!tabRef) return;

      const rect = tabRef.getBoundingClientRect();
      const tabCenterX = rect.left + rect.width / 2;

      if (isDesktop) {
        setHintPosition({
          contentTop: rect.bottom + 12,
          contentLeft: Math.max(8, tabCenterX - 80),
          arrowLeft: tabCenterX,
          arrowTop: rect.bottom + 4,
        });
      } else {
        setHintPosition({
          contentBottom: window.innerHeight - rect.top + 12,
          arrowLeft: tabCenterX,
          arrowBottom: window.innerHeight - rect.top + 4,
        });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [showRailroadHint, isDesktop]);

  React.useEffect(() => {
    if (!showRailroadHint || !onDismissHint) return;

    const handleClick = () => onDismissHint();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismissHint();
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClick);
      document.addEventListener("keydown", handleKeyDown);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showRailroadHint, onDismissHint]);

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

  const tabs: { id: NavBarTabId; label: string }[] = [
    { id: "board", label: "Contracts" },
    { id: "commodities", label: "Commodities" },
    { id: "indies", label: "Railroads" },
    { id: "cities", label: "Cities" },
  ];

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
      </PopupMenu>

      <nav className="navBar">
        <button
          type="button"
          className="navBar__menuButton--desktop"
          ref={menuButtonDesktopRef}
          onClick={() => setIsMenuOpen((o: boolean) => !o)}
          aria-label="Menu"
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          <img src={hamburgerIcon} alt="" className="navBar__menuIcon" />
        </button>

        <div className="navBar__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={tab.id === "board" ? contractsTabRef : null}
              type="button"
              className={`navBar__tab ${activeTab === tab.id ? "navBar__tab--active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <img src={placeholderIcon} alt="" className="navBar__tabIcon" />
              <span className="navBar__tabLabel">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="navBar__tabs--mobile">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={tab.id === "board" ? contractsTabMobileRef : null}
              type="button"
              className={`navBar__tab--mobile ${activeTab === tab.id ? "navBar__tab--mobile--active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <img src={placeholderIcon} alt="" className="navBar__tabIcon--mobile" />
              <span className="navBar__tabLabel--mobile">{tab.label}</span>
            </button>
          ))}
        </div>

        {showRailroadHint && hintPosition && (
          <>
            <div
              className={`navBar__hintCallout ${isDesktop ? "navBar__hintCallout--desktop" : ""}`}
              style={
                isDesktop && "contentTop" in hintPosition
                  ? { top: hintPosition.contentTop, left: hintPosition.contentLeft }
                  : "contentBottom" in hintPosition
                    ? { bottom: hintPosition.contentBottom }
                    : undefined
              }
            >
              <div className="navBar__hintCallout__content">
                Mark the independent railroads on your map, then switch to Contracts to start taking turns.
              </div>
            </div>
            <div
              className={`navBar__hintCallout__arrow ${isDesktop ? "navBar__hintCallout__arrow--desktop" : ""}`}
              style={
                isDesktop && "arrowTop" in hintPosition
                  ? { left: hintPosition.arrowLeft, top: hintPosition.arrowTop }
                  : "arrowBottom" in hintPosition
                    ? { left: hintPosition.arrowLeft, bottom: hintPosition.arrowBottom }
                    : undefined
              }
            />
          </>
        )}
      </nav>
    </>
  );
}
