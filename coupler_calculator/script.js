document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.getElementById('calculateBtn');
    const resultsGrid = document.getElementById('resultsGrid');
    
    calculate();

    calculateBtn.addEventListener('click', () => {
        calculate();
        resultsGrid.classList.remove('pop-anim');
        void resultsGrid.offsetWidth; 
        resultsGrid.classList.add('pop-anim');
    });

    function calculate() {
        const z0 = parseFloat(document.getElementById('z0').value);
        const zl = parseFloat(document.getElementById('zl').value);
        const freq = parseFloat(document.getElementById('freq').value);
        const er = parseFloat(document.getElementById('er').value);
        const h = parseFloat(document.getElementById('h').value);

        if (isNaN(z0) || isNaN(zl) || isNaN(freq) || isNaN(er) || isNaN(h) || z0 <= 0 || zl <= 0 || h <= 0) {
            alert("Please enter valid positive numbers for all fields.");
            return;
        }

        // 1. Calculate Impedances
        const zs = Math.sqrt((z0 * zl) / 2);
        const zp1 = z0;
        const zp2 = zl;

        // 2. Calculate Microstrip Physical Dimensions (W, L)
        const dim_zs = calculateMicrostrip(zs, er, h, freq);
        const dim_zp1 = calculateMicrostrip(zp1, er, h, freq);
        const dim_zp2 = calculateMicrostrip(zp2, er, h, freq);

        // 3. Update DOM
        document.getElementById('res-zs').textContent = zs.toFixed(2) + ' Ω';
        document.getElementById('res-zp1').textContent = zp1.toFixed(2) + ' Ω';
        document.getElementById('res-zp2').textContent = zp2.toFixed(2) + ' Ω';

        // Update CST Dimensions
        animateValue('w-zs', dim_zs.W);
        animateValue('l-zs', dim_zs.L);
        
        animateValue('w-zp1', dim_zp1.W);
        animateValue('l-zp1', dim_zp1.L);
        
        animateValue('w-zp2', dim_zp2.W);
        animateValue('l-zp2', dim_zp2.L);
    }

    // Microstrip Synthesis Formulas (Wheeler / Hammerstad)
    function calculateMicrostrip(Z, er, h, f_GHz) {
        // A and B parameters
        const A = (Z / 60) * Math.sqrt((er + 1) / 2) + ((er - 1) / (er + 1)) * (0.23 + 0.11 / er);
        const B = (377 * Math.PI) / (2 * Z * Math.sqrt(er));
        
        let w_h;
        // Check W/h < 2 
        const w_h_less = (8 * Math.exp(A)) / (Math.exp(2 * A) - 2);
        if (w_h_less < 2) {
            w_h = w_h_less;
        } else {
            w_h = (2 / Math.PI) * (B - 1 - Math.log(2 * B - 1) + ((er - 1) / (2 * er)) * (Math.log(B - 1) + 0.39 - 0.61 / er));
        }
        
        const W = w_h * h;
        
        // Effective Dielectric Constant
        let ereff;
        if (w_h < 1) {
            ereff = (er + 1) / 2 + ((er - 1) / 2) * (1 / Math.sqrt(1 + 12 / w_h) + 0.04 * Math.pow(1 - w_h, 2));
        } else {
            ereff = (er + 1) / 2 + ((er - 1) / 2) * (1 / Math.sqrt(1 + 12 / w_h));
        }
        
        // Guided wavelength in mm (c = 300 mm/ns)
        const lambda_g = 300 / (f_GHz * Math.sqrt(ereff));
        
        // Quarter wavelength
        const L = lambda_g / 4;
        
        return { W: W, L: L };
    }

    function animateValue(id, targetValue) {
        const element = document.getElementById(id);
        const duration = 800; // ms
        const startValue = 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = startValue + (targetValue - startValue) * easeOut;
            
            element.textContent = current.toFixed(3);

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = targetValue.toFixed(3);
            }
        }
        requestAnimationFrame(update);
    }
});
