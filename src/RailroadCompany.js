import { routes } from "./GameData";
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


class RailroadManager {
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


function initializeRailroads() {
  // Calculate how many routes we want to assign (5% of total)
  const startingCityKeys = ["Quebec City", "Montreal", "Boston", "Portland ME", "Philadelphia", "New York", "Washington", 
    "Richmond", "Norfolk", "Raleigh", "Charleston", "Savannah", "Jacksonville", "Tallahassee"];
  const offLimitsCitiesForIndiesAtStart = new Set(startingCityKeys);

  const withinTwoOfStartingCities = citiesConnectedTo(startingCityKeys, 2);
  withinTwoOfStartingCities.forEach(cityKey => {offLimitsCitiesForIndiesAtStart.add(cityKey)});

  const routesAvailableToIndies = new Set(routes.entries());

  offLimitsCitiesForIndiesAtStart.forEach(cityKey => { 
    routesAvailableToIndies.forEach(routeValue, routeKey => {
      if (routeValue.cities.includes(cityKey)).
    })
  })

  const numberOfRoutesToAssign = Math.ceil(routes.size * 0.05);
  
  // Convert routes Map to array of entries for easier random selection
  const routeEntries = Array.from(routes.entries());
  
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
      const companyName = `Railroad ${companyCounter}`;
      
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
      totalRoutes: routes.size,
      percentageAssigned: (assignedCount / routes.size * 100).toFixed(1)
  };
}

// Clear any existing data
const railroadManager = new RailroadManager();

// Run the initialization
const stats = initializeRailroads();

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
