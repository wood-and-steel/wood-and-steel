import React from "react";

// Game List Dialog Component
export function GameListDialog({ gameManager, onClose }) {
  const games = gameManager.onListGames();
  const currentCode = gameManager.currentGameCode;
  const [showSwitchDialog, setShowSwitchDialog] = React.useState(false);
  const [switchCode, setSwitchCode] = React.useState('');
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleteCode, setDeleteCode] = React.useState('');

  const handleNewGame = () => {
    if (window.confirm("Are you sure you want to start a new game? All progress will be lost.")) {
      gameManager.onNewGame();
    }
  };
  
  const handleSwitchGame = () => {
    if (gameManager && switchCode) {
      const normalized = gameManager.normalizeGameCode(switchCode);
      if (gameManager.isValidGameCode(normalized)) {
        gameManager.onSwitchGame(normalized);
      } else {
        alert('Please enter a valid 4-letter game code.');
      }
    }
    setShowSwitchDialog(false);
  };

  const handleCancelSwitch = () => {
    setShowSwitchDialog(false);
    setSwitchCode('');
  };

  const handleDeleteGame = () => {
    if (gameManager && deleteCode) {
      const normalized = gameManager.normalizeGameCode(deleteCode);
      if (gameManager.isValidGameCode(normalized)) {
        if (window.confirm(`Are you sure you want to delete game "${normalized}"?`)) {
          if (gameManager.onDeleteGame(normalized)) {
            alert(`Game "${normalized}" deleted successfully.`);
          } else {
            alert(`Failed to delete game "${normalized}".`);
          }
        }
      } else {
        alert('Please enter a valid 4-letter game code.');
      }
    }
    setShowDeleteDialog(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setDeleteCode('');
  };

  return (
    <>
      <div className="modal">
        <div className="modal__content">
          <h2 className="modal__title">All Games</h2>
          {games.length === 0 ? (
            <p>No games found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr className="table__header">
                  <th className="table__headerCell">Code</th>
                  <th className="table__headerCell">Phase</th>
                  <th className="table__headerCell">Turn</th>
                </tr>
              </thead>
              <tbody>
                {games.map(game => (
                  <tr 
                    key={game.code} 
                    className={`table__row ${game.code === currentCode ? 'table__row--current' : ''}`}
                  >
                    <td className={`table__cell ${game.code === currentCode ? 'table__cell--bold' : ''}`}>
                      {game.code}
                      {game.code === currentCode && ' (current)'}
                    </td>
                    <td className="table__cell">{game.phase}</td>
                    <td className="table__cell">{game.turn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="modal__actions">
            <button 
              onClick={handleNewGame}
              className="button"
            >
              New Game
            </button>
            <button 
              onClick={() => setShowSwitchDialog(true)}
              className="button"
            >
              Switch Game
            </button>
            <button 
              onClick={() => setShowDeleteDialog(true)}
              className="button"
            >
              Delete Game
            </button>
            <button 
              onClick={onClose}
              className="button button--auto-margin"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      
      {showSwitchDialog && (
        <GameSwitchDialog 
          switchCode={switchCode} 
          setSwitchCode={setSwitchCode} 
          onSwitch={handleSwitchGame} 
          onCancel={handleCancelSwitch} 
        />
      )}
      
      {showDeleteDialog && (
        <GameDeleteDialog 
          deleteCode={deleteCode} 
          setDeleteCode={setDeleteCode} 
          onDelete={handleDeleteGame} 
          onCancel={handleCancelDelete} 
        />
      )}
    </>
  );
}

// Game Switch Dialog Component
function GameSwitchDialog({ switchCode, setSwitchCode, onSwitch, onCancel }) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && switchCode && switchCode.length === 4) {
      onSwitch();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal modal--nested">
      <div className="modal__content modal__content--small">
        <h2 className="modal__title">Switch Game</h2>
        <p>Enter the 4-letter code of the game you want to switch to:</p>
        <input
          type="text"
          value={switchCode}
          onChange={e => setSwitchCode(e.target.value.toUpperCase())}
          onKeyDown={handleKeyPress}
          placeholder="ABCD"
          maxLength={4}
          className="modal__input"
          autoFocus
        />
        <div className="modal__actions modal__actions--end">
          <button 
            type="button"
            onClick={onCancel}
            className="button"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={onSwitch}
            className="button"
            disabled={!switchCode || switchCode.length !== 4}
          >
            Switch
          </button>
        </div>
      </div>
    </div>
  );
}

// Game Delete Dialog Component
function GameDeleteDialog({ deleteCode, setDeleteCode, onDelete, onCancel }) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && deleteCode && deleteCode.length === 4) {
      onDelete();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal modal--nested">
      <div className="modal__content modal__content--small">
        <h2 className="modal__title">Delete Game</h2>
        <p>Enter the 4-letter code of the game you want to delete:</p>
        <input
          type="text"
          value={deleteCode}
          onChange={e => setDeleteCode(e.target.value.toUpperCase())}
          onKeyDown={handleKeyPress}
          placeholder="ABCD"
          maxLength={4}
          className="modal__input"
          autoFocus
        />
        <div className="modal__actions modal__actions--end">
          <button 
            type="button"
            onClick={onCancel}
            className="button"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={onDelete}
            className="button button--danger"
            disabled={!deleteCode || deleteCode.length !== 4}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
