import { cities, routes } from "./GameData";
import { citiesConnectedTo } from "./graph";
import { weightedRandom, randomArrayItem } from "./utils";

/**
 * Independent railroad company
 *
 * @class RailroadCompany
 * @typedef {RailroadCompany}
 * @property {string} name - name of the company
 * @property {Set<string>} routes - keys of routes held by the company
 */
class RailroadCompany {
  constructor(name) {
    this.name = name;
    this.routes = new Set();
  }

  /**
   * Adds a route to the railroad network if it's valid
   * @param {string} routeKey - key of the route (e.g., "Albany-Boston")
   * @returns {boolean} - hether the route was successfully added
   */
  addRoute(routeKey) {
    // If this is our first route, we can always add it
    if (this.routes.size === 0) {
      this.routes.add(routeKey);
      return true;
    }

    // Check if the route connects to our existing network
    const [city1, city2] = routes.get(routeKey).cities;
    const isConnected = this.cities.has(city1) || this.cities.has(city2);

    if (!isConnected) {
      return false;
    }

    // Add the route and its cities
    this.routes.add(routeKey);
    return true;
  }


  /**
   * Checks if adding a route is possible by making sure it shares one city with the exsiting network
   * @param {string} routeKey - The key of the route
   * @returns {boolean} - Whether the route can be added
   */
  canAddRoute(routeKey) {
    if (this.routes.size === 0) return true;
    
    const [city1, city2] = routes.get(routeKey).cities;
    return this.cities.has(city1) || this.cities.has(city2);
  }


  /**
   * Gets all cities in this company's railway network
   * @returns {Set<string>} - Set of city keys
   */
  getCities() {
    const cities = new Set();

    [...this.routes].forEach(routeKey => {
      const [city1, city2] = routes.get(routeKey).cities;
      cities.add(city1).add(city2);
    });

    return cities;
  }

  /**
   * Gets all routes in the network
   * @returns {Set<string>} - Set of route keys
   */
  getRoutes() {
    return new Set(this.routes);
  }
}


export class RailroadManager {
  constructor() {
    this.companies = new Map();
    this.routeOwnership = new Map();
    this.cityOwnership = new Map(); // Tracks which company owns each city
  }

  /**
   * Creates a new railroad company
   * @param {string} name - Name of the company
   * @returns {boolean} - Whether company was successfully created
   */
  createCompany(name) {
    if (this.getCompany(name)) {
      return false;
    }
    this.companies.set(name, new RailroadCompany(name));
    return true;
  }

  
  /**
   * Deletes a railroad company if one with the given name exists
   * @param {string} name - name of company to delete
   * @returns {boolean} - whether the company was deleted
   */
  deleteCompany(name) {
    return this.companies.delete(name);
  }

  
  /**
   * Checks if any city in a route is owned by another company
   * @param {string} companyName - name of the company trying to claim the route
   * @param {Array<string>} cities - keys of cities in the route
   * @returns {boolean} - whether any city is owned by another company
   */
  isCityOwnedByOther(companyName, cityKeys) {
    return cityKeys.some(cityKey => {
      const owner = this.cityOwnership.get(cityKey);
      return owner && owner !== companyName;
    });
  }


  /**
   * Claims cities for a company
   * @param {string} companyName - Name of the company
   * @param {Array<string>} cities - Array of cities to claim
   */
  claimCities(companyName, cities) {
    cities.forEach(city => {
      if (!this.cityOwnership.has(city)) {
        this.cityOwnership.set(city, companyName);
      }
    });
  }


