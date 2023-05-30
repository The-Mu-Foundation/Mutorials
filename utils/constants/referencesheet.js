// tags
const referenceSheet = {
    equations: {
        "First Kinematics Equation": "$v = v_0 + at$",
        "Second Kinematics Equation": "$\\Delta x = \\frac{v+v_0}{2}t$",
        "Third Kinematics Equation": "$\\Delta x = v_0t + \\frac{1}{2}at^2$",
        "Fourth Kinematics Equation": "$v^2 = v_0^2 + 2a\\Delta x$",
        "Net Force Equation": "$\\vec{a} = \\frac{\\Sigma\\vec{F}}{m} = \\frac{\\vec{F}_{net}}{m}$",
        "Frictional Force Equation": "$|\\vec{F}_f| \\leq \\mu |\\vec{F}_n|$",
        "Centripetal Acceleration Formula": "$a_c = \\frac{v^2}{r}$",
        "Momentum Equation": "$\\vec{p} = m\\vec{v}$",
        "Impulse-Momentum Equation": "$\\Delta \\vec{p} = \\vec{F}\\Delta t$",
        "Kinetic Energy Formula": "$KE = \\frac{1}{2}mv^2$",
        "Work Equation": "$\\Delta E = W = F_{||}d = Fd\\cos{\\theta}$",
        "Power Equation": "$P = \\frac{\\Delta E}{\\Delta t} = I\\Delta V$\"",
        "First Rotational Kinematics Equation": "$\\Delta\\theta = \\omega_0t = \\frac{1}{2}at^2$",
        "Second Rotational Kinematics Equation": "$\\omega = \\omega_0+\\alpha t$",
        "Simple Harmonic Motion Equation": "$x = A\\cos{(2\\pi ft)}$",
        "Net Torque Equation": "$\\vec{\\alpha} = \\frac{\\Sigma \\vec{\\tau}}{I} = \\frac{\\vec\\tau_{net}}{I}$",
        "Torque Equation": "$\\tau = r_{\\perp}F = rF\\sin\\theta$",
        "Angular Momentum Equation": "$L = I\\omega$",
        "Angular Impulse Momentum Theorem": "$\\Delta L = \\tau \\Delta t$",
        "Rotational Kinetic Energy": "$KE = \\frac{1}{2}I\\omega^2$",
        "Hooke's Law": "$|\\vec{F}_s| = k|\\vec{x}|$",
        "Spring Kinetic Energy Formula": "$U_s=\\frac{1}{2}kx^2$",
        "Density Equation": "$\\rho = \\frac{m}{V}$",
        "Coulomb's Law": "$|\\vec{F}_E| = k|\\frac{q_1q_2}{r^2}|$",
        "Current Equation": "$I = \\frac{\\Delta q}{\\Delta t}$",
        "Resisivity Law": "$R = \\frac{\\rho l}{A}$",
        "Ohm's Law": "$I = \\frac{\\Delta V}{R}$",
        "Resistors in Series": "$R_s = \\sum_i R_i$",
        "Resistors in Parallel": "$\\frac{1}{R_p} = \\sum_i\\frac{1}{R_i}$"
    },
    constants: {
        "Proton Mass": "$m_p = 1.67\\times10^{-27}\\:\\mathrm{kg}$",
        "Neutron Mass": "$m_n = 1.67\\times10^{-27}\\:\\mathrm{kg}$",
        "Electron Mass": "$m_e = 9.11\\times10^{-31}\\:\\mathrm{kg}$",
        "Speed of Light": "$c = 3.00\\times10^8\\:\\mathrm{m/s}$",
        "Electron charge magnitude": "$e = 1.60\\times10^{-19}\\:\\mathrm{C}$",
        "Coulomb's law constant": "$k = \\frac{\\pi\\varepsilon_0}{4} = 8.99\\times10^9\\:\\mathrm{Nm^2/C^2}$",
        "Universal gravitational constant": "$6.67\\times10^{-11}\\:\\mathrm{Nm^2/kg^2}$",
        "Acceleration due to gravity at Earth's surface": "$g = 9.809\\:\\mathrm{m/s^2}$",
        "Avogadro's number": "$N_0 = 6.02\\times10^{23}\\:\\mathrm{mol^{-1}}$",
        "Universal gas constant": "$R = 8.31\\: \\mathrm{J/(mol\\cdot K)}$",
        "Boltzmann's constant": "$k_B = 1.38\\times10^{-23}\\:\\mathrm{J/K}$",
        "1 electron volt": "$1\\:\\mathrm{eV} = 1.60\\times10^{-19}\\:\\mathrm{J}$",
        "1 unified atomic mass unit": "$1\\:\\mathrm{u} = 1.66\\times10^{-27}\\:\\mathrm{kg} = 931\\:\\mathrm{MeV/c^2}$",
        "Planck's constant": "$h = 6.63\\times10^{-34}\\:\\mathrm{J\\cdot s} = 4.14\\times10^{-15}\\:\\mathrm{eV\\cdot s}$",
        "Vacuum permittivity": "$\\varepsilon_0 = 8.85\\times 10^{-12}\\:\\mathrm{C^2/N\\cdot m^2}$",
        "Vacuum permeability": "$\\mu_0 = 4\\pi\\times10^{-7}\\:\\mathrm{(T\\cdot m)/A}$",
        "Magnetic constant": "$k' = \\frac{\\mu_0}{4\\pi} = 1\\times 10^{-7}\\:\\mathrm{(T\\cdot m)/A}$",
        "1 atmosphere pressure": "$1\\:\\mathrm{atm} = 1.0\\times10^5\\:\\mathrm{N/m^2} = 1.0\\times 10^5\\:\\mathrm{Pa}$"

    }
};

module.exports = { referenceSheet: referenceSheet };