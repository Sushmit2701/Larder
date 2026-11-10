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

    const recipes = Larder.seed.recipes(today);
    return {
      version: 3, example: true, pantry, shopping, history, recipes,
      targets: { ...L.DEFAULT_TARGETS }, log: Larder.seed.log(recipes, today)
    };
  },

  // An example breakfast logged for today so the Today tab shows progress.
  log(recipes, today) {
    const L = Larder.logic;
    today = today || L.todayISO();
    const oats = recipes.find(r => r.title === 'Overnight oats');
    let s = { log: [] };
    if (oats) s = L.logRecipe(s, oats, 1, today).state;
    s = L.logEntry(s, { title: 'Flat white', kcal: 110, protein: 6, carbs: 9, fat: 6 }, today).state;
    return s.log;
  },

  // Example recipes. Macros are rough per-serving figures for illustration.
  recipes(today) {
    const L = Larder.logic;
    const ing = s => L.parseIngredients(s);
    return [
      {
        title: 'Spinach and chickpea curry',
        servings: 4, prepMin: 10, cookMin: 25,
        ingredients: ing('1 tbsp olive oil\n1 onion\n2 cloves garlic\n1 tbsp curry powder\n2 tins chickpeas\n400 g chopped tomatoes\n200 g baby spinach\n300 g basmati rice'),
        steps: [
          'Rinse the rice and cook it in salted water for 12 minutes, then drain.',
          'Soften the chopped onion in the oil for 5 minutes, then add the garlic and curry powder for 1 minute.',
          'Add the drained chickpeas and chopped tomatoes. Simmer for 15 minutes.',
          'Stir in the spinach until it wilts. Season and serve with the rice.'
        ],
        macros: { kcal: 480, protein: 17, carbs: 78, fat: 10 },
        prepNote: 'Cook the curry and rice on Sunday and portion into 4 tubs. Keeps 4 days in the fridge or 3 months in the freezer. If you can, keep some spinach back and stir it in fresh when reheating.'
      },
      {
        title: 'Lemon chicken traybake',
        servings: 3, prepMin: 10, cookMin: 35,
        ingredients: ing('500 g chicken thighs\n600 g potatoes\n250 g cherry tomatoes\n1 lemon\n2 tbsp olive oil\n1 tsp dried oregano'),
        steps: [
          'Heat the oven to 200°C (180°C fan).',
          'Cut the potatoes into chunks. Toss with the chicken, oil, oregano, lemon juice and zest in a roasting tin.',
          'Roast for 25 minutes, add the tomatoes, then roast for 10 minutes more until the chicken is cooked through.'
        ],
        macros: { kcal: 520, protein: 38, carbs: 40, fat: 22 },
        prepNote: 'On Sunday, chop the potatoes (keep them in water in the fridge) and marinate the chicken in the lemon, oil and oregano. Both keep 2 days. Cooked portions keep 3 days in the fridge.'
      },
      {
        title: 'Overnight oats',
        servings: 1, prepMin: 5, cookMin: 0,
        ingredients: ing('50 g rolled oats\n150 g greek yoghurt\n100 ml milk\n1 banana\n1 tsp honey'),
        steps: [
          'Mix the oats, yoghurt, milk and honey in a jar.',
          'Cover and leave in the fridge overnight.',
          'Slice the banana on top in the morning.'
        ],
        macros: { kcal: 430, protein: 22, carbs: 62, fat: 9 },
        prepNote: 'Make 4 jars on Sunday. They keep 4 days in the fridge. Add the banana on the day so it does not brown.'
      },
      {
        title: 'Cheese and spinach omelette',
        servings: 1, prepMin: 5, cookMin: 5,
        ingredients: ing('3 eggs\n30 g cheddar\n1 handful baby spinach\n1 tsp butter'),
        steps: [
          'Beat the eggs with a pinch of salt.',
          'Melt the butter in a small pan over a medium heat and pour in the eggs.',
          'When almost set, add the spinach and grated cheese. Fold and serve.'
        ],
        macros: { kcal: 380, protein: 27, carbs: 2, fat: 29 },
        prepNote: 'Grate a block of cheese for the week. It keeps 5 days in a sealed box in the fridge.'
      }
    ].map(r => ({ id: L.uid(), createdAt: today, ...r }));
  }
};
