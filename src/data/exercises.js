// A simplified, localized database of common gym exercises
// Categorized by muscle group for easy filtering and autocomplete
// Exercises can have a primary `category` and optional `secondaryCategories` for compound movements

export const EXERCISE_CATEGORIES = {
  CHEST: 'Petto',
  BACK: 'Dorso',
  LEGS: 'Gambe', // Keep for backward compatibility if needed, but we'll use specific ones
  QUADRICEPS: 'Quadricipiti',
  HAMSTRINGS: 'Femorali',
  GLUTES: 'Glutei',
  CALVES: 'Polpacci',
  SHOULDERS: 'Spalle',
  BICEPS: 'Bicipiti',
  TRICEPS: 'Tricipiti',
  CORE: 'Addome',
  CARDIO: 'Cardio',
  NECK: 'Collo',
  FOREARMS: 'Avambracci'
};

/**
 * Normalizes an exercise name for consistent matching:
 * - Lowercase
 * - Trim leading/trailing whitespace
 * - Replace multiple spaces with a single space
 */
export const normalizeName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
};

/**
 * Returns all categories for an exercise (primary + secondary).
 * Works with both DB exercises and custom exercises.
 */
export const getExerciseCategories = (exercise) => {
  if (!exercise) return [];
  const primary = exercise.category ? [exercise.category] : [];
  const secondary = exercise.secondaryCategories || [];
  return [...primary, ...secondary];
};

/**
 * Equipment types that determine the weight increment step.
 * 'dumbbell' = manubri → +2kg (1kg per mano)
 * 'barbell' = bilanciere/macchina → +2.5kg (1.25kg per lato)
 */
export const EQUIPMENT_TYPES = {
  DUMBBELL: 'dumbbell',
  BARBELL: 'barbell'
};

/**
 * Returns the weight increment step for an exercise.
 * Reads the equipmentType field from the exercise or looks it up in the DB.
 */
export const getWeightStep = (exercise, allExercisesDb) => {
  const exName = typeof exercise === 'string' ? exercise : (exercise.name || '');
  if (!exName) return 2.5; // no name yet, return default
  const dbEx = allExercisesDb
    ? allExercisesDb.find(e => normalizeName(e.name) === normalizeName(exName))
    : null;
  const exObj = dbEx || exercise;

  if (exObj && exObj.equipmentType === EQUIPMENT_TYPES.DUMBBELL) return 2;
  return 2.5; // barbell/machine default
};

const D = EQUIPMENT_TYPES.DUMBBELL;
const B = EQUIPMENT_TYPES.BARBELL;

