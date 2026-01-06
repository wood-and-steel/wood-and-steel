import { useGameStore } from '../stores/gameStore';

/**
 * Deep comparison utility for comparing two objects
 * @param {any} a - First object
 * @param {any} b - Second object
 * @returns {boolean} - True if objects are deeply equal
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * Filter out internal properties (prefixed with underscore) from an object
 * @param {Object} obj - Object to filter
 * @returns {Object} - Object with only public properties
 */
function filterPublicProperties(obj) {
  if (obj == null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => filterPublicProperties(item));
  }
  
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, value]) => [key, filterPublicProperties(value)])
  );
}

/**
 * Compare Zustand store state with bgio state
 * Only compares public properties (ignores internal properties prefixed with underscore)
 * @param {Object} bgioG - Game state from bgio
 * @param {Object} bgioCtx - Context from bgio
 * @returns {Object} - Comparison results
 */
export function compareStates(bgioG, bgioCtx) {
  const zustandState = useGameStore.getState();
  const zustandG = zustandState.G;
  const zustandCtx = zustandState.ctx;

  // Filter out internal properties from bgio ctx for comparison
  const publicBgioCtx = filterPublicProperties(bgioCtx);
  
  // Zustand ctx should already have internal properties filtered, but filter to be safe
  const publicZustandCtx = filterPublicProperties(zustandCtx);

  const comparison = {
    G: {
      equal: deepEqual(bgioG, zustandG),
      differences: findDifferences(bgioG, zustandG, 'G', true),
    },
    ctx: {
      equal: deepEqual(publicBgioCtx, publicZustandCtx),
      differences: findDifferences(publicBgioCtx, publicZustandCtx, 'ctx', true),
    },
    summary: {
      inSync: deepEqual(bgioG, zustandG) && deepEqual(publicBgioCtx, publicZustandCtx),
      bgioState: { G: bgioG, ctx: publicBgioCtx },
      zustandState: { G: zustandG, ctx: publicZustandCtx },
    },
  };

  return comparison;
}

/**
 * Find differences between two objects
 * @param {any} a - First object
 * @param {any} b - Second object
 * @param {string} path - Current path in object tree
 * @param {boolean} skipInternal - Whether to skip internal properties (prefixed with underscore)
 * @returns {Array} - Array of difference descriptions
 */
function findDifferences(a, b, path = '', skipInternal = false) {
  const differences = [];

  if (a === b) return differences;

  if (a == null || b == null) {
    differences.push({
      path,
      bgio: a,
      zustand: b,
      type: a == null ? 'missing_in_bgio' : 'missing_in_zustand',
    });
    return differences;
  }

  if (typeof a !== 'object' || typeof b !== 'object') {
    if (a !== b) {
      differences.push({
        path,
        bgio: a,
        zustand: b,
        type: 'value_mismatch',
      });
    }
    return differences;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const maxLength = Math.max(a.length, b.length);
    for (let i = 0; i < maxLength; i++) {
      if (i >= a.length) {
        differences.push({
          path: `${path}[${i}]`,
          bgio: undefined,
          zustand: b[i],
          type: 'missing_in_bgio',
        });
      } else if (i >= b.length) {
        differences.push({
          path: `${path}[${i}]`,
          bgio: a[i],
          zustand: undefined,
          type: 'missing_in_zustand',
        });
      } else {
        differences.push(...findDifferences(a[i], b[i], `${path}[${i}]`, skipInternal));
      }
    }
    return differences;
  }

  // Filter out internal properties if skipInternal is true
  const keysA = Object.keys(a).filter(key => !skipInternal || !key.startsWith('_'));
  const keysB = Object.keys(b).filter(key => !skipInternal || !key.startsWith('_'));
  const allKeys = new Set([...keysA, ...keysB]);
  
  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    if (!(key in a)) {
      differences.push({
        path: newPath,
        bgio: undefined,
        zustand: b[key],
        type: 'missing_in_bgio',
      });
    } else if (!(key in b)) {
      differences.push({
        path: newPath,
        bgio: a[key],
        zustand: undefined,
        type: 'missing_in_zustand',
      });
    } else {
      differences.push(...findDifferences(a[key], b[key], newPath, skipInternal));
    }
  }

  return differences;
}

/**
 * Get current Zustand store state
 * @returns {Object} - Current store state
 */
export function getZustandState() {
  return useGameStore.getState();
}

/**
 * Log comparison results to console
 * @param {Object} bgioG - Game state from bgio
 * @param {Object} bgioCtx - Context from bgio
 */
export function logStateComparison(bgioG, bgioCtx) {
  const comparison = compareStates(bgioG, bgioCtx);
  
  console.group('🔍 State Comparison: bgio vs Zustand');
  
  if (comparison.summary.inSync) {
    console.log('✅ States are in sync!');
  } else {
    console.warn('⚠️ States are NOT in sync');
    
    if (comparison.G.differences.length > 0) {
      console.group('📊 G (Game State) Differences:');
      comparison.G.differences.forEach(diff => {
        console.log(`Path: ${diff.path}`);
        console.log(`  bgio:`, diff.bgio);
        console.log(`  zustand:`, diff.zustand);
        console.log(`  type: ${diff.type}`);
      });
      console.groupEnd();
    }
    
    if (comparison.ctx.differences.length > 0) {
      console.group('📊 ctx (Context) Differences:');
      comparison.ctx.differences.forEach(diff => {
        console.log(`Path: ${diff.path}`);
        console.log(`  bgio:`, diff.bgio);
        console.log(`  zustand:`, diff.zustand);
        console.log(`  type: ${diff.type}`);
      });
      console.groupEnd();
    }
  }
  
  console.group('📦 Full State Objects (public properties only)');
  console.log('bgio:', { G: bgioG, ctx: comparison.summary.bgioState.ctx });
  console.log('zustand:', comparison.summary.zustandState);
  console.groupEnd();
  
  console.groupEnd();
  
  return comparison;
}
