// Larder: example data loaded on first run, dated relative to today so the
// expiry warnings show straight away. Clear it from the banner in the app.
window.Larder = window.Larder || {};

Larder.seed = {
  create(today) {
    const L = Larder.logic;
    const d = n => L.addDays(today, n);
    const withId = x => ({ id: L.uid(), ...x });

    const pantry = [
      { name: 'Baby spinach', category: 'Fruit & veg', qty: 200, unit: 'g', expiry: d(1) },
      { name: 'Chicken thighs', category: 'Meat & fish', qty: 500, unit: 'g', expiry: d(2) },
      { name: 'Milk', category: 'Dairy & eggs', qty: 1, unit: 'L', expiry: d(4) },
      { name: 'Greek yoghurt', category: 'Dairy & eggs', qty: 500, unit: 'g', expiry: d(6) },
      { name: 'Cherry tomatoes', category: 'Fruit & veg', qty: 250, unit: 'g', expiry: d(-1) },
      { name: 'Eggs', category: 'Dairy & eggs', qty: 6, unit: 'pcs', expiry: d(12) },
      { name: 'Cheddar', category: 'Dairy & eggs', qty: 200, unit: 'g', expiry: d(21) },
      { name: 'Rolled oats', category: 'Cupboard', qty: 500, unit: 'g', expiry: d(90) },
      { name: 'Basmati rice', category: 'Cupboard', qty: 1, unit: 'kg', expiry: d(240) },
      { name: 'Chickpeas', category: 'Tins & jars', qty: 2, unit: 'tin', expiry: d(400) },
      { name: 'Frozen peas', category: 'Frozen', qty: 900, unit: 'g', expiry: '' }
    ].map(p => withId({ addedAt: d(-3), ...p }));

    const shopping = [
      { name: 'Milk', qty: 2, unit: 'L', frequency: 'weekly', category: 'Dairy & eggs' },
      { name: 'Bananas', qty: 6, unit: 'pcs', frequency: 'weekly', category: 'Fruit & veg' },
      { name: 'Eggs', qty: 12, unit: 'pcs', frequency: '2w', category: 'Dairy & eggs' },
      { name: 'Greek yoghurt', qty: 1, unit: 'kg', frequency: 'weekly', category: 'Dairy & eggs' },
      { name: 'Wholemeal bread', qty: 1, unit: 'loaf', frequency: 'weekly', category: 'Bakery' },
      { name: 'Salmon fillets', qty: 2, unit: 'pcs', frequency: '2-3w', category: 'Meat & fish' },
      { name: 'Olive oil', qty: 1, unit: 'bottle', frequency: '', category: 'Cupboard' }
    ].map(s => withId({ needed: true, lastBought: '', ...s }));

    shopping.push(withId({ name: 'Lentils', qty: 500, unit: 'g', frequency: '2-3w', category: 'Tins & jars', needed: false, lastBought: d(-5) }));

    const history = [
      { name: 'Sourdough', category: 'Bakery', qty: 1, unit: 'loaf', expiry: d(-1), addedAt: d(-6), usedAt: d(-1) },
      { name: 'Feta', category: 'Dairy & eggs', qty: 200, unit: 'g', expiry: d(4), addedAt: d(-8), usedAt: d(-3) }
    ].map(withId);

    return { version: 1, example: true, pantry, shopping, history };
  }
};
