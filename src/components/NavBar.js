import React from "react";
import placeholderIcon from "../shared/assets/images/placeholder-icon.svg";
import hamburgerIcon from "../shared/assets/images/hamburger-icon.svg";

// Nav Bar Component
export function NavBar({ input, setInput, startingContractExists, currentPhase, G, gameManager, onNavigateToLobby, onOpenEditPlaytest, activeTab, onTabChange }) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  const menuButtonRef = React.useRef(null);
  const menuButtonDesktopRef = React.useRef(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event) {
      const target = event.target;
      const isMenuClick = menuRef.current?.contains(target);
      const isMenuButtonClick = menuButtonRef.current?.contains(target) || menuButtonDesktopRef.current?.contains(target);
      
      if (isMenuOpen && !isMenuClick && !isMenuButtonClick) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMenuOpen]);

  // Handle copying game code to clipboard
  const handleCopyGameCode = React.useCallback(async () => {
    if (gameManager?.currentGameCode) {
      try {
        await navigator.clipboard.writeText(gameManager.currentGameCode);
        setIsMenuOpen(false);
      } catch (err) {
        console.error('Failed to copy game code:', err);
      }
    }
  }, [gameManager]);

  // Handle menu item clicks
  const handleMenuClick = React.useCallback((action) => {
    if (action === 'lobby') {
      onNavigateToLobby();
    } else if (action === 'edit') {
      onOpenEditPlaytest();
    }
    setIsMenuOpen(false);
  }, [onNavigateToLobby, onOpenEditPlaytest]);

  const tabs = [
    { id: 'board', label: 'Board' },
    { id: 'commodities', label: 'Commodities' },
    { id: 'cities', label: 'Cities' },
    { id: 'indies', label: 'Indies' }
  ];

  return (
    <>
      {/* Menu button - floating on mobile/tablet, in nav bar on desktop */}
      <button
        type="button"
        className="navBar__menuButton"
        ref={menuButtonRef}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Menu"
      >
        <img src={hamburgerIcon} alt="" className="navBar__menuIcon" />
      </button>

      {/* Menu dropdown */}
      {isMenuOpen && (
        <div className="navBar__menu" ref={menuRef}>
          <button
            type="button"
            className="navBar__menuItem"
            onClick={() => handleMenuClick('lobby')}
          >
            Lobby
          </button>
          {gameManager?.currentGameCode && (
            <button
              type="button"
              className="navBar__menuItem"
              onClick={handleCopyGameCode}
            >
              Copy Game Code ({gameManager.currentGameCode})
            </button>
          )}
          <button
            type="button"
            className="navBar__menuItem"
            onClick={() => handleMenuClick('edit')}
          >
            Edit Playtest
          </button>
        </div>
      )}

      {/* Main nav bar */}
      <nav className="navBar">
        {/* Desktop: Menu button in left edge */}
        <button
          type="button"
          className="navBar__menuButton--desktop"
          ref={menuButtonDesktopRef}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Menu"
        >
          <img src={hamburgerIcon} alt="" className="navBar__menuIcon" />
        </button>

        {/* Desktop: Centered tabs with icons */}
        <div className="navBar__tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
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
              type="button"
              className={`navBar__tab--mobile ${activeTab === tab.id ? 'navBar__tab--mobile--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <img src={placeholderIcon} alt="" className="navBar__tabIcon--mobile" />
              <span className="navBar__tabLabel--mobile">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
