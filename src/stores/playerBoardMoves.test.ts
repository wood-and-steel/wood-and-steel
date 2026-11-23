/**
 * Moves that track the player board and money (docs/PLAYER_APP_REDESIGN_PLAN.md, Moves): cash
 * never goes negative, each move's rules are enforced, money changes reach this turn's ledger,
 * and Undo and End turn behave.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { moneyValue, type Contract } from '../Contract';
import {
  acquireIndependentRailroad,
  borrow,
  buyEngine,
  buyUpgrade,
  claimMarketContract,
  independentRailroadPrice,
  payForTrack,
  repay,
  setCargo,
  setPlayerBoard,
  toggleContractFulfilled,
} from './gameActions';
import { useGameStore, type PlayerProps } from './gameStore';
import { endTurn } from './events';

const me = (): PlayerProps => useGameStore.getState().G.players.find(([id]) => id === '0')![1];
const them = (): PlayerProps => useGameStore.getState().G.players.find(([id]) => id === '1')![1];
const ledger = () => useGameStore.getState().G.turnLedger;

/** Player 0's turn in play with starting cities; `board` changes player 0's props. Snapshot taken. */
function setUp(board: Partial<PlayerProps> = {}, other: Partial<PlayerProps> = {}) {
  useGameStore.getState().resetState(2);
  useGameStore.setState((s) => ({
    G: {
      ...s.G,
      players: s.G.players.map(([id, p]) => [
        id,
        id === '0'
          ? { ...p, activeCities: ['Boston', 'Portland ME'], ...board }
          : { ...p, activeCities: ['Norfolk', 'Raleigh'], ...other },
      ]),
    },
    ctx: { ...s.ctx, phase: 'play' },
  }));
  const { G, ctx } = useGameStore.getState();
  useGameStore.getState().setTurnStartSnapshot({ G, ctx });
}

/** Adds an unfulfilled contract held by player 0. */
function holdContract(contract: Partial<Contract>): Contract {
  const c: Contract = {
    id: 'k1',
    commodity: 'coal',
    destinationKey: 'Boston',
    type: 'private',
    fulfilled: false,
    playerID: '0',
    creationTime: 0,
    turnsHeld: 0,
    ...contract,
  };
  useGameStore.setState((s) => ({ G: { ...s.G, contracts: [c, ...s.G.contracts] } }));
  return c;
}

beforeEach(() => setUp());

describe('borrowing and repaying', () => {
  test('borrowing adds to cash and debt in $5,000 steps, with no limit', () => {
    expect(borrow(25000)).toBe(true);
    expect(me()).toMatchObject({ cash: 35000, debt: 25000 });
    expect(ledger()).toEqual({ playerID: '0', entries: [{ label: 'Borrowed', amount: 25000 }] });
    expect(borrow(2500)).toBe(false);
    expect(borrow(0)).toBe(false);
    expect(borrow(-5000)).toBe(false);
  });

  test('repaying needs $20,000+ debt, never goes below $15,000, and needs the cash', () => {
    setUp({ debt: 15000, cash: 20000 });
    expect(repay(5000)).toBe(false);
    setUp({ debt: 25000, cash: 20000 });
    expect(repay(15000)).toBe(false);
    expect(repay(10000)).toBe(true);
    expect(me()).toMatchObject({ cash: 10000, debt: 15000 });
    setUp({ debt: 20000, cash: 4000 });
    expect(repay(5000)).toBe(false);
  });
});

describe('paying for track', () => {
  test('takes a typed amount in $1,000 units, never more than the cash', () => {
    expect(payForTrack(7000)).toBe(true);
    expect(me().cash).toBe(3000);
    expect(payForTrack(4000)).toBe(false);
    expect(payForTrack(1500)).toBe(false);
    expect(me().cash).toBe(3000);
    expect(ledger()?.entries).toEqual([{ label: 'Paid for track', amount: -7000 }]);
  });
});

