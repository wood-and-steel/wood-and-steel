/**
 * Randomly pick a key from a map, weighted by the relative integer value of the keys
 *
 * @export
 * @param {Map<any, number>} weightedMap - Map where the keys are the choices and values are their integer weights
 * @returns {any} - Randomly selected key from weightedMap, or undefined if map is empty or all weights are zero
 */
export function weightedRandom(weightedMap) {
  if (!weightedMap || weightedMap.size === 0) {
    return undefined;
  }

  const sumValues = [...weightedMap.values()].reduce((accumulator, currentValue) => accumulator + currentValue, 0);

  if (sumValues <= 0) {
    console.warn('weightedRandom: sum of weights is zero or negative');
    return undefined;
  }

  const finalDieRoll = Math.floor(Math.random() * sumValues);
  let skipped = 0;
  
  for (const [choice, value] of weightedMap) {
    if (finalDieRoll < value + skipped) {
      return choice;
    }
    skipped += value;
  }

  // Fallback (should never reach here with valid input)
  return undefined;
}

// Standard deviation divisor for Gaussian distribution
// Value of 10.0 produces a distribution that fits well within [0, 1] range when centered at 0.5
const GAUSSIAN_STD_DEV_DIVISOR = 10.0;

// Maximum recursion depth for resampling out-of-range values
const MAX_GAUSSIAN_ITERATIONS = 10;

/**
 * Generate a random number with a Gaussian (normal) distribution between 0 and 1
 * Uses the Box-Muller transform to convert uniform random values to Gaussian distribution.
 *
 * @export
 * @returns {number} - Random number between 0 and 1 with Gaussian distribution, clamped to range
 */
export function gaussianRandom() {
  return _gaussianRandomInternal(0);
}

/**
 * Internal implementation of gaussianRandom with recursion counter
 *
 * @param {number} iterations - Internal counter to prevent infinite recursion
 * @returns {number} - Random number between 0 and 1 with Gaussian distribution
 */
function _gaussianRandomInternal(iterations) {
  // Box-Muller transform to generate Gaussian distribution
  const u = 1 - Math.random(); // Subtract to flip [0, 1) to (0, 1] (avoid log(0))
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * Math.random());
  
  // Scale and translate: divide by std dev divisor and shift to center at 0.5
  num = num / GAUSSIAN_STD_DEV_DIVISOR + 0.5;

  // Resample if outside [0, 1] range (rare, but possible with extreme values)
  if (num > 1 || num < 0) {
    if (iterations < MAX_GAUSSIAN_ITERATIONS) {
      return _gaussianRandomInternal(iterations + 1);
    } else {
      // After max iterations, fall back to uniform distribution
      // Note: This is extremely rare but ensures function always returns a valid value
      // Tradeoff: silently changes distribution type, but prevents potential infinite recursion
      console.warn('gaussianRandom: exceeded max iterations, falling back to uniform distribution');
      return Math.random();
    }
  }

  return num;
}


/**
 * Chooses a random item from an array
 *
 * @export
 * @param {Array<unknown>} arr - Array of length 1+ 
 * @returns {*} - A random item from that array, or undefined if array is empty
 */
export function randomArrayItem(arr) {
  if (arr && arr.length > 0) {
    return arr[Math.floor(Math.random() * arr.length)];
  } else {
    return undefined;
  }
}


/**
 * Chooses a random item from a Set
 *
 * @export
 * @param {Set<unknown>} set - Set to select from
 * @returns {*} - Randomly selected element, or undefined if set is empty
 */
export function randomSetItem(set) {
  if (set && set.size > 0) {
    const array = [...set];
    return array[Math.floor(Math.random() * array.length)];
  } else {
    return undefined;
  }
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm
 * 
 * @export
 * @param {Array<unknown>} array - Array to shuffle
 * @returns {Array<unknown>} - The same array, shuffled in place
 */
export function shuffleArray(array) {
  if (!array || array.length <= 1) {
    return array;
  }
  
  // Fisher-Yates shuffle
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  
  return array;
}
