import React from "react";
import { cities, commodities } from "./GameData";
import { valueOfCity, rewardValue, railroadTieValue } from "./Contract";

// Style constants
const contractStyles = {
  enabled: {
    cursor: 'pointer',
  },
  disabled: {
    cursor: 'default',
    opacity: '0.6',
  },
  fulfilled: {
    true: { textDecoration: 'line-through' },
    false: { textDecoration: 'none' },
  },
  type: {
    market: { color: 'blue' },
    private: { color: 'black' },
  }
};

const buttonStyles = {
  disabled: {
    color: "#a0a0a0",
    border: "solid 1px #c0c0c0",
    backgroundColor: "white",
  }
};

// Helper functions
function formatCommodityList(items) {
  return items.toString().replaceAll(',', ', ');
}

function getContractValue(contract) {
  const ties = railroadTieValue(contract);
  return `$${rewardValue(contract)/1000}K + ${ties} ${ties > 1 ? "RR ties" : "RR tie"}`;
}

function isContractEnabled(contract, ctx) {
  return contract.playerID === ctx.currentPlayer || 
         (contract.type === "market" && (!contract.fulfilled || contract.playerID === ctx.currentPlayer));
}

// Contract Component
function Contract({ contract, ctx, onToggle, onDelete }) {
  const style = {
    ...contractStyles.fulfilled[contract.fulfilled], 
    ...contractStyles.type[contract.type], 
    ...(isContractEnabled(contract, ctx) ? contractStyles.enabled : contractStyles.disabled)
  };
  
  const value = getContractValue(contract);

  return (
    <div>
      <button 
        className="contract" 
        id={contract.id} 
        style={style} 
        name="toggleContractFulfilled"
        onClick={onToggle}
      >
        {contract.commodity} to {contract.destinationKey} ({value})
      </button>
      <button 
        className="deleteButton" 
        id={contract.id} 
        style={{display: contract.fulfilled ? "none" : "inline"}} 
        name="deleteContract"
        onClick={onDelete}
      >✕</button>
    </div>
  );
}

// Contracts List Component
function ContractsList({ G, ctx, type = "market", playerID = null }) {
  function compareContractsFn(a, b) {
    const aValue = (a.type === "market" ? 10 : 0) + (a.fulfilled ? 100 : 0);
    const bValue = (b.type === "market" ? 10 : 0) + (b.fulfilled ? 100 : 0);
    if (aValue < bValue) return -1;
    if (aValue > bValue) return 1;
    return 0;
  }

  const filteredContracts = (
    type === "market" ?
    G.contracts.filter(contract => contract.type === "market" && !contract.fulfilled) :
    G.contracts.filter(contract => contract.playerID === playerID)
  );

  return filteredContracts.toSorted(compareContractsFn).map((contract, index) => (
    <Contract key={index} contract={contract} ctx={ctx} />
  ));
}

