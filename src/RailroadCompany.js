import { cities, routes } from "./GameData";
import { citiesConnectedTo } from "./graph";

class RailroadCompany {
  constructor(name) {
    this.name = name;
    this.routes = new Set();
  }

  /**
   * Adds a route to the railroad network if it's valid
   * @param {string} routeKey - The key of the route (e.g., "Albany-Boston")
   * @returns {boolean} - Whether the route was successfully added
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
    if (this.companies.has(name)) {
      return false;
    }
    this.companies.set(name, new RailroadCompany(name));
    return true;
  }


  /**
   * Checks if any city in a route is owned by another company
   * @param {string} companyName - Name of the company trying to claim the route
   * @param {Array<string>} cities - Array of cities in the route
   * @returns {boolean} - Whether any city is owned by another company
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
   * @param {string} city - The city key
   * @returns {string|null} - Name of the owning company or null
   */
  getCityOwner(cityKey) {
    return this.cityOwnership.get(cityKey) || null;
  }


  /**
   * Gets a company by name
   * @param {string} name - Company name
   * @returns {RailroadCompany|null} - The company object or null
   */
  getCompany(name) {
    return this.companies.get(name) || null;
  }


  /**
   * Gets all companies
   * @returns {Map} - Map of all companies
   */
  getCompanies() {
    return new Map(this.companies);
  }
}


