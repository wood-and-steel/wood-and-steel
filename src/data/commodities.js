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
  [ "oil", { "regions": ["Central"], "cities": ["Dallas", "Houston", "Oklahoma City"] } ],
  [ "pork", { "regions": ["Central"], "cities": ["Des Moines", "Fargo", "Minneapolis"] } ],
  [ "precious metals", { "regions": ["Western"], "cities": ["San Francisco", "Vancouver"] } ],
  [ "rice", { "regions": ["Central"], "cities": ["Houston", "New Orleans"] } ],
  [ "sheep", { "regions": ["Western"], "cities": ["Butte", "Denver", "Salt Lake City"] } ],
  [ "steel", { "regions": ["Eastern"], "cities": ["Birmingham", "Pittsburgh"] } ],
  [ "textiles", { "regions": ["Eastern"], "cities": ["Atlanta", "Raleigh", "Savannah", "Tallahassee"] } ],
  [ "tobacco", { "regions": ["Eastern"], "cities": ["Charleston", "Norfolk", "Raleigh"] } ],
  [ "tourists", { "regions": ["Central", "Eastern"], "cities": ["Chicago", "New York", "Philadelphia"] } ],
  [ "wine", { "regions": ["Western"], "cities": ["Los Angeles", "San Francisco", "Spokane"] } ],
  [ "wood", { "regions": ["Eastern", "Western"], "cities": ["Ottawa", "Portland ME", "Portland OR", "Quebec City", "Seattle", "Vancouver"] } ]
]);
