import React from "react";
import { cities, commodities } from "./GameData";
import { valueOfCity, rewardValue, railroadTieValue } from "./Contract";

export function WoodAndSteelState({ ctx, G, moves, playerID }) {

  const styles = {
    page: {
      padding: '1rem',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      fontSize: '14px',
    },
    buttonBar: {
      display: 'flex',
      flexDirection: 'row',
      gap: '0.5rem',
      alignItems: 'center',
    },
    button: {
      height: '26px',
      textAlign: 'center',
      paddingLeft: '1rem',
      paddingRight: '1rem',
      alignItems: 'center',
    },
    contract: {
      base: {
        padding: '0.25rem 0.75rem',
        margin: '0rem',
        textAlign: 'left', 
        width: 'fit-content',
      },
      deleteButton: {
        fontSize: '120%', 
        backgroundColor: 'transparent', 
        border: 'none', 
        cursor: 'pointer',
      },
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
    },
    playerBoard: {
      display: "flex",
      gap: "1rem",
      margin: "0.5rem 0",
    },
  };

  function filteredContractsList(options={}) {
    const {
      type = "market",
      player = null,
    } = options;
  
    function compareContractsFn(a , b) {
      const aValue = (a.type === "private" ? 10 : 0) + (a.fulfilled ? 100 : 0);
      const bValue = (b.type === "private" ? 10 : 0) + (b.fulfilled ? 100 : 0);
      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
      else return 0;
    }

    let filteredContracts = G.contracts.filter(contract => contract.type === type);
    if (type === "private" && player) {
      filteredContracts = filteredContracts.filter(contract => contract.player === player);
    }

    return filteredContracts.toSorted(compareContractsFn).map((contract, index) => {
      let style = {
        ...styles.contract.base,
        ...styles.contract.fulfilled[contract.fulfilled], 
        ...styles.contract.type[contract.type], 
        ...(contract.player === ctx.currentPlayer || contract.type === "market" ? styles.contract.enabled : styles.contract.disabled)
      };
      const value = `$${rewardValue(contract)/1000}K + ${railroadTieValue(contract)} ${railroadTieValue(contract) > 1 ? "RR ties" : "RR tie"}`;

      return (<div key={index}>
        <button id={contract.id} style={style} name="toggleContractFulfilled">
          {contract.commodity} to {contract.destinationKey} ({value}) {contract.fulfilled ? " FULFILLED " : " "}
        </button>
        <button id={contract.id} style={styles.contract.deleteButton} name="deleteContract">✕</button>
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
    <div style={styles.playerBoard}>

      {G.players.map(([key, {name, activeCities}]) => {
        const contractsList = filteredContractsList({ type: "private", player: key })
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
        if (window.confirm("Toggle fulfillment for this contract?")) {
          moves.toggleContractFulfilled(e.nativeEvent.submitter.id);
        }
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
      <form style={styles.form} method="post" onSubmit={handleSubmit}>
        
        <div>
          <div style={{ backgroundColor: "#606060", padding: "0.75em", ...styles.buttonBar}}>
            <span style={{ color: "white" }}>Generate contract:</span>
            <button name="privateContract" style={styles.button}>Private</button>
            <button name="marketContract" style={styles.button}>Market</button>
            <button name="endTurn" style={{marginLeft: "1rem", ...styles.button}}>End Turn</button>
            <span style={{ color: "white", paddingLeft: "1.5rem", fontSize: "90%" }}>Starting city 1, city 2, or<br />Manual commodity, destination, type:</span>
            <input name="inputParameters" style={{width: "15rem", height: "20px"}} defaultValue="Jacksonville, Tallahassee" />
            <button name="startingContract" style={styles.button}>Starting</button>
            <button name="manualContract" style={styles.button}>Manual</button>
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
