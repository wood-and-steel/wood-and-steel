import React from "react";
import { useGame } from "../hooks/useGame";

// Independent Railroads Page Component
export function IndependentRailroadsPage() {
  const { G } = useGame();
  
  // Convert object to array for rendering
  const railroadsArray = Object.values(G.independentRailroads);
  
  return (
    <div className="pageContent">
      <div>
        <div className="independentRailroads">
          {railroadsArray.map((railroad) =>
            <div key={railroad.name} className="independentRailroads__item">
              <div className="independentRailroads__name">{railroad.name}</div>
              {railroad.routes.map((route, routeIndex) => (
                <div key={routeIndex} className="independentRailroads__route">{route}</div>
              ))}
              <button 
                name="acquireIndependentRailroad" 
                id={railroad.name} 
                className="button independentRailroads__button"
              >Acquire</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
