/* Exports:
 *   cities       the cities, their commodities, and their connected routes
 *   routes       segments of track between the cities
 *   commodities  what each city supplies
 * 
 * source: https://docs.google.com/spreadsheets/d/1r1ffSOFxTSjz-kltB9eLAaIVIo5z_CFEEDkP6zkNr0g/edit?usp=sharing
 */

/*
 * cities
 * 
 * key:           string - name of city
 * value: {
 *  id              string
 *  state           string
 *  country         string
 *  region          ["Eastern", "Central", "Western"]
 *  label           string (can be null) - prettier version of key, or null if the key is already pretty to humans
 *  latitude        number
 *  longitude       number
 *  large           boolean
 *  westCoast       boolean
 *  nearWestCoast   boolean
 *  nearEastCoast   boolean
 *  commodities     string[]
 *  routes          string[] - keys for routes Map
 * }
 */

export const cities = new Map([
  [ "Atlanta", { "id": "atl", "state": "GA", "country": "US", "region": "Eastern", "label": null, "latitude": 33.7491, "longitude": -84.3902, "large": true, "westCoast": false, "nearWestCoast": false, "nearEastCoast": true, "commodities": ["coal", "cotton", "textiles"], "routes": ["Atlanta-Birmingham", "Atlanta-Cincinnati", "Atlanta-Raleigh", "Atlanta-Savannah", "Atlanta-Tallahassee"]} ],
  [ "Birmingham", { "id": "bir", "state": "AL", "country": "US", "region": "Eastern", "label": null, "latitude": 33.5207, "longitude": -86.8024, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["steel"], "routes": ["Atlanta-Birmingham", "Birmingham-Memphis"]} ],
  [ "Bismarck", { "id": "bis", "state": "ND", "country": "US", "region": "Western", "label": null, "latitude": 46.8083, "longitude": -100.7837, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": [], "routes": ["Bismarck-Butte", "Bismarck-Fargo", "Bismarck-Regina"]} ],
  [ "Boise", { "id": "boi", "state": "ID", "country": "US", "region": "Western", "label": null, "latitude": 43.615, "longitude": -116.2044, "large": false, "westCoast": false, "nearWestCoast": true, "nearEastCoast": false, "commodities": ["copper"], "routes": ["Boise-Butte", "Boise-Portland OR", "Boise-Salt Lake City"]} ],
  [ "Boston", { "id": "bos", "state": "MA", "country": "US", "region": "Eastern", "label": null, "latitude": 42.3605, "longitude": -71.0596, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["imports", "machinery"], "routes": ["Boston-New York", "Boston-Portland ME", "Boston-Syracuse"]} ],
  [ "Butte", { "id": "but", "state": "MT", "country": "US", "region": "Western", "label": null, "latitude": 45.9838, "longitude": -112.5007, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["coal", "lead", "sheep"], "routes": ["Bismarck-Butte", "Boise-Butte", "Butte-Spokane"]} ],
  [ "Calgary", { "id": "cal", "state": "AB", "country": "CA", "region": "Western", "label": null, "latitude": 51.0531, "longitude": -114.0626, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["coal", "copper", "lead"], "routes": ["Calgary-Edmonton", "Calgary-Regina", "Calgary-Spokane", "Calgary-Vancouver"]} ],
  [ "Charleston", { "id": "cha", "state": "SC", "country": "US", "region": "Eastern", "label": null, "latitude": 32.7876, "longitude": -79.9403, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["cotton", "tobacco"], "routes": ["Charleston-Raleigh", "Charleston-Savannah"]} ],
  [ "Chicago", { "id": "chi", "state": "IL", "country": "US", "region": "Central", "label": null, "latitude": 41.8756, "longitude": -87.6244, "large": true, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["coal", "machinery", "tourists"], "routes": ["Chicago-Cincinnati", "Chicago-Cleveland", "Chicago-Des Moines", "Chicago-Detroit", "Chicago-Milwaukee", "Chicago-Saint Louis"]} ],
  [ "Cincinnati", { "id": "cin", "state": "OH", "country": "US", "region": "Central", "label": null, "latitude": 39.1015, "longitude": -84.5125, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["coal"], "routes": ["Atlanta-Cincinnati", "Chicago-Cincinnati", "Cincinnati-Cleveland", "Cincinnati-Memphis", "Cincinnati-Pittsburgh", "Cincinnati-Saint Louis"]} ],
  [ "Cleveland", { "id": "cle", "state": "OH", "country": "US", "region": "Central", "label": null, "latitude": 41.5052, "longitude": -81.6934, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": true, "commodities": [], "routes": ["Chicago-Cleveland", "Cincinnati-Cleveland", "Cleveland-Detroit", "Cleveland-New York", "Cleveland-Pittsburgh", "Cleveland-Syracuse"]} ],
  [ "Dallas", { "id": "dal", "state": "TX", "country": "US", "region": "Central", "label": null, "latitude": 32.7763, "longitude": -96.7969, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["cotton", "oil"], "routes": ["Dallas-Houston", "Dallas-Memphis", "Dallas-Oklahoma City", "Dallas-Santa Fe"]} ],
  [ "Denver", { "id": "den", "state": "CO", "country": "US", "region": "Western", "label": null, "latitude": 39.7348, "longitude": -104.9653, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["lead", "sheep"], "routes": ["Denver-Kansas City", "Denver-Omaha", "Denver-Salt Lake City"]} ],
  [ "Des Moines", { "id": "dm", "state": "IA", "country": "US", "region": "Central", "label": null, "latitude": 41.5911, "longitude": -93.6037, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["grain", "pork"], "routes": ["Chicago-Des Moines", "Des Moines-Kansas City", "Des Moines-Milwaukee", "Des Moines-Minneapolis", "Des Moines-Omaha", "Des Moines-Saint Louis"]} ],
  [ "Detroit", { "id": "det", "state": "MI", "country": "US", "region": "Central", "label": null, "latitude": 42.93, "longitude": -82.56, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["machinery"], "routes": ["Chicago-Detroit", "Cleveland-Detroit", "Detroit-Toronto"]} ],
  [ "Duluth", { "id": "dul", "state": "MN", "country": "US", "region": "Central", "label": null, "latitude": 46.7729, "longitude": -92.1251, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["iron ore"], "routes": ["Duluth-Fargo", "Duluth-Milwaukee", "Duluth-Minneapolis", "Duluth-Thunder Bay", "Duluth-Winnipeg"]} ],
  [ "Edmonton", { "id": "edm", "state": "AB", "country": "CA", "region": "Western", "label": null, "latitude": 53.5344, "longitude": -113.5065, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["oil"], "routes": ["Calgary-Edmonton", "Edmonton-Regina"]} ],
  [ "Fargo", { "id": "far", "state": "ND", "country": "US", "region": "Central", "label": null, "latitude": 46.8772, "longitude": -96.7898, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["pork"], "routes": ["Bismarck-Fargo", "Duluth-Fargo", "Fargo-Minneapolis", "Fargo-Winnipeg"]} ],
  [ "Houston", { "id": "hou", "state": "TX", "country": "US", "region": "Central", "label": null, "latitude": 29.7589, "longitude": -95.3677, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["oil", "rice"], "routes": ["Dallas-Houston", "Houston-Memphis", "Houston-New Orleans", "Houston-Santa Fe"]} ],
  [ "Kansas City", { "id": "kc", "state": "KS", "country": "US", "region": "Central", "label": null, "latitude": 39.1147, "longitude": -94.7495, "large": true, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["cattle", "grain"], "routes": ["Denver-Kansas City", "Des Moines-Kansas City", "Kansas City-Memphis", "Kansas City-Oklahoma City", "Kansas City-Omaha", "Kansas City-Saint Louis", "Kansas City-Santa Fe"]} ],
  [ "Los Angeles", { "id": "la", "state": "CA", "country": "US", "region": "Western", "label": null, "latitude": 34.0544, "longitude": -118.2439, "large": true, "westCoast": true, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["fruit", "imports", "wine"], "routes": ["Los Angeles-Phoenix", "Los Angeles-San Diego", "Los Angeles-San Francisco"]} ],
  [ "Memphis", { "id": "mem", "state": "TN", "country": "US", "region": "Central", "label": null, "latitude": 35.149, "longitude": -90.0516, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["bauxite"], "routes": ["Birmingham-Memphis", "Cincinnati-Memphis", "Dallas-Memphis", "Houston-Memphis", "Kansas City-Memphis", "Memphis-New Orleans", "Memphis-Oklahoma City", "Memphis-Saint Louis"]} ],
  [ "Milwaukee", { "id": "mil", "state": "WI", "country": "US", "region": "Central", "label": null, "latitude": 43.0115, "longitude": -87.9735, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["machinery"], "routes": ["Chicago-Milwaukee", "Des Moines-Milwaukee", "Duluth-Milwaukee", "Milwaukee-Minneapolis"]} ],
  [ "Minneapolis", { "id": "min", "state": "MN", "country": "US", "region": "Central", "label": null, "latitude": 44.9773, "longitude": -93.2655, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["grain", "iron ore", "pork"], "routes": ["Des Moines-Minneapolis", "Duluth-Minneapolis", "Fargo-Minneapolis", "Milwaukee-Minneapolis"]} ],
  [ "Montreal", { "id": "mon", "state": "QC", "country": "CA", "region": "Eastern", "label": null, "latitude": 45.5088, "longitude": -73.554, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": [], "routes": ["Montreal-Ottawa", "Montreal-Quebec City", "Montreal-Syracuse"]} ],
  [ "New Orleans", { "id": "no", "state": "LA", "country": "US", "region": "Central", "label": null, "latitude": 29.9499, "longitude": -90.0701, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["fish", "rice"], "routes": ["Houston-New Orleans", "Memphis-New Orleans", "New Orleans-Tallahassee"]} ],
  [ "New York", { "id": "ny", "state": "NY", "country": "US", "region": "Eastern", "label": null, "latitude": 40.7648, "longitude": -73.9808, "large": true, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["imports", "tourists"], "routes": ["Boston-New York", "Cleveland-New York", "New York-Philadelphia", "New York-Syracuse"]} ],
  [ "Norfolk", { "id": "nor", "state": "VA", "country": "US", "region": "Eastern", "label": null, "latitude": 36.8465, "longitude": -76.2916, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["tobacco"], "routes": ["Norfolk-Raleigh", "Norfolk-Washington"]} ],
  [ "Oklahoma City", { "id": "oc", "state": "OK", "country": "US", "region": "Central", "label": null, "latitude": 35.473, "longitude": -97.5171, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["oil"], "routes": ["Dallas-Oklahoma City", "Kansas City-Oklahoma City", "Memphis-Oklahoma City"]} ],
  [ "Omaha", { "id": "oma", "state": "NE", "country": "US", "region": "Central", "label": null, "latitude": 41.2587, "longitude": -95.9379, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["grain"], "routes": ["Denver-Omaha", "Des Moines-Omaha", "Kansas City-Omaha"]} ],
  [ "Ottawa", { "id": "ott", "state": "ON", "country": "CA", "region": "Eastern", "label": null, "latitude": 45.421, "longitude": -75.69, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["wood"], "routes": ["Montreal-Ottawa", "Ottawa-Sudbury", "Ottawa-Toronto"]} ],
  [ "Philadelphia", { "id": "phi", "state": "PA", "country": "US", "region": "Eastern", "label": null, "latitude": 40.0115, "longitude": -75.1327, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["imports", "tourists"], "routes": ["New York-Philadelphia", "Philadelphia-Pittsburgh", "Philadelphia-Washington"]} ],
  [ "Phoenix", { "id": "pho", "state": "AZ", "country": "US", "region": "Western", "label": null, "latitude": 33.4486, "longitude": -112.0773, "large": false, "westCoast": false, "nearWestCoast": true, "nearEastCoast": false, "commodities": ["copper"], "routes": ["Los Angeles-Phoenix", "Phoenix-San Diego", "Phoenix-Santa Fe"]} ],
  [ "Pittsburgh", { "id": "pit", "state": "PA", "country": "US", "region": "Eastern", "label": null, "latitude": 40.4417, "longitude": -79.9901, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": true, "commodities": ["coal", "steel"], "routes": ["Cincinnati-Pittsburgh", "Cleveland-Pittsburgh", "Philadelphia-Pittsburgh", "Pittsburgh-Washington"]} ],
  [ "Portland ME", { "id": "porm", "state": "ME", "country": "US", "region": "Eastern", "label": "Portland, Maine", "latitude": 43.661, "longitude": -70.2549, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["aluminum", "wood"], "routes": ["Boston-Portland ME", "Portland ME-Quebec City"]} ],
  [ "Portland OR", { "id": "poro", "state": "OR", "country": "US", "region": "Western", "label": "Portland, Ore.", "latitude": 45.5202, "longitude": -122.6742, "large": false, "westCoast": true, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["wood"], "routes": ["Boise-Portland OR", "Portland OR-San Francisco", "Portland OR-Seattle", "Portland OR-Spokane"]} ],
  [ "Quebec City", { "id": "que", "state": "QC", "country": "CA", "region": "Eastern", "label": null, "latitude": 46.8257, "longitude": -71.2349, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": true, "commodities": ["imports", "wood"], "routes": ["Montreal-Quebec City", "Portland ME-Quebec City"]} ],
  [ "Raleigh", { "id": "ral", "state": "NC", "country": "US", "region": "Eastern", "label": null, "latitude": 35.7804, "longitude": -78.6391, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["textiles", "tobacco"], "routes": ["Atlanta-Raleigh", "Charleston-Raleigh", "Norfolk-Raleigh", "Raleigh-Washington"]} ],
  [ "Regina", { "id": "reg", "state": "SK", "country": "CA", "region": "Western", "label": null, "latitude": 50.4481, "longitude": -104.6158, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["lead", "nickel"], "routes": ["Bismarck-Regina", "Calgary-Regina", "Edmonton-Regina", "Regina-Winnipeg"]} ],
  [ "Saint Louis", { "id": "sl", "state": "MO", "country": "US", "region": "Central", "label": null, "latitude": 38.63, "longitude": -90.19, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": [], "routes": ["Chicago-Saint Louis", "Cincinnati-Saint Louis", "Des Moines-Saint Louis", "Kansas City-Saint Louis", "Memphis-Saint Louis"]} ],
  [ "Salt Lake City", { "id": "slc", "state": "UT", "country": "US", "region": "Western", "label": null, "latitude": 40.767, "longitude": -111.8904, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["iron ore", "sheep"], "routes": ["Boise-Salt Lake City", "Denver-Salt Lake City", "Salt Lake City-San Francisco", "Salt Lake City-Santa Fe"]} ],
  [ "San Diego", { "id": "sd", "state": "CA", "country": "US", "region": "Western", "label": null, "latitude": 32.7174, "longitude": -117.1628, "large": false, "westCoast": true, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["fruit"], "routes": ["Los Angeles-San Diego", "Phoenix-San Diego"]} ],
  [ "San Francisco", { "id": "sfo", "state": "CA", "country": "US", "region": "Western", "label": null, "latitude": 37.7648, "longitude": -122.463, "large": true, "westCoast": true, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["imports", "precious metals", "wine"], "routes": ["Los Angeles-San Francisco", "Portland OR-San Francisco", "Salt Lake City-San Francisco"]} ],
  [ "Santa Fe", { "id": "sfe", "state": "NM", "country": "US", "region": "Western", "label": null, "latitude": 35.687, "longitude": -105.9378, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": [], "routes": ["Dallas-Santa Fe", "Houston-Santa Fe", "Kansas City-Santa Fe", "Phoenix-Santa Fe", "Salt Lake City-Santa Fe"]} ],
  [ "Savannah", { "id": "sav", "state": "GA", "country": "US", "region": "Eastern", "label": null, "latitude": 32.0835, "longitude": -81.0998, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["textiles"], "routes": ["Atlanta-Savannah", "Charleston-Savannah", "Savannah-Tallahassee", "Savannah-Tampa"]} ],
  [ "Seattle", { "id": "sea", "state": "WA", "country": "US", "region": "Western", "label": null, "latitude": 47.6038, "longitude": -122.3301, "large": true, "westCoast": true, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["fish", "wood"], "routes": ["Portland OR-Seattle", "Seattle-Spokane", "Seattle-Vancouver"]} ],
  [ "Spokane", { "id": "spo", "state": "WA", "country": "US", "region": "Western", "label": null, "latitude": 47.6589, "longitude": -117.4247, "large": false, "westCoast": false, "nearWestCoast": true, "nearEastCoast": false, "commodities": ["wine"], "routes": ["Butte-Spokane", "Calgary-Spokane", "Portland OR-Spokane", "Seattle-Spokane"]} ],
  [ "Sudbury", { "id": "sud", "state": "ON", "country": "CA", "region": "Central", "label": null, "latitude": 47.77, "longitude": -82.08, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["nickel"], "routes": ["Ottawa-Sudbury", "Sudbury-Thunder Bay", "Sudbury-Toronto"]} ],
  [ "Syracuse", { "id": "syr", "state": "NY", "country": "US", "region": "Eastern", "label": null, "latitude": 43.0481, "longitude": -76.1474, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["machinery"], "routes": ["Albany-Syracuse", "Buffalo-Syracuse", "New York-Syracuse", "Ottawa-Syracuse"]} ],
  [ "Tallahassee", { "id": "tal", "state": "FL", "country": "US", "region": "Eastern", "label": null, "latitude": 30.4381, "longitude": -84.2809, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": true, "commodities": ["textiles"], "routes": ["Atlanta-Tallahassee", "New Orleans-Tallahassee", "Savannah-Tallahassee", "Tallahassee-Tampa"]} ],
  [ "Tampa", { "id": "tam", "state": "FL", "country": "US", "region": "Eastern", "label": null, "latitude": 27.9478, "longitude": -82.4584, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["fruit"], "routes": ["Savannah-Tampa", "Tallahassee-Tampa"]} ],
  [ "Thunder Bay", { "id": "tb", "state": "ON", "country": "CA", "region": "Central", "label": null, "latitude": 48.4062, "longitude": -89.2591, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["cattle", "iron ore"], "routes": ["Duluth-Thunder Bay", "Sudbury-Thunder Bay", "Thunder Bay-Winnipeg"]} ],
  [ "Toronto", { "id": "tor", "state": "ON", "country": "CA", "region": "Central", "label": null, "latitude": 43.6529, "longitude": -79.3849, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["machinery"], "routes": ["Detroit-Toronto", "Ottawa-Toronto", "Sudbury-Toronto", "Syracuse-Toronto"]} ],
  [ "Vancouver", { "id": "van", "state": "BC", "country": "CA", "region": "Western", "label": null, "latitude": 49.2609, "longitude": -123.1139, "large": false, "westCoast": true, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["fish", "precious metals", "wood"], "routes": ["Calgary-Vancouver", "Seattle-Vancouver"]} ],
  [ "Washington", { "id": "was", "state": "DC", "country": "US", "region": "Eastern", "label": null, "latitude": 38.895, "longitude": -77.0366, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": [], "routes": ["Norfolk-Washington", "Philadelphia-Washington", "Pittsburgh-Washington", "Raleigh-Washington"]} ],
  [ "Winnipeg", { "id": "win", "state": "MB", "country": "CA", "region": "Central", "label": null, "latitude": 49.8833, "longitude": -97.1667, "large": false, "westCoast": false, "nearWestCoast": false, "nearEastCoast": false, "commodities": ["cattle", "grain"], "routes": ["Duluth-Winnipeg", "Fargo-Winnipeg", "Regina-Winnipeg", "Thunder Bay-Winnipeg"]} ]
]);

/*
 * routes
 * 
 * key:           string - keys of connected cities, dash-separated and in alphabetical order
 * value: {
 *  length          number - integer in the range [1, 5]
 *  mountainous     boolean
 *  cities          string[] - keys of connected cities
 * }
 */

export const routes = new Map([
  [ "Atlanta-Birmingham", { "length": 1, "mountainous": false, cities: ["Atlanta", "Birmingham"] } ],
  [ "Atlanta-Cincinnati", { "length": 3, "mountainous": false, cities: ["Atlanta", "Cincinnati"] } ],
  [ "Atlanta-Raleigh", { "length": 4, "mountainous": false, cities: ["Atlanta", "Raleigh"] } ],
  [ "Atlanta-Savannah", { "length": 2, "mountainous": false, cities: ["Atlanta", "Savannah"] } ],
  [ "Atlanta-Tallahassee", { "length": 2, "mountainous": false, cities: ["Atlanta", "Tallahassee"] } ],
  [ "Birmingham-Memphis", { "length": 2, "mountainous": false, cities: ["Birmingham", "Memphis"] } ],
  [ "Bismarck-Butte", { "length": 4, "mountainous": true, cities: ["Bismarck", "Butte"] } ],
  [ "Bismarck-Fargo", { "length": 2, "mountainous": false, cities: ["Bismarck", "Fargo"] } ],
  [ "Bismarck-Regina", { "length": 3, "mountainous": false, cities: ["Bismarck", "Regina"] } ],
  [ "Boise-Butte", { "length": 2, "mountainous": true, cities: ["Boise", "Butte"] } ],
  [ "Boise-Portland OR", { "length": 3, "mountainous": true, cities: ["Boise", "Portland OR"] } ],
  [ "Boise-Salt Lake City", { "length": 3, "mountainous": true, cities: ["Boise", "Salt Lake City"] } ],
  [ "Boston-New York", { "length": 2, "mountainous": false, cities: ["Boston", "New York"] } ],
  [ "Boston-Portland ME", { "length": 1, "mountainous": false, cities: ["Boston", "Portland ME"] } ],
  [ "Boston-Syracuse", { "length": 2, "mountainous": false, cities: ["Boston", "Syracuse"] } ],
  [ "Butte-Spokane", { "length": 3, "mountainous": true, cities: ["Butte", "Spokane"] } ],
  [ "Calgary-Edmonton", { "length": 2, "mountainous": false, cities: ["Calgary", "Edmonton"] } ],
  [ "Calgary-Regina", { "length": 4, "mountainous": false, cities: ["Calgary", "Regina"] } ],
  [ "Calgary-Spokane", { "length": 3, "mountainous": true, cities: ["Calgary", "Spokane"] } ],
  [ "Calgary-Vancouver", { "length": 4, "mountainous": true, cities: ["Calgary", "Vancouver"] } ],
  [ "Charleston-Raleigh", { "length": 2, "mountainous": false, cities: ["Charleston", "Raleigh"] } ],
  [ "Charleston-Savannah", { "length": 1, "mountainous": false, cities: ["Charleston", "Savannah"] } ],
  [ "Chicago-Cincinnati", { "length": 3, "mountainous": false, cities: ["Chicago", "Cincinnati"] } ],
  [ "Chicago-Cleveland", { "length": 3, "mountainous": false, cities: ["Chicago", "Cleveland"] } ],
  [ "Chicago-Detroit", { "length": 2, "mountainous": false, cities: ["Chicago", "Detroit"] } ],
  [ "Chicago-Des Moines", { "length": 3, "mountainous": false, cities: ["Chicago", "Des Moines"] } ],
  [ "Chicago-Milwaukee", { "length": 1, "mountainous": false, cities: ["Chicago", "Milwaukee"] } ],
  [ "Chicago-Saint Louis", { "length": 3, "mountainous": false, cities: ["Chicago", "Saint Louis"] } ],
  [ "Cincinnati-Cleveland", { "length": 2, "mountainous": false, cities: ["Cincinnati", "Cleveland"] } ],
  [ "Cincinnati-Memphis", { "length": 3, "mountainous": false, cities: ["Cincinnati", "Memphis"] } ],
  [ "Cincinnati-Pittsburgh", { "length": 2, "mountainous": false, cities: ["Cincinnati", "Pittsburgh"] } ],
  [ "Cincinnati-Saint Louis", { "length": 3, "mountainous": false, cities: ["Cincinnati", "Saint Louis"] } ],
  [ "Cleveland-Detroit", { "length": 1, "mountainous": false, cities: ["Cleveland", "Detroit"] } ],
  [ "Cleveland-New York", { "length": 4, "mountainous": true, cities: ["Cleveland", "New York"] } ],
  [ "Cleveland-Pittsburgh", { "length": 1, "mountainous": false, cities: ["Cleveland", "Pittsburgh"] } ],
  [ "Cleveland-Syracuse", { "length": 2, "mountainous": false, cities: ["Cleveland", "Syracuse"] } ],
  [ "Dallas-Houston", { "length": 2, "mountainous": false, cities: ["Dallas", "Houston"] } ],
  [ "Dallas-Memphis", { "length": 4, "mountainous": false, cities: ["Dallas", "Memphis"] } ],
  [ "Dallas-Oklahoma City", { "length": 2, "mountainous": false, cities: ["Dallas", "Oklahoma City"] } ],
  [ "Dallas-Santa Fe", { "length": 5, "mountainous": false, cities: ["Dallas", "Santa Fe"] } ],
  [ "Denver-Kansas City", { "length": 5, "mountainous": false, cities: ["Denver", "Kansas City"] } ],
  [ "Denver-Omaha", { "length": 5, "mountainous": false, cities: ["Denver", "Omaha"] } ],
  [ "Denver-Salt Lake City", { "length": 4, "mountainous": true, cities: ["Denver", "Salt Lake City"] } ],
  [ "Des Moines-Kansas City", { "length": 2, "mountainous": false, cities: ["Des Moines", "Kansas City"] } ],
  [ "Des Moines-Milwaukee", { "length": 3, "mountainous": false, cities: ["Des Moines", "Milwaukee"] } ],
  [ "Des Moines-Minneapolis", { "length": 2, "mountainous": false, cities: ["Des Moines", "Minneapolis"] } ],
  [ "Des Moines-Omaha", { "length": 1, "mountainous": false, cities: ["Des Moines", "Omaha"] } ],
  [ "Des Moines-Saint Louis", { "length": 3, "mountainous": false, cities: ["Des Moines", "Saint Louis"] } ],
  [ "Detroit-Toronto", { "length": 2, "mountainous": false, cities: ["Detroit", "Toronto"] } ],
  [ "Duluth-Fargo", { "length": 2, "mountainous": false, cities: ["Duluth", "Fargo"] } ],
  [ "Duluth-Milwaukee", { "length": 3, "mountainous": false, cities: ["Duluth", "Milwaukee"] } ],
  [ "Duluth-Minneapolis", { "length": 1, "mountainous": false, cities: ["Duluth", "Minneapolis"] } ],
  [ "Duluth-Thunder Bay", { "length": 2, "mountainous": false, cities: ["Duluth", "Thunder Bay"] } ],
  [ "Duluth-Winnipeg", { "length": 3, "mountainous": false, cities: ["Duluth", "Winnipeg"] } ],
  [ "Edmonton-Regina", { "length": 4, "mountainous": false, cities: ["Edmonton", "Regina"] } ],
  [ "Fargo-Minneapolis", { "length": 2, "mountainous": false, cities: ["Fargo", "Minneapolis"] } ],
  [ "Fargo-Winnipeg", { "length": 2, "mountainous": false, cities: ["Fargo", "Winnipeg"] } ],
  [ "Houston-Memphis", { "length": 5, "mountainous": false, cities: ["Houston", "Memphis"] } ],
  [ "Houston-New Orleans", { "length": 3, "mountainous": false, cities: ["Houston", "New Orleans"] } ],
  [ "Houston-Santa Fe", { "length": 5, "mountainous": false, cities: ["Houston", "Santa Fe"] } ],
  [ "Kansas City-Memphis", { "length": 4, "mountainous": false, cities: ["Kansas City", "Memphis"] } ],
  [ "Kansas City-Oklahoma City", { "length": 3, "mountainous": false, cities: ["Kansas City", "Oklahoma City"] } ],
  [ "Kansas City-Omaha", { "length": 2, "mountainous": false, cities: ["Kansas City", "Omaha"] } ],
  [ "Kansas City-Saint Louis", { "length": 2, "mountainous": false, cities: ["Kansas City", "Saint Louis"] } ],
  [ "Kansas City-Santa Fe", { "length": 5, "mountainous": false, cities: ["Kansas City", "Santa Fe"] } ],
  [ "Los Angeles-Phoenix", { "length": 4, "mountainous": true, cities: ["Los Angeles", "Phoenix"] } ],
  [ "Los Angeles-San Diego", { "length": 1, "mountainous": true, cities: ["Los Angeles", "San Diego"] } ],
  [ "Los Angeles-San Francisco", { "length": 4, "mountainous": true, cities: ["Los Angeles", "San Francisco"] } ],
  [ "Memphis-New Orleans", { "length": 4, "mountainous": false, cities: ["Memphis", "New Orleans"] } ],
  [ "Memphis-Oklahoma City", { "length": 4, "mountainous": false, cities: ["Memphis", "Oklahoma City"] } ],
  [ "Memphis-Saint Louis", { "length": 2, "mountainous": false, cities: ["Memphis", "Saint Louis"] } ],
  [ "Milwaukee-Minneapolis", { "length": 3, "mountainous": false, cities: ["Milwaukee", "Minneapolis"] } ],
  [ "Montreal-Ottawa", { "length": 1, "mountainous": false, cities: ["Montreal", "Ottawa"] } ],
  [ "Montreal-Quebec City", { "length": 1, "mountainous": false, cities: ["Montreal", "Quebec City"] } ],
  [ "Montreal-Syracuse", { "length": 2, "mountainous": false, cities: ["Montreal", "Syracuse"] } ],
  [ "New Orleans-Tallahassee", { "length": 3, "mountainous": false, cities: ["New Orleans", "Tallahassee"] } ],
  [ "New York-Philadelphia", { "length": 1, "mountainous": false, cities: ["New York", "Philadelphia"] } ],
  [ "New York-Syracuse", { "length": 2, "mountainous": true, cities: ["New York", "Syracuse"] } ],
  [ "Norfolk-Raleigh", { "length": 1, "mountainous": false, cities: ["Norfolk", "Raleigh"] } ],
  [ "Norfolk-Washington", { "length": 1, "mountainous": false, cities: ["Norfolk", "Washington"] } ],
  [ "Ottawa-Sudbury", { "length": 3, "mountainous": false, cities: ["Ottawa", "Sudbury"] } ],
  [ "Ottawa-Toronto", { "length": 2, "mountainous": false, cities: ["Ottawa", "Toronto"] } ],
  [ "Philadelphia-Pittsburgh", { "length": 2, "mountainous": true, cities: ["Philadelphia", "Pittsburgh"] } ],
  [ "Philadelphia-Washington", { "length": 1, "mountainous": false, cities: ["Philadelphia", "Washington"] } ],
  [ "Phoenix-San Diego", { "length": 3, "mountainous": false, cities: ["Phoenix", "San Diego"] } ],
  [ "Phoenix-Santa Fe", { "length": 3, "mountainous": true, cities: ["Phoenix", "Santa Fe"] } ],
  [ "Pittsburgh-Washington", { "length": 2, "mountainous": true, cities: ["Pittsburgh", "Washington"] } ],
  [ "Portland ME-Quebec City", { "length": 2, "mountainous": true, cities: ["Portland ME", "Quebec City"] } ],
  [ "Portland OR-San Francisco", { "length": 5, "mountainous": false, cities: ["Portland OR", "San Francisco"] } ],
  [ "Portland OR-Seattle", { "length": 1, "mountainous": false, cities: ["Portland OR", "Seattle"] } ],
  [ "Portland OR-Spokane", { "length": 2, "mountainous": false, cities: ["Portland OR", "Spokane"] } ],
  [ "Raleigh-Washington", { "length": 2, "mountainous": false, cities: ["Raleigh", "Washington"] } ],
  [ "Regina-Winnipeg", { "length": 3, "mountainous": false, cities: ["Regina", "Winnipeg"] } ],
  [ "Salt Lake City-San Francisco", { "length": 5, "mountainous": true, cities: ["Salt Lake City", "San Francisco"] } ],
  [ "Salt Lake City-Santa Fe", { "length": 4, "mountainous": true, cities: ["Salt Lake City", "Santa Fe"] } ],
  [ "Savannah-Tampa", { "length": 3, "mountainous": false, cities: ["Savannah", "Tampa"] } ],
  [ "Savannah-Tallahassee", { "length": 2, "mountainous": false, cities: ["Savannah", "Tallahassee"] } ],
  [ "Seattle-Spokane", { "length": 2, "mountainous": true, cities: ["Seattle", "Spokane"] } ],
  [ "Seattle-Vancouver", { "length": 1, "mountainous": false, cities: ["Seattle", "Vancouver"] } ],
  [ "Sudbury-Thunder Bay", { "length": 4, "mountainous": false, cities: ["Sudbury", "Thunder Bay"] } ],
  [ "Sudbury-Toronto", { "length": 2, "mountainous": false, cities: ["Sudbury", "Toronto"] } ],
  [ "Syracuse-Toronto", { "length": 1, "mountainous": false, cities: ["Syracuse", "Toronto"] } ],
  [ "Tallahassee-Tampa", { "length": 2, "mountainous": false, cities: ["Tallahassee", "Tampa"] } ],
  [ "Thunder Bay-Winnipeg", { "length": 4, "mountainous": false, cities: ["Thunder Bay", "Winnipeg"] } ]
]);

/*
 * commodities
 * 
 * key:           name of commodity
 * value: {
 *  regions       [String] - regions with cities that supply the commodity
 *  cities        [String] - cities that supply the commodity
 * }
 */
export const commodities = new Map([
  [ "aluminum", { "regions": ["Eastern"], "cities": ["Portland ME"] } ],
  [ "bauxite", { "regions": ["Central"], "cities": ["Memphis"] } ],
  [ "cattle", { "regions": ["Central"], "cities": ["Kansas City", "Thunder Bay", "Winnipeg"] } ],
  [ "coal", { "regions": ["Central", "Eastern", "Western"], "cities": ["Atlanta", "Butte", "Calgary", "Chicago", "Cincinnati", "Pittsburgh"] } ],
  [ "copper", { "regions": ["Western"], "cities": ["Boise", "Calgary", "Phoenix"] } ],
  [ "cotton", { "regions": ["Central", "Eastern"], "cities": ["Atlanta", "Charleston", "Dallas"] } ],
  [ "fish", { "regions": ["Central", "Western"], "cities": ["New Orleans", "Seattle", "Vancouver"] } ],
  [ "fruit", { "regions": ["Eastern", "Western"], "cities": ["Los Angeles", "San Diego", "Tampa"] } ],
  [ "grain", { "regions": ["Central"], "cities": ["Des Moines", "Kansas City", "Minneapolis", "Omaha", "Winnipeg"] } ],
  [ "imports", { "regions": ["Eastern", "Western"], "cities": ["Boston", "Los Angeles", "New York", "Philadelphia", "Quebec City", "San Francisco"] } ],
  [ "iron ore", { "regions": ["Central", "Western"], "cities": ["Duluth", "Minneapolis", "Salt Lake City", "Thunder Bay"] } ],
  [ "lead", { "regions": ["Western"], "cities": ["Butte", "Calgary", "Denver", "Regina"] } ],
  [ "machinery", { "regions": ["Central", "Eastern"], "cities": ["Boston", "Chicago", "Detroit", "Milwaukee", "Syracuse", "Toronto"] } ],
  [ "nickel", { "regions": ["Central", "Western"], "cities": ["Regina", "Sudbury"] } ],
  [ "oil", { "regions": ["Central", "Western"], "cities": ["Dallas", "Edmonton", "Houston", "Oklahoma City"] } ],
  [ "pork", { "regions": ["Central"], "cities": ["Des Moines", "Fargo", "Minneapolis"] } ],
  [ "precious metals", { "regions": ["Western"], "cities": ["San Francisco", "Vancouver"] } ],
  [ "rice", { "regions": ["Central"], "cities": ["Houston", "New Orleans"] } ],
  [ "sheep", { "regions": ["Western"], "cities": ["Butte", "Denver", "Salt Lake City"] } ],
  [ "steel", { "regions": ["Eastern"], "cities": ["Birmingham", "Pittsburgh"] } ],
  [ "textiles", { "regions": ["Eastern"], "cities": ["Atlanta", "Raleigh", "Savannah", "Tallahassee"] } ],
  [ "tobacco", { "regions": ["Eastern"], "cities": ["Charleston", "Norfolk", "Raleigh"] } ],
  [ "tourists", { "regions": ["Central", "Eastern"], "cities": ["Chicago", "New York", "Philadelphia"] } ],
  [ "wine", { "regions": ["Western"], "cities": ["Los Angeles", "San Francisco", "Spokane"] } ],
  [ "wood", { "regions": ["Eastern", "Western"], "cities": ["Ottawa", "Portland ME", "Portland OR", "Quebec City", "Seattle", "Vancouver"] } ],
]);