  /**
   * Assigns a route to a company
   * @param {string} companyName - Name of the company
   * @param {string} routeKey - The route key
   * @returns {boolean} - Whether route was successfully assigned
   */
  assignRoute(companyName, routeKey) {
    // Check if company exists
    const company = this.companies.get(companyName);
    if (!company) return false;

    // Check if route is already owned
    if (this.routeOwnership.has(routeKey)) return false;

    // Check if any cities in the route are owned by other companies
    if (this.isCityOwnedByOther(companyName, routes.get(routeKey).cities)) return false;

    // Try to add route to company
    if (!company.addRoute(routeKey)) return false;

    // If successful, record ownership of route and cities
    this.routeOwnership.set(routeKey, companyName);
    this.claimCities(companyName, routes.get(routeKey).cities);
    return true;
  }


  /**
   * Gets the company that owns a specific route
   * @param {string} routeKey - The route key
   * @returns {string|null} - Name of the owning company or null
   */
  getRouteOwner(routeKey) {
    return this.routeOwnership.get(routeKey) || null;
  }


  /**
   * Gets the company that owns a specific city
   * @param {string} cityKey - The city key
   * @returns {string|null} - Name of the owning company or null
   */
  getCityOwner(cityKey) {
    return this.cityOwnership.get(cityKey) || null;
  }


  /**
   * Gets a company by name
   * @param {string} name - Company name
   * @returns {Object|null} - a JSON-serializable object or undefined
   */
  getCompany(name) {
    const company = this.companies.get(name);
    
    if (company) {

      return {
        name: company.name,
        routes: [...company.getRoutes()],
      }
    } else {
      return company;
    }
  }


  /**
   * Gets all companies
   * @returns {Array<Object>} - array of all companies and their properties
   */
  getCompanies() {
    const companies = [];
    this.companies.forEach((value, key) => companies.push(this.getCompany(key)));
    return companies;
  }
}



/**
 * Given a set of cities, return a set of all the routes that do not include those cities
 *
 * @param {Set} cities Set of IDs of cities to avoid
 * @returns {Set} Set of IDs of routes that do not include these cities
 */
function routesWithoutTheseCities(cities) {
  const routesFound = new Set();
  routes.forEach((routeValue, routeKey) => { 
    if (!cities.has(routeValue.cities[0]) && !cities.has(routeValue.cities[1]))
      routesFound.add(routeKey);
  })

  return routesFound;
}


export function initializeIndependentRailroads(railroadManager) {

  /*
   * TODO: Restore this if we want to
   *
  // Get the set of cities that are valid endpoints for independent railroads: everything not within 2 hops of possible starting cities
  const withinTwoOfStartingCities = citiesConnectedTo(
    [
      "Quebec City", "Montreal", "Boston", "Portland ME", "Philadelphia", "New York", "Washington", 
      "Richmond", "Norfolk", "Raleigh", "Charleston", "Savannah", "Jacksonville", "Tallahassee"
    ], 
    {
      distance: 2,
      includeFromCities: true
    }
  );

  const routesAvailableToIndies = routesWithoutTheseCities(withinTwoOfStartingCities);
   *
   */

  
  const routesAvailableToIndies = new Set(routes.keys());

  // Calculate how many routes we want to assign (5% of total)
  const numberOfRoutesToAssign = Math.ceil(routesAvailableToIndies.size * 0.05);
  
  // Convert routes Map to array of entries for easier random selection
  const routeEntries = Array.from(routesAvailableToIndies.entries());
  
  // Shuffle the routes array
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  const shuffledRoutes = shuffle([...routeEntries]);
  
  // Try to assign routes one by one
  let assignedCount = 0;
  let companyCounter = 1;
  
  while (assignedCount < numberOfRoutesToAssign && shuffledRoutes.length > 0) {
    const [routeKey, routeData] = shuffledRoutes.pop();
    
    // Create a new company name
    let companyCreated = false, companyName;
    while (!companyCreated) {
      companyName = generateRailroadName(cities.get(routes.get(routeKey).cities[0]).state);
      companyCreated = railroadManager.createCompany(companyName);
    }

    // Try to create company and assign the route
    if (railroadManager.assignRoute(companyName, routeKey, routeData)) {
      assignedCount++;
      companyCounter++;
    } else {
      railroadManager.deleteCompany(companyName);
    }
  }
  
  // Return statistics about the initialization
  return {
    companiesCreated: companyCounter - 1,
    routesAssigned: assignedCount,
    totalRoutes: routesAvailableToIndies.size,
    percentageAssigned: (assignedCount / routesAvailableToIndies.size * 100).toFixed(1)
  };
}


