/**
 * Randomly pick a key from a map, weighted by the relative integer value of the keys
 *
 * @param {Map<any, number>} weightedMap - Map where the keys are the choices and values are their integer weights
 * @returns {any} - Randomly selected key from weightedMap
 */
export function weightedRandom(weightedMap) {
  let chosenKey = undefined;
  const sumValues = weightedMap.values().reduce((accumulator, currentValue) => accumulator + currentValue, 0);

  const finalDieRoll = Math.floor(Math.random() * sumValues);
  let skipped = 0;
  weightedMap.forEach((value, choice) => {
    if (finalDieRoll < value + skipped && !chosenKey)
      chosenKey = choice
    else
      skipped += value;
  });

  return chosenKey;
}

/**
* Like Math.random(), but with a Gaussian distribution
*  
* @returns {number} - Number between 0 and 1
 */
export function gaussianRandom() {
  const val = Math.sqrt( -2.0 * Math.log( 1 - Math.random() ) ) * Math.cos( 2.0 * Math.PI * Math.random() );
  if (val < 0.0 || val > 1.0) {
    // Happens <0.02% of the time
    return Math.random();
  } else {
    return val;
  }
}