export function initializeIndependentRailroads() {
  // Get the set of cities that are valid endpoints for independent railroads: everything not within 2 hops of possible startting cities
  const routesAvailableToIndies = new Set();

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
  routes.forEach((routeValue, routeKey) => { 
    if (!withinTwoOfStartingCities.has(routeValue.cities[0]) && !withinTwoOfStartingCities.has(routeValue.cities[1]))
      routesAvailableToIndies.add(routeKey);
  })

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
      const companyName = generateRailroadName(cities.get(routes.get(routeKey).cities[0]).state);
      
      // Try to create company and assign the route
      if (railroadManager.createCompany(companyName) && 
          railroadManager.assignRoute(companyName, routeKey, routeData)) {
          assignedCount++;
          companyCounter++;
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

// Clear any existing data
const railroadManager = new RailroadManager();

// Run the initialization
const stats = initializeIndependentRailroads();

// Log the results
console.log(`Initialization complete:
Companies created: ${stats.companiesCreated}
Routes assigned: ${stats.routesAssigned}
Total routes: ${stats.totalRoutes}
Percentage assigned: ${stats.percentageAssigned}%

Companies and their routes:`);

// Log each company and its route
for (const [name, company] of railroadManager.getCompanies()) {
  const routes = Array.from(company.getRoutes().keys());
  console.log(`\n${name}:`);
  routes.forEach(route => console.log(`  ${route}`));
}


/**
 * generateRailroadName - First version written by Claude.ai
 * @param {string} [state] - State whose features or industries might be used in name
 * @returns {string} Generated name
 */
function generateRailroadName(state) {
  // Common railroad terms that work anywhere
  const directions = ["Northern", "Southern", "Eastern", "Western", "Central"];
  
  const grandNames = [
      "Pioneer", "Liberty", "Enterprise", "Commonwealth", "Republic", "Continental",
      "Overland", "Frontier", "Trailblazer", "Excelsior", "Superior", "Imperial"
  ];

  // State-specific industries and geographic features
  const stateCharacteristics = {
    "AL": {
      name: "Alabama",
      features: ["Valley", "Ridge", "Hills", "River", "Bay"],
      industries: ["Cotton", "Iron", "Mining", "Lumber", "Agricultural"]
    },
    "AZ": {
      name: "Arizona",
      features: ["Mesa", "Canyon", "Desert", "Mountain", "Basin"],
      industries: ["Mining", "Copper", "Trading", "Express"]
    },
    "AR": {
      name: "Arkansas",
      features: ["Mountain", "Valley", "River", "Prairie"],
      industries: ["Lumber", "Cotton", "Mining", "Agricultural"]
    },
    "CA": {
      name: "California",
      features: ["Mountain", "Valley", "Coast", "Bay", "Desert"],
      industries: ["Mining", "Lumber", "Agricultural", "Maritime", "Express"]
    },
    "CO": {
      name: "Colorado",
      features: ["Mountain", "Peak", "Valley", "Canyon", "Mesa"],
      industries: ["Mining", "Express", "Trading"]
    },
    "CT": {
      name: "Connecticut",
      features: ["River", "Valley", "Sound", "Harbor"],
      industries: ["Industrial", "Maritime", "Commercial", "Transportation"]
    },
    "DE": {
      name: "Delaware",
      features: ["Bay", "River", "Coast", "Harbor"],
      industries: ["Maritime", "Industrial", "Commercial", "Transportation"]
    },
    "FL": {
      name: "Florida",
      features: ["Coast", "Bay", "River", "Harbor"],
      industries: ["Maritime", "Lumber", "Agricultural", "Commercial"]
    },
    "GA": {
      name: "Georgia",
      features: ["Mountain", "River", "Coast", "Valley"],
      industries: ["Cotton", "Lumber", "Agricultural", "Maritime"]
    },
    "ID": {
      name: "Idaho",
      features: ["Mountain", "Valley", "River", "Canyon"],
      industries: ["Mining", "Lumber", "Express", "Trading"]
    },
    "IL": {
      name: "Illinois",
      features: ["Prairie", "Valley", "River", "Lake"],
      industries: ["Agricultural", "Industrial", "Commercial", "Transportation"]
    },
    "IN": {
      name: "Indiana",
      features: ["Prairie", "Valley", "River", "Lake"],
      industries: ["Industrial", "Agricultural", "Commercial", "Transportation"]
    },
    "IA": {
      name: "Iowa",
      features: ["Prairie", "Valley", "River", "Hills"],
      industries: ["Agricultural", "Industrial", "Commercial", "Transportation"]
    },
    "KS": {
      name: "Kansas",
      features: ["Prairie", "Plains", "River", "Valley"],
      industries: ["Agricultural", "Cattle", "Express", "Trading"]
    },
    "KY": {
      name: "Kentucky",
      features: ["Mountain", "Valley", "River", "Hills"],
      industries: ["Coal", "Agricultural", "Industrial", "Transportation"]
    },
    "LA": {
      name: "Lousiana",
      features: ["River", "Bay", "Coast", "Delta"],
      industries: ["Cotton", "Maritime", "Agricultural", "Commercial"]
    },
    "ME": {
      name: "Maine",
      features: ["Coast", "Bay", "Harbor", "Lake", "Forest"],
      industries: ["Lumber", "Maritime", "Industrial", "Commercial"]
    },
    "MD": {
      name: "Maryland",
      features: ["Bay", "River", "Harbor", "Valley"],
      industries: ["Maritime", "Industrial", "Commercial", "Transportation"]
    },
    "MA": {
      name: "Massachusetts",
      features: ["Bay", "Harbor", "Coast", "Valley"],
      industries: ["Maritime", "Industrial", "Commercial", "Transportation"]
    },
    "MI": {
      name: "Michigan",
      features: ["Lake", "Peninsula", "Bay", "Forest"],
      industries: ["Lumber", "Mining", "Industrial", "Maritime"]
    },
    "MN": {
      name: "Minnesota",
      features: ["Lake", "Prairie", "Forest", "Valley"],
      industries: ["Lumber", "Mining", "Agricultural", "Transportation"]
    },
    "MS": {
      name: "Mississippi",
      features: ["River", "Delta", "Coast", "Bay"],
      industries: ["Cotton", "Lumber", "Maritime", "Agricultural"]
    },
    "MO": {
      name: "Missouri",
      features: ["River", "Valley", "Prairie", "Hills"],
      industries: ["Mining", "Agricultural", "Industrial", "Transportation"]
    },
    "MT": {
      name: "Montana",
      features: ["Mountain", "Valley", "Prairie", "Canyon"],
      industries: ["Mining", "Cattle", "Express", "Trading"]
    },
    "NE": {
      name: "Nebraska",
      features: ["Prairie", "Plains", "River", "Valley"],
      industries: ["Agricultural", "Cattle", "Express", "Transportation"]
    },
    "NV": {
      name: "Nevada",
      features: ["Mountain", "Desert", "Valley", "Basin"],
      industries: ["Mining", "Express", "Trading"]
    },
    "NH": {
      name: "New Hampshire",
      features: ["Mountain", "Valley", "Lake", "Forest"],
      industries: ["Lumber", "Industrial", "Transportation"]
    },
    "NJ": {
      name: "New Jersey",
      features: ["Coast", "Bay", "Harbor", "Valley"],
      industries: ["Industrial", "Maritime", "Commercial", "Transportation"]
    },
    "NM": {
      name: "New Hampshire",
      features: ["Mesa", "Mountain", "Desert", "Canyon"],
      industries: ["Mining", "Express", "Trading"]
    },
    "NY": {
      name: "New York",
      features: ["Lake", "Valley", "Mountain", "Harbor"],
      industries: ["Industrial", "Maritime", "Commercial", "Transportation"]
    },
    "NC": {
      name: "North Carolina",
      features: ["Mountain", "Valley", "Coast", "Sound"],
      industries: ["Lumber", "Cotton", "Maritime", "Industrial"]
    },
    "ND": {
      name: "North Dakota",
      features: ["Prairie", "Plains", "Valley", "River"],
      industries: ["Agricultural", "Express", "Trading"]
    },
    "OH": {
      name: "Ohio",
      features: ["River", "Valley", "Lake", "Hills"],
      industries: ["Industrial", "Agricultural", "Commercial", "Transportation"]
    },
    "OK": {
      name: "Oklahoma",
      features: ["Prairie", "Plains", "River", "Valley"],
      industries: ["Agricultural", "Express", "Trading"]
    },
    "OR": {
      name: "Oregon",
      features: ["Mountain", "Valley", "Coast", "Forest"],
      industries: ["Lumber", "Maritime", "Express", "Transportation"]
    },
    "PA": {
      name: "Pennsylvnia",
      features: ["Mountain", "Valley", "River", "Forest"],
      industries: ["Coal", "Industrial", "Commercial", "Transportation"]
    },
    "RI": {
      name: "Rhode Island",
      features: ["Bay", "Harbor", "Sound", "Coast"],
      industries: ["Maritime", "Industrial", "Commercial", "Transportation"]
    },
    "SC": {
      name: "South Carolina",
      features: ["Coast", "Valley", "Harbor", "River"],
      industries: ["Cotton", "Maritime", "Agricultural", "Industrial"]
    },
    "SD": {
      name: "South Dakota",
      features: ["Prairie", "Plains", "Valley", "Hills"],
      industries: ["Agricultural", "Mining", "Express", "Trading"]
    },
    "TN": {
      name: "Tennessee",
      features: ["Mountain", "Valley", "River", "Plains"],
      industries: ["Coal", "Agricultural", "Industrial", "Transportation"]
    },
    "TX": {
      name: "Texas",
      features: ["Plains", "Coast", "Valley", "Desert"],
      industries: ["Cattle", "Cotton", "Express", "Trading"]
    },
    "UT": {
      name: "Utah",
      features: ["Mountain", "Valley", "Desert", "Lake"],
      industries: ["Mining", "Express", "Trading"]
    },
    "VT": {
      name: "Vermont",
      features: ["Mountain", "Valley", "Lake", "Forest"],
      industries: ["Lumber", "Agricultural", "Transportation"]
    },
    "VA": {
      name: "Virginia",
      features: ["Mountain", "Valley", "Coast", "Bay"],
      industries: ["Coal", "Maritime", "Agricultural", "Transportation"]
    },
    "WA": {
      name: "Washington",
      features: ["Mountain", "Sound", "Coast", "Forest"],
      industries: ["Lumber", "Maritime", "Express", "Transportation"]
    },
    "WV": {
      name: "West Virginia",
      features: ["Mountain", "Valley", "River", "Forest"],
      industries: ["Coal", "Industrial", "Transportation"]
    },
    "WI": {
      name: "Wisconsin",
      features: ["Lake", "Valley", "Forest", "Prairie"],
      industries: ["Lumber", "Agricultural", "Industrial", "Transportation"]
    },
    "WY": {
      name: "Wyoming",
      features: ["Mountain", "Valley", "Plains", "Basin"],
      industries: ["Mining", "Cattle", "Express", "Trading"]
    },
    "BC": {
      name: "British Columbia",
      features: ["Coast", "Mountain", "Forest", "Valley", "Island"],
      industries: ["Lumber", "Maritime", "Mining", "Fishing", "Tourism"]
    },
    "AB": {
      name: "Alberta",
      features: ["Prairie", "Mountain", "Foothills", "River", "Canyon"],
      industries: ["Oil", "Gas", "Agriculture", "Mining", "Cattle"]
    },
    "SK": {
      name: "Saskatchewan",
      features: ["Prairie", "Plains", "River", "Lake"],
      industries: ["Agriculture", "Wheat", "Potash", "Mining", "Cattle"]
    },
    "MB": {
      name: "Manitoba",
      features: ["Prairie", "Lake", "Forest", "River"],
      industries: ["Agriculture", "Mining", "Hydro-electric", "Transportation"]
    },
    "ON": {
      name: "Ontario",
      features: ["Great Lakes", "River", "Forest", "Valley"],
      industries: ["Manufacturing", "Technology", "Agriculture", "Mining", "Automotive"]
    },
    "QC": {
      name: "Quebec",
      features: ["River", "Forest", "Mountain", "Coast", "Lake"],
      industries: ["Hydro-electric", "Forestry", "Mining", "Agriculture", "Manufacturing"]
    },
    "NB": {
      name: "New Brunswick",
      features: ["Coast", "Bay", "Forest", "River", "Hill"],
      industries: ["Forestry", "Fishing", "Agriculture", "Mining", "Maritime"]
    },
  };

  // Helper function to get random item from array
  const random = arr => arr[Math.floor(Math.random() * arr.length)];
  
  // Determine name style (33% chance for each type)
  const nameStyle = Math.random();
  
  if (typeof state !== "string" || nameStyle < 0.33) {
      // Generate grand single name (these are universal)
      const prefix = Math.random() < 0.5 ? "The " : "";
      const suffix = random(["Railway", "Railroad", "Line", "Express"]);
      return `${prefix}${random(grandNames)} ${suffix}`;
  } 
  else if (nameStyle < 0.66) {
      // Generate industry/regional name using state-specific industries
      const direction = random(directions);
      const industry = random(stateCharacteristics[state]?.industries);
      return `${stateCharacteristics[state].name} ${direction} ${industry} Line`;
  }
  else {
      // Generate paired geographic name using state-specific features
      const firstPart = random(stateCharacteristics[state].features);
      const secondPart = random([...directions, ...stateCharacteristics[state].features]);
      return `${firstPart} & ${secondPart} Railroad`;
  }
}