/**
 * Called at the end of a round, this adds 0 or more segments and 0 or more independent railroad companies
 *
 * @export
 * @param {G} G - global game state
 * @returns {Set|undefined} - Set of IDs of added routes or undefined if none were added
 */
export function growIndependentRailroads(G) {
  /* Definitions used throughout this function
   *  - available route: a route an independent railroad could occupy
   *  - occupancy: percentage of available routes with independent railroads on them
   */

  /* Odds of independent railroads growing by different amounts given starting sizes
  *
  * How to read the nested maps:
  * - The key of the outer map is the current occupancy.
  * - The inner map works with weightedRandom to return the number of percentage points by which
  *   the total indie network should grow.
  * 
  * For example, if the independent RRs currently occupy 11% of the available routes, there's a 
  * 10% chance they not grow, a 70% chance they will grow to 11+1=12% occupancy and a 20% chance 
  * they will grow to 11+2=13% occupancy.
  */

  const growthProbabilities = new Map([
    [  5, new Map([          [1, 10], [2, 20], [3, 30], [4, 40] ]) ],
    [  6, new Map([          [1, 20], [2, 30], [3, 30], [4, 20] ]) ],
    [  7, new Map([ [0,  5], [1, 30], [2, 30], [3, 25], [4, 10] ]) ],
    [  8, new Map([ [0,  5], [1, 45], [2, 35], [3, 10], [4,  5] ]) ],
    [  9, new Map([ [0,  5], [1, 55], [2, 30], [3, 10]          ]) ],
    [ 10, new Map([ [0, 10], [1, 60], [2, 25], [3,  5]          ]) ],
    [ 11, new Map([ [0, 10], [1, 70], [2, 20]                   ]) ],
    [ 12, new Map([ [0, 35], [1, 50], [2, 15]                   ]) ],
    [ 13, new Map([ [0, 50], [1, 40], [2, 10]                   ]) ],
    [ 14, new Map([ [0, 70], [1, 30]                            ]) ],
    [ 15, new Map([ [0, 95], [1,  5]                            ]) ],
  ]);

  // Min and max key values from above
  const smallestMappedOccupancy = Math.min(...[...growthProbabilities.keys()]);
  const largestMappedOccupancy = Math.max(...[...growthProbabilities.keys()]);

  // Collect keys of all active cities and what's adjacent to them
  const activeCities = new Set();
  G.players.forEach(([key, value]) => {
    value.activeCities.forEach(city => { activeCities.add(city); });
  })
  const activeCitiesPlusOneHop = citiesConnectedTo(activeCities, { includeFromCities: true });

  /* Independent railroads can only grow into routes that are not adjacent to player routes.
   * We can't know all the players' routes, but hopefully everything within 1 of their active
   * cities will make a decent approximation.
   */
  const routesNotNearActiveCities = routesWithoutTheseCities(activeCitiesPlusOneHop);
  const railroadsArray = Object.values(G.independentRailroads);
  const startingRouteCount = railroadsArray.reduce((acc, current) => acc + current.routes.length, 0);
  let startingOccupancy = Math.round(100 * startingRouteCount / routesNotNearActiveCities.size);

  if (startingOccupancy < smallestMappedOccupancy)
    startingOccupancy = smallestMappedOccupancy
  else if (startingOccupancy > largestMappedOccupancy)
    startingOccupancy = largestMappedOccupancy;

  const occupancyGrowth = weightedRandom(growthProbabilities.get(startingOccupancy));

  // If there's a zero growth rate picked at random, we're done
  if (occupancyGrowth === 0) return undefined;

  const newOccupancy = startingOccupancy + occupancyGrowth;
  let newRouteCount = Math.round(0.01 * newOccupancy * routesNotNearActiveCities.size);

  // Rounding might mean that a non-zero increase in occupancy would still result in no growth. If this happens,
  // make it a 50/50 chance we'll grow by one route anyway.
  if (newRouteCount === startingRouteCount) {
    if (Math.random() > 0.5) {
      newRouteCount++
    } else {
      // No new routes, so we're done
      return undefined;
    }
  }

  // Finally, we have the number of routes we're going to add during this independent growth action
  const numberOfRoutesToAdd = newRouteCount - startingRouteCount;
  const addedRoutes = new Set();

  // Now we try to expand, up to 100 times
  let countOfAttempts = 0;

  while (addedRoutes.size < numberOfRoutesToAdd && countOfAttempts++ < 100) {
    // Pick an indepdendent RR at random
    const railroadNames = Object.keys(G.independentRailroads);
    const randomRailroadName = railroadNames[Math.floor(Math.random() * railroadNames.length)];
    const railroadToExpand = G.independentRailroads[randomRailroadName];

    /*
     *  Add one route
     */

    // Get all the cities in this RR
    const citiesInRailroad = new Set();
    [...railroadToExpand.routes].forEach(routeKey => {
      const [city1, city2] = routes.get(routeKey).cities;
      citiesInRailroad.add(city1).add(city2);
    });

    // Get all the routes attached to those cities
    const routesSuperset = new Set();
    [...citiesInRailroad].forEach(cityKey => {
      cities.get(cityKey).routes.forEach(r => routesSuperset.add(r));
    })

    // Get all the cities in other independent RRs
    const citiesInOtherRailroads = new Set();
    for (const [name, railroad] of Object.entries(G.independentRailroads)) {
      if (name !== randomRailroadName) {
        [...railroad.routes].forEach(routeKey => {
          const [city1, city2] = routes.get(routeKey).cities;
          citiesInOtherRailroads.add(city1).add(city2);
        })
      }
    };

    const routesOneHapAwayFromIndies = routesWithoutTheseCities(citiesConnectedTo(citiesInOtherRailroads, { includeFromCities: true }));

    const possibleRoutes = routesSuperset
      .difference(new Set([...railroadToExpand.routes]))
      .difference(routesOneHapAwayFromIndies)
      .intersection(routesNotNearActiveCities);

    if (possibleRoutes.size > 0) {
      const routeToAdd = randomArrayItem([...possibleRoutes]);
      railroadToExpand.routes.push(routeToAdd);
      addedRoutes.add(routeToAdd);
    }
  }
  
  return addedRoutes;
}


