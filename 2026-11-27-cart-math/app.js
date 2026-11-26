'use strict';

const baskets = {
  desk: { items: [['Desk lamp', 4200], ['Grid notebook', 2200]], filler: ['binder clip', 150] },
  weekend: { items: [['Travel pouch', 3300], ['Pocket flask', 2700]], filler: ['luggage tag', 400] },
  studio: { items: [['Sketchpad', 2600], ['Ink set', 4500]], filler: ['pencil cap', 250] },
};
const coupons = {
  none: { label: 'None', discount: () => 0 },
  flat: { label: '$8 off', discount: (subtotal) => Math.min(800, subtotal) },
  percent: { label: '15% off', discount: (subtotal) => Math.round(subtotal * 15 / 100) },
};
const freeAt = 5500;

function quote(basket, coupon, addFiller) {
  const items = addFiller ? [...basket.items, basket.filler] : basket.items;
  const subtotal = items.reduce((sum, [, price]) => sum + price, 0);
  const discount = coupons[coupon].discount(subtotal);
  const belowThreshold = Math.max(0, freeAt - (subtotal - discount));
  const shipping = belowThreshold > 0 ? 900 : 0;
  return { items, subtotal, discount, belowThreshold, shipping, total: subtotal - discount + shipping };
}

function compare(basket) {
  return Object.keys(coupons).flatMap((coupon) => [false, true].map((addFiller) => ({
    coupon, addFiller, ...quote(basket, coupon, addFiller),
  }))).sort((a, b) => a.total - b.total || Number(a.addFiller) - Number(b.addFiller));
}

if (typeof module !== 'undefined') module.exports = { baskets, quote, compare };

if (typeof document !== 'undefined') {
  const get = (id) => document.getElementById(id);
  const basketSelect = get('basket');
  const filler = get('filler');
  const couponInputs = [...document.querySelectorAll('input[name="coupon"]')];
  const pickedCoupon = () => couponInputs.find((input) => input.checked).value;
  const format = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const money = (cents) => format.format(cents / 100);
  const compareButton = get('compare');
  const solutions = get('solutions');

  function updateSelection() {
    for (const button of get('results').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.coupon === pickedCoupon()
        && (button.dataset.filler === 'true') === filler.checked));
    }
  }

  function updateReceipt() {
    const basket = baskets[basketSelect.value];
    const result = quote(basket, pickedCoupon(), filler.checked);
    get('filler-name').textContent = basket.filler[0];
    get('filler-price').textContent = '+' + money(basket.filler[1]);
    get('items').replaceChildren(...result.items.map(([name, price]) => {
      const row = document.createElement('li');
      const amount = document.createElement('span');
      amount.className = 'amount';
      amount.textContent = money(price);
      row.append(name, amount);
      return row;
    }));
    get('subtotal').textContent = money(result.subtotal);
    get('discount').textContent = (result.discount ? '−' : '') + money(result.discount);
    get('shipping').textContent = result.shipping ? money(result.shipping) : 'Free';
    get('total').textContent = money(result.total);
    const note = get('shipping-note');
    note.textContent = result.belowThreshold ? money(result.belowThreshold) + ' short of free shipping' : 'Free shipping unlocked';
    note.classList.toggle('free', !result.belowThreshold);
    updateSelection();
  }

  function updateComparisons() {
    const results = compare(baskets[basketSelect.value]);
    get('results').replaceChildren(...results.map(({ coupon, addFiller, total }) => {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.coupon = coupon;
      button.dataset.filler = addFiller;
      const label = document.createElement('span');
      label.textContent = coupons[coupon].label + (addFiller ? ' + extra item' : '');
      if (total === results[0].total) {
        const best = document.createElement('small');
        best.textContent = ' Lowest';
        label.append(best);
      }
      const price = document.createElement('span');
      price.className = 'amount';
      price.textContent = money(total);
      button.append(label, price);
      button.addEventListener('click', () => {
        couponInputs.find((input) => input.value === coupon).checked = true;
        filler.checked = addFiller;
        updateReceipt();
      });
      row.append(button);
      return row;
    }));
    updateSelection();
  }

  basketSelect.addEventListener('change', () => {
    couponInputs[0].checked = true;
    filler.checked = false;
    solutions.hidden = true;
    compareButton.textContent = 'Compare all 6 totals';
    compareButton.setAttribute('aria-expanded', 'false');
    updateReceipt();
  });
  for (const input of [...couponInputs, filler]) input.addEventListener('change', updateReceipt);
  compareButton.addEventListener('click', () => {
    solutions.hidden = !solutions.hidden;
    compareButton.setAttribute('aria-expanded', String(!solutions.hidden));
    compareButton.textContent = solutions.hidden ? 'Compare all 6 totals' : 'Hide comparison';
    if (!solutions.hidden) updateComparisons();
  });
  updateReceipt();
}
