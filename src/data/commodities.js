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
  [ "aluminum", { "regions": ["NE"], "cities": ["Portland ME"] } ],
  [ "bauxite", { "regions": ["SC"], "cities": ["Memphis"] } ],
  [ "cattle", { "regions": ["NC", "NW", "SC"], "cities": ["Kansas City", "Thunder Bay", "Winnipeg"] } ],
  [ "coal", { "regions": ["NC", "NE", "NW", "SC", "SE"], "cities": ["Atlanta", "Butte", "Calgary", "Chicago", "Cincinnati", "Pittsburgh"] } ],
  [ "copper", { "regions": ["NW", "SW"], "cities": ["Boise", "Calgary", "Phoenix"] } ],
  [ "cotton", { "regions": ["SC", "SE"], "cities": ["Atlanta", "Charleston", "Dallas"] } ],
  [ "fish", { "regions": ["NW", "SC"], "cities": ["New Orleans", "Seattle", "Vancouver"] } ],
  [ "fruit", { "regions": ["SE", "SW"], "cities": ["Los Angeles", "San Diego", "Tampa"] } ],
  [ "grain", { "regions": ["NC", "NW", "SC"], "cities": ["Des Moines", "Kansas City", "Minneapolis", "Omaha", "Winnipeg"] } ],
  [ "imports", { "regions": ["NE", "SW"], "cities": ["Boston", "Los Angeles", "New York", "Philadelphia", "Quebec City", "San Francisco"] } ],
  [ "iron ore", { "regions": ["NC", "SW"], "cities": ["Duluth", "Minneapolis", "Salt Lake City", "Thunder Bay"] } ],
  [ "lead", { "regions": ["NW", "SW"], "cities": ["Butte", "Calgary", "Denver", "Regina"] } ],
  [ "machinery", { "regions": ["NC", "NE"], "cities": ["Boston", "Chicago", "Detroit", "Milwaukee", "Syracuse", "Toronto"] } ],
  [ "nickel", { "regions": ["NC", "NW"], "cities": ["Regina", "Sudbury"] } ],
  [ "oil", { "regions": ["SC"], "cities": ["Dallas", "Houston", "Oklahoma City"] } ],
  [ "pork", { "regions": ["NC", "SC"], "cities": ["Des Moines", "Fargo", "Minneapolis"] } ],
  [ "precious metals", { "regions": ["NW", "SW"], "cities": ["San Francisco", "Vancouver"] } ],
  [ "rice", { "regions": ["SC"], "cities": ["Houston", "New Orleans"] } ],
  [ "sheep", { "regions": ["NW", "SW"], "cities": ["Butte", "Denver", "Salt Lake City"] } ],
  [ "steel", { "regions": ["NE", "SE"], "cities": ["Birmingham", "Pittsburgh"] } ],
  [ "textiles", { "regions": ["SE"], "cities": ["Atlanta", "Raleigh", "Savannah", "Tallahassee"] } ],
  [ "tobacco", { "regions": ["SE"], "cities": ["Charleston", "Norfolk", "Raleigh"] } ],
  [ "tourists", { "regions": ["NC", "NE"], "cities": ["Chicago", "New York", "Philadelphia"] } ],
  [ "wine", { "regions": ["NW", "SW"], "cities": ["Los Angeles", "San Francisco", "Spokane"] } ],
  [ "wood", { "regions": ["NE", "NW"], "cities": ["Ottawa", "Portland ME", "Portland OR", "Quebec City", "Seattle", "Vancouver"] } ]
]);
