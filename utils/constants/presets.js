// fill in preset units later
const presetUnitOptions = {
    "Physics": {
        "AP Physics 1": [],
        "AP Physics 2": [],
        "AP Physics C Mechanics": [],
        "AP Physics C EM": [],
        "IB Physics SL1": [],
        "IB Physics SL2/HL2": [],
        "F=ma Exam": []
    },
    "Chemistry": {
        "AP Chemistry": ["Atomic Structure", "Bonding", "Gases", "Solubility", "Stoichiometry", "Acids and Bases", "Chemical Kinetics", "Thermochemistry", "Chemical Equilibrium", "Electrochemistry", "Spontaneity, Entropy, and Free Energy", "Chemical Reactions"],
        "IB Chemistry SL2": ["Atomic Structure", "Bonding", "Gases", "Solubility", "Stoichiometry", "Acids and Bases", "Chemical Kinetics", "Thermochemistry", "Chemical Equilibrium", "Electrochemistry", "Spontaneity, Entropy, and Free Energy", "Chemical Reactions", "Organic Chemistry", "Materials Chemistry", "Biochemistry"],
    },
    "Biology": {
        "AP Biology": ["Molecular Biology","Cell Biology","Metabolism","Heredity and Genetics","Evolution","Ecology"],
        "IB Biology SL": ["Molecular Biology","Cell Biology","Heredity and Genetics","Ecology","Evolution","Biosystematics","Animal Anatomy and Physiology"],
        "IB Biology HL": ["Molecular Biology","Cell Biology","Heredity and Genetics","Ecology","Evolution","Biosystematics","Animal Anatomy and Physiology","Plant Anatomy and Physiology"]
    }
};

module.exports = { presetUnitOptions: presetUnitOptions };
