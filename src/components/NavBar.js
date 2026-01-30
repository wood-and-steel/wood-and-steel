import React from "react";
import placeholderIcon from "../shared/assets/images/placeholder-icon.svg";
import hamburgerIcon from "../shared/assets/images/hamburger-icon.svg";
import { PopupMenu, PopupMenuItem } from "./PopupMenu";

function useIsDesktop() {
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

/**
 * Navigation bar component with responsive design. Shows tabs for different views on desktop and mobile,
 * and includes a hamburger menu for game management actions.
 * 
 * @component
 * @param {object} props
 * @param {string} props.input - Search input value (currently unused but kept for compatibility).
 * @param {function} props.setInput - Setter for search input (currently unused but kept for compatibility).
 * @param {boolean} props.startingContractExists - Whether starting contract exists (currently unused but kept for compatibility).
 * @param {'setup'|'play'|'scoring'} props.currentPhase - The current game phase.
 * @param {object} props.G - The game state object.
 * @param {object} props.gameManager - Game manager instance with currentGameCode property.
 * @param {function} props.onNavigateToLobby - Called when user wants to navigate to the lobby.
 * @param {function} props.onOpenEditPlaytest - Called when user wants to open the edit playtest dialog.
 * @param {'board'|'commodities'|'indies'|'cities'} props.activeTab - The currently active tab ID.
 * @param {function} props.onTabChange - Called when a tab is clicked. Receives the tab ID.
 * 
 * @example
 * <NavBar
 *   input={searchInput}
 *   setInput={setSearchInput}
 *   startingContractExists={true}
 *   currentPhase="play"
 *   G={G}
 *   gameManager={gameManager}
 *   onNavigateToLobby={() => navigateToLobby()}
 *   onOpenEditPlaytest={() => openEditDialog()}
 *   activeTab="board"
 *   onTabChange={(tabId) => setActiveTab(tabId)}
 * />
 */
export function NavBar({ input, setInput, startingContractExists, currentPhase, G, gameManager, onNavigateToLobby, onOpenEditPlaytest, activeTab, onTabChange, showRailroadHint, onDismissHint }) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const menuButtonRef = React.useRef(null);
  const menuButtonDesktopRef = React.useRef(null);
  const contractsTabRef = React.useRef(null);
  const contractsTabMobileRef = React.useRef(null);
  const [hintPosition, setHintPosition] = React.useState(null);
  const isDesktop = useIsDesktop();

  // Calculate hint callout position based on Contracts tab location
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
        // Desktop: callout below nav, arrow points up at tab bottom
        // Position content so arrow appears to come from its center-ish area
        const contentLeft = Math.max(8, tabCenterX - 80); // 80px offset so arrow is near left side of bubble
        setHintPosition({
          contentTop: rect.bottom + 12, // content starts 12px below the tab (8px gap + 4px for arrow)
          contentLeft: contentLeft,
          arrowLeft: tabCenterX,
          arrowTop: rect.bottom + 4, // arrow tip 4px below the tab
        });
      } else {
        // Mobile/Tablet: callout above nav, arrow points down at tab top
        setHintPosition({
          contentBottom: window.innerHeight - rect.top + 12, // content starts 12px above the tab
          arrowLeft: tabCenterX,
          arrowBottom: window.innerHeight - rect.top + 4, // arrow tip 4px above the tab
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [showRailroadHint, isDesktop]);

  // Dismiss hint on click anywhere or Escape key
  React.useEffect(() => {
    if (!showRailroadHint || !onDismissHint) return;

    const handleClick = () => {
      onDismissHint();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onDismissHint();
      }
    };

    // Use a small delay to avoid immediately dismissing on the same click that might have triggered the hint
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleKeyDown);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showRailroadHint, onDismissHint]);

  const placement = React.useMemo(
    () => (isDesktop ? { side: "bottom", align: "start" } : { side: "top", align: "end" }),
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
    (action) => {
      if (action === "lobby") onNavigateToLobby();
      else if (action === "edit") onOpenEditPlaytest();
      setIsMenuOpen(false);
    },
    [onNavigateToLobby, onOpenEditPlaytest]
  );

  const tabs = [
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
        onClick={() => setIsMenuOpen((o) => !o)}
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

      {/* Main nav bar */}
      <nav className="navBar">
        {/* Desktop: Menu button in left edge */}
        <button
          type="button"
          className="navBar__menuButton--desktop"
          ref={menuButtonDesktopRef}
          onClick={() => setIsMenuOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          <img src={hamburgerIcon} alt="" className="navBar__menuIcon" />
        </button>

        {/* Desktop: Centered tabs with icons */}
        <div className="navBar__tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              ref={tab.id === 'board' ? contractsTabRef : null}
              type="button"
              className={`navBar__tab ${activeTab === tab.id ? 'navBar__tab--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <img src={placeholderIcon} alt="" className="navBar__tabIcon" />
              <span className="navBar__tabLabel">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Mobile/Tablet: Bottom nav with icons and labels */}
        <div className="navBar__tabs--mobile">
          {tabs.map(tab => (
            <button
              key={tab.id}
              ref={tab.id === 'board' ? contractsTabMobileRef : null}
              type="button"
              className={`navBar__tab--mobile ${activeTab === tab.id ? 'navBar__tab--mobile--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <img src={placeholderIcon} alt="" className="navBar__tabIcon--mobile" />
              <span className="navBar__tabLabel--mobile">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Railroad hint callout - shown when transitioning from setup to play */}
        {showRailroadHint && hintPosition && (
          <>
            <div 
              className={`navBar__hintCallout ${isDesktop ? 'navBar__hintCallout--desktop' : ''}`}
              style={isDesktop 
                ? { top: hintPosition.contentTop, left: hintPosition.contentLeft } 
                : { bottom: hintPosition.contentBottom }
              }
            >
              <div className="navBar__hintCallout__content">
                Mark the independent railroads on your map, then switch to Contracts to start taking turns.
              </div>
            </div>
            <div 
              className={`navBar__hintCallout__arrow ${isDesktop ? 'navBar__hintCallout__arrow--desktop' : ''}`}
              style={isDesktop
                ? { left: hintPosition.arrowLeft, top: hintPosition.arrowTop }
                : { left: hintPosition.arrowLeft, bottom: hintPosition.arrowBottom }
              }
            />
          </>
        )}
      </nav>
    </>
  );
}
