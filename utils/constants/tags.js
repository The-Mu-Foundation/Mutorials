// tags
const tags = {
    "Physics": {
        "Units": {
            "ACC": "AC Circuits",
            "CAR": "Current and Resistance",
            "DCC": "DC Circuits",
            "EEC": "Electrical Energy and Capacitance",
            "EFF": "Electric Forces and Fields",
            "ENE": "Energy",
            "ES": "Electrostatics",
            "FOR": "Forces",
            "IND": "Inductance",
            "KIN": "Kinematics",
            "LAB": "Lab Skills",
            "MAC": "Momentum and Collisions",
            "MAG": "Magnetism",
            "ML": "Mirrors and Lenses",
            "NEEP": "Nuclear Energy and Elementary Particles",
            "QP": "Quantum Physics",
            "RAR": "Reflection and Refraction",
            "REL": "Relativity",
            "ROMO": "Rotational Motion",
            "SAF": "Solids and Fluids",
            "SHM": "Simple Harmonic Motion",
            "THER": "Thermodynamics",
            "VW": "Vibrations and Waves",
            "WO": "Wave Optics"
        },
        "Concepts": {
            "2D": "2D Motion",
            "ACCL": "Acceleration",
            "ANGACC": "Angular Acceleration",
            "ANGMOM": "Angular Momentum",
            "CAM": "Conservation of Angular Momentum",
            "BUOY": "Buoyancy",
            "CALC": "Requires calculus",
            "CEN": "Conservation of Energy",
            "CENT": "Centripetal Acceleration",
            "CM": "Center of Mass",
            "CMO": "Conservation of Momentum",
            "COL": "Collison Mechanics",
            "COU": "Coulomb's Law",
            "DEN": "Density",
            "DISP": "Displacement",
            "ELE": "Electricity",
            "FRIC": "Friction",
            "FRQ": "Frequency",
            "GAS": "Ideal Gas Law",
            "GRAV": "Gravity",
            "HKL": "Hooke's Law",
            "HT": "Heat Transfer",
            "IMT": "Impulse Momentum Theorem",
            "KEP": "Kepler's Laws",
            "KE": "Kinetic Energy",
            "LEN": "Lenses",
            "MIR": "Mirror Optics",
            "MOI": "Moment of Inertia",
            "MOM": "Momentum",
            "NEW1": "Newton's First Law",
            "NEW2": "Newton's Second Law",
            "NEW3": "Newton's Third Law",
            "NORM": "Normal Force",
            "PE": "Potential Energy",
            "PRES": "Pressure",
            "PUL": "Pulley",
            "PWR": "Power",
            "RD": "Radioactive Decay",
            "RC": "RC Circuits",
            "RKE": "Rotational Kinetic Energy",
            "SNF": "Strong Nuclear Force",
            "TC": "Thermodynamic Cycles",
            "TEN": "Tension",
            "TORQ": "Torque",
            "TKE": "Translational Kinetic Energy",
            "UCM": "Uniform Circular Motion",
            "UG": "Gravitational Potential Energy",
            "USP": "Spring Potential Energy",
            "VAVG": "Average Velocity",
            "VEC": "Vectors",
            "WET": "Work Energy Theorem",
            "WNF": "Weak Nuclear Force",
            "WORK": "Work"
        }
    },
    "Chemistry": {
        "Units": {
            "AAB": "Acids and Bases",
            "AMI": "Atoms, Molecules, and Ions",
            "ATOM": "Atomic Structure",
            "BCHEM": "Biochemistry",
            "BOND": "Bonding",
            "CHEQ": "Chemical Equilibrium",
            "CHKI": "Chemical Kinetics",
            "ECHEM": "Electrochemistry",
            "GAS": "Gases",
            "LAB": "Lab Skills",
            "MCHEM": "Materials Chemistry",
            "OCHEM": "Organic Chemistry",
            "PCHEM": "Physical Chemistry",
            "REACT": "Chemical Reactions",
            "SEF": "Spontaneity, Entropy, and Free Energy",
            "SOL": "Solubility",
            "SOLU": "Solutions",
            "STOICH": "Stoichiometry",
            "TCHEM": "Thermochemistry"
        },
        "Concepts": {
            "ACID": "Acids",
            "ADDI": "Addition Reaction",
            "AEN": "Activation Energy",
            "ALC": "Alcohol",
            "ALDE": "Aldehyde",
            "ALLOY": "Alloys",
            "AMINE": "Amines",
            "AMQN": "Angular Momentum Quantum Number",
            "ANUM": "Atomic Number",
            "ARAD": "Atomic Radius",
            "AROM": "Aromatic Hydrocarbons",
            "AVO": "Avogadro's Law",
            "BASE": "Bases",
            "BONDL": "Bond Length",
            "BONDO": "Bond Order",
            "BOYLE": "Boyle's Law",
            "BUFF": "Buffer Solutions",
            "CHAR": "Charles's Law",
            "CHIR": "Chirality",
            "CHROM": "Chromatography",
            "CONJ": "Conjugate Acids and Bases",
            "CONV": "Conversions",
            "COVB": "Covalent Bonding",
            "DALT": "Dalton's Law of Partial Pressures",
            "DEN": "Density",
            "EFFU": "Effusion",
            "ELEC": "Electrolysis",
            "EMP": "Empirical Formulas",
            "ENEG": "Electronegativity",
            "ENT": "Enthalpy",
            "ESPN": "Electron Spin Quantum Number",
            "FORM": "Formal Charge",
            "FREN": "Free Energy",
            "GAS": "Ideal Gas Law",
            "GAYL": "Gay-Lussac's Law",
            "HALFL": "Half Life",
            "HBOND": "Hydrogen Bond",
            "HESS": "Hess's Law",
            "HYBR": "Hybridization",
            "IONB": "Ionic Bonding",
            "ISO": "Isomers",
            "KANE": "Alkanes",
            "KENE": "Alkenes",
            "KMT": "Kinetic Molecular Theory",
            "KYNE": "Alkynes",
            "LATT": "Lattice Energy",
            "LCHAT": "Le Chatelier's Principle",
            "LIMIT": "Limiting Reactant",
            "LOND": "London Dispersion Forces",
            "MGEO": "Molecular Geometry",
            "MOT": "Molecular Orbital Theory",
            "MQN": "Magnetic Quantum Number",
            "PH": "pH",
            "PIB": "Pi Bond",
            "POL": "Polarity",
            "POLAR": "Polar Bond",
            "PQN": "Principle Quantum Number",
            "PTABLE": "Periodic Table Facts",
            "RAOU": "Raoult's Law",
            "RATEL": "Rate Law",
            "REDOX": "Redox Reaction",
            "SHC": "Specific Heat Capacity",
            "SIGMA": "Sigma Bond",
            "SRP": "Standard Reduction Potential",
            "VAPP": "Vapor Pressure",
            "VHF": "Van't Hoff Factor",
            "VSEPR": "VSEPR Theory"
        }
    },
    "Biology": {
        "Units": {
            "01B":"Molecular Biology",
            "02B":"Cell Biology",
            "03B":"Metabolism",
            "04B":"Hereditary and Genetics",
            "05B":"Evolution",
            "06B":"Biosystematics",
            "07B":"Ecology",
            "08B":"Human Anatomy and Physiology",
            "09B":"Plant Anatomy and Physiology",
            "10B":"Lab Skills"
        },
        "Concepts": {
            "CARB": "Carbon Cycle",
            "CELC": "Cell Communication",
            "CELR": "Cellular Respiration",
            "CELS": "Cell Structure",
            "CELT": "Cellular Transport",
            "CYC": "Cell Cycle",
            "DIG": "Digestion",
            "DNAR": "DNA Replication",
            "ENZ": "Enzymes",
            "GASX": "Gas Exchange",
            "GEC": "Genes & Chromosomes",
            "HORM": "Hormones",
            "IMM": "Immune System",
            "INH": "Inheritance",
            "LAB": "Lab Skills",
            "MEI": "Meiosis",
            "MEM": "Membrane Structure and Function",
            "MIT": "Mitosis",
            "NATS": "Natural Selection",
            "PED": "Pedigrees",
            "PHO": "Photosynthesis",
            "PROT": "Proteins",
            "PUN": "Punnett Squares",
            "TAXON": "Taxonomy",
            "TRSCRIP": "Transcription",
            "TRSLATE": "Translation",
            "PATHO": "Pathophysiology",
            "ORG": "Organ Structure and Function"
        }
    }
};

module.exports = { tags: tags };
