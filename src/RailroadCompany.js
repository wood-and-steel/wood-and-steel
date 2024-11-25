import { routes } from "./GameData";

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
    const isConnected = false;
      
    this.cities.has(city1) || this.cities.has(city2);

    if (!isConnected) {
      return false;
    }

    // Add the route and its cities
    this.routes.add(routeKey);
    return true;
  }

  /**
   * Checks if adding a route would be valid
   * @param {string} routeKey - The key of the route
   * @returns {boolean} - Whether the route can be added
   */
  canAddRoute(routeKey) {
    if (this.routes.size === 0) return true;
    
    const [city1, city2] = routes.get(routeKey).cities;
    return this.cities.has(city1) || this.cities.has(city2);
  }


  /**
   * Gets all cities in the network
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
  isCityOwnedByOther(companyName, cities) {
    return cities.some(city => {
      const owner = this.cityOwnership.get(city);
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
   * @param {string} city - The city name
   * @returns {string|null} - Name of the owning company or null
   */
  getCityOwner(city) {
      return this.cityOwnership.get(city) || null;
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


  /**
   * Gets all unowned routes
   * @returns {Set<string>} - Set of unowned route keys
   */
  getUnownedRoutes(allRoutes) {
      const unownedRoutes = new Set();
      for (const routeKey of allRoutes.keys()) {
          if (!this.routeOwnership.has(routeKey)) {
              unownedRoutes.add(routeKey);
          }
      }
      return unownedRoutes;
  }
}

// Create global instance
const railroadManager = new RailroadManager();