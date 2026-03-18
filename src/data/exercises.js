// A simplified, localized database of common gym exercises
// Categorized by muscle group for easy filtering and autocomplete
// Exercises can have a primary `category` and optional `secondaryCategories` for compound movements

export const EXERCISE_CATEGORIES = {
  CHEST: 'Petto',
  BACK: 'Dorso',
  LEGS: 'Gambe',
  SHOULDERS: 'Spalle',
  BICEPS: 'Bicipiti',
  TRICEPS: 'Tricipiti',
  CORE: 'Addome',
  CARDIO: 'Cardio',
  NECK: 'Collo',
  FOREARMS: 'Avambracci'
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

export const EXERCISES_DB = [
  // --- PETTO (CHEST) ---
  { id: 'c1', name: 'Panca Piana Bilanciere', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c2', name: 'Spinte Manubri Panca Inclinata', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c3', name: 'Croci ai Cavi', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c4', name: 'Chest Press', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c5', name: 'Piegamenti sulle braccia (Push-up)', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c6', name: 'Dip alle Parallele', category: EXERCISE_CATEGORIES.CHEST, secondaryCategories: [EXERCISE_CATEGORIES.TRICEPS] },
  { id: 'c7', name: 'Croci Manubri Panca Piana', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c8', name: 'Panca Inclinata Bilanciere', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c9', name: 'Panca Declinata Bilanciere', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c10', name: 'Spinte Manubri Panca Piana', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c11', name: 'Pectoral Machine', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c12', name: 'Croci Manubri Panca Inclinata', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c13', name: 'Chest Press Inclinata', category: EXERCISE_CATEGORIES.CHEST },
  { id: 'c14', name: 'Panca Inclinata MultiPower', category: EXERCISE_CATEGORIES.CHEST },

  // --- DORSO (BACK) ---
  { id: 'b1', name: 'Trazioni alla Sbarra (Pull-up)', category: EXERCISE_CATEGORIES.BACK, secondaryCategories: [EXERCISE_CATEGORIES.BICEPS] },
  { id: 'b2', name: 'Lat Machine Avanti', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b3', name: 'Rematore con Bilanciere', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b4', name: 'Pulley Basso', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b5', name: 'Rematore Manubrio', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b6', name: 'Pullover ai Cavi', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b7', name: 'T Bar Row', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b8', name: 'Pull-down a Braccia Tese', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b9', name: 'Lat Machine Presa Stretta', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b10', name: 'Rematore al Cavo Seduto', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b11', name: 'Pullover Manubrio', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b12', name: 'Hyperextension', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b13', name: 'Scrollate Bilanciere (Shrugs)', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b14', name: 'Trazioni zavorrate', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b15', name: 'Pulley Basso Singolo', category: EXERCISE_CATEGORIES.BACK },
  { id: 'b16', name: 'Lat Machine Dietro Nuca', category: EXERCISE_CATEGORIES.BACK },

  // --- GAMBE (LEGS) ---
  { id: 'l1', name: 'Squat con Bilanciere', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l2', name: 'Leg Press 45°', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l3', name: 'Affondi con Manubri', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l4', name: 'Leg Extension', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l5', name: 'Leg Curl', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l6', name: 'Stacchi da Terra (Deadlift)', category: EXERCISE_CATEGORIES.LEGS, secondaryCategories: [EXERCISE_CATEGORIES.BACK] },
  { id: 'l7', name: 'Stacchi Rumeni (RDL)', category: EXERCISE_CATEGORIES.LEGS, secondaryCategories: [EXERCISE_CATEGORIES.BACK] },
  { id: 'l8', name: 'Calf Raise Seduto', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l9', name: 'Calf Raise in Piedi', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l10', name: 'Front Squat', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l11', name: 'Hack Squat', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l12', name: 'Bulgarian Split Squat', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l13', name: 'Hip Thrust', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l14', name: 'Adductor Machine', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l15', name: 'Abductor Machine', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l16', name: 'Pressa Orizzontale', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l17', name: 'Sissy Squat', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l18', name: 'Step Up', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l19', name: 'Good Morning', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l20', name: 'Slanci ai Cavi', category: EXERCISE_CATEGORIES.LEGS },
  // Integrazione Polpacci specifica
  { id: 'l21', name: 'Calf Raise alla Pressa', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l22', name: 'Donkey Calf Raise', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l23', name: 'Calf Raise su Gradino (Single Leg)', category: EXERCISE_CATEGORIES.LEGS },
  { id: 'l24', name: 'Tibiale Anteriore al Cavo/Macchina', category: EXERCISE_CATEGORIES.LEGS },

  // --- SPALLE (SHOULDERS) ---
  { id: 's1', name: 'Military Press', category: EXERCISE_CATEGORIES.SHOULDERS, secondaryCategories: [EXERCISE_CATEGORIES.TRICEPS] },
  { id: 's2', name: 'Spinte Manubri Seduto', category: EXERCISE_CATEGORIES.SHOULDERS },
  { id: 's3', name: 'Alzate Laterali Manubri', category: EXERCISE_CATEGORIES.SHOULDERS },
  { id: 's4', name: 'Alzate Laterali ai Cavi', category: EXERCISE_CATEGORIES.SHOULDERS },
  { id: 's5', name: 'Alzate a 90° (Posteriori)', category: EXERCISE_CATEGORIES.SHOULDERS },
  { id: 's6', name: 'Arnold Press', category: EXERCISE_CATEGORIES.SHOULDERS },
  { id: 's7', name: 'Face Pull ai Cavi', category: EXERCISE_CATEGORIES.SHOULDERS },
  { id: 's8', name: 'Tirate al Mento Bilanciere', category: EXERCISE_CATEGORIES.SHOULDERS },
  { id: 's9', name: 'Shoulder Press alla Macchina', category: EXERCISE_CATEGORIES.SHOULDERS },
  { id: 's10', name: 'Reverse Fly alla Macchina', category: EXERCISE_CATEGORIES.SHOULDERS },
  { id: 's11', name: 'Alzate Frontali Manubri', category: EXERCISE_CATEGORIES.SHOULDERS },

  // --- BICIPITI (BICEPS) ---
  { id: 'bi1', name: 'Curl Bilanciere', category: EXERCISE_CATEGORIES.BICEPS },
  { id: 'bi2', name: 'Curl Manubri Panca Inclinata', category: EXERCISE_CATEGORIES.BICEPS },
  { id: 'bi3', name: 'Hammer Curl', category: EXERCISE_CATEGORIES.BICEPS, secondaryCategories: [EXERCISE_CATEGORIES.FOREARMS] },
  { id: 'bi4', name: 'Curl Bilanciere EZ', category: EXERCISE_CATEGORIES.BICEPS },
  { id: 'bi5', name: 'Curl ai Cavi', category: EXERCISE_CATEGORIES.BICEPS },
  { id: 'bi6', name: 'Curl Concentrato', category: EXERCISE_CATEGORIES.BICEPS },
  { id: 'bi7', name: 'Curl alla Panca Scott', category: EXERCISE_CATEGORIES.BICEPS },
  { id: 'bi8', name: 'Spider Curl', category: EXERCISE_CATEGORIES.BICEPS },
  { id: 'bi9', name: 'Curl Manubri Alternati', category: EXERCISE_CATEGORIES.BICEPS },
  { id: 'bi10', name: 'Zottman Curl', category: EXERCISE_CATEGORIES.BICEPS, secondaryCategories: [EXERCISE_CATEGORIES.FOREARMS] },

  // --- TRICIPITI (TRICEPS) ---
  { id: 'tr1', name: 'Pushdown Tricipiti ai Cavi', category: EXERCISE_CATEGORIES.TRICEPS },
  { id: 'tr2', name: 'French Press', category: EXERCISE_CATEGORIES.TRICEPS },
  { id: 'tr3', name: 'Estensioni Dietro Nuca Manubrio', category: EXERCISE_CATEGORIES.TRICEPS },
  { id: 'tr4', name: 'Kickback Tricipiti Manubrio', category: EXERCISE_CATEGORIES.TRICEPS },
  { id: 'tr5', name: 'Dip alla Panca', category: EXERCISE_CATEGORIES.TRICEPS, secondaryCategories: [EXERCISE_CATEGORIES.CHEST] },
  { id: 'tr6', name: 'Pushdown Corda', category: EXERCISE_CATEGORIES.TRICEPS },
  { id: 'tr7', name: 'Estensioni ai Cavi Sopra la Testa', category: EXERCISE_CATEGORIES.TRICEPS },
  { id: 'tr8', name: 'JM Press', category: EXERCISE_CATEGORIES.TRICEPS },
  { id: 'tr9', name: 'Panca Presa Stretta', category: EXERCISE_CATEGORIES.TRICEPS, secondaryCategories: [EXERCISE_CATEGORIES.CHEST] },
  { id: 'tr10', name: 'Skull Crusher Bilanciere EZ', category: EXERCISE_CATEGORIES.TRICEPS },

  // --- AVAMBRACCI (FOREARMS) ---
  { id: 'f1', name: 'Wrist Curl Bilanciere (Supinazione)', category: EXERCISE_CATEGORIES.FOREARMS },
  { id: 'f2', name: 'Wrist Curl Bilanciere (Pronazione)', category: EXERCISE_CATEGORIES.FOREARMS },
  { id: 'f3', name: 'Farmer\'s Walk', category: EXERCISE_CATEGORIES.FOREARMS },
  { id: 'f4', name: 'Reverse Curl Bilanciere EZ', category: EXERCISE_CATEGORIES.FOREARMS, secondaryCategories: [EXERCISE_CATEGORIES.BICEPS] },

  // --- ADDOME (CORE) ---
  { id: 'co1', name: 'Crunch a Terra', category: EXERCISE_CATEGORIES.CORE },
  { id: 'co2', name: 'Plank', category: EXERCISE_CATEGORIES.CORE },
  { id: 'co3', name: 'Leg Raise in Sospensione', category: EXERCISE_CATEGORIES.CORE },
  { id: 'co4', name: 'Russian Twist', category: EXERCISE_CATEGORIES.CORE },
  { id: 'co5', name: 'Crunch ai Cavi (Rope)', category: EXERCISE_CATEGORIES.CORE },
  { id: 'co6', name: 'Ab Roller', category: EXERCISE_CATEGORIES.CORE },
  { id: 'co7', name: 'Mountain Climbers', category: EXERCISE_CATEGORIES.CORE },
  { id: 'co8', name: 'Dragon Flag', category: EXERCISE_CATEGORIES.CORE },

  // --- COLLO (NECK) ---
  { id: 'n1', name: 'Flessioni del Collo (Neck Flexion)', category: EXERCISE_CATEGORIES.NECK },
  { id: 'n2', name: 'Estensioni del Collo (Neck Extension)', category: EXERCISE_CATEGORIES.NECK },
  { id: 'n3', name: 'Neck Curl Panca Piana', category: EXERCISE_CATEGORIES.NECK },

  // --- CARDIO ---
  { id: 'ca1', name: 'Tapis Roulant', category: EXERCISE_CATEGORIES.CARDIO },
  { id: 'ca2', name: 'Cyclette', category: EXERCISE_CATEGORIES.CARDIO },
  { id: 'ca3', name: 'Ellittica', category: EXERCISE_CATEGORIES.CARDIO },
  { id: 'ca4', name: 'Vogatore', category: EXERCISE_CATEGORIES.CARDIO },
  { id: 'ca5', name: 'Stepper', category: EXERCISE_CATEGORIES.CARDIO },
  { id: 'ca6', name: 'Corda per Saltare', category: EXERCISE_CATEGORIES.CARDIO }
];