// Player Board Component
function PlayerBoard({ G, ctx, startingContractExists }) {
  return (
    <div className="playerBoard">
      {G.players.map(([key, {name, activeCities}]) => {
        const activePlayerBoard = ctx.currentPlayer === key;
        
        return (
          <div key={key} style={{flexGrow: 1}}>
            <div style={{
              backgroundColor: activePlayerBoard ? "#f0f2ff" : "transparent",
              padding: "0.5rem",
            }}>
              <div style={{
                fontWeight: activePlayerBoard ? "bold" : "400",
                marginBottom: "0.25rem",
              }}>
                {name}
              </div>
              {activeCities.map((city, index) => <div key={index}>{city}</div>)}
            </div>
            <div style={{display: "flex", flexDirection: "column", gap: "0.25em", paddingTop: "0.5em"}}>
              <button 
                name="privateContract" 
                className="button"
                style={{ 
                  ...( activePlayerBoard ? {} : buttonStyles.disabled ),
                  display: startingContractExists ? "block" : "none" 
                }}
              >Generate Private Contract</button>
              <ContractsList G={G} ctx={ctx} type="private" playerID={key} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Market Contracts Component
function MarketContracts({ G, ctx }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", margin: "auto", padding: "0.5rem" }}>
      <div style={{fontWeight: "bold", width: "18rem", paddingBottom: "0.25rem"}}>Market contracts</div>
      <button name="marketContract" className="button">Generate Market Contract</button>
      <ContractsList G={G} ctx={ctx} type="market" />
    </div>
  );
}

// Independent Railroads Component
function IndependentRailroads({ G }) {
  return (
    <div>
      <div style={{fontWeight: "bold", paddingBottom: "0.5rem"}}>Independent railroads</div>
      <div className="independentRailroads">
        {G.independentRailroads.map((railroad, index) =>
          <div key={index} style={{marginBottom: "0.1rem"}}>
            <button 
              name="acquireIndependentRailroad" 
              id={index} 
              className="button" 
              style={{marginRight: "0.5rem"}}
            >Acquire</button>
            <span style={{opacity: "0.6"}}>{railroad.name}</span>
            {railroad.routes.map((route, routeIndex) => (
              <span key={routeIndex} style={{marginLeft: "0.3rem"}}>• {route}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Reference Tables Component
function ReferenceTables({ G }) {
  const cityValues = [...cities].map(([key, value]) =>
    <div key={key} className="cityCell">
      <span 
        style={{opacity: '0.65', paddingRight: '0.4rem', cursor: 'default'}} 
        title={value.commodities.length === 0 ? "(no commodities)" : formatCommodityList(value.commodities)}
      >
        {key}
      </span> 
      <span style={{fontWeight: '600'}}>{valueOfCity(G, key)}</span>
    </div>
  );

  const commodityList = [...commodities].map(([key, value]) =>
    <div key={key}>{key} <span style={{opacity: "0.6"}}>• {formatCommodityList(value.cities)}</span></div>
  );

  return (
    <>
      <div>
        <div style={{fontWeight: "bold", paddingTop: "1rem"}}>Commodities</div>
        <div className="referenceTable commodityTable">{commodityList}</div>
      </div>
      <div>
        <div style={{fontWeight: "bold"}}>Cities</div>
        <div className="referenceTable cityTable">{cityValues}</div>
      </div>
    </>
  );
}

// Top Button Bar Component
function TopButtonBar({ input, setInput, cityInput, setCityInput, startingContractExists }) {
  return (
    <div className="buttonBar" style={{ backgroundColor: "#606060", padding: "0.75em", position: "fixed", top: "0", left: "0", right: "0"}}>
      <button name="endTurn" className="button" style={{marginLeft: "1rem"}}>End Turn</button>

      <div style={{ display: "inline" }}>
        <span style={{ 
          color: "white", paddingLeft: "1.5rem", fontSize: "90%",
          display: startingContractExists ? "none" : "block",
        }}>
          <b>Starting</b> city 1, city 2, or<br />
        </span>
        <span style={{ color: "white", paddingLeft: "1.5rem", fontSize: "90%" }}>
          <b>Manual</b> commodity, destination, type:
        </span>
      </div>
      <input 
        value={input}
        onChange={e => setInput(e.target.value)}
        name="inputParameters" 
        style={{width: "15rem", height: "20px"}} 
      />
      <button 
        name="startingContract" 
        className="button"
        style={{ display: startingContractExists ? "none" : "block" }}
      >Starting</button>
      <button name="manualContract" className="button">Manual Contract</button>

      <div style={{ display: "inline" }}>
        <span style={{ color: "white", paddingLeft: " 1.5rem", fontSize: "90%" }}><b>Cities:</b></span>
        <input 
          value={cityInput}
          onChange={e => setCityInput(e.target.value)}
          name="cityList" 
          style={{width: "8rem", height: "20px", margin: "0 0.5rem"}} 
        />
        <button name="addCities" className="button">Add Cities</button>
      </div>
    </div>
  );
}

// Main Component
export function WoodAndSteelState({ ctx, G, moves, playerID }) {
  // React hooks must be at the top of the component
  const [input, setInput] = React.useState('');
  const [cityInput, setCityInput] = React.useState('');

  const startingContractExists = G.contracts.filter(contract => contract.playerID === playerID).length > 0;

  function handleSubmit(e) {
    // Prevent the browser from reloading the page
    e.preventDefault();

    const inputParameters = input.split(',').map(i => i.trim());

    switch (e.nativeEvent.submitter.name) {
      case "startingContract":
        moves.generateStartingContract(inputParameters);
        setInput("");
        break;
      case "privateContract":
        moves.generatePrivateContract();
        break;
      case "marketContract":
        moves.generateMarketContract();
        break;
      case "manualContract":
        moves.addManualContract(inputParameters[0], inputParameters[1], inputParameters[2]);
        break;
      case "toggleContractFulfilled":
        moves.toggleContractFulfilled(e.nativeEvent.submitter.id);
        break;
      case "deleteContract":
        const contractIndex = G.contracts.findIndex(c => c.id === e.nativeEvent.submitter.id);
        const contract = G.contracts[contractIndex];
        if (window.confirm(`Delete "${contract.commodity} to ${contract.destinationKey}?"`)) {
            setInput(`${contract.commodity}, ${contract.destinationKey}, ${contract.type}`); 
            moves.deleteContract(e.nativeEvent.submitter.id);
        }
        break;
      case "acquireIndependentRailroad":
        const railroadIndex = e.nativeEvent.submitter.id;
        const railroad = G.independentRailroads[railroadIndex];
        if (railroad && window.confirm(`Is the current player buying ${railroad.name}?`)) {
          moves.acquireIndependentRailroad(railroadIndex);
        }
        break;
      case "endTurn":
        moves.endTurn();
        break;
      default:
        break;
    }
  }

  return (
    <div className="boardPage" style={{display: (ctx.currentPlayer === playerID ? "block" : "none")}}>
      <form className="form" method="post" onSubmit={handleSubmit}>
        <div>
          <TopButtonBar 
            input={input} 
            setInput={setInput} 
            cityInput={cityInput} 
            setCityInput={setCityInput}
            startingContractExists={startingContractExists}
          />
          <PlayerBoard G={G} ctx={ctx} startingContractExists={startingContractExists} />
        </div>
        <MarketContracts G={G} ctx={ctx} />
        <IndependentRailroads G={G} />
        <ReferenceTables G={G} />
      </form>
    </div>
  );
}
