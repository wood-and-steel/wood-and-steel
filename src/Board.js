import React from "react";
import { cities } from "./GameData";
import { valueOfCity, rewardValue, railroadTieValue } from "./Contract";

export function WoodAndSteelState({ ctx, G, moves, playerID }) {

  const pageStyle = {
    padding: '1rem',
  };
  const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    fontSize: '14px',
  };
  const textBoxStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  };
  const buttonBarStyle = {
    display: 'flex',
    flexDirection: 'row',
    gap: '0.5rem',
    alignItems: 'center',
  };
  const buttonStyle = {
    height: '28px',
    textAlign: 'center',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    alignItems: 'center',
  };
  const contractStyle = {
    padding: '0.25rem 0.75rem',
    margin: '0rem',
    backgroundColor: '#f0f0f0',
    textAlign: 'left', 
    border: 'solid 1px rgba(0, 0, 0, 0.2)',
    cursor: 'pointer',
  };
  const cityTableStyle = {
    margin: '0.5rem 0rem', 
    display: 'flex', 
    flexDirection: 'column', 
    flexWrap: 'wrap',
    height: '280px',
  };
  const cityCellStyle = {
    display: 'flow',
    flex: '1 1',
    width: '115px',
    opacity: '0.8',
  };

  function compareContractsFn(a , b) {
    const aValue = (a.type === "private" ? 10 : 0) + (a.fulfilled ? 100 : 0);
    const bValue = (b.type === "private" ? 10 : 0) + (b.fulfilled ? 100 : 0);
    if (aValue < bValue) return -1;
    if (aValue > bValue) return 1;
    else return 0;
  }

  var contractsList = G.contracts.toSorted(compareContractsFn).map((contract, index) => 
    <div key={index}>
      <button id={contract.id} style={contractStyle} name="toggleContractFulfilled">
        <span style={{
          textDecoration: contract.fulfilled ? 'line-through' : 'none', 
          color: contract.type === "market" ? "blue" : "black",
        }}>
          {contract.commodity} to {contract.destinationKey} 
          {contract.type === "market" ? " (market) " : ` (private to ${G.players.find(([id, props]) => id === contract.player)[1].name}) `}
          ${`${rewardValue(contract)/1000}`}K + {railroadTieValue(contract)} {railroadTieValue(contract) > 1 ? "RR ties" : "RR tie"} 
        </span> 
        {contract.fulfilled ? " FULFILLED " : " "}
      </button>
      <button id={contract.id} style={{fontSize: '120%', backgroundColor: 'Window', border: 'none', cursor: 'pointer' }} name="deleteContract">
        ✕
      </button>
    </div>
  );

  const cityValues = [...cities].map(([key, ...rest]) =>
    <div key={key} style={cityCellStyle}>
      <span style={{opacity: '0.65', paddingRight: '0.4rem'}}>{key}</span> 
      <span style={{fontWeight: '600'}}>{valueOfCity(G, key)}</span>
    </div>
  );

  const playerBoard = 
    <div style={{
      display: "flex",
      gap: "1rem",
      marginBottom: "0.5rem",
    }}>
      {G.players.map(([key, {name, activeCities}]) => 
        <div style={{
          backgroundColor: (ctx.currentPlayer === key) ? "#f0f2ff" : "transparent",
          padding: "0.5rem",
          flexGrow: 1,
        }}>
          <div style={{
            fontWeight: (ctx.currentPlayer === key) ? "bold" : "400",
            marginBottom: "0.25rem",
          }}>{name}</div>
          {activeCities.map(city => <div>{city}</div>)}
        </div> 
      )}
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

  return (
    <div style={{display: (ctx.currentPlayer === playerID ? "block" : "none"), ...pageStyle}}>
      <form style={formStyle} method="post" onSubmit={handleSubmit}>
        
        <div>
          {playerBoard}
          <div style={{justifyContent: "center", borderBottom: "solid 1px silver", paddingTop: "0.5em", paddingBottom: "1em", ...buttonBarStyle}}>
            <button name="privateContract" style={buttonStyle}>Private</button>
            <button name="marketContract" style={buttonStyle}>Market</button>
            <button name="endTurn" style={{marginLeft: "2em", ...buttonStyle}}>End Turn</button>
          </div>
        </div>

        <div style={{display: "flex", paddingTop: "0.5em", paddingBottom: "1em", borderBottom: "solid 1px silver"}}>
          <label style={textBoxStyle}>
            <span><b>City 1, City 2</b> for Starting contracts<span style={{display: "none"}}>, or <b>destination, commodity, type</b> for Manual contracts</span>:</span>
            <input name="inputParameters" autoFocus={true} defaultValue="Jacksonville,Tallahassee" />
          </label>
          <div style={{paddingLeft: "2em", ...buttonBarStyle}}>
            <button name="startingContract" style={buttonStyle}>Starting</button>
            <button name="manualContract" style={{display: "none", ...buttonStyle}}>Manual</button>
          </div>
        </div>
        <div style={cityTableStyle}>{cityValues}</div>
        {contractsList}
      </form>
    </div>
  );
}
