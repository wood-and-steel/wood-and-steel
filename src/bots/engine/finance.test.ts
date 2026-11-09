import { describe, expect, test } from 'vitest';
import { moneyValue } from '../../Contract';
import { borrowOptions, debtServiceForDelivery, deliveryPayment, repayOptions, serviceOn } from './finance';

const fresh = { debt: 15000, centralDebtServicePaid: false, westernDeliveryMade: false };

describe('debt service', () => {
  test('$1,000 per $5,000 borrowed', () => {
    expect(serviceOn(0)).toBe(0);
    expect(serviceOn(15000)).toBe(3000);
  });

  test('none for Northeast and Southeast deliveries', () => {
    expect(debtServiceForDelivery(fresh, 'Philadelphia')).toEqual({ service: 0, centralDebtServicePaid: false, westernDeliveryMade: false });
    expect(debtServiceForDelivery(fresh, 'Atlanta').service).toBe(0);
  });

  test('once on the first Central delivery', () => {
    const first = debtServiceForDelivery(fresh, 'Chicago');
    expect(first).toEqual({ service: 3000, centralDebtServicePaid: true, westernDeliveryMade: false });
    expect(debtServiceForDelivery({ ...fresh, centralDebtServicePaid: true }, 'Chicago').service).toBe(0);
  });

  test('on every delivery after the first Western one, wherever it goes', () => {
    expect(debtServiceForDelivery(fresh, 'Denver')).toEqual({ service: 3000, centralDebtServicePaid: false, westernDeliveryMade: true });
    expect(debtServiceForDelivery({ ...fresh, westernDeliveryMade: true }, 'Boston').service).toBe(3000);
  });
});

describe('deliveryPayment', () => {
  const contract = { commodity: 'coal', destinationKey: 'Boston' };
  const value = moneyValue(contract);

  test('contract value, plus $3,000 with Upgraded Stations', () => {
    expect(value).toBeGreaterThan(0);
    expect(deliveryPayment(contract, 'american', false)).toBe(value);
    expect(deliveryPayment(contract, 'american', true)).toBe(value + 3000);
  });

  test('Mountain and Challenger earn 1 1/3x, rounded down to $1,000', () => {
    expect(deliveryPayment(contract, 'mountain', false)).toBe(Math.floor((value * 4) / 3 / 1000) * 1000);
    expect(deliveryPayment(contract, 'challenger', true)).toBe(Math.floor((value * 4) / 3 / 1000) * 1000 + 3000);
  });
});

describe('borrowing and repaying', () => {
  test('borrow in $5,000 steps', () => {
    expect(borrowOptions()).toEqual([5000, 10000, 15000, 20000, 25000, 30000]);
  });

  test('repay $5,000 or $10,000, never below $15,000 of debt, and only with the cash', () => {
    expect(repayOptions({ debt: 15000, cash: 50000 })).toEqual([]);
    expect(repayOptions({ debt: 20000, cash: 50000 })).toEqual([5000]);
    expect(repayOptions({ debt: 30000, cash: 50000 })).toEqual([5000, 10000]);
    expect(repayOptions({ debt: 30000, cash: 7000 })).toEqual([5000]);
  });
});
