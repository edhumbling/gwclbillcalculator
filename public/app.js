const TARIFFS = {
    firstBlockLimitM3: 5,
    firstBlockRate: 5.28176,
    excessRate: 9.344558,
    serviceCharge: 10.0,
    fireLevyRate: 0.01,
    ruralLevyRate: 0.02,
};

const fmtMoney = (n) => `GHS ${n.toFixed(2)}`;
const clamp = (n) => (Number.isFinite(n) && n >= 0 ? n : 0);

function calculateCurrentCharges(prevReading, currReading) {
    const previous = clamp(prevReading);
    const current = clamp(currReading);
    if (!Number.isFinite(previous) || !Number.isFinite(current) || current <= previous) {
        throw new Error('Current reading must be greater than previous reading.');
    }

    const consumption = current - previous; // m³
    const withinFirst = Math.min(consumption, TARIFFS.firstBlockLimitM3);
    const aboveFirst = Math.max(consumption - TARIFFS.firstBlockLimitM3, 0);

    const waterAmountRaw = withinFirst * TARIFFS.firstBlockRate + aboveFirst * TARIFFS.excessRate;
    const waterAmount = Math.round(waterAmountRaw * 100) / 100;
    const fire = Math.round(waterAmount * TARIFFS.fireLevyRate * 100) / 100;
    const rural = Math.round(waterAmount * TARIFFS.ruralLevyRate * 100) / 100;
    const service = TARIFFS.serviceCharge;
    const total = waterAmount + fire + rural + service;

    return {
        consumption,
        waterAmount,
        fire,
        rural,
        service,
        total,
    };
}

function attachUI() {
    const prevEl = document.getElementById('prevReading');
    const currEl = document.getElementById('currReading');
    const errorEl = document.getElementById('error');
    const result = document.getElementById('result');
    const btn = document.getElementById('calcBtn');
    const resetBtn = document.getElementById('resetBtn');

    const out = {
        consumption: document.getElementById('consumption'),
        waterAmount: document.getElementById('waterAmount'),
        fire: document.getElementById('fire'),
        rural: document.getElementById('rural'),
        service: document.getElementById('service'),
        totalGhs: document.getElementById('totalGhs'),
    };

    function run() {
        errorEl.hidden = true;
        errorEl.textContent = '';
        try {
            const prev = parseFloat(prevEl.value);
            const curr = parseFloat(currEl.value);
            const r = calculateCurrentCharges(prev, curr);
            result.hidden = false;
            out.consumption.textContent = `${r.consumption.toFixed(2)} m³`;
            out.waterAmount.textContent = fmtMoney(r.waterAmount);
            out.fire.textContent = fmtMoney(r.fire);
            out.rural.textContent = fmtMoney(r.rural);
            out.service.textContent = fmtMoney(r.service);
            out.totalGhs.textContent = fmtMoney(r.total);
        } catch (e) {
            result.hidden = true;
            errorEl.textContent = e.message;
            errorEl.hidden = false;
        }
    }

    btn.addEventListener('click', run);
    prevEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    currEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    resetBtn.addEventListener('click', () => {
        // Restore defaults
        prevEl.value = '61';
        currEl.value = '63';
        errorEl.hidden = true;
        result.hidden = true;
    });
}

document.addEventListener('DOMContentLoaded', attachUI);


