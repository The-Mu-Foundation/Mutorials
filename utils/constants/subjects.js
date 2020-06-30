// list of subjects and units used
var subjects = ["Physics", "Chemistry", "Biology"];
var subjectUnitDictionary = {
    "Physics": ["Kinematics",
                "Forces",
                "Energy",
                "Momentum and Collisions",
                "Rotational Motion",
                "Solids and Fluids",
                "Simple Harmonic Motion"
                //"Thermodynamics",
                //"Vibrations and Waves",
                //"Electric Forces and Fields",
                //"Electrical Energy and Capacitance",
                //"Current and Resistance",
                //"DC Circuits",
                //"AC Circuits",
                //"Magnetism",
                //"Inductance",
                //"Reflection and Refraction",
                //"Mirrors and Lenses",
                //"Wave Optics",
                //"Relativity",
                //"Quantum Physics",
                //"Nuclear Energy and Elementary Particles"
            ],
    "Chemistry": ["Stoichiometry",
                "Gases",
                "Thermochemistry",
                "Atomic Structure",
                "Bonding",
                "Chemical Kinetics",
                "Chemical Equilibrium",
                "Acids and Bases",
                "Solubility",
                "Spontaneity",
                "Electrochemistry",
                "Organic Chemistry"
            ],
    "Biology": ["Cell Biology",
                "Molecular Biology",
                "Heredity and Genetics",
                "Ecology",
                "Evolution and Biodiversity",
                "Human Physiology",
                "Plant and Animal Physiology"
            ]
}

module.exports = { subjectUnitDictionary: subjectUnitDictionary, subjects: subjects };