import React from "react";
import { cities, commodities } from "./GameData";
import { valueOfCity, rewardValue, railroadTieValue } from "./Contract";

export function WoodAndSteelState({ ctx, G, moves, playerID }) {

  const contractStyles = {
    enabled: {
      backgroundColor: '#f0f0f0',
      border: 'solid 1px rgba(0, 0, 0, 0.2)',
      cursor: 'pointer',
    },
    disabled: {
      backgroundColor: 'transparent',
      border: 'solid 1px rgba(0, 0, 0, 0.2)',
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

  function filteredContractsList(options={}) {
    const {
      type = "market",
      playerID = null,
    } = options;
  
    function compareContractsFn(a , b) {
      const aValue = (a.type === "market" ? 10 : 0) + (a.fulfilled ? 100 : 0);
      const bValue = (b.type === "market" ? 10 : 0) + (b.fulfilled ? 100 : 0);
      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
      else return 0;
    }

    // Open market contracts are listed in a common area, fulfilled ones with the rest of that player's contracts
    const filteredContracts = (
      type === "market" ?
      G.contracts.filter(contract => contract.type === "market" && !contract.fulfilled) :
      G.contracts.filter(contract => contract.playerID === playerID)
    );

    return filteredContracts.toSorted(compareContractsFn).map((contract, index) => {
      let style = {
        ...contractStyles.fulfilled[contract.fulfilled], 
        ...contractStyles.type[contract.type], 
        ...(
          contract.playerID === ctx.currentPlayer || (contract.type === "market" && (!contract.fulfilled || contract.playerID === ctx.currentPlayer)) ? 
          contractStyles.enabled : 
          contractStyles.disabled
        )
      };
      const value = `$${rewardValue(contract)/1000}K + ${railroadTieValue(contract)} ${railroadTieValue(contract) > 1 ? "RR ties" : "RR tie"}`;

      return (<div key={index}>
        <button className="contract" id={contract.id} style={style} name="toggleContractFulfilled">
          {contract.commodity} to {contract.destinationKey} ({value})
        </button>
        <button className="deleteButton" id={contract.id} style={{display: contract.fulfilled ? "none" : "inline"}} name="deleteContract">✕</button>
      </div>);
    });
  }

  const cityValues = [...cities].map(([key, value]) =>
    <div key={key} className="cityCell">
      <span 
        style={{opacity: '0.65', paddingRight: '0.4rem', cursor: 'default'}} 
        title={value.commodities.length === 0 ? "(no commodities)" : value.commodities.toString().replaceAll(',', ", ")}
      >
        {key}
      </span> 
      <span style={{fontWeight: '600'}}>{valueOfCity(G, key)}</span>
    </div>
  );

  const commodityList = [...commodities].map(([key, value]) =>
    <div key={key}>{key} <span style={{opacity: "0.6"}}>• {value.cities.toString().replaceAll(',', ", ")}</span></div>
  );

  const playerBoard = 
    <div className="playerBoard">
      {G.players.map(([key, {name, activeCities}]) => {
        const contractsList = filteredContractsList({ type: "private", playerID: key })
        return (<div style={{flexGrow: 1}}>
          <div style={{
            backgroundColor: (ctx.currentPlayer === key) ? "#f0f2ff" : "transparent",
            padding: "0.5rem",
          }}>
            <div style={{
              fontWeight: (ctx.currentPlayer === key) ? "bold" : "400",
              marginBottom: "0.25rem",
            }}>
              {name}
            </div>
            {activeCities.map(city => <div>{city}</div>)}
          </div>
          <div style={{display: "flex", flexDirection: "column", gap: "0.25em", paddingTop: "0.5em"}}>
            {contractsList}
          </div>
        </div>);
      })}

    </div>;

  function handleSubmit(e) {
    // Prevent the browser from reloading the page
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const inputParameters = Object.fromEntries(formData.entries()).inputParameters.split(',').map(i => i.trim());

    switch (e.nativeEvent.submitter.name) {
      case "startingContract":
        moves.generateStartingContract(inputParameters);
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
        if (window.confirm("Delete this contract?")) {
          moves.deleteContract(e.nativeEvent.submitter.id);
        }
        break;
      case "endTurn":
        moves.endTurn();
        break;
      default:
      }
  }

  const marketContractsList = filteredContractsList();

  return (
    <div className="boardPage" style={{display: (ctx.currentPlayer === playerID ? "block" : "none")}}>
      <form className="form" method="post" onSubmit={handleSubmit}>
        
        <div>
          <div className="buttonBar" style={{ backgroundColor: "#606060", padding: "0.75em"}}>
            <span style={{ color: "white" }}>Generate contract:</span>
            <button name="privateContract" className="button">Private</button>
            <button name="marketContract" className="button">Market</button>
            <button name="endTurn" className="button" style={{marginLeft: "1rem"}}>End Turn</button>
            <span style={{ color: "white", paddingLeft: "1.5rem", fontSize: "90%" }}>Starting city 1, city 2, or<br />Manual commodity, destination, type:</span>
            <input name="inputParameters" style={{width: "15rem", height: "20px"}} />
            <button name="startingContract" className="button">Starting</button>
            <button name="manualContract" className="button">Manual</button>
          </div>
          {playerBoard}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", margin: "auto", padding: "0.5rem"} }>
          <div style={{fontWeight: "bold", width: "18rem", paddingBottom: "0.25rem"}}>Market contracts</div>
          {marketContractsList}
        </div>
        <div className="cityTable">{cityValues}</div>
        <div className="cityTable">{commodityList}</div>
      </form>
    </div>
  );
}
