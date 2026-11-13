export const USD_TO_HKD = 7.8;
export const USD_TO_HKD_DATE = '2026-11-13';

export const RANDOM_SEED = 20261113;

export const ITEMS_PER_OUTLET = { min: 25, max: 40 } as const;

export const KAGGLE_COLUMNS = {
  restaurantsFile: 'restaurants.csv',
  menuFile: 'restaurant-menus.csv',
  restaurants: {
    id: ['id'],
    name: ['name'],
    category: ['category'],
  },
  menu: {
    restaurantId: ['restaurant_id'],
    category: ['category'],
    name: ['name'],
    description: ['description'],
    price: ['price'],
  },
} as const;

export type OutletGroup = 'bistro' | 'cafe';

export const OUTLET_GROUPS: Record<OutletGroup, readonly string[]> = {
  bistro: ['Bistro NTT'],
  cafe: ['Harmony Lounge', 'iCafe', 'Café@CVA Commons', 'JCCC UG/F Cafe', 'JCCC G/F Cafe'],
};

export const GROUP_KEYWORDS: Record<OutletGroup, readonly string[]> = {
  bistro: ['burger', 'steak', 'pasta', 'grill', 'italian', 'american', 'sandwich', 'wings'],
  cafe: ['coffee', 'tea', 'bakery', 'dessert', 'cafe', 'café', 'breakfast', 'smoothie', 'salad'],
};

export const PRICE_BOUNDS_HKD: Record<OutletGroup, { min: number; max: number }> = {
  bistro: { min: 30, max: 190 },
  cafe: { min: 12, max: 90 },
};

export const BRAND_BLOCKLIST: readonly string[] = [
  "mcdonald's",
  'mcdonalds',
  'big mac',
  'mcflurry',
  'starbucks',
  'frappuccino',
  "wendy's",
  'burger king',
  'whopper',
  "domino's",
  'pizza hut',
  'kfc',
  "dunkin'",
  'dunkin',
  "papa john's",
  'subway',
  'taco bell',
  'chick-fil-a',
  'chipotle',
  'panera',
  'five guys',
  'shake shack',
  'in-n-out',
  'coca-cola',
  'coke',
  'pepsi',
  'sprite',
  'fanta',
  'oreo',
  "reese's",
  'snickers',
  'nutella',
  'heinz',
  "ben & jerry's",
  'haagen-dazs',
];

export const DIET_KEYWORDS = {
  vegan: ['vegan', 'plant-based', 'plant based'],
  vegetarian: ['vegetarian', 'veggie'],
  meat: [
    'beef',
    'pork',
    'chicken',
    'bacon',
    'ham',
    'sausage',
    'turkey',
    'steak',
    'lamb',
    'pepperoni',
    'salami',
    'fish',
    'tuna',
    'salmon',
    'shrimp',
    'prawn',
    'crab',
    'meat',
  ],
} as const;

export const ALLERGEN_KEYWORDS = {
  gluten: [
    'bun',
    'bread',
    'pasta',
    'wheat',
    'flour',
    'noodle',
    'croissant',
    'muffin',
    'cake',
    'pizza',
    'sandwich',
    'wrap',
    'bagel',
    'cookie',
    'brownie',
  ],
  egg: ['egg', 'mayo', 'mayonnaise', 'omelet', 'omelette', 'aioli'],
  dairy: [
    'cheese',
    'milk',
    'cream',
    'butter',
    'latte',
    'cappuccino',
    'mocha',
    'yogurt',
    'yoghurt',
    'ice cream',
    'shake',
  ],
  soy: ['soy', 'tofu', 'edamame', 'teriyaki'],
  peanut: ['peanut'],
  tree_nut: ['almond', 'walnut', 'pecan', 'cashew', 'hazelnut', 'pistachio'],
  sesame: ['sesame', 'tahini'],
  fish: ['fish', 'tuna', 'salmon', 'anchovy', 'cod'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'clam', 'oyster', 'scallop'],
} as const;

export const PREP_MINUTES: Record<OutletGroup, { drink: number; light: number; main: number }> = {
  bistro: { drink: 2, light: 6, main: 12 },
  cafe: { drink: 3, light: 4, main: 6 },
};

export const DRINK_WORDS: readonly string[] = [
  'coffee',
  'latte',
  'tea',
  'juice',
  'smoothie',
  'drink',
  'beverage',
  'soda',
  'shake',
  'cappuccino',
  'espresso',
];

export const LIGHT_WORDS: readonly string[] = [
  'side',
  'fries',
  'dessert',
  'bakery',
  'pastry',
  'cookie',
  'muffin',
  'cake',
  'salad',
  'soup',
  'snack',
  'appetizer',
];