describe('buying an engine', () => {
  test('trades in the engine on that token for half its price', () => {
    expect(buyEngine(0, 'american')).toBe(true);
    expect(me()).toMatchObject({ engines: ['american', null], cash: 5000 });
    expect(ledger()?.entries).toEqual([{ label: 'Bought 4-4-0 American, trading in 2-4-0 John Bull', amount: -5000 }]);
  });

  test('puts a new engine on an empty token, keeping each token’s cargo', () => {
    setUp({ engines: ['american', null], cargo: ['coal', null], cash: 20000 });
    expect(buyEngine(1, 'mogul')).toBe(true);
    expect(me()).toMatchObject({ engines: ['american', 'mogul'], cargo: ['coal', null], cash: 13000 });
    expect(buyEngine(0, 'consolidation')).toBe(true); // $10,000 less the American's $2,000
    expect(me()).toMatchObject({ engines: ['consolidation', 'mogul'], cargo: ['coal', null], cash: 5000 });
  });

  test('only one level up, or two with a Hub for $5,000 more', () => {
    setUp({ cash: 50000 });
    expect(buyEngine(1, 'mogul')).toBe(false);
    setUp({ cash: 50000, hubCity: 'Boston' });
    expect(buyEngine(1, 'mogul')).toBe(true);
    expect(me().cash).toBe(50000 - 7000 - 5000);
  });

  test('refused without the cash', () => {
    setUp({ cash: 4000 });
    expect(buyEngine(0, 'american')).toBe(false);
    expect(me()).toMatchObject({ engines: ['john-bull', null], cash: 4000 });
  });

  test('the first Mogul on the table fills the market tableau', () => {
    const open = () => useGameStore.getState().G.contracts.filter((c) => c.type === 'market' && c.playerID === null);
    setUp({ engines: ['american', null], cash: 20000 });
    expect(buyEngine(1, 'mogul')).toBe(true);
    expect(open()).toHaveLength(3);

    setUp({ engines: ['american', null], cash: 20000 }, { engines: ['mogul', null] });
    expect(buyEngine(1, 'mogul')).toBe(true);
    expect(open()).toHaveLength(0);
  });
});

describe('buying an upgrade', () => {
  test('charges the price and records it once', () => {
    setUp({ cash: 30000 });
    expect(buyUpgrade('timetable')).toBe(true);
    expect(me()).toMatchObject({ upgrades: ['timetable'], cash: 15000 });
    expect(buyUpgrade('timetable')).toBe(false);
    expect(ledger()?.entries).toEqual([{ label: 'Bought Timetable', amount: -15000 }]);
  });

  test('a Railyard needs no city', () => {
    setUp({ cash: 10000 });
    expect(buyUpgrade('railyard')).toBe(true);
    expect(me()).toMatchObject({ upgrades: ['railyard'], cash: 0 });
  });

  test('refused without the cash', () => {
    expect(buyUpgrade('timetable')).toBe(false);
    expect(me()).toMatchObject({ upgrades: [], cash: 10000 });
  });

  test('the Service Yard opens once anyone owns a Consolidation', () => {
    setUp({ cash: 30000 });
    expect(buyUpgrade('service-yard')).toBe(false);
    setUp({ cash: 30000 }, { engines: ['consolidation', null] });
    expect(buyUpgrade('service-yard')).toBe(true);
  });

  test('a Hub needs a city no one else has, and joins the active cities', () => {
    setUp({ cash: 30000 }, { hubCity: 'Raleigh' });
    expect(buyUpgrade('hub')).toBe(false);
    expect(buyUpgrade('hub', 'Raleigh')).toBe(false);
    expect(buyUpgrade('hub', 'New York')).toBe(true);
    expect(me()).toMatchObject({ hubCity: 'New York', cash: 15000 });
    expect(me().activeCities).toContain('New York');
    expect(ledger()?.entries).toEqual([{ label: 'Bought Hub (New York)', amount: -15000 }]);
  });

  test('a Regional Office needs a region no one else has', () => {
    setUp({ cash: 30000 }, { regionalOffice: 'SE' });
    expect(buyUpgrade('regional-office', 'SE')).toBe(false);
    expect(buyUpgrade('regional-office', 'XX')).toBe(false);
    expect(buyUpgrade('regional-office', 'NE')).toBe(true);
    expect(me()).toMatchObject({ regionalOffice: 'NE', cash: 10000 });
  });

  test('a Commodities Exchange needs a monopolizable commodity no one else holds', () => {
    setUp({ cash: 30000 }, { exchangeCommodity: 'coal', upgrades: ['commodities-exchange'] });
    expect(buyUpgrade('commodities-exchange', 'wine')).toBe(false);
    expect(buyUpgrade('commodities-exchange', 'coal')).toBe(false);
    expect(buyUpgrade('commodities-exchange', 'grain')).toBe(true);
    expect(me()).toMatchObject({ exchangeCommodity: 'grain', upgrades: ['commodities-exchange'], cash: 10000 });
  });
});

