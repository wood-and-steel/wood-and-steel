import React from "react";

// Independent Railroads Component
export function IndependentRailroads({ G }) {
  // Convert object to array for rendering
  const railroadsArray = Object.values(G.independentRailroads);
  
  return (
    <div>
      <div className="independentRailroads__title">Independent railroads</div>
      <div className="independentRailroads">
        {railroadsArray.map((railroad) =>
          <div key={railroad.name} className="independentRailroads__item">
            <button 
              name="acquireIndependentRailroad" 
              id={railroad.name} 
              className="button independentRailroads__button"
            >Acquire</button>
            <span className="independentRailroads__name">{railroad.name}</span>
            {railroad.routes.map((route, routeIndex) => (
              <span key={routeIndex} className="independentRailroads__route">• {route}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
