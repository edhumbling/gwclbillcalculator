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
const STORAGE_KEYS = {
    lastCurrentReading: 'gwcl.lastCurrentReadingM3',
    lastSavedAt: 'gwcl.lastSavedAt',
};

function calculateCurrentCharges(prevReading, currReading) {
    const previous = clamp(prevReading);
    const current = clamp(currReading);
    if (!Number.isFinite(previous) || !Number.isFinite(current) || current <= previous) {
        throw new Error('Current reading must be greater than previous reading.');
    }

    const consumption = current - previous; // m³
    
    // Tiered pricing system: first 5 m³ at lower rate, excess at higher rate
    let waterAmountRaw;
    if (consumption <= TARIFFS.firstBlockLimitM3) {
        waterAmountRaw = consumption * TARIFFS.firstBlockRate;
    } else {
        waterAmountRaw = (TARIFFS.firstBlockLimitM3 * TARIFFS.firstBlockRate) + 
                        ((consumption - TARIFFS.firstBlockLimitM3) * TARIFFS.excessRate);
    }
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

            try {
                localStorage.setItem(STORAGE_KEYS.lastCurrentReading, String(curr));
                localStorage.setItem(STORAGE_KEYS.lastSavedAt, new Date().toISOString());
            } catch (_) {
                // Ignore storage errors
            }
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
        // Clear fields
        prevEl.value = '';
        currEl.value = '';
        errorEl.hidden = true;
        result.hidden = true;
    });

    function proposeSavedPreviousReading() {
        let saved = NaN;
        try {
            saved = parseFloat(localStorage.getItem(STORAGE_KEYS.lastCurrentReading));
        } catch (_) {
            saved = NaN;
        }
        if (!Number.isFinite(saved)) return;

        const currentPrev = parseFloat(prevEl.value);
        if (Number.isFinite(currentPrev) && currentPrev === saved) return;

        const useSaved = window.confirm(`Use last saved current reading (${saved.toFixed(3)} m³) as previous reading?`);
        if (useSaved) {
            prevEl.value = String(saved);
        }
    }

    let prompted = false;
    // Prompt on first focus of current reading to match the user's flow
    currEl.addEventListener('focus', () => {
        if (!prompted) {
            prompted = true;
            proposeSavedPreviousReading();
        }
    }, { once: false });

    // Also prompt once on load so keyboard/mouse users both get it
    setTimeout(() => {
        if (!prompted) {
            prompted = true;
            proposeSavedPreviousReading();
        }
    }, 0);
}

document.addEventListener('DOMContentLoaded', attachUI);

// Set dynamic year in header and footer
document.addEventListener('DOMContentLoaded', () => {
    const currentYear = String(new Date().getFullYear());
    document.querySelectorAll('.js-year').forEach((el) => {
        el.textContent = currentYear;
    });
});

// Camera functionality
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const preview = document.getElementById('cameraPreview');
    const previewImage = document.getElementById('previewImage');
    const statusEl = document.getElementById('cameraStatus');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const processBtn = document.getElementById('processBtn');
    const closeBtn = document.getElementById('closeCameraBtn');
    const prevCameraBtn = document.getElementById('prevCameraBtn');
    const currCameraBtn = document.getElementById('currCameraBtn');
    const modalTitle = document.getElementById('cameraModalTitle');
    
    // Ensure modal and all camera elements are hidden on page load
    modal.hidden = true;
    video.hidden = true;
    preview.hidden = true;
    captureBtn.hidden = true;
    retakeBtn.hidden = true;
    processBtn.hidden = true;
    statusEl.hidden = true;
    
    let stream = null;
    let capturedImageData = null;
    let targetInput = null;

    function updateStatus(message, type = 'info') {
        statusEl.textContent = message;
        statusEl.className = `camera-status ${type}`;
        statusEl.hidden = false;
    }

    function hideStatus() {
        statusEl.hidden = true;
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        video.srcObject = null;
    }

    function closeModal() {
        stopCamera();
        modal.hidden = true;
        modal.style.display = 'none';
        video.hidden = true;
        preview.hidden = true;
        captureBtn.hidden = true;
        retakeBtn.hidden = true;
        processBtn.hidden = true;
        
        // Clear captured image data and preview image
        capturedImageData = null;
        previewImage.src = '';
        targetInput = null;
        hideStatus();
    }

    async function startCamera() {
        try {
            updateStatus('Accessing camera...', 'info');
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }, // Use back camera on mobile
                audio: false
            });
            video.srcObject = stream;
            video.hidden = false;
            captureBtn.hidden = false;
            hideStatus();
        } catch (error) {
            console.error('Error accessing camera:', error);
            updateStatus('Failed to access camera. Please ensure you have granted camera permissions.', 'error');
        }
    }

    function capturePhoto() {
        const context = canvas.getContext('2d');
        const maxWidth = 1920; // Limit resolution to stay under 33MP limit
        const maxHeight = 1920;
        
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        // Scale down if too large (maintain aspect ratio)
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        
        // Use lower quality (0.7) to reduce file size and stay under 4MB limit
        capturedImageData = canvas.toDataURL('image/jpeg', 0.7);
        previewImage.src = capturedImageData;
        
        video.hidden = true;
        preview.hidden = false;
        captureBtn.hidden = true;
        retakeBtn.hidden = false;
        processBtn.hidden = false;
        stopCamera();
    }

    function retakePhoto() {
        preview.hidden = true;
        retakeBtn.hidden = true;
        processBtn.hidden = true;
        capturedImageData = null;
        startCamera();
    }

    async function processImage() {
        if (!capturedImageData || !targetInput) return;

        try {
            updateStatus('Extracting reading from image...', 'info');
            processBtn.disabled = true;

            // Use absolute URL if on Vercel, relative for local dev
            const apiUrl = '/api/extract-reading';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ imageBase64: capturedImageData }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.details || errorData.error || `Server error: ${response.status}`;
                throw new Error(errorMessage);
            }

            const data = await response.json();

            if (data.reading !== null && data.reading !== undefined) {
                targetInput.value = parseFloat(data.reading).toFixed(3);
                updateStatus(`Reading extracted: ${data.reading.toFixed(3)} m³`, 'success');
                
                // Auto-close after a short delay
                setTimeout(() => {
                    closeModal();
                    // Trigger input event to update any listeners
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                }, 1500);
            } else {
                updateStatus('Could not extract reading from image. Please try again with a clearer photo.', 'error');
                processBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error processing image:', error);
            updateStatus(`Error: ${error.message}`, 'error');
            processBtn.disabled = false;
        }
    }

    function openCameraForInput(inputElement, label) {
        targetInput = inputElement;
        modalTitle.textContent = `Capture ${label} Reading`;
        
        // Clear any old captured image data and preview
        capturedImageData = null;
        previewImage.src = '';
        preview.hidden = true;
        retakeBtn.hidden = true;
        processBtn.hidden = true;
        
        modal.hidden = false;
        modal.style.display = 'flex';
        startCamera();
    }

    prevCameraBtn.addEventListener('click', () => {
        const prevInput = document.getElementById('prevReading');
        openCameraForInput(prevInput, 'Previous');
    });

    currCameraBtn.addEventListener('click', () => {
        const currInput = document.getElementById('currReading');
        openCameraForInput(currInput, 'Current');
    });

    captureBtn.addEventListener('click', capturePhoto);
    retakeBtn.addEventListener('click', retakePhoto);
    processBtn.addEventListener('click', processImage);
    closeBtn.addEventListener('click', closeModal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });
});