describe('cargo', () => {
  test('records or clears cargo on a token with an engine', () => {
    expect(setCargo(0, 'machinery')).toBe(true);
    expect(me().cargo).toEqual(['machinery', null]);
    expect(setCargo(1, 'coal')).toBe(false);
    expect(setCargo(0, 'unobtainium')).toBe(false);
    expect(setCargo(0, null)).toBe(true);
    expect(me().cargo).toEqual([null, null]);
    expect(ledger()).toBeUndefined();
  });
});

describe('fulfilling a contract', () => {
  test('pays the contract value with no debt service in the East', () => {
    setUp({ debt: 10000 });
    const c = holdContract({ commodity: 'coal', destinationKey: 'Boston' });
    expect(toggleContractFulfilled(c.id)).toBe(true);
    const value = moneyValue(c);
    expect(me().cash).toBe(10000 + value);
    expect(ledger()?.entries).toEqual([{ label: 'Delivered coal to Boston', amount: value }]);
  });

  test('charges one-time debt service on the first Central delivery only', () => {
    setUp({ debt: 10000 });
    const c = holdContract({ commodity: 'cotton', destinationKey: 'Chicago' });
    expect(toggleContractFulfilled(c.id)).toBe(true);
    expect(me()).toMatchObject({ cash: 10000 + moneyValue(c) - 2000, centralDebtServicePaid: true, westernDeliveryMade: false });
    expect(ledger()?.entries.slice(-1)).toEqual([{ label: 'Debt service', amount: -2000 }]);
    const again = holdContract({ id: 'k2', commodity: 'wood', destinationKey: 'Chicago' });
    const before = me().cash;
    toggleContractFulfilled(again.id);
    expect(me().cash).toBe(before + moneyValue(again));
  });

  test('charges debt service on every delivery after the first Western one', () => {
    setUp({ debt: 15000 });
    const west = holdContract({ commodity: 'coal', destinationKey: 'Boise' });
    toggleContractFulfilled(west.id);
    expect(me()).toMatchObject({ cash: 10000 + moneyValue(west) - 3000, westernDeliveryMade: true });
    const east = holdContract({ id: 'k2', commodity: 'coal', destinationKey: 'Boston' });
    const before = me().cash;
    toggleContractFulfilled(east.id);
    expect(me().cash).toBe(before + moneyValue(east) - 3000);
  });

  test('a Mountain or Challenger earns 1 1/3x (rounded down to $1,000), plus Upgraded Stations', () => {
    setUp({ engines: ['mountain', 'prairie'], upgrades: ['upgraded-stations'] });
    const c = holdContract({ commodity: 'coal', destinationKey: 'Boston' });
    const value = moneyValue(c);
    toggleContractFulfilled(c.id, 0);
    expect(me().cash).toBe(10000 + Math.floor((value * 4) / 3 / 1000) * 1000 + 3000);
  });

  test('without the delivering engine, the bonus applies only when both engines would earn it', () => {
    setUp({ engines: ['mountain', 'prairie'] });
    const c = holdContract({ commodity: 'coal', destinationKey: 'Boston' });
    toggleContractFulfilled(c.id);
    expect(me().cash).toBe(10000 + moneyValue(c));
    setUp({ engines: ['mountain', null] });
    const d = holdContract({ commodity: 'coal', destinationKey: 'Boston' });
    toggleContractFulfilled(d.id);
    expect(me().cash).toBe(10000 + Math.floor((moneyValue(d) * 4) / 3 / 1000) * 1000);
  });

  test('works whether or not cargo was recorded, and clears matching cargo', () => {
    setUp({ cargo: ['coal', null] });
    const c = holdContract({ commodity: 'coal', destinationKey: 'Boston' });
    expect(toggleContractFulfilled(c.id)).toBe(true);
    expect(me().cargo).toEqual([null, null]);
    expect(me().activeCities).toContain('Boston');
  });

  test('is blocked when debt service would take more than the payout plus cash', () => {
    setUp({ cash: 0, debt: 200000, westernDeliveryMade: true });
    const c = holdContract({ commodity: 'coal', destinationKey: 'Boston' });
    expect(toggleContractFulfilled(c.id)).toBe(false);
    expect(useGameStore.getState().G.contracts[0].fulfilled).toBe(false);
    expect(me().cash).toBe(0);
  });
});