export const EXERCISES_DB = [
  // --- PETTO (CHEST) ---
  { id: 'c1', name: 'Panca Piana Bilanciere', category: EXERCISE_CATEGORIES.CHEST, equipmentType: B },
  { id: 'c2', name: 'Spinte Manubri Panca Inclinata', category: EXERCISE_CATEGORIES.CHEST, equipmentType: D },
  { id: 'c3', name: 'Croci ai Cavi', category: EXERCISE_CATEGORIES.CHEST, equipmentType: B },
  { id: 'c4', name: 'Chest Press', category: EXERCISE_CATEGORIES.CHEST, equipmentType: B },
  { id: 'c5', name: 'Piegamenti sulle braccia (Push-up)', category: EXERCISE_CATEGORIES.CHEST, equipmentType: B },
  { id: 'c6', name: 'Dip alle Parallele', category: EXERCISE_CATEGORIES.CHEST, secondaryCategories: [EXERCISE_CATEGORIES.TRICEPS], equipmentType: B },
  { id: 'c7', name: 'Croci Manubri Panca Piana', category: EXERCISE_CATEGORIES.CHEST, equipmentType: D },
  { id: 'c8', name: 'Panca Inclinata Bilanciere', category: EXERCISE_CATEGORIES.CHEST, equipmentType: B },
  { id: 'c9', name: 'Panca Declinata Bilanciere', category: EXERCISE_CATEGORIES.CHEST, equipmentType: B },
  { id: 'c10', name: 'Spinte Manubri Panca Piana', category: EXERCISE_CATEGORIES.CHEST, equipmentType: D },
  { id: 'c11', name: 'Pectoral Machine', category: EXERCISE_CATEGORIES.CHEST, equipmentType: B },
  { id: 'c12', name: 'Croci Manubri Panca Inclinata', category: EXERCISE_CATEGORIES.CHEST, equipmentType: D },
  { id: 'c13', name: 'Chest Press Inclinata', category: EXERCISE_CATEGORIES.CHEST, equipmentType: B },
  { id: 'c14', name: 'Panca Inclinata MultiPower', category: EXERCISE_CATEGORIES.CHEST, equipmentType: B },

  // --- DORSO (BACK) ---
  { id: 'b1', name: 'Trazioni alla Sbarra (Pull-up)', category: EXERCISE_CATEGORIES.BACK, secondaryCategories: [EXERCISE_CATEGORIES.BICEPS], equipmentType: B },
  { id: 'b2', name: 'Lat Machine Avanti', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b3', name: 'Rematore con Bilanciere', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b4', name: 'Pulley Basso', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b5', name: 'Rematore Manubrio', category: EXERCISE_CATEGORIES.BACK, equipmentType: D },
  { id: 'b6', name: 'Pullover ai Cavi', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b7', name: 'T Bar Row', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b8', name: 'Pull-down a Braccia Tese', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b9', name: 'Lat Machine Presa Stretta', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b10', name: 'Rematore al Cavo Seduto', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b11', name: 'Pullover Manubrio', category: EXERCISE_CATEGORIES.BACK, equipmentType: D },
  { id: 'b12', name: 'Hyperextension', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b13', name: 'Scrollate Bilanciere (Shrugs)', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b14', name: 'Trazioni zavorrate', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b15', name: 'Pulley Basso Singolo', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },
  { id: 'b16', name: 'Lat Machine Dietro Nuca', category: EXERCISE_CATEGORIES.BACK, equipmentType: B },

  // --- GAMBE (LEGS) ---
  { id: 'l1', name: 'Squat con Bilanciere', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: B },
  { id: 'l2', name: 'Leg Press 45°', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: B },
  { id: 'l3', name: 'Affondi con Manubri', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: D },
  { id: 'l4', name: 'Leg Extension', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: B },
  { id: 'l5', name: 'Leg Curl', category: EXERCISE_CATEGORIES.HAMSTRINGS, equipmentType: B },
  { id: 'l6', name: 'Stacchi da Terra (Deadlift)', category: EXERCISE_CATEGORIES.HAMSTRINGS, secondaryCategories: [EXERCISE_CATEGORIES.BACK], equipmentType: B },
  { id: 'l7', name: 'Stacchi Rumeni (RDL)', category: EXERCISE_CATEGORIES.HAMSTRINGS, secondaryCategories: [EXERCISE_CATEGORIES.BACK], equipmentType: B },
  { id: 'l8', name: 'Calf Raise Seduto', category: EXERCISE_CATEGORIES.CALVES, equipmentType: B },
  { id: 'l9', name: 'Calf Raise in Piedi', category: EXERCISE_CATEGORIES.CALVES, equipmentType: B },
  { id: 'l10', name: 'Front Squat', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: B },
  { id: 'l11', name: 'Hack Squat', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: B },
  { id: 'l12', name: 'Bulgarian Split Squat', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: D },
  { id: 'l13', name: 'Hip Thrust', category: EXERCISE_CATEGORIES.GLUTES, equipmentType: B },
  { id: 'l14', name: 'Adductor Machine', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: B },
  { id: 'l15', name: 'Abductor Machine', category: EXERCISE_CATEGORIES.GLUTES, equipmentType: B },
  { id: 'l16', name: 'Pressa Orizzontale', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: B },
  { id: 'l17', name: 'Sissy Squat', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: B },
  { id: 'l18', name: 'Step Up', category: EXERCISE_CATEGORIES.QUADRICEPS, equipmentType: D },
  { id: 'l19', name: 'Good Morning', category: EXERCISE_CATEGORIES.HAMSTRINGS, equipmentType: B },
  { id: 'l20', name: 'Slanci ai Cavi', category: EXERCISE_CATEGORIES.GLUTES, equipmentType: B },
  { id: 'l21', name: 'Calf Raise alla Pressa', category: EXERCISE_CATEGORIES.CALVES, equipmentType: B },
  { id: 'l22', name: 'Donkey Calf Raise', category: EXERCISE_CATEGORIES.CALVES, equipmentType: B },
  { id: 'l23', name: 'Calf Raise su Gradino (Single Leg)', category: EXERCISE_CATEGORIES.CALVES, equipmentType: D },
  { id: 'l24', name: 'Tibiale Anteriore al Cavo/Macchina', category: EXERCISE_CATEGORIES.CALVES, equipmentType: B },

  // --- SPALLE (SHOULDERS) ---
  { id: 's1', name: 'Military Press', category: EXERCISE_CATEGORIES.SHOULDERS, secondaryCategories: [EXERCISE_CATEGORIES.TRICEPS], equipmentType: B },
  { id: 's2', name: 'Spinte Manubri Seduto', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: D },
  { id: 's3', name: 'Alzate Laterali Manubri', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: D },
  { id: 's4', name: 'Alzate Laterali ai Cavi', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: B },
  { id: 's5', name: 'Alzate a 90° (Posteriori)', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: D },
  { id: 's6', name: 'Arnold Press', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: D },
  { id: 's7', name: 'Face Pull ai Cavi', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: B },
  { id: 's8', name: 'Tirate al Mento Bilanciere', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: B },
  { id: 's9', name: 'Shoulder Press alla Macchina', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: B },
  { id: 's10', name: 'Reverse Fly alla Macchina', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: B },
  { id: 's11', name: 'Alzate Frontali Manubri', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: D },
  { id: 's12', name: 'Lento Avanti Bilanciere', category: EXERCISE_CATEGORIES.SHOULDERS, secondaryCategories: [EXERCISE_CATEGORIES.TRICEPS], equipmentType: B },
  { id: 's13', name: 'Spinte Spalle Manubri', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: D },
  { id: 's14', name: 'Front Press Bilanciere', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: B },
  { id: 's15', name: 'Shoulder Press', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: B },
  { id: 's16', name: 'Military Press Seduto', category: EXERCISE_CATEGORIES.SHOULDERS, equipmentType: B },

  // --- BICIPITI (BICEPS) ---
  { id: 'bi1', name: 'Curl Bilanciere', category: EXERCISE_CATEGORIES.BICEPS, equipmentType: B },
  { id: 'bi2', name: 'Curl Manubri Panca Inclinata', category: EXERCISE_CATEGORIES.BICEPS, equipmentType: D },
  { id: 'bi3', name: 'Hammer Curl', category: EXERCISE_CATEGORIES.BICEPS, secondaryCategories: [EXERCISE_CATEGORIES.FOREARMS], equipmentType: D },
  { id: 'bi4', name: 'Curl Bilanciere EZ', category: EXERCISE_CATEGORIES.BICEPS, equipmentType: B },
  { id: 'bi5', name: 'Curl ai Cavi', category: EXERCISE_CATEGORIES.BICEPS, equipmentType: B },
  { id: 'bi6', name: 'Curl Concentrato', category: EXERCISE_CATEGORIES.BICEPS, equipmentType: D },
  { id: 'bi7', name: 'Curl alla Panca Scott', category: EXERCISE_CATEGORIES.BICEPS, equipmentType: B },
  { id: 'bi8', name: 'Spider Curl', category: EXERCISE_CATEGORIES.BICEPS, equipmentType: B },
  { id: 'bi9', name: 'Curl Manubri Alternati', category: EXERCISE_CATEGORIES.BICEPS, equipmentType: D },
  { id: 'bi10', name: 'Zottman Curl', category: EXERCISE_CATEGORIES.BICEPS, secondaryCategories: [EXERCISE_CATEGORIES.FOREARMS], equipmentType: D },

  // --- TRICIPITI (TRICEPS) ---
  { id: 'tr1', name: 'Pushdown Tricipiti ai Cavi', category: EXERCISE_CATEGORIES.TRICEPS, equipmentType: B },
  { id: 'tr2', name: 'French Press', category: EXERCISE_CATEGORIES.TRICEPS, equipmentType: B },
  { id: 'tr3', name: 'Estensioni Dietro Nuca Manubrio', category: EXERCISE_CATEGORIES.TRICEPS, equipmentType: D },
  { id: 'tr4', name: 'Kickback Tricipiti Manubrio', category: EXERCISE_CATEGORIES.TRICEPS, equipmentType: D },
  { id: 'tr5', name: 'Dip alla Panca', category: EXERCISE_CATEGORIES.TRICEPS, secondaryCategories: [EXERCISE_CATEGORIES.CHEST], equipmentType: B },
  { id: 'tr6', name: 'Pushdown Corda', category: EXERCISE_CATEGORIES.TRICEPS, equipmentType: B },
  { id: 'tr7', name: 'Estensioni ai Cavi Sopra la Testa', category: EXERCISE_CATEGORIES.TRICEPS, equipmentType: B },
  { id: 'tr8', name: 'JM Press', category: EXERCISE_CATEGORIES.TRICEPS, equipmentType: B },
  { id: 'tr9', name: 'Panca Presa Stretta', category: EXERCISE_CATEGORIES.TRICEPS, secondaryCategories: [EXERCISE_CATEGORIES.CHEST], equipmentType: B },
  { id: 'tr10', name: 'Skull Crusher Bilanciere EZ', category: EXERCISE_CATEGORIES.TRICEPS, equipmentType: B },

  // --- AVAMBRACCI (FOREARMS) ---
  { id: 'f1', name: 'Wrist Curl Bilanciere (Supinazione)', category: EXERCISE_CATEGORIES.FOREARMS, equipmentType: B },
  { id: 'f2', name: 'Wrist Curl Bilanciere (Pronazione)', category: EXERCISE_CATEGORIES.FOREARMS, equipmentType: B },
  { id: 'f3', name: 'Farmer\'s Walk', category: EXERCISE_CATEGORIES.FOREARMS, equipmentType: D },
  { id: 'f4', name: 'Reverse Curl Bilanciere EZ', category: EXERCISE_CATEGORIES.FOREARMS, secondaryCategories: [EXERCISE_CATEGORIES.BICEPS], equipmentType: B },

  // --- ADDOME (CORE) ---
  { id: 'co1', name: 'Crunch a Terra', category: EXERCISE_CATEGORIES.CORE, equipmentType: B },
  { id: 'co2', name: 'Plank', category: EXERCISE_CATEGORIES.CORE, equipmentType: B },
  { id: 'co3', name: 'Leg Raise in Sospensione', category: EXERCISE_CATEGORIES.CORE, equipmentType: B },
  { id: 'co4', name: 'Russian Twist', category: EXERCISE_CATEGORIES.CORE, equipmentType: B },
  { id: 'co5', name: 'Crunch ai Cavi (Rope)', category: EXERCISE_CATEGORIES.CORE, equipmentType: B },
  { id: 'co6', name: 'Ab Roller', category: EXERCISE_CATEGORIES.CORE, equipmentType: B },
  { id: 'co7', name: 'Mountain Climbers', category: EXERCISE_CATEGORIES.CORE, equipmentType: B },
  { id: 'co8', name: 'Dragon Flag', category: EXERCISE_CATEGORIES.CORE, equipmentType: B },

  // --- COLLO (NECK) ---
  { id: 'n1', name: 'Flessioni del Collo (Neck Flexion)', category: EXERCISE_CATEGORIES.NECK, equipmentType: B },
  { id: 'n2', name: 'Estensioni del Collo (Neck Extension)', category: EXERCISE_CATEGORIES.NECK, equipmentType: B },
  { id: 'n3', name: 'Neck Curl Panca Piana', category: EXERCISE_CATEGORIES.NECK, equipmentType: B },

  // --- CARDIO ---
  { id: 'ca1', name: 'Tapis Roulant', category: EXERCISE_CATEGORIES.CARDIO, equipmentType: B },
  { id: 'ca2', name: 'Cyclette', category: EXERCISE_CATEGORIES.CARDIO, equipmentType: B },
  { id: 'ca3', name: 'Ellittica', category: EXERCISE_CATEGORIES.CARDIO, equipmentType: B },
  { id: 'ca4', name: 'Vogatore', category: EXERCISE_CATEGORIES.CARDIO, equipmentType: B },
  { id: 'ca5', name: 'Stepper', category: EXERCISE_CATEGORIES.CARDIO, equipmentType: B },
  { id: 'ca6', name: 'Corda per Saltare', category: EXERCISE_CATEGORIES.CARDIO, equipmentType: B }
];
