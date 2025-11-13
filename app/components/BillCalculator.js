'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'

const TARIFFS = {
    firstBlockLimitM3: 5,
    firstBlockRate: 5.28176,
    excessRate: 9.344558,
    serviceCharge: 10.0,
    fireLevyRate: 0.01,
    ruralLevyRate: 0.02,
};

const HISTORY_STORAGE_KEY = 'gwcl.readingHistory.v1';

const createHistoryId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const fmtMoney = (n) => `GHS ${n.toFixed(2)}`;
const clamp = (n) => (Number.isFinite(n) && n >= 0 ? n : 0);
const STORAGE_KEYS = {
    lastCurrentReading: 'gwcl.lastCurrentReadingM3',
    lastSavedAt: 'gwcl.lastSavedAt',
};

const formatDate = (isoString) => {
    try {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return 'Unknown date';
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return 'Unknown date';
    }
};

const toDateInputValue = (isoString) => {
    try {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return '';
        return date.toISOString().slice(0, 10);
    } catch {
        return '';
    }
};

const sanitizeHistoryEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const fallbackDate = new Date().toISOString();
    const prevReading = Number(entry.prevReading);
    const currReading = Number(entry.currReading);
    return {
        id: entry.id || createHistoryId(),
        prevReading: Number.isFinite(prevReading) ? prevReading : 0,
        currReading: Number.isFinite(currReading) ? currReading : 0,
        consumption: Number(entry.consumption) || 0,
        waterAmount: Number(entry.waterAmount) || 0,
        fire: Number(entry.fire) || 0,
        rural: Number(entry.rural) || 0,
        service: Number(entry.service) || TARIFFS.serviceCharge,
        total: Number(entry.total) || 0,
        status: entry.status === 'paid' ? 'paid' : 'unpaid',
        readingDate: entry.readingDate || entry.createdAt || fallbackDate,
        createdAt: entry.createdAt || fallbackDate,
        updatedAt: entry.updatedAt || entry.createdAt || fallbackDate,
        paidAt: entry.status === 'paid' ? (entry.paidAt || fallbackDate) : null,
        notes: entry.notes || '',
    };
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
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeView, setActiveView] = useState('calculator');
    const [history, setHistory] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [historyError, setHistoryError] = useState('');
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

    const navItems = useMemo(() => ([
        { id: 'calculator', label: 'Bill Calculator' },
        { id: 'history', label: 'Reading History' },
    ]), []);

    const orderedHistory = useMemo(() => {
        return [...history].sort((a, b) => {
            const dateA = new Date(a.readingDate || a.createdAt || 0).getTime();
            const dateB = new Date(b.readingDate || b.createdAt || 0).getTime();
            return dateB - dateA;
        });
    }, [history]);

    const historySummary = useMemo(() => {
        if (!history.length) {
            return {
                outstanding: 0,
                paidTotal: 0,
                unpaidCount: 0,
                paidCount: 0,
                lastReading: null,
            };
        }
        const outstanding = history.reduce((acc, entry) => entry.status === 'unpaid' ? acc + entry.total : acc, 0);
        const paidTotal = history.reduce((acc, entry) => entry.status === 'paid' ? acc + entry.total : acc, 0);
        const unpaidCount = history.filter(entry => entry.status === 'unpaid').length;
        const paidCount = history.length - unpaidCount;
        const lastReading = orderedHistory[0] || null;
        return { outstanding, paidTotal, unpaidCount, paidCount, lastReading };
    }, [history, orderedHistory]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const sanitized = parsed
                        .map(sanitizeHistoryEntry)
                        .filter(Boolean)
                        .sort((a, b) => {
                            const dateA = new Date(a.readingDate || a.createdAt || 0).getTime();
                            const dateB = new Date(b.readingDate || b.createdAt || 0).getTime();
                            return dateB - dateA;
                        });
                    setHistory(sanitized);
                }
            }
        } catch (err) {
            console.error('Failed to load reading history:', err);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
        } catch (err) {
            console.error('Failed to save reading history:', err);
        }
    }, [history]);

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
            recordHistoryEntry(prev, curr, r);

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

    const closeMenu = () => setMenuOpen(false);
    const toggleMenu = () => setMenuOpen((prev) => !prev);

    const handleSelectView = (view) => {
        setActiveView(view);
        closeMenu();
    };

    const recordHistoryEntry = (prevValue, currValue, breakdown) => {
        if (!Number.isFinite(prevValue) || !Number.isFinite(currValue) || !breakdown) {
            return;
        }
        const now = new Date();
        const entry = {
            id: createHistoryId(),
            prevReading: prevValue,
            currReading: currValue,
            consumption: breakdown.consumption,
            waterAmount: breakdown.waterAmount,
            fire: breakdown.fire,
            rural: breakdown.rural,
            service: breakdown.service,
            total: breakdown.total,
            status: 'unpaid',
            readingDate: now.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            paidAt: null,
            notes: '',
        };
        setHistory((prevHistory) => {
            const next = [entry, ...prevHistory];
            return next.sort((a, b) => {
                const dateA = new Date(a.readingDate || a.createdAt || 0).getTime();
                const dateB = new Date(b.readingDate || b.createdAt || 0).getTime();
                return dateB - dateA;
            });
        });
    };

    const toggleEntryStatus = (id) => {
        setHistory((prevHistory) =>
            prevHistory.map((entry) => {
                if (entry.id !== id) return entry;
                const nextStatus = entry.status === 'paid' ? 'unpaid' : 'paid';
                return {
                    ...entry,
                    status: nextStatus,
                    paidAt: nextStatus === 'paid' ? new Date().toISOString() : null,
                    updatedAt: new Date().toISOString(),
                };
            })
        );
    };

    const deleteHistoryEntry = (id) => {
        const confirmDelete = typeof window !== 'undefined'
            ? window.confirm('Remove this reading from history? This cannot be undone.')
            : true;
        if (!confirmDelete) return;
        if (editingId === id) {
            cancelEditEntry();
        }
        setHistory((prevHistory) => prevHistory.filter((entry) => entry.id !== id));
    };

    const beginEditEntry = (entry) => {
        if (!entry) return;
        setEditingId(entry.id);
        setHistoryError('');
        setEditForm({
            date: toDateInputValue(entry.readingDate),
            prevReading: entry.prevReading.toString(),
            currReading: entry.currReading.toString(),
            status: entry.status,
            notes: entry.notes || '',
        });
    };

    const cancelEditEntry = () => {
        setEditingId(null);
        setEditForm(null);
        setHistoryError('');
    };

    const updateEditFormField = (field, value) => {
        setEditForm((prevForm) => {
            if (!prevForm) return prevForm;
            return {
                ...prevForm,
                [field]: value,
            };
        });
    };

    const saveEditEntry = (id) => {
        if (!editForm) return;
        const prevValue = parseFloat(editForm.prevReading);
        const currValue = parseFloat(editForm.currReading);

        if (!Number.isFinite(prevValue) || !Number.isFinite(currValue)) {
            setHistoryError('Please enter valid numeric readings.');
            return;
        }

        let recalculated;
        try {
            recalculated = calculateCurrentCharges(prevValue, currValue);
        } catch (err) {
            setHistoryError(err.message);
            return;
        }

        const dateIso = editForm.date
            ? new Date(`${editForm.date}T00:00:00Z`).toISOString()
            : new Date().toISOString();

        setHistory((prevHistory) =>
            prevHistory.map((entry) => {
                if (entry.id !== id) {
                    return entry;
                }
                return {
                    ...entry,
                    prevReading: prevValue,
                    currReading: currValue,
                    consumption: recalculated.consumption,
                    waterAmount: recalculated.waterAmount,
                    fire: recalculated.fire,
                    rural: recalculated.rural,
                    service: recalculated.service,
                    total: recalculated.total,
                    status: editForm.status,
                    notes: editForm.notes || '',
                    readingDate: dateIso,
                    updatedAt: new Date().toISOString(),
                    paidAt: editForm.status === 'paid' ? (entry.paidAt || new Date().toISOString()) : null,
                };
            })
        );
        setEditingId(null);
        setEditForm(null);
        setHistoryError('');
    };

    const outstandingAmount = historySummary.outstanding || 0;

    return (
        <>
            <header className="site-header">
                <div className="header-left">
                    <button
                        type="button"
                        className={`menu-toggle ${menuOpen ? 'open' : ''}`}
                        aria-label="Toggle navigation"
                        aria-expanded={menuOpen}
                        aria-controls="main-navigation"
                        onClick={toggleMenu}
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                    <div className="brand">
                        <Image src="/favicon.svg" alt="GWCL" width={28} height={28} />
                        <span>GWCL Current Bill</span>
                    </div>
                </div>
                <nav id="main-navigation" className={`main-nav ${menuOpen ? 'open' : ''}`}>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`nav-link ${activeView === item.id ? 'active' : ''}`}
                            onClick={() => handleSelectView(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="header-meta">
                    <div className="period">Domestic 611 • {currentYear}</div>
                    <div className={`header-outstanding ${outstandingAmount > 0 ? 'due' : ''}`}>
                        Outstanding: {fmtMoney(outstandingAmount)}
                    </div>
                </div>
            </header>

            <div className={`nav-backdrop ${menuOpen ? 'open' : ''}`} onClick={closeMenu} role="presentation" />

            <div className="app-layout">
                <aside className="sidebar">
                    <div className="sidebar-nav">
                        <span className="sidebar-label">Navigation</span>
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`sidebar-link ${activeView === item.id ? 'active' : ''}`}
                                onClick={() => handleSelectView(item.id)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="sidebar-summary">
                        <div className="sidebar-outstanding">
                            <span className="sidebar-label">Outstanding</span>
                            <span className="sidebar-value">{fmtMoney(outstandingAmount)}</span>
                        </div>
                        <div className="sidebar-stats">
                            <div>
                                <span className="sidebar-label">Open bills</span>
                                <span className="sidebar-value">{historySummary.unpaidCount}</span>
                            </div>
                            <div>
                                <span className="sidebar-label">Paid bills</span>
                                <span className="sidebar-value">{historySummary.paidCount}</span>
                            </div>
                        </div>
                        {historySummary.lastReading && (
                            <div className="sidebar-last">
                                <span className="sidebar-label">Last reading</span>
                                <span className="sidebar-value">{historySummary.lastReading.currReading.toFixed(3)} m³</span>
                                <span className="sidebar-muted">on {formatDate(historySummary.lastReading.readingDate)}</span>
                                <span className={`status-pill ${historySummary.lastReading.status}`}>
                                    {historySummary.lastReading.status === 'paid' ? 'Paid' : 'Unpaid'}
                                </span>
                            </div>
                        )}
                    </div>
                </aside>

                <main className="container">
                    {activeView === 'calculator' ? (
                        <>
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
                        </>
                    ) : (
                        <section className="card history-card">
                            <div className="history-header">
                                <div>
                                    <h1>Reading History</h1>
                                    <p className="subtext">Review past readings, adjust records, and track whether bills are paid.</p>
                                </div>
                                <div className="history-metrics">
                                    <div className="metric">
                                        <span className="metric-label">Outstanding</span>
                                        <span className="metric-value">{fmtMoney(outstandingAmount)}</span>
                                    </div>
                                    <div className="metric">
                                        <span className="metric-label">Open bills</span>
                                        <span className="metric-value">{historySummary.unpaidCount}</span>
                                    </div>
                                    <div className="metric">
                                        <span className="metric-label">Paid</span>
                                        <span className="metric-value">{historySummary.paidCount}</span>
                                    </div>
                                </div>
                            </div>
                            {historySummary.lastReading && (
                                <div className="history-last">
                                    <span>Latest reading</span>
                                    <strong>{historySummary.lastReading.currReading.toFixed(3)} m³</strong>
                                    <span>on {formatDate(historySummary.lastReading.readingDate)}</span>
                                    <span className={`status-pill ${historySummary.lastReading.status}`}>
                                        {historySummary.lastReading.status === 'paid' ? 'Paid' : 'Unpaid'}
                                    </span>
                                </div>
                            )}
                            {history.length === 0 ? (
                                <p className="note">No readings saved yet. Calculate a bill to add it to your history.</p>
                            ) : (
                                <div className="history-list">
                                    {orderedHistory.map((entry) => {
                                        const isEditing = editingId === entry.id;
                                        return (
                                            <div key={entry.id} className={`history-item ${entry.status}`}>
                                                <div className="history-item-header">
                                                    <div>
                                                        <span className="history-date">{formatDate(entry.readingDate)}</span>
                                                        <span className={`status-pill ${entry.status}`}>
                                                            {entry.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                        </span>
                                                    </div>
                                                    {!isEditing && (
                                                        <div className="history-item-actions">
                                                            <button type="button" className="btn ghost small" onClick={() => beginEditEntry(entry)}>
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn ghost small"
                                                                onClick={() => toggleEntryStatus(entry.id)}
                                                            >
                                                                {entry.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn ghost small danger"
                                                                onClick={() => deleteHistoryEntry(entry.id)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {isEditing ? (
                                                    <form
                                                        className="history-edit"
                                                        onSubmit={(e) => {
                                                            e.preventDefault();
                                                            saveEditEntry(entry.id);
                                                        }}
                                                    >
                                                        <div className="history-edit-grid">
                                                            <label>
                                                                <span>Reading date</span>
                                                                <input
                                                                    type="date"
                                                                    value={editForm?.date || ''}
                                                                    onChange={(e) => updateEditFormField('date', e.target.value)}
                                                                    required
                                                                />
                                                            </label>
                                                            <label>
                                                                <span>Previous reading (m³)</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.001"
                                                                    min="0"
                                                                    value={editForm?.prevReading || ''}
                                                                    onChange={(e) => updateEditFormField('prevReading', e.target.value)}
                                                                    required
                                                                />
                                                            </label>
                                                            <label>
                                                                <span>Current reading (m³)</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.001"
                                                                    min="0"
                                                                    value={editForm?.currReading || ''}
                                                                    onChange={(e) => updateEditFormField('currReading', e.target.value)}
                                                                    required
                                                                />
                                                            </label>
                                                            <label>
                                                                <span>Status</span>
                                                                <select
                                                                    value={editForm?.status || 'unpaid'}
                                                                    onChange={(e) => updateEditFormField('status', e.target.value)}
                                                                >
                                                                    <option value="unpaid">Unpaid</option>
                                                                    <option value="paid">Paid</option>
                                                                </select>
                                                            </label>
                                                            <label className="span-2">
                                                                <span>Notes</span>
                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Optional comment"
                                                                    value={editForm?.notes || ''}
                                                                    onChange={(e) => updateEditFormField('notes', e.target.value)}
                                                                />
                                                            </label>
                                                        </div>
                                                        {historyError && <p className="error history-error">{historyError}</p>}
                                                        <div className="history-edit-actions">
                                                            <button type="submit" className="btn primary small">Save changes</button>
                                                            <button type="button" className="btn ghost small" onClick={cancelEditEntry}>Cancel</button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <div className="history-details">
                                                        <div className="detail-row">
                                                            <span>Previous</span>
                                                            <span>{entry.prevReading.toFixed(3)} m³</span>
                                                        </div>
                                                        <div className="detail-row">
                                                            <span>Current</span>
                                                            <span>{entry.currReading.toFixed(3)} m³</span>
                                                        </div>
                                                        <div className="detail-row">
                                                            <span>Consumption</span>
                                                            <span>{entry.consumption.toFixed(2)} m³</span>
                                                        </div>
                                                        <div className="detail-row">
                                                            <span>Water amount</span>
                                                            <span>{fmtMoney(entry.waterAmount)}</span>
                                                        </div>
                                                        <div className="detail-row">
                                                            <span>Levies (Fire + Rural)</span>
                                                            <span>{fmtMoney(entry.fire + entry.rural)}</span>
                                                        </div>
                                                        <div className="detail-row">
                                                            <span>Service charge</span>
                                                            <span>{fmtMoney(entry.service)}</span>
                                                        </div>
                                                        <div className="detail-row total">
                                                            <span>Total bill</span>
                                                            <span>{fmtMoney(entry.total)}</span>
                                                        </div>
                                                        {entry.status === 'paid' && entry.paidAt && (
                                                            <div className="history-paid">
                                                                Paid on {formatDate(entry.paidAt)}
                                                            </div>
                                                        )}
                                                        {entry.notes && (
                                                            <div className="history-notes">
                                                                <span>Notes</span>
                                                                <p>{entry.notes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}
                </main>
            </div>

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