describe('independent railroads', () => {
  const erie = { Erie: { name: 'Erie', routes: [{ key: 'Boston-Syracuse', addedInRound: 0 }, { key: 'Buffalo-Syracuse', addedInRound: 1 }] } };

  test('cost $3,000 per route, and the player must afford it', () => {
    useGameStore.setState((s) => ({ G: { ...s.G, independentRailroads: erie } }));
    expect(independentRailroadPrice(useGameStore.getState().G, 'Erie')).toBe(6000);
    expect(acquireIndependentRailroad('Erie')).toBe(true);
    expect(me().cash).toBe(4000);
    expect(ledger()?.entries).toEqual([{ label: 'Acquired Erie', amount: -6000 }]);

    setUp({ cash: 5000 });
    useGameStore.setState((s) => ({ G: { ...s.G, independentRailroads: erie } }));
    expect(acquireIndependentRailroad('Erie')).toBe(false);
    expect(useGameStore.getState().G.independentRailroads).toHaveProperty('Erie');
  });

  test('cost $4,000 per route once anyone has delivered to the West', () => {
    useGameStore.setState((s) => ({ G: { ...s.G, independentRailroads: erie } }));
    holdContract({ commodity: 'coal', destinationKey: 'Boise', playerID: '1', fulfilled: true });
    expect(independentRailroadPrice(useGameStore.getState().G, 'Erie')).toBe(8000);
  });
});

describe('claiming a market contract', () => {
  const market = (id = 'm1') => holdContract({ id, type: 'market', playerID: null, commodity: 'coal', destinationKey: 'Boston' });

  test('needs a Mogul or better', () => {
    market();
    expect(claimMarketContract('m1')).toBe(false);
    setUp({ engines: ['mogul', null] });
    market();
    expect(claimMarketContract('m1')).toBe(true);
  });

  test('holds only one claimed contract at a time', () => {
    setUp({ engines: ['mogul', null] });
    market('m1');
    market('m2');
    expect(claimMarketContract('m1')).toBe(true);
    expect(claimMarketContract('m2')).toBe(false);
  });

  test('can record the commodity on an engine', () => {
    setUp({ engines: ['mogul', 'american'] });
    market();
    expect(claimMarketContract('m1', 1)).toBe(true);
    expect(me().cargo).toEqual([null, 'coal']);
  });
});

describe('the turn', () => {
  test('ending the turn clears the money log', () => {
    borrow(5000);
    expect(ledger()).toBeDefined();
    endTurn();
    expect(ledger()).toBeUndefined();
  });

  test('Undo restores money, engines and the money log', () => {
    borrow(5000);
    buyEngine(0, 'american');
    useGameStore.getState().undoCurrentTurn();
    expect(me()).toMatchObject({ cash: 10000, debt: 0, engines: ['john-bull', null] });
    expect(ledger()).toBeUndefined();
  });

  test('the money log belongs to the current player', () => {
    borrow(5000);
    expect(them().cash).toBe(10000);
    expect(ledger()?.playerID).toBe('0');
  });
});

describe('playtest fix-up', () => {
  test("sets any player's board, falling back to start values for anything invalid", () => {
    expect(setPlayerBoard('1', { cash: 3000, debt: 15000, engines: ['mogul', null], upgrades: ['timetable'] })).toBe(true);
    expect(them()).toMatchObject({ cash: 3000, debt: 15000, engines: ['mogul', null], upgrades: ['timetable'] });
    expect(setPlayerBoard('1', { debt: 7500 })).toBe(true);
    expect(them().debt).toBe(0);
    expect(setPlayerBoard('9', { cash: 1000 })).toBe(false);
  });
});

