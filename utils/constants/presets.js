// fill in preset units later
const presetUnitOptions = {
    "Physics": {
        "AP Physics 1": ["Measurement", "Kinematics", "Newton's Laws", "Forces", "Linear Momentum", "Rotation", "Energy Basics", "Gravitation", "Oscillations", "Sound", "Simple Machines"],
        "AP Physics 2": ["Measurement", "Forces", "Energy Basics", "Fluids", "Wave Motion", "Ray Optics", "Wave Optics", "Thermodynamics", "Modern Physics", "Nuclear Physics", "Electrostatics", "Electrical Properties of Materials", "Capacitors", "DC Circuits", "Magnetic Forces", "Induction"],
        "AP Physics C - Mechanics": ["Calculus-Based", "Measurement", "Kinematics", "Newton's Laws", "Forces", "Linear Momentum", "Rotation", "Energy Basics", "Gravitation", "Oscillations", "Simple Machines"],
        "AP Physics C - Electricity and Magnetism": ["Calculus-Based", "Measurement", "Electrostatics", "Electrical Properties of Materials", "Capacitors", "DC Circuits", "AC Circuits", "Magnetic Fields", "Magnetic Forces", "Induction", "Magnetic Properties of Materials", "Electromagnetic Waves - Advanced"],
        "IB Physics SL1": ["Measurement", "Kinematics", "Newton's Laws", "Forces", "Linear Momentum", "Energy Basics", "Gravitation", "Wave Motion", "Sound", "Thermodynamics", "Nuclear Physics", "Electrostatics", "DC Circuits"],
        "IB Physics SL2": ["Measurement", "Kinematics", "Newton's Laws", "Forces", "Linear Momentum", "Energy Basics", "Gravitation", "Wave Motion", "Sound", "Thermodynamics", "Nuclear Physics", "Electrostatics", "DC Circuits", "Rotation", "Fluids", "Ray Optics", "Modern Physics", "Astrophysics"],
        "IB Physics HL2": ["Measurement", "Kinematics", "Newton's Laws", "Forces", "Linear Momentum", "Energy Basics", "Gravitation", "Wave Motion", "Sound", "Thermodynamics", "Nuclear Physics", "Electrostatics", "DC Circuits", "Rotation", "Fluids", "Ray Optics", "Modern Physics", "Astrophysics", "Oscillations", "Wave Optics", "Electrical Properties of Materials", "Capacitors", "Magnetic Fields", "Magnetic Forces", "Induction"],
        "F=ma Exam": ["Simple Machines", "Measurement", "Kinematics", "Newton's Laws", "Forces", "Linear Momentum", "Rotation", "Energy Basics", "Gravitation", "Fluids"]
    },
    "Chemistry": {
        "AP Chemistry": ["Measurement", "Atomic Structure", "Compound Nomenclature", "Stoichiometry", "Solutions", "Types of Reactions", "Gases", "Thermochemistry", "Atomic Periodicity", "Atomic Bonding", "Liquids and Solids", "Kinetics", "Chemical Equilibria", "Acids and Bases", "Physical Chemistry", "Electrochemistry", "Nuclear Chemistry", "Lab Skills"],
        "IB Chemistry SL2": ["Measurement", "Atomic Structure", "Compound Nomenclature", "Stoichiometry", "Solutions", "Types of Reactions", "Gases", "Thermochemistry", "Atomic Periodicity", "Atomic Bonding", "Liquids and Solids", "Kinetics", "Chemical Equilibria", "Acids and Bases", "Physical Chemistry", "Electrochemistry", "Organic Chemistry", "Coordination Chemistry", "Biochemistry", "Lab Skills"]
    },
    "Biology": {
        "AP Biology": ["Molecular Biology", "Cell Biology", "Metabolism", "Heredity and Genetics", "Evolution", "Ecology"],
        "IB Biology SL1": ["Molecular Biology", "Cell Biology", "Heredity and Genetics", "Ecology", "Evolution", "Biosystematics and Biodiversity", "Human Anatomy and Physiology"],
        "IB Biology HL": ["Molecular Biology", "Cell Biology", "Heredity and Genetics", "Ecology", "Evolution", "Biosystematics and Biodiversity", "Human Anatomy and Physiology", "Plant Anatomy and Physiology"]
    }
};

module.exports = { presetUnitOptions: presetUnitOptions };
