'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { baskets, quote, compare } = require('./app.js');

test('the larger coupon can add shipping, while a small extra can remove it', () => {
  const flat = quote(baskets.desk, 'flat', false);
  const percent = quote(baskets.desk, 'percent', false);
  const withExtra = quote(baskets.desk, 'percent', true);
  assert.equal(flat.total, 5600);
  assert.equal(percent.belowThreshold, 60);
  assert.equal(percent.total, 6340);
  assert.equal(withExtra.discount, 983);
  assert.equal(withExtra.total, 5567);
  assert.equal(withExtra.shipping, 0);
});

test('free shipping begins at exactly $55 after the discount', () => {
  const exact = { items: [['Test item', 6300]] };
  const justUnder = { items: [['Test item', 6299]] };
  assert.equal(quote(exact, 'flat', false).shipping, 0);
  assert.equal(quote(justUnder, 'flat', false).shipping, 900);
});

test('each basket compares all six choices and has a different winning strategy', () => {
  const expected = [['percent', true, 5567], ['flat', true, 5600], ['percent', false, 6035]];
  Object.values(baskets).forEach((basket, index) => {
    const options = compare(basket);
    assert.equal(new Set(options.map(({ coupon, addFiller }) => coupon + addFiller)).size, 6);
    assert.deepEqual(options.map((option) => option.total), options.map((option) => option.total).sort((a, b) => a - b));
    const { coupon, addFiller, total } = options[0];
    assert.deepEqual([coupon, addFiller, total], expected[index]);
  });
});