/**
 * generateRailroadName - Create a thematically appropraite railroad company name. The first draft of this
 * was written with the help of Claude.ai.
 * 
 * @param {string} [state] - State whose features or industries might be used in name
 * @returns {string} Generated name
 */
function generateRailroadName(state) {
  // Common railroad terms that work anywhere
  const regions = ["Northern", "Southern", "Eastern", "Western", "Central"];
  
  const grandNames = [
      "Pioneer", "Liberty", "Enterprise", "Commonwealth", "Republic", "Continental",
      "Overland", "Frontier", "Trailblazer", "Excelsior", "Superior", "Imperial"
  ];

  // State-specific industries and geographic features
  const stateCharacteristics = {
    "AL": {
      name: "Alabama",
      features: ["Valley", "Ridge", "Hills", "River", "Talladega", "Black Belt"],
      industries: ["Cotton", "Iron", "Mining", "Lumber", "Agricultural"]
    },
    "AZ": {
      name: "Arizona",
      features: ["Mesa", "Canyon", "Desert", "Mountain", "Basin"],
      industries: ["Mining", "Copper", "Trading"]
    },
    "AR": {
      name: "Arkansas",
      features: ["Mountain", "Highlands", "Ridge", "Ozark", "Plains"],
      industries: ["Lumber", "Cotton", "Mining", "Agricultural"]
    },
    "CA": {
      name: "California",
      features: ["Mountain", "Valley", "Coast", "Bay", "Desert", "Pacific"],
      industries: ["Mining", "Lumber", "Agricultural", "Maritime", "Express"]
    },
    "CO": {
      name: "Colorado",
      features: ["Mountain", "Peak", "Valley", "Canyon", "Mesa", "Rocky Mountain"],
      industries: ["Mining", "Trading"]
    },
    "CT": {
      name: "Connecticut",
      features: ["River", "Valley", "Sound", "Harbor", "Atlantic", "Brownstone"],
      industries: ["Industrial", "Maritime", "Commercial"]
    },
    "DE": {
      name: "Delaware",
      features: ["Bay", "River", "Coast", "Harbor"],
      industries: ["Maritime", "Industrial", "Commercial"]
    },
    "FL": {
      name: "Florida",
      features: ["Coast", "Bay", "River", "Harbor", "Atlantic"],
      industries: ["Maritime", "Lumber", "Agricultural", "Commercial"]
    },
    "GA": {
      name: "Georgia",
      features: ["Mountain", "River", "Coast", "Valley", "Atlantic"],
      industries: ["Cotton", "Lumber", "Agricultural", "Maritime"]
    },
    "ID": {
      name: "Idaho",
      features: ["Mountain", "Valley", "River", "Canyon"],
      industries: ["Mining", "Lumber", "Trading"]
    },
    "IL": {
      name: "Illinois",
      features: ["Prairie", "Valley", "River", "Lake", "Shawnee"],
      industries: ["Agricultural", "Industrial", "Commercial"]
    },
    "IN": {
      name: "Indiana",
      features: ["Prairie", "Valley", "River", "Lake"],
      industries: ["Industrial", "Agricultural", "Commercial"]
    },
    "IA": {
      name: "Iowa",
      features: ["Prairie", "Valley", "River", "Hills"],
      industries: ["Agricultural", "Industrial", "Commercial"]
    },
    "KS": {
      name: "Kansas",
      features: ["Prairie", "Plains", "River", "Valley", "Junction"],
      industries: ["Agricultural", "Cattle", "Trading"]
    },
    "KY": {
      name: "Kentucky",
      features: ["Mountain", "Valley", "River", "Hills"],
      industries: ["Coal", "Agricultural", "Industrial"]
    },
    "LA": {
      name: "Lousiana",
      features: ["River", "Bay", "Coast", "Delta"],
      industries: ["Cotton", "Maritime", "Agricultural", "Commercial"]
    },
    "ME": {
      name: "Maine",
      features: ["Coast", "Bay", "Harbor", "Lake", "Forest", "Atlantic"],
      industries: ["Lumber", "Maritime", "Industrial"]
    },
    "MD": {
      name: "Maryland",
      features: ["Bay", "Harbor", "Chesapeake", "Piedmont"],
      industries: ["Maritime", "Industrial", "Commercial"]
    },
    "MA": {
      name: "Massachusetts",
      features: ["Bay", "Harbor", "Cape", "Berkshire", "Granite", "Plymouth", "Housatonic"],
      industries: ["Maritime", "Industrial", "Commercial"]
    },
    "MI": {
      name: "Michigan",
      features: ["Lake", "Peninsula", "Forest", "Superior"],
      industries: ["Lumber", "Mining", "Industrial", "Maritime"]
    },
    "MN": {
      name: "Minnesota",
      features: ["Lake", "Arrowhead", "Forest", "Plains", "Superior"],
      industries: ["Lumber", "Mining", "Agricultural"]
    },
    "MS": {
      name: "Mississippi",
      features: ["River", "Delta", "Coast", "Bay"],
      industries: ["Cotton", "Lumber", "Maritime", "Agricultural"]
    },
    "MO": {
      name: "Missouri",
      features: ["River", "Valley", "Prairie", "Hills"],
      industries: ["Mining", "Agricultural", "Industrial"]
    },
    "MT": {
      name: "Montana",
      features: ["Mountain", "Prairie", "Canyon", "Big Sky", "Glocier"],
      industries: ["Mining", "Cattle", "Trading"]
    },
    "NE": {
      name: "Nebraska",
      features: ["Prairie", "Plains", "River", "Valley"],
      industries: ["Agricultural", "Cattle"]
    },
    "NV": {
      name: "Nevada",
      features: ["Mountain", "Desert", "Basin", "Humboldt", "Sierra"],
      industries: ["Mining", "Trading"]
    },
    "NH": {
      name: "New Hampshire",
      features: ["Mountain", "Valley", "Monadnock", "Timberland", "Granite"],
      industries: ["Lumber", "Industrial", "Mining"]
    },
    "NJ": {
      name: "New Jersey",
      features: ["Coast", "Bay", "Harbor", "Valley", "Atlantic", "Pine"],
      industries: ["Industrial", "Maritime", "Commercial"]
    },
    "NM": {
      name: "New Hampshire",
      features: ["River", "Forest", "Appalachian", "Merrimack", "Mountain"],
      industries: ["Mining", "Textiles", "Trading"]
    },
    "NY": {
      name: "New York",
      features: ["Lake", "Valley", "Mountain", "Harbor", "Upstate", "Taconic", "Erie"],
      industries: ["Agricultural", "Maritime", "Commercial"]
    },
    "NC": {
      name: "North Carolina",
      features: ["Blue Ridge", "Piedmont", "Coast", "Sound", "Atlantic"],
      industries: ["Lumber", "Cotton", "Maritime", "Industrial"]
    },
    "ND": {
      name: "North Dakota",
      features: ["Prairie", "Plains", "Valley", "River"],
      industries: ["Agricultural", "Trading"]
    },
    "OH": {
      name: "Ohio",
      features: ["River", "Valley", "Lake", "Hills"],
      industries: ["Industrial", "Agricultural", "Commercial"]
    },
    "OK": {
      name: "Oklahoma",
      features: ["Prairie", "Great Plains", "Mesa", "Panhandle"],
      industries: ["Agricultural", "Trading"]
    },
    "OR": {
      name: "Oregon",
      features: ["Cascades", "Columbia", "Coast", "Forest", "Pacific", "Willamette"],
      industries: ["Lumber", "Maritime"]
    },
    "PA": {
      name: "Pennsylvnia",
      features: ["Mountain", "Valley", "River", "Forest", "Keystone", "Allegheny"],
      industries: ["Coal", "Industrial", "Commercial"]
    },
    "RI": {
      name: "Rhode Island",
      features: ["Bay", "Harbor", "Sound", "Coast"],
      industries: ["Maritime", "Industrial", "Commercial"]
    },
    "SC": {
      name: "South Carolina",
      features: ["Coast", "Valley", "Harbor", "River", "Canal"],
      industries: ["Cotton", "Maritime", "Agricultural", "Industrial"]
    },
    "SD": {
      name: "South Dakota",
      features: ["Prairie", "Plains", "Valley", "Hills"],
      industries: ["Agricultural", "Mining", "Trading"]
    },
    "TN": {
      name: "Tennessee",
      features: ["Mountain", "Valley", "River", "Upland", "Blue Ridge"],
      industries: ["Coal", "Agricultural", "Industrial"]
    },
    "TX": {
      name: "Texas",
      features: ["Plains", "Coast", "Valley", "Plains", "Rio Grande"],
      industries: ["Cattle", "Cotton", "Petroleum", "Trading"]
    },
    "UT": {
      name: "Utah",
      features: ["Mountain", "Valley", "Desert", "Glen Canyon", "Four Corners", "Wasatch"],
      industries: ["Mining", "Cattle", "Trading"]
    },
    "VT": {
      name: "Vermont",
      features: ["Green Mountain", "Valley", "Champlain", "Timberline", "Burlington", "River"],
      industries: ["Lumber", "Agricultural", "Granite"]
    },
    "VA": {
      name: "Virginia",
      features: ["Mountain", "Valley", "Coast", "Bay"],
      industries: ["Coal", "Maritime", "Agricultural"]
    },
    "WA": {
      name: "Washington",
      features: ["Mountain", "Puget Sound", "Coast", "Forest", "Pacific", "Cascadia"],
      industries: ["Lumber", "Maritime"]
    },
    "WV": {
      name: "West Virginia",
      features: ["Mountain", "Valley", "River", "Forest"],
      industries: ["Coal", "Industrial"]
    },
    "WI": {
      name: "Wisconsin",
      features: ["Great Lakes", "Ridge", "Forest", "Midwest"],
      industries: ["Lumber", "Agricultural", "Manufacturing", "Dairy"]
    },
    "WY": {
      name: "Wyoming",
      features: ["Mountain", "Valley", "Plains", "Basin"],
      industries: ["Mining", "Cattle", "Trading"]
    },
    "BC": {
      name: "British Columbia",
      features: ["Coast", "Okanagan", "Plateau", "Valley", "Island", "Pacific", "Glacier"],
      industries: ["Lumber", "Maritime", "Mining", "Fishing"]
    },
    "AB": {
      name: "Alberta",
      features: ["Prairie", "Mountain", "Foothills", "River", "Canyon"],
      industries: ["Oil", "Gas", "Agricultural", "Mining", "Cattle"]
    },
    "SK": {
      name: "Saskatchewan",
      features: ["Prairie", "Forest", "Aspen", "Athabasca", "Basin"],
      industries: ["Agricultural", "Wheat", "Potash", "Mining", "Cattle"]
    },
    "MB": {
      name: "Manitoba",
      features: ["Prairie", "Lake", "Forest", "River"],
      industries: ["Agricultural", "Mining", "Hydro-electric"]
    },
    "ON": {
      name: "Ontario",
      features: ["Great Lakes", "River", "Forest", "Valley"],
      industries: ["Manufacturing", "Agricultural", "Mining"]
    },
    "QC": {
      name: "Quebec",
      features: ["River", "Forest", "Bay", "Coast", "Pine"],
      industries: ["Hydro-Electric", "Forestry", "Mining", "Manufacturing"]
    },
    "NB": {
      name: "New Brunswick",
      features: ["Coast", "Bay", "Forest", "River", "Hill"],
      industries: ["Forestry", "Fishing", "Mining", "Maritime"]
    },
  };

  const suffix = weightedRandom(new Map([
    ["Railway", 10], ["Railroad", 10], ["Line", 5], ["Transportation Company", 1], ["Rail Road", 1], ["Rail Company", 1]
  ]));
  
  // Determine name style
  const nameStyle = Math.random();

  if (typeof state !== "string" || nameStyle < 0.2) {
      // 20% chance: Grand single name (e.g. Enterprise)
      const prefix = Math.random() < 0.5 ? "The " : "";
      return `${prefix}${randomArrayItem(grandNames)} ${suffix}`;
  } 
  else if (nameStyle < 0.6) {
      // 40% chance: Industry/regional name (e.g. Michigan Lumber)
      const direction = Math.random() < 0.5 ? `${randomArrayItem(regions)} ` : '';
      const industry = randomArrayItem(stateCharacteristics[state]?.industries);
      return `${stateCharacteristics[state].name} ${direction}${industry} ${suffix}`;
  }
  else {
      // 40% chance: Paired geographic name (e.g. Valley & River)
      const firstPart = randomArrayItem(stateCharacteristics[state].features);
      let secondPart = firstPart;
      while (secondPart === firstPart) { 
        secondPart = randomArrayItem([...regions, ...stateCharacteristics[state].features]);
      }
      return `${firstPart} & ${secondPart} ${suffix}`;
  }
}