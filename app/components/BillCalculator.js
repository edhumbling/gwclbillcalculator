'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

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

    const consumption = current - previous;
    let waterAmountRaw;
    
    // Use excess rate if current reading is above 5 m³, otherwise use first block rate
    if (current > TARIFFS.firstBlockLimitM3) {
        // Current reading is above 5 m³, use excess rate for entire consumption
        waterAmountRaw = consumption * TARIFFS.excessRate;
    } else {
        // Current reading is 5 m³ or below, use first block rate
        waterAmountRaw = consumption * TARIFFS.firstBlockRate;
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

export default function BillCalculator() {
    const [prevReading, setPrevReading] = useState('');
    const [currReading, setCurrReading] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState('Capture Meter Reading');
    const [targetInput, setTargetInput] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [cameraStatus, setCameraStatus] = useState({ message: '', type: 'info', hidden: true });
    const [showVideo, setShowVideo] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [showCaptureBtn, setShowCaptureBtn] = useState(false);
    const [showRetakeBtn, setShowRetakeBtn] = useState(false);
    const [showProcessBtn, setShowProcessBtn] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [isParsing, setIsParsing] = useState(false);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const previewImageRef = useRef(null);
    const streamRef = useRef(null);
    const fileInputRef = useRef(null);
    const currentYear = new Date().getFullYear();

    useEffect(() => {
        // Propose saved reading on mount
        try {
            const saved = parseFloat(localStorage.getItem(STORAGE_KEYS.lastCurrentReading));
            if (Number.isFinite(saved) && !prevReading) {
                const useSaved = window.confirm(`Use last saved current reading (${saved.toFixed(3)} m³) as previous reading?`);
                if (useSaved) {
                    setPrevReading(String(saved));
                }
            }
        } catch (_) {}
    }, []);

    const handleCalculate = () => {
        setError('');
        setResult(null);
        try {
            const prev = parseFloat(prevReading);
            const curr = parseFloat(currReading);
            const r = calculateCurrentCharges(prev, curr);
            setResult(r);

            try {
                localStorage.setItem(STORAGE_KEYS.lastCurrentReading, String(curr));
                localStorage.setItem(STORAGE_KEYS.lastSavedAt, new Date().toISOString());
            } catch (_) {}
        } catch (e) {
            setError(e.message);
            setResult(null);
        }
    };

    const handleReset = () => {
        setPrevReading('');
        setCurrReading('');
        setResult(null);
        setError('');
    };

    const openCamera = (inputType, label) => {
        setTargetInput(inputType);
        setModalTitle(`Capture ${label} Reading`);
        setCapturedImage(null);
        setShowPreview(false);
        setShowRetakeBtn(false);
        setShowProcessBtn(false);
        setShowModal(true);
        startCamera();
    };

    const startCamera = async () => {
        try {
            setCameraStatus({ message: 'Accessing camera...', type: 'info', hidden: false });
            
            // Ensure video element is visible first
            setShowVideo(true);
            
            // Wait a bit for React to render the video element
            await new Promise(resolve => setTimeout(resolve, 100));

            // Stop any existing streams before requesting a new one
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                
                // Wait for video to be ready
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play().catch(err => {
                        console.error('Error playing video:', err);
                        setCameraStatus({ 
                            message: 'Camera accessed but failed to start. Please try again.', 
                            type: 'error', 
                            hidden: false 
                        });
                    });
                };
                
                setShowCaptureBtn(true);
                setCameraStatus({ message: '', type: 'info', hidden: true });
            } else {
                throw new Error('Video element not found');
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            setShowVideo(false);
            let errorMessage = 'Failed to access camera. ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Please grant camera permissions and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No camera found on this device.';
            } else if (error.name === 'NotReadableError') {
                errorMessage += 'Camera is already in use by another application. Please close other apps using the camera and try again.';
            } else if (error.name === 'OverconstrainedError') {
                errorMessage += 'Camera does not support the requested settings. Please try again.';
            } else {
                errorMessage += `Error: ${error.message || 'Please ensure you have granted camera permissions.'}`;
            }
            setCameraStatus({ 
                message: errorMessage, 
                type: 'error', 
                hidden: false 
            });
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const capturePhoto = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const context = canvas.getContext('2d');
        const maxWidth = 1920;
        const maxHeight = 1920;
        
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.7);
        setCapturedImage(imageData);
        setShowVideo(false);
        setShowPreview(true);
        setShowCaptureBtn(false);
        setShowRetakeBtn(true);
        setShowProcessBtn(true);
        stopCamera();
    };

    const retakePhoto = () => {
        setShowPreview(false);
        setShowRetakeBtn(false);
        setShowProcessBtn(false);
        setCapturedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        startCamera();
    };

    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setCameraStatus({ 
                message: 'Please select an image file', 
                type: 'error', 
                hidden: false 
            });
            return;
        }

        // Validate file size (4MB limit for base64)
        if (file.size > 4 * 1024 * 1024) {
            setCameraStatus({ 
                message: 'Image too large. Maximum size is 4MB. Please use a smaller image.', 
                type: 'error', 
                hidden: false 
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = e.target?.result;
                // Ensure result is a string (data URL)
                if (!result || typeof result !== 'string') {
                    throw new Error('Invalid file data');
                }
                const imageData = String(result);
                // Stop camera if running
                stopCamera();
                setShowVideo(false);
                setCapturedImage(imageData);
                setShowPreview(true);
                setShowCaptureBtn(false);
                setShowRetakeBtn(true);
                setShowProcessBtn(true);
                setCameraStatus({ message: '', type: 'info', hidden: true });
            } catch (err) {
                setCameraStatus({ 
                    message: 'Error processing file. Please try again.', 
                    type: 'error', 
                    hidden: false 
                });
            }
        };
        reader.onerror = () => {
            setCameraStatus({ 
                message: 'Error reading file. Please try again.', 
                type: 'error', 
                hidden: false 
            });
        };
        reader.readAsDataURL(file);
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const processImage = async () => {
        if (!capturedImage || !targetInput) return;

        try {
            setCameraStatus({ message: 'Extracting reading from image...', type: 'info', hidden: false });
            setProcessing(true);
            setIsParsing(true);

            // Ensure capturedImage is a string
            const imageData = typeof capturedImage === 'string' 
                ? capturedImage 
                : String(capturedImage || '');

            if (!imageData || imageData.trim() === '') {
                throw new Error('No image data available');
            }

            const response = await fetch('/api/extract-reading', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ imageBase64: imageData }),
            });

            if (!response.ok) {
                let errorData = {};
                try {
                    const text = await response.text();
                    if (text) {
                        errorData = JSON.parse(text);
                    }
                } catch (parseErr) {
                    // If JSON parsing fails, use empty object
                    console.error('Error parsing error response:', parseErr);
                }
                const errorMessage = errorData.details || errorData.error || `Server error: ${response.status}`;
                throw new Error(errorMessage);
            }

            let data;
            try {
                const responseText = await response.text();
                if (!responseText) {
                    throw new Error('Empty response from server');
                }
                data = JSON.parse(responseText);
            } catch (parseErr) {
                console.error('Error parsing response:', parseErr);
                throw new Error('Invalid response from server');
            }

            if (data.reading !== null && data.reading !== undefined) {
                const numericReading = Number(data.reading);
                if (!Number.isFinite(numericReading)) {
                    throw new Error('Received non-numeric reading from server');
                }
                const readingValue = numericReading.toFixed(3);
                if (targetInput === 'prev') {
                    setPrevReading(readingValue);
                } else {
                    setCurrReading(readingValue);
                }
                setIsParsing(false);
                setCameraStatus({ 
                    message: `Reading extracted: ${numericReading.toFixed(3)} m³`, 
                    type: 'success', 
                    hidden: false 
                });
                
                setTimeout(() => {
                    closeModal();
                }, 1500);
            } else {
                setIsParsing(false);
                setCameraStatus({ 
                    message: 'Could not extract reading from image. Please try again with a clearer photo.', 
                    type: 'error', 
                    hidden: false 
                });
                setProcessing(false);
            }
        } catch (error) {
            console.error('Error processing image:', error);
            setIsParsing(false);
            setCameraStatus({ 
                message: `Error: ${error.message}`, 
                type: 'error', 
                hidden: false 
            });
            setProcessing(false);
        }
    };

    const closeModal = () => {
        stopCamera();
        setShowModal(false);
        setShowVideo(false);
        setShowPreview(false);
        setShowCaptureBtn(false);
        setShowRetakeBtn(false);
        setShowProcessBtn(false);
        setCapturedImage(null);
        setTargetInput(null);
        setCameraStatus({ message: '', type: 'info', hidden: true });
        setProcessing(false);
        setIsParsing(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Update preview image when capturedImage changes and preview is shown
    useEffect(() => {
        if (capturedImage && showPreview && previewImageRef.current) {
            previewImageRef.current.src = capturedImage;
        }
    }, [capturedImage, showPreview]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && showModal) {
                closeModal();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [showModal]);

    return (
        <>
            <header className="site-header">
                <div className="brand">
                    <Image src="/favicon.svg" alt="GWCL" width={28} height={28} />
                    <span>GWCL Current Bill</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="period">Domestic 611 • {currentYear}</div>
                </div>
            </header>

            <main className="container">
                <section className="card">
                    <h1>Current Bill Calculator</h1>
                    <p className="subtext">Enter your meter readings in cubic metres (m³). 1 unit = 1 m³.</p>

                    <form onSubmit={(e) => { e.preventDefault(); handleCalculate(); }} noValidate>
                        <div className="grid-2">
                            <div className="field">
                                <label htmlFor="prevReading">Previous reading</label>
                                <div className="input-wrap">
                                    <button 
                                        type="button" 
                                        onClick={() => openCamera('prev', 'Previous')}
                                        className="btn-icon input-icon-left" 
                                        title="Capture from camera" 
                                        aria-label="Capture previous reading from camera"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                            <circle cx="12" cy="13" r="4"></circle>
                                        </svg>
                                    </button>
                                    <input 
                                        type="number" 
                                        id="prevReading" 
                                        inputMode="decimal" 
                                        step="0.001" 
                                        min="0" 
                                        placeholder="e.g., 61.000" 
                                        value={prevReading}
                                        onChange={(e) => setPrevReading(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleCalculate(); }}
                                        aria-describedby="prevHelp" 
                                        required 
                                    />
                                    <span className="suffix">m³</span>
                                </div>
                                <small id="prevHelp" className="help">From your last bill or capture from camera</small>
                            </div>

                            <div className="field">
                                <label htmlFor="currReading">Current reading</label>
                                <div className="input-wrap">
                                    <button 
                                        type="button" 
                                        onClick={() => openCamera('curr', 'Current')}
                                        className="btn-icon input-icon-left" 
                                        title="Capture from camera" 
                                        aria-label="Capture current reading from camera"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                            <circle cx="12" cy="13" r="4"></circle>
                                        </svg>
                                    </button>
                                    <input 
                                        type="number" 
                                        id="currReading" 
                                        inputMode="decimal" 
                                        step="0.001" 
                                        min="0" 
                                        placeholder="e.g., 63.000" 
                                        value={currReading}
                                        onChange={(e) => setCurrReading(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleCalculate(); }}
                                        aria-describedby="currHelp" 
                                        required 
                                    />
                                    <span className="suffix">m³</span>
                                </div>
                                <small id="currHelp" className="help">Latest meter value or capture from camera</small>
                            </div>
                        </div>

                        <div className="actions">
                            <button type="submit" className="btn primary">Calculate</button>
                            <button type="button" onClick={handleReset} className="btn ghost">Reset defaults</button>
                        </div>
                        {error && <p className="error" role="alert" aria-live="polite">{error}</p>}
                    </form>

                    {result && (
                        <div className="result">
                            <div className="result-header">
                                <h2>Current charges</h2>
                                <div className="total">{fmtMoney(result.total)}</div>
                            </div>

                            <div className="kv">
                                <div className="k">Consumption</div>
                                <div className="v">{result.consumption.toFixed(2)} m³</div>

                                <div className="k">Water amount</div>
                                <div className="v">{fmtMoney(result.waterAmount)}</div>

                                <div className="k">1% Fire levy</div>
                                <div className="v">{fmtMoney(result.fire)}</div>

                                <div className="k">2% Rural water levy</div>
                                <div className="v">{fmtMoney(result.rural)}</div>

                                <div className="k">Service charge</div>
                                <div className="v">{fmtMoney(result.service)}</div>
                            </div>

                            <p className="note">Note: This covers current charges only. Previous balances or payments are not included.</p>
                        </div>
                    )}
                </section>

                <section className="card info">
                    <details>
                        <summary>Tariff details</summary>
                        <ul className="bullets">
                            <li>Domestic Category 611 ({currentYear}, July–September, 0% adjustment)</li>
                            <li>First 5 m³: GHS 5.28176/m³</li>
                            <li>Excess above 5 m³: GHS 9.344558/m³</li>
                            <li>Levies: 1% Fire Fighting, 2% Rural Water (on water amount)</li>
                            <li>Service charge: GHS 10.00</li>
                        </ul>
                    </details>
                </section>

                <section className="card info">
                    <strong>Disclaimer:</strong>
                    <p className="note">Tariffs and charges may change over time. For the most accurate and up-to-date rates, always verify with GWCL's current published tariffs before relying on these results.</p>
                </section>
            </main>

            <footer className="site-footer">
                <span>GWCL Current Bill Calculator • {currentYear}</span>
            </footer>

            {/* Camera Modal */}
            {showModal && (
                <div 
                    className="modal" 
                    onClick={(e) => { if (e.target.className === 'modal') closeModal(); }}
                    style={{ display: 'flex' }}
                >
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{modalTitle}</h2>
                            <button 
                                type="button" 
                                onClick={closeModal}
                                className="btn-icon" 
                                aria-label="Close camera"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="modal-body">
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept="image/*" 
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                            />
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                style={{ display: showVideo ? 'block' : 'none' }}
                                onError={(e) => {
                                    console.error('Video error:', e);
                                    setCameraStatus({ 
                                        message: 'Error loading camera stream. Please try again.', 
                                        type: 'error', 
                                        hidden: false 
                                    });
                                }}
                            />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                            {showPreview && (
                                <div className="camera-preview">
                                    <div className="preview-container">
                                        <img ref={previewImageRef} alt="Preview" className={isParsing ? 'parsing' : ''} />
                                        {isParsing && (
                                            <div className="parsing-overlay">
                                                <div className="scan-line"></div>
                                                <div className="parsing-text">Reading...</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {!cameraStatus.hidden && (
                                <div className={`camera-status ${cameraStatus.type}`}>
                                    {cameraStatus.message}
                                </div>
                            )}
                            <div className="camera-actions">
                                {!showPreview && (
                                    <button 
                                        type="button" 
                                        onClick={triggerFileUpload} 
                                        className="btn secondary"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="17 8 12 3 7 8"></polyline>
                                            <line x1="12" y1="3" x2="12" y2="15"></line>
                                        </svg>
                                        Upload Image
                                    </button>
                                )}
                                {showCaptureBtn && (
                                    <button type="button" onClick={capturePhoto} className="btn primary">
                                        Capture Photo
                                    </button>
                                )}
                                {showRetakeBtn && (
                                    <button type="button" onClick={retakePhoto} className="btn ghost">
                                        Retake
                                    </button>
                                )}
                                {showProcessBtn && (
                                    <button 
                                        type="button" 
                                        onClick={processImage} 
                                        className="btn primary"
                                        disabled={processing}
                                    >
                                        Extract Reading
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
