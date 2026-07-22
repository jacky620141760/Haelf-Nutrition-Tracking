/** MyFitnessPal-inspired design tokens (light). */
export const theme = {
  colors: {
    // Brand
    mfpBlue: '#005DAA',
    lakeBlue: '#0072CE',
    lakeBluePressed: '#005FA8',
    skyBlue: '#E7F0FF',

    // Macros (locked order: carbs → fat → protein)
    carbs: '#FF9F1C',
    fat: '#A463F2',
    protein: '#19C37D',

    // Canvas
    bg: '#FFFFFF',
    bgElevated: '#FFFFFF',
    surface: '#F5F7FA',
    surface2: '#E5E9F0',
    border: '#E5E7EB',
    hairline: '#EEF1F5',

    // Text
    text: '#1F2937',
    textMuted: '#4B5563',
    textMute: '#9CA3AF',
    heroNumber: '#111827',

    // Semantic
    accent: '#0072CE',
    accentSoft: '#E7F0FF',
    underGoal: '#19C37D',
    approaching: '#F59E0B',
    danger: '#EF4444',
    warning: '#F59E0B',
    warningBg: '#FEF3C7',

    // Charts
    chartFood: '#0072CE',
    chartGoal: '#9CA3AF',
    chartWeight: '#0072CE',

    // Web banner
    webBanner: '#78350F',
    webBannerBg: '#FEF3C7',

    // Meal accents (subtle, not macro colors)
    mealAccent: {
      breakfast: '#0072CE',
      lunch: '#0072CE',
      dinner: '#0072CE',
      snack: '#0072CE',
    },

    // Ring track
    ringTrack: '#E5E9F0',
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  minTouch: 44,
  radius: 12,
  radiusCard: 16,
  font: {
    calorieHero: 56,
    navTitle: 28,
    section: 22,
    mealTitle: 18,
    body: 16,
    bodySmall: 13,
    macroNumber: 22,
    macroLabel: 11,
    tab: 10,
    button: 16,
    small: 13,
    title: 22,
  },
  ring: {
    calorieSize: 200,
    calorieStroke: 18,
    macroSize: 72,
    macroStroke: 8,
  },
} as const;
