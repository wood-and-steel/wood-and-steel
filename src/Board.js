import React from "react";
import { cities } from "./GameData";
import { valueOfCity, rewardValue } from "./Contract";

export function WoodAndSteelState({ ctx, G, moves }) {

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

  const contractsList = G.contracts.map((contract, index) => 
    <div>
      <button id={index} style={contractStyle} name="toggleContractFulfilled">
        <span style={contract.fulfilled ? {textDecoration: 'line-through'} : null}>
          {contract.commodity} to {contract.destinationKey} ({contract.type})
        </span> 
        {contract.fulfilled ? " FULFILLED " : " "}
        ${`${rewardValue(contract)/1000}`}K
      </button>
      <button id={index} style={{fontSize: '120%', backgroundColor: 'Window', border: 'none', cursor: 'pointer' }} name="deleteContract">
        ✕
      </button>
    </div>
  );

  const cityValues = [...cities].map(([key, ...rest]) =>
    <div style={{width: '140px', display: 'inline-block', opacity: '0.8'}}>
      <span style={{opacity: '0.65', paddingRight: '0.4rem'}}>{key}</span> 
      <span style={{fontWeight: '600'}}>{valueOfCity(G, key)}</span>
    </div>
  );

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
        moves.generatePrivateContract(inputParameters, inputParameters[0]);
        break;
      case "marketContract":
        moves.generateMarketContract(inputParameters);
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
        default:
      }
  }

  return (
    <div style={pageStyle}>
      <form style={formStyle} method="post" onSubmit={handleSubmit}>
        <label style={textBoxStyle}>
          <span>Active cities, or <em>destination, commodity, type</em> for manual contracts:</span>
          <input name="inputParameters" autoFocus={true} defaultValue="Jacksonville,Tallahassee" />
        </label>
        <div style={buttonBarStyle}>
          <span style={{alignSelf: 'center'}}>Generate a contract:</span>
          <button name="startingContract" style={buttonStyle}>Starting</button>
          <button name="privateContract" style={buttonStyle}>Private</button>
          <button name="marketContract" style={buttonStyle}>Market</button>
          <button name="manualContract" style={{marginLeft: '2rem', ...buttonStyle}}>Add Manual</button>
        </div>
        <div>
          <div><span style={{fontWeight: 600}}>Private</span>: First listed city should be the one with the latest delivery completed.</div>
        </div>
        <div style={{margin: '0.5rem 0rem', flexDirection: 'column'}}>{cityValues}</div>
      {contractsList}
      </form>
    </div>
  );
}
