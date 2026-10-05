// AnzenRoad Frontend Controller

let map;
let marker;
let selectedLatLng = null;
let selectedAddress = "";
let uploadedPhotos = []; // [{ id, file, previewUrl, isExisting, serverPath }]
let generatedPdfBlobUrl = null;
let currentClosestJurisdiction = null;
let jurisdictionCandidates = [];
let existingSpots = [];

// Jurisdiction Modal Elements
const modalJurisdiction = document.getElementById('modal-jurisdiction');
const btnOpenJurisdictionModal = document.getElementById('btn-open-jurisdiction-modal');
const btnCloseJurisdiction = document.getElementById('btn-close-jurisdiction');
const btnCancelJurisdiction = document.getElementById('btn-cancel-jurisdiction');
const btnApplyJurisdiction = document.getElementById('btn-apply-jurisdiction');
const jurisdictionCandidatesList = document.getElementById('jurisdiction-candidates-list');
const manualJName = document.getElementById('manual-j-name');
const manualJAddress = document.getElementById('manual-j-address');
const manualJPhone = document.getElementById('manual-j-phone');

// Spots List & Edit State Elements
let editingSpotId = null;
const btnToggleSpotsList = document.getElementById('btn-toggle-spots-list');
const spotsCountBadge = document.getElementById('spots-count-badge');
const modalSpotsList = document.getElementById('modal-spots-list');
const btnCloseSpotsList = document.getElementById('btn-close-spots-list');
const btnCloseSpotsListBottom = document.getElementById('btn-close-spots-list-bottom');
const spotsListContainer = document.getElementById('spots-list-container');
const editBanner = document.getElementById('edit-banner');
const editSpotIdSpan = document.getElementById('edit-spot-id');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

// DOM Elements
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');
const step4 = document.getElementById('step-4');

const prgStep1 = document.getElementById('progress-step-1');
const prgStep2 = document.getElementById('progress-step-2');
const prgStep3 = document.getElementById('progress-step-3');
const prgStep4 = document.getElementById('progress-step-4');

const lineStep1 = document.getElementById('line-step-1');
const lineStep2 = document.getElementById('line-step-2');
const lineStep3 = document.getElementById('line-step-3');

const btnGotoStep2 = document.getElementById('btn-goto-step-2');
const btnGotoStep3 = document.getElementById('btn-goto-step-3');
const btnBackToStep1 = document.getElementById('btn-back-to-step-1');
const btnBackToStep2 = document.getElementById('btn-back-to-step-2');
const btnFinalize = document.getElementById('btn-finalize');
const btnRestart = document.getElementById('btn-restart');

const coordinatesInfo = document.getElementById('coordinates-info');
const displayAddress = document.getElementById('display-address');
const btnGps = document.getElementById('btn-gps');

// Photos Multiple Upload Elements
const photoDropzone = document.getElementById('photo-dropzone');
const photoInput = document.getElementById('photo-input');
const dropzonePrompt = document.getElementById('dropzone-prompt');
const btnTriggerCamera = document.getElementById('btn-trigger-camera');
const btnAddPhotoBrowse = document.getElementById('btn-add-photo-browse');
const photosGalleryContainer = document.getElementById('photos-gallery-container');
const photosGalleryGrid = document.getElementById('photos-gallery-grid');

const btnPreviewPdf = document.getElementById('btn-preview-pdf');
const pdfFrameWrapper = document.getElementById('pdf-frame-wrapper');
const pdfPreviewIframe = document.getElementById('pdf-preview-iframe');
const pdfLoadingOverlay = document.getElementById('pdf-loading-overlay');
const btnDownloadPdfFinal = document.getElementById('btn-download-pdf-final');

// Modal Elements
const modalWebcam = document.getElementById('modal-webcam');
const webcamVideo = document.getElementById('webcam-video');
const webcamCanvas = document.getElementById('webcam-canvas');
const btnCloseWebcam = document.getElementById('btn-close-webcam');
const btnCaptureWebcam = document.getElementById('btn-capture-webcam');
const btnSwitchCamera = document.getElementById('btn-switch-camera');

const modalBlur = document.getElementById('modal-blur');
const btnCloseBlur = document.getElementById('btn-close-blur');
const btnResetBlur = document.getElementById('btn-reset-blur');
const btnSaveBlur = document.getElementById('btn-save-blur');
const editorCanvas = document.getElementById('editor-canvas');
const editorCanvasContainer = document.getElementById('editor-canvas-container');
const brushSize = document.getElementById('brush-size');
const brushSizeVal = document.getElementById('brush-size-val');

// Zoom Elements in Blur Editor
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');
const zoomLevelText = document.getElementById('zoom-level-text');
const zoomRange = document.getElementById('zoom-range');

// Global state for camera/editor
let webcamStream = null;
let currentFacingMode = 'environment'; // default to rear camera
let editorOriginalImage = null;
let editorBlurredCanvas = null;
let editorCtx = null;
let isDrawingOnEditor = false;
let currentBlurPhotoIndex = null;
let currentZoom = 1.0;
let editorCanvasOriginalWidth = 0;
let editorCanvasOriginalHeight = 0;
let baseDisplayWidth = 0;
let baseDisplayHeight = 0;

// Initialize the Application
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
    loadExistingSpots();
});

// 1. Interactive Map Control
function initMap() {
    // Default coordinates: Shinjuku area (near metropolitan government)
    const defaultLat = 35.6938;
    const defaultLng = 139.7034;
    
    map = L.map('map', {
        zoomControl: false // Disable default zoom controls to style it clean
    }).setView([defaultLat, defaultLng], 15);
    
    // Add standard zoom control at the top-right
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Dark-themed tiles or standard OSM tiles (styled via CSS filter in styles.css)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Map click event
    map.on('click', (e) => {
        placeMarker(e.latlng);
    });
}

function placeMarker(latlng) {
    selectedLatLng = latlng;
    
    if (marker) {
        marker.setLatLng(latlng);
    } else {
        // Create custom red pin icon
        const redIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
        
        marker = L.marker(latlng, { 
            draggable: true,
            icon: redIcon
        }).addTo(map);
        
        // Marker dragend event
        marker.on('dragend', (e) => {
            selectedLatLng = marker.getLatLng();
            updateLocationInfo();
        });
    }
    
    updateLocationInfo();
    btnGotoStep2.disabled = false;
}

// Reverse Geocoding via OSM Nominatim API
async function updateLocationInfo() {
    if (!selectedLatLng) return;
    
    const lat = selectedLatLng.lat.toFixed(6);
    const lng = selectedLatLng.lng.toFixed(6);
    coordinatesInfo.textContent = `緯度: ${lat} / 経度: ${lng}`;
    displayAddress.value = "住所を検索中...";
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja`);
        if (response.ok) {
            const data = await response.json();
            selectedAddress = data.display_name || "";
            
            // Clean up Nominatim address format which tends to be reversed
            // Format: "Japan, Tokyo, Shinjuku, ..." -> Extract key parts
            let cleanAddress = "";
            if (data.address) {
                const addr = data.address;
                const state = addr.province || addr.state || addr.prefecture || "";
                const city = addr.city || addr.ward || addr.town || addr.village || addr.suburb || "";
                const road = addr.road || "";
                const houseNum = addr.house_number || "";
                const neighbourhood = addr.neighbourhood || addr.suburb || "";
                
                cleanAddress = `${state}${city}${neighbourhood}${road}${houseNum}`.trim();
                
                // If it is still empty, fallback to displayName
                if (!cleanAddress) {
                    cleanAddress = data.display_name;
                }
            } else {
                cleanAddress = data.display_name;
            }
            
            // Remove country name "日本、" if present
            cleanAddress = cleanAddress.replace(/^日本(、)?/, '').replace(/, Japan$/, '');
            selectedAddress = cleanAddress || `${lat}, ${lng}`;
            displayAddress.value = selectedAddress;
        } else {
            throw new Error("Address fetch failed");
        }
    } catch (error) {
        console.error("Geocoding error:", error);
        selectedAddress = `緯度: ${lat}, 経度: ${lng} 付近`;
        displayAddress.value = selectedAddress;
    }
}

// GPS / Location tracking
btnGps.addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert("お使いのブラウザは現在地取得に対応していません。");
        return;
    }
    
    btnGps.classList.add('loading');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
            map.setView(latlng, 17);
            placeMarker(latlng);
            btnGps.classList.remove('loading');
        },
        (error) => {
            console.error("GPS error:", error);
            alert("位置情報の取得に失敗しました。地図を直接クリックして指定してください。");
            btnGps.classList.remove('loading');
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
});

// Load and show historical user-reported spots
async function loadExistingSpots() {
    try {
        const response = await fetch('/api/spots');
        if (response.ok) {
            existingSpots = await response.json();
            
            // Render markers for existing spots
            existingSpots.forEach(spot => {
                // Determine icon color/style based on danger level
                const blueIcon = L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [20, 32],
                    iconAnchor: [10, 32],
                    shadowSize: [32, 32]
                });
                
                const categoryText = {
                    'poor_visibility': '見通しが悪い',
                    'heavy_traffic': '交通量が多い',
                    'speeding': 'スピード超過',
                    'no_sidewalk': '歩道がない',
                    'no_light': '信号がない',
                    'other': 'その他'
                }[spot.danger_category] || '危険箇所';
                
                const stars = '★'.repeat(spot.danger_level) + '☆'.repeat(5 - spot.danger_level);
                
                const popupContent = `
                    <div style="font-family: sans-serif; color: #1e293b; padding: 2px;">
                        <strong style="color: #e11d48; font-size:13px;">⚠️ 報告済みの危険箇所</strong><br/>
                        <b>区分:</b> ${categoryText}<br/>
                        <b>危険度:</b> <span style="color:#f59e0b;">${stars}</span><br/>
                        <b>状況:</b> ${spot.description || '特になし'}<br/>
                        <span style="font-size:10px; color:#64748b;">登録日: ${spot.created_at.split(' ')[0]}</span>
                    </div>
                `;
                
                L.marker([spot.latitude, spot.longitude], { icon: blueIcon })
                    .addTo(map)
                    .bindPopup(popupContent);
            });
        }
    } catch (err) {
        console.error("Failed to load historical spots:", err);
    }
}

// 2. Step Flow Control
function goToStep(stepNumber) {
    // Hide all steps
    [step1, step2, step3, step4].forEach(s => s.classList.remove('active'));
    
    // Deactivate all progress lines/items
    [prgStep2, prgStep3, prgStep4].forEach(p => p.classList.remove('active'));
    [lineStep1, lineStep2, lineStep3].forEach(l => l.classList.remove('active'));
    
    if (stepNumber === 1) {
        step1.classList.add('active');
    } else if (stepNumber === 2) {
        step2.classList.add('active');
        prgStep2.classList.add('active');
        lineStep1.classList.add('active');
    } else if (stepNumber === 3) {
        step3.classList.add('active');
        prgStep2.classList.add('active');
        prgStep3.classList.add('active');
        lineStep1.classList.add('active');
        lineStep2.classList.add('active');
        
        // Fetch jurisdiction info as we enter Step 3
        resolveJurisdiction();
    } else if (stepNumber === 4) {
        step4.classList.add('active');
        prgStep2.classList.add('active');
        prgStep3.classList.add('active');
        prgStep4.classList.add('active');
        lineStep1.classList.add('active');
        lineStep2.classList.add('active');
        lineStep3.classList.add('active');
    }
    
    // Auto-scroll to wizard panel on small screens
    if (window.innerWidth <= 992) {
        document.querySelector('.panel-form').scrollIntoView({ behavior: 'smooth' });
    }
}

function setupEventListeners() {
    // Navigation Buttons
    btnGotoStep2.addEventListener('click', () => goToStep(2));
    btnGotoStep3.addEventListener('click', () => {
        // Validate Category in Step 2
        const categorySelect = document.getElementById('danger_category');
        if (!categorySelect.value) {
            categorySelect.reportValidity();
            return;
        }
        goToStep(3);
    });
    
    btnBackToStep1.addEventListener('click', () => goToStep(1));
    btnBackToStep2.addEventListener('click', () => goToStep(2));
    
    btnFinalize.addEventListener('click', () => {
        // Validate Requester fields in Step 3
        const reqName = document.getElementById('requester_name');
        const reqPhone = document.getElementById('requester_phone');
        const reqAddr = document.getElementById('requester_address');
        
        if (!reqName.value || !reqPhone.value || !reqAddr.value) {
            reqName.reportValidity();
            reqPhone.reportValidity();
            reqAddr.reportValidity();
            return;
        }
        
        // Save requester details in localStorage for future convenience
        localStorage.setItem('anzenroad_req_name', reqName.value);
        localStorage.setItem('anzenroad_req_phone', reqPhone.value);
        localStorage.setItem('anzenroad_req_address', reqAddr.value);
        
        saveSpotAndFinalize();
    });
    
    btnRestart.addEventListener('click', () => {
        resetForm();
        goToStep(1);
    });

    // Address Manual Edit & Map sync (Forward Geocoding)
    displayAddress.addEventListener('input', () => {
        selectedAddress = displayAddress.value;
    });

    displayAddress.addEventListener('change', async () => {
        const addressQuery = displayAddress.value.trim();
        if (!addressQuery) return;
        
        coordinatesInfo.textContent = "住所から地図の位置を検索中...";
        
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&accept-language=ja&limit=1`);
            if (response.ok) {
                const results = await response.json();
                if (results && results.length > 0) {
                    const first = results[0];
                    const lat = parseFloat(first.lat);
                    const lng = parseFloat(first.lon);
                    const latlng = L.latLng(lat, lng);
                    
                    selectedLatLng = latlng;
                    selectedAddress = addressQuery;
                    
                    // Move or place marker
                    if (marker) {
                        marker.setLatLng(latlng);
                    } else {
                        const redIcon = L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        });
                        marker = L.marker(latlng, { draggable: true, icon: redIcon }).addTo(map);
                        marker.on('dragend', (e) => {
                            selectedLatLng = marker.getLatLng();
                            updateLocationInfo();
                        });
                    }
                    
                    map.setView(latlng, 17);
                    coordinatesInfo.textContent = `緯度: ${lat.toFixed(6)} / 経度: ${lng.toFixed(6)}`;
                    btnGotoStep2.disabled = false;
                    
                    // Update jurisdiction
                    resolveJurisdiction();
                } else {
                    coordinatesInfo.textContent = "指定された住所の位置が見つかりませんでした";
                }
            }
        } catch (err) {
            console.error("Forward geocoding error:", err);
            coordinatesInfo.textContent = "位置検索エラー";
        }
    });

    displayAddress.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            displayAddress.blur(); // Triggers change event
        }
    });

    // Populate saved requester info from localStorage if available
    const savedName = localStorage.getItem('anzenroad_req_name');
    const savedPhone = localStorage.getItem('anzenroad_req_phone');
    const savedAddr = localStorage.getItem('anzenroad_req_address');
    if (savedName) document.getElementById('requester_name').value = savedName;
    if (savedPhone) document.getElementById('requester_phone').value = savedPhone;
    if (savedAddr) document.getElementById('requester_address').value = savedAddr;

    // Photo Upload Triggers (複数写真対応)
    if (photoDropzone) photoDropzone.addEventListener('click', () => photoInput.click());
    if (btnAddPhotoBrowse) btnAddPhotoBrowse.addEventListener('click', () => photoInput.click());
    
    photoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handlePhotosSelect(e.target.files);
            photoInput.value = ''; // 次回同じファイルを選んでも発火するようにリセット
        }
    });

    // Drag and drop event handlers
    if (photoDropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            photoDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                photoDropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            photoDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                photoDropzone.classList.remove('dragover');
            }, false);
        });

        photoDropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                handlePhotosSelect(files);
            }
        });
    }

    // Webcam Events
    btnTriggerCamera.addEventListener('click', openWebcam);
    btnCloseWebcam.addEventListener('click', closeWebcam);
    btnCaptureWebcam.addEventListener('click', captureWebcamPhoto);
    btnSwitchCamera.addEventListener('click', switchWebcam);

    // Blur Editor Events
    btnCloseBlur.addEventListener('click', closeBlurEditor);
    btnResetBlur.addEventListener('click', resetBlurCanvas);
    btnSaveBlur.addEventListener('click', saveBlurCanvas);
    brushSize.addEventListener('input', (e) => {
        brushSizeVal.textContent = e.target.value;
    });

    // Blur Zoom Events
    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            adjustZoom(0.25);
        });
    }
    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            adjustZoom(-0.25);
        });
    }
    if (btnZoomReset) {
        btnZoomReset.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            resetZoom();
        });
    }
    if (zoomRange) {
        zoomRange.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) / 100;
            setZoom(val);
        });
    }

    // Canvas drawing setup
    setupEditorCanvasDrawing();

    // PDF Preview Trigger
    btnPreviewPdf.addEventListener('click', generatePdfPreview);
    
    // Jurisdiction Modal Events
    if (btnOpenJurisdictionModal) btnOpenJurisdictionModal.addEventListener('click', openJurisdictionModal);
    if (btnCloseJurisdiction) btnCloseJurisdiction.addEventListener('click', closeJurisdictionModal);
    if (btnCancelJurisdiction) btnCancelJurisdiction.addEventListener('click', closeJurisdictionModal);
    if (btnApplyJurisdiction) btnApplyJurisdiction.addEventListener('click', applyJurisdictionSelection);

    // Spots List Modal & Edit Events
    if (btnToggleSpotsList) btnToggleSpotsList.addEventListener('click', openSpotsListModal);
    if (btnCloseSpotsList) btnCloseSpotsList.addEventListener('click', closeSpotsListModal);
    if (btnCloseSpotsListBottom) btnCloseSpotsListBottom.addEventListener('click', closeSpotsListModal);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', cancelEditMode);

    // Final download button trigger
    btnDownloadPdfFinal.addEventListener('click', () => {
        if (generatedPdfBlobUrl) {
            const a = document.createElement('a');
            a.href = generatedPdfBlobUrl;
            a.download = '要望書.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert("PDFが生成されていません。プレビューを実行してください。");
        }
    });

    // 初回に登録済み要望書件数を取得
    fetchSpotsCount();
}

// 3. Photos Multiple Handling (複数写真の追加・管理)
function handlePhotosSelect(fileList) {
    const validFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
        alert('画像ファイル（JPEG, PNG等）を選択してください。');
        return;
    }

    validFiles.forEach(file => {
        const previewUrl = URL.createObjectURL(file);
        uploadedPhotos.push({
            id: Date.now() + Math.random().toString(36).substring(2, 7),
            file: file,
            previewUrl: previewUrl,
            isExisting: false,
            serverPath: null
        });
    });

    renderPhotosGallery();
}

function renderPhotosGallery() {
    if (!photosGalleryContainer || !photosGalleryGrid) return;

    if (uploadedPhotos.length === 0) {
        photoDropzone.classList.remove('hidden');
        photosGalleryContainer.classList.add('hidden');
        photosGalleryGrid.innerHTML = '';
        return;
    }

    photoDropzone.classList.add('hidden');
    photosGalleryContainer.classList.remove('hidden');
    photosGalleryGrid.innerHTML = '';

    uploadedPhotos.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'photo-thumb-card';
        card.innerHTML = `
            <div class="photo-thumb-img-wrapper">
                <img src="${item.previewUrl}" alt="写真 ${index + 1}">
            </div>
            <div class="photo-thumb-actions">
                <button type="button" class="btn-thumb-blur" data-index="${index}" title="この写真の個人情報をぼかす">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px; height:11px;">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    ぼかし
                </button>
                <button type="button" class="btn-thumb-delete" data-index="${index}" title="この写真を削除">✕</button>
            </div>
        `;

        const btnBlur = card.querySelector('.btn-thumb-blur');
        btnBlur.addEventListener('click', (e) => {
            e.stopPropagation();
            openBlurEditor(index);
        });

        const btnDel = card.querySelector('.btn-thumb-delete');
        btnDel.addEventListener('click', (e) => {
            e.stopPropagation();
            removePhotoAt(index);
        });

        photosGalleryGrid.appendChild(card);
    });
}

function removePhotoAt(index) {
    if (index >= 0 && index < uploadedPhotos.length) {
        const removed = uploadedPhotos.splice(index, 1)[0];
        if (removed.previewUrl && !removed.isExisting) {
            URL.revokeObjectURL(removed.previewUrl);
        }
        renderPhotosGallery();
    }
}

function removeAllPhotos() {
    uploadedPhotos.forEach(p => {
        if (p.previewUrl && !p.isExisting) {
            URL.revokeObjectURL(p.previewUrl);
        }
    });
    uploadedPhotos = [];
    renderPhotosGallery();
}

// 4. Jurisdiction resolving & Selection Modal
async function resolveJurisdiction() {
    if (!selectedLatLng) return;
    
    const targetType = document.querySelector('input[name="target_type"]:checked').value;
    
    try {
        const response = await fetch('/api/resolve-jurisdiction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: selectedLatLng.lat,
                longitude: selectedLatLng.lng,
                target_type: targetType,
                address: selectedAddress
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentClosestJurisdiction = data;
            jurisdictionCandidates = data.candidates || [];
            
            updateJurisdictionPreviewUI();
        }
    } catch (err) {
        console.error("Jurisdiction fetch failed:", err);
    }
}

function updateJurisdictionPreviewUI() {
    if (!currentClosestJurisdiction) return;
    
    const targetType = document.querySelector('input[name="target_type"]:checked').value;
    const badge = document.getElementById('j-badge');
    const name = document.getElementById('j-name');
    const address = document.getElementById('j-address');
    
    badge.textContent = targetType === 'police' ? '管轄警察署' : '自治体窓口';
    badge.style.background = targetType === 'police' ? 'rgba(16, 185, 129, 0.15)' : 'var(--primary-glow)';
    badge.style.color = targetType === 'police' ? 'var(--success)' : 'var(--primary)';
    badge.style.borderColor = targetType === 'police' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(14, 165, 233, 0.2)';
    
    name.textContent = currentClosestJurisdiction.name;
    address.textContent = currentClosestJurisdiction.address;
    
    // Populate step 4 target guide
    document.getElementById('guide-j-name').textContent = currentClosestJurisdiction.name;
    document.getElementById('guide-j-address').textContent = currentClosestJurisdiction.address;
    document.getElementById('guide-j-phone').textContent = currentClosestJurisdiction.phone || "N/A";
    
    const urlLink = document.getElementById('guide-j-url');
    if (currentClosestJurisdiction.online_url && currentClosestJurisdiction.online_url !== '#') {
        urlLink.href = currentClosestJurisdiction.online_url;
        document.getElementById('guide-url-wrapper').style.display = 'flex';
    } else {
        document.getElementById('guide-url-wrapper').style.display = 'none';
    }
}

function openJurisdictionModal() {
    if (!currentClosestJurisdiction) {
        currentClosestJurisdiction = {
            name: document.getElementById('j-name').textContent || '管轄窓口',
            address: document.getElementById('j-address').textContent || '',
            phone: ''
        };
    }
    
    // 現在の選択情報を手動入力フォームにセット
    manualJName.value = currentClosestJurisdiction.name || '';
    manualJAddress.value = currentClosestJurisdiction.address || '';
    manualJPhone.value = currentClosestJurisdiction.phone || '';
    
    // 候補リストを生成
    renderJurisdictionCandidates();
    
    modalJurisdiction.classList.remove('hidden');
    
    // 手動入力欄にフォーカスを当てやすいように少し遅延
    setTimeout(() => {
        if (manualJName) manualJName.focus();
    }, 100);
}

function closeJurisdictionModal() {
    modalJurisdiction.classList.add('hidden');
}

function renderJurisdictionCandidates() {
    jurisdictionCandidatesList.innerHTML = '';
    
    if (!jurisdictionCandidates || jurisdictionCandidates.length === 0) {
        jurisdictionCandidatesList.innerHTML = '<p style="font-size:12px; color:var(--text-secondary); padding: 8px 0;">候補が取得できませんでした。下の手動直接入力欄をご利用ください。</p>';
        return;
    }
    
    jurisdictionCandidates.forEach((cand, idx) => {
        const card = document.createElement('div');
        card.className = 'candidate-card';
        if (cand.name === manualJName.value) {
            card.classList.add('active');
        }
        
        const isRec = cand.is_inferred || idx === 0;
        const badgeText = isRec ? '★ 住所から自動判定' : (cand.type === 'police' ? '警察署' : '自治体');
        const badgeClass = isRec ? 'candidate-badge recommended' : 'candidate-badge';
        
        card.innerHTML = `
            <div class="candidate-card-top">
                <span class="candidate-title">${cand.name}</span>
                <span class="${badgeClass}">${badgeText}</span>
            </div>
            <div class="candidate-sub">
                <span>📍 ${cand.address || '住所情報なし'}</span>
                ${cand.phone ? `<span>📞 ${cand.phone}</span>` : ''}
            </div>
        `;
        
        // タッチおよびクリック両方に対応
        const selectHandler = (e) => {
            e.preventDefault();
            document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            manualJName.value = cand.name;
            manualJAddress.value = cand.address || '';
            manualJPhone.value = cand.phone || '';
        };
        card.addEventListener('click', selectHandler);
        
        jurisdictionCandidatesList.appendChild(card);
    });
}

function applyJurisdictionSelection() {
    const newName = manualJName.value.trim();
    if (!newName) {
        alert("宛先・窓口名を入力してください。");
        return;
    }
    
    const newAddress = manualJAddress.value.trim();
    const newPhone = manualJPhone.value.trim();
    
    if (!currentClosestJurisdiction) {
        currentClosestJurisdiction = {};
    }
    
    currentClosestJurisdiction.name = newName;
    currentClosestJurisdiction.address = newAddress;
    currentClosestJurisdiction.phone = newPhone;
    
    updateJurisdictionPreviewUI();
    closeJurisdictionModal();
}

// -------------------------------------------------------------------------
// 作成済み要望書一覧（リスト化） & 再確認・編集機能
// -------------------------------------------------------------------------
async function fetchSpotsCount() {
    try {
        const response = await fetch('/api/spots');
        if (response.ok) {
            const spots = await response.json();
            if (spotsCountBadge) {
                spotsCountBadge.textContent = spots.length || 0;
            }
        }
    } catch (e) {
        console.error("Failed to fetch spots count:", e);
    }
}

function formatJstDate(dateStr) {
    if (!dateStr) return '';
    try {
        const cleaned = dateStr.replace('T', ' ').replace('Z', '');
        const parts = cleaned.split(' ');
        const ymd = parts[0].split('-');
        const hm = parts[1] ? parts[1].substring(0, 5) : '';
        if (ymd.length === 3) {
            return `${ymd[0]}年${parseInt(ymd[1])}月${parseInt(ymd[2])}日 ${hm}`;
        }
    } catch (e) {}
    return dateStr.substring(0, 16);
}

async function openSpotsListModal() {
    modalSpotsList.classList.remove('hidden');
    spotsListContainer.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-secondary);"><div class="spinner" style="margin: 0 auto 10px;"></div>要望書一覧を読み込み中...</div>';
    
    try {
        const response = await fetch('/api/spots');
        if (!response.ok) throw new Error("一覧取得に失敗しました");
        const spots = await response.json();
        
        spotsListContainer.innerHTML = '';
        if (!spots || spots.length === 0) {
            spotsListContainer.innerHTML = '<div style="text-align:center; padding: 32px 16px; color: var(--text-secondary);">まだ作成された要望書がありません。<br>地図上で危険箇所を選択して要望書を作成してみましょう！</div>';
            return;
        }
        
        spots.forEach(spot => {
            const card = document.createElement('div');
            card.className = 'spot-item-card';
            
            const categoryNames = {
                'poor_visibility': '見通し不良',
                'heavy_traffic': '交通量過多',
                'speeding': 'スピード超過',
                'no_sidewalk': '歩道未整備',
                'no_light': '信号・横断歩道なし',
                'other': 'その他'
            };
            const catLabel = categoryNames[spot.danger_category] || spot.danger_category || '要望';
            const stars = '★'.repeat(spot.danger_level || 3);
            const dateStr = formatJstDate(spot.created_at);
            const office = spot.target_office_name || (spot.target_type === 'police' ? '管轄警察署' : '自治体窓口');

            card.innerHTML = `
                <div class="spot-item-header">
                    <span class="spot-item-title">📍 ${spot.address || '指定位置'}</span>
                    <span class="candidate-badge ${spot.target_type === 'police' ? 'recommended' : ''}">
                        ${spot.target_type === 'police' ? '警察署' : '自治体'}
                    </span>
                </div>
                <div class="spot-item-meta">
                    <span>🏢 ${office}</span>
                    <span>⚠️ ${catLabel}</span>
                    <span style="color: #f59e0b;">${stars}</span>
                    ${dateStr ? `<span>🕒 ${dateStr}</span>` : ''}
                </div>
                ${spot.description ? `<div class="spot-item-desc">${escapeHtml(spot.description)}</div>` : ''}
                <div class="spot-item-footer">
                    <button type="button" class="btn-spot-delete" data-id="${spot.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px; height:12px;">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        削除
                    </button>
                    <button type="button" class="btn-spot-edit" data-id="${spot.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px; height:12px;">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                        確認・編集する
                    </button>
                </div>
            `;
            
            const btnEdit = card.querySelector('.btn-spot-edit');
            btnEdit.addEventListener('click', (e) => {
                e.stopPropagation();
                loadSpotForEditing(spot.id);
            });

            const btnDelete = card.querySelector('.btn-spot-delete');
            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSpot(spot.id);
            });
            
            spotsListContainer.appendChild(card);
        });
    } catch (err) {
        console.error("Spots fetch error:", err);
        spotsListContainer.innerHTML = `<div style="color:var(--danger); padding:16px;">一覧の取得に失敗しました: ${err.message}</div>`;
    }
}

async function deleteSpot(spotId) {
    if (!confirm(`要望書 (#${spotId}) を削除してもよろしいですか？\n※削除したデータは元に戻せません。`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/spots/${spotId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error("削除リクエストに失敗しました");
        }
        
        // 編集中だった要望書が削除された場合は編集モードを解除
        if (editingSpotId === spotId) {
            cancelEditMode();
        }
        
        // 一覧・地図・バッジ件数を更新
        await openSpotsListModal();
        loadExistingSpots();
        fetchSpotsCount();
        
    } catch (err) {
        console.error("Delete spot error:", err);
        alert("削除中にエラーが発生しました: " + err.message);
    }
}

function closeSpotsListModal() {
    modalSpotsList.classList.add('hidden');
}

async function loadSpotForEditing(spotId) {
    try {
        const response = await fetch(`/api/spots/${spotId}`);
        if (!response.ok) throw new Error("要望書データの取得に失敗しました");
        const spot = await response.json();
        
        editingSpotId = spot.id;
        
        // 編集中バナーを表示
        if (editSpotIdSpan) editSpotIdSpan.textContent = spot.id;
        if (editBanner) editBanner.classList.remove('hidden');
        
        // 位置・住所の復元
        if (spot.latitude && spot.longitude) {
            selectedLatLng = L.latLng(spot.latitude, spot.longitude);
            if (marker) {
                marker.setLatLng(selectedLatLng);
            } else {
                marker = L.marker(selectedLatLng, { icon: redPinIcon, draggable: true }).addTo(map);
                marker.on('dragend', (e) => {
                    const pos = e.target.getLatLng();
                    updateSelectedLocation(pos.lat, pos.lng);
                });
            }
            map.setView(selectedLatLng, 16);
            coordinatesInfo.textContent = `緯度: ${spot.latitude.toFixed(6)} / 経度: ${spot.longitude.toFixed(6)}`;
        }
        
        selectedAddress = spot.address || '';
        displayAddress.value = selectedAddress;
        btnGotoStep2.disabled = false;
        
        // 状況入力（STEP 2）の復元
        if (spot.danger_category) {
            document.getElementById('danger_category').value = spot.danger_category;
        }
        if (spot.danger_level) {
            const starRadio = document.getElementById(`star${spot.danger_level}`);
            if (starRadio) starRadio.checked = true;
        }
        document.getElementById('description').value = spot.description || '';
        
        // 提出先種別の復元
        const radioTarget = document.querySelector(`input[name="target_type"][value="${spot.target_type || 'mayor'}"]`);
        if (radioTarget) radioTarget.checked = true;
        
        // 要望者連絡先（STEP 3）の復元
        if (spot.requester_name) document.getElementById('requester_name').value = spot.requester_name;
        if (spot.requester_phone) document.getElementById('requester_phone').value = spot.requester_phone;
        if (spot.requester_address) document.getElementById('requester_address').value = spot.requester_address;
        
        // 窓口情報の復元
        if (spot.target_office_name) {
            currentClosestJurisdiction = {
                name: spot.target_office_name,
                address: spot.address || '',
                phone: ''
            };
            updateJurisdictionPreviewUI();
        } else {
            resolveJurisdiction();
        }
        
        // 既存写真（複数可）の復元
        removeAllPhotos();
        if (spot.photo_path) {
            const paths = spot.photo_path.split(',').map(p => p.trim()).filter(Boolean);
            paths.forEach(p => {
                const filename = p.split(/[\\/]/).pop();
                uploadedPhotos.push({
                    id: Date.now() + Math.random().toString(36).substring(2, 7),
                    file: null,
                    previewUrl: `/uploads/${filename}`,
                    isExisting: true,
                    serverPath: p
                });
            });
            renderPhotosGallery();
        }
        
        // モーダルを閉じ、STEP 1に移動
        closeSpotsListModal();
        goToStep(1);
        
        alert(`要望書 #${spot.id} のデータを読み込みました。\n内容を確認・修正し、STEP 3でPDFを再生成してください。`);
        
    } catch (err) {
        console.error("Load spot for edit error:", err);
        alert(`データの読み込みに失敗しました: ${err.message}`);
    }
}

function cancelEditMode() {
    editingSpotId = null;
    if (editBanner) editBanner.classList.add('hidden');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// 5. PDF generation & view
async function generatePdfPreview() {
    if (!selectedLatLng || !currentClosestJurisdiction) return;
    
    // Show Loading
    pdfFrameWrapper.classList.remove('hidden');
    pdfLoadingOverlay.classList.remove('hidden');
    
    // Construct FormData to handle files and text fields
    const formData = new FormData();
    formData.append('latitude', selectedLatLng.lat);
    formData.append('longitude', selectedLatLng.lng);
    formData.append('address', selectedAddress);
    
    const targetType = document.querySelector('input[name="target_type"]:checked').value;
    let targetOfficeName = (currentClosestJurisdiction.name || '').trim();
    if (targetOfficeName.endsWith('御中') || targetOfficeName.endsWith('殿')) {
        // すでに敬称が付いている場合はそのまま
    } else if (targetType === 'police') {
        if (targetOfficeName.endsWith('署')) {
            targetOfficeName += '長 殿';
        } else {
            targetOfficeName += ' 御中';
        }
    } else {
        if (!targetOfficeName.includes('課') && !targetOfficeName.includes('係') && !targetOfficeName.includes('局') && !targetOfficeName.includes('所')) {
            targetOfficeName += ' 道路管理担当課 御中';
        } else {
            targetOfficeName += ' 御中';
        }
    }
    formData.append('target_office_name', targetOfficeName);
    
    formData.append('requester_name', document.getElementById('requester_name').value);
    formData.append('requester_address', document.getElementById('requester_address').value);
    formData.append('requester_phone', document.getElementById('requester_phone').value);
    
    formData.append('danger_category', document.getElementById('danger_category').value);
    formData.append('description', document.getElementById('description').value);
    
    // 複数写真の添付
    uploadedPhotos.forEach(p => {
        if (p.file) {
            formData.append('photos', p.file);
        } else if (p.serverPath) {
            formData.append('photo_paths', p.serverPath);
        }
    });
    
    try {
        const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const blob = await response.blob();
            
            // Revoke previous URL to release memory
            if (generatedPdfBlobUrl) {
                URL.revokeObjectURL(generatedPdfBlobUrl);
            }
            
            generatedPdfBlobUrl = URL.createObjectURL(blob);
            
            // Render in IFrame
            pdfPreviewIframe.src = generatedPdfBlobUrl;
            
            // Hide Loading Overlay on iframe load
            pdfPreviewIframe.onload = () => {
                pdfLoadingOverlay.classList.add('hidden');
            };
        } else {
            let errorMsg = "サーバーエラーが発生しました";
            try {
                const errData = await response.json();
                if (errData && errData.error) errorMsg = errData.error;
            } catch (e) {}
            throw new Error(errorMsg);
        }
    } catch (err) {
        console.error("PDF preview generation error:", err);
        alert(`要望書PDFのプレビュー作成に失敗しました。\n詳細: ${err.message || '入力内容を確認の上、再試行してください。'}`);
        pdfLoadingOverlay.classList.add('hidden');
    }
}

// 6. DB Submission and completion
async function saveSpotAndFinalize() {
    if (!selectedLatLng) return;
    
    // First make sure we have generated the PDF (or generate it silently)
    if (!generatedPdfBlobUrl) {
        // Generate it first
        await generatePdfPreview();
    }
    
    // Save to Database
    const formData = new FormData();
    formData.append('latitude', selectedLatLng.lat);
    formData.append('longitude', selectedLatLng.lng);
    formData.append('address', selectedAddress);
    formData.append('target_type', document.querySelector('input[name="target_type"]:checked').value);
    formData.append('danger_category', document.getElementById('danger_category').value);
    
    // Get danger rating
    const ratingEl = document.querySelector('input[name="danger_level"]:checked');
    formData.append('danger_level', ratingEl ? ratingEl.value : 3);
    
    formData.append('description', document.getElementById('description').value);
    formData.append('requester_name', document.getElementById('requester_name').value);
    formData.append('requester_address', document.getElementById('requester_address').value);
    formData.append('requester_phone', document.getElementById('requester_phone').value);
    
    // 宛先窓口名を含める
    if (currentClosestJurisdiction && currentClosestJurisdiction.name) {
        formData.append('target_office_name', currentClosestJurisdiction.name);
    }
    
    // 複数写真の送信
    uploadedPhotos.forEach(p => {
        if (p.file) {
            formData.append('photos', p.file);
        } else if (p.serverPath) {
            formData.append('photo_paths', p.serverPath);
        }
    });
    
    try {
        const endpoint = editingSpotId ? `/api/spots/${editingSpotId}` : '/api/spots';
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            // Reload spots on map and count badge
            loadExistingSpots();
            fetchSpotsCount();
            cancelEditMode();
            // Proceed to success step
            goToStep(4);
        } else {
            throw new Error("Save spot request failed");
        }
    } catch (err) {
        console.error("Save spot error:", err);
        // Fallback: Proceed to success anyway so the user can download the PDF
        goToStep(4);
    }
}

// Reset Form State
function resetForm() {
    // Reset inputs
    document.getElementById('danger_category').value = '';
    document.getElementById('description').value = '';
    document.getElementById('star3').checked = true;
    removeAllPhotos();
    
    // Clear pdf iframe
    pdfPreviewIframe.src = '';
    pdfFrameWrapper.classList.add('hidden');
    
    if (generatedPdfBlobUrl) {
        URL.revokeObjectURL(generatedPdfBlobUrl);
        generatedPdfBlobUrl = null;
    }
    
    // Reset Map Pin
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
    selectedLatLng = null;
    selectedAddress = "";
    btnGotoStep2.disabled = true;
    coordinatesInfo.textContent = "緯度経度: 地図上をクリックして指定してください";
    displayAddress.value = "";
}

// ==========================================
// 7. Webcam & Blur Editor Added Features (追加機能：カメラ撮影・ぼかし編集)
// ==========================================

/**
 * インラインWebカメラを起動する関数
 * メディアデバイスからカメラストリーム(video)を要求して映像を開始します。
 */
async function openWebcam() {
    modalWebcam.classList.remove('hidden');
    
    // カメラ設定（facingModeによりフロント/リアを制御。音声は不要）
    const constraints = {
        video: { facingMode: currentFacingMode },
        audio: false
    };
    
    try {
        // カメラデバイスストリームの取得
        webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        webcamVideo.srcObject = webcamStream;
    } catch (err) {
        console.error("Camera access failed:", err);
        alert("カメラへのアクセスに失敗しました。カメラパーミッション（権限設定）を確認するか、標準ファイルアップロードを使用してください。");
        closeWebcam();
    }
}

/**
 * Webカメラのストリームを停止しモーダルを閉じる関数
 */
function closeWebcam() {
    if (webcamStream) {
        // すべての映像トラックを停止
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    webcamVideo.srcObject = null;
    modalWebcam.classList.add('hidden');
}

/**
 * インラインWebカメラの前面・背面を切り替える関数 (スマホ向け)
 */
async function switchWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
    }
    
    // カメラの向きフラグをトグル (user:フロント, environment:リア)
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    
    const constraints = {
        video: { facingMode: currentFacingMode },
        audio: false
    };
    
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        webcamVideo.srcObject = webcamStream;
    } catch (err) {
        console.error("Camera switch failed:", err);
    }
}

/**
 * 現在のカメラプレビューフレームを静止画キャプチャする関数
 * ビデオ要素からCanvasへ描き写し、Blob(画像ファイル)に変換します。
 */
/**
 * 現在のカメラプレビューフレームを静止画キャプチャする関数
 * ビデオ要素からCanvasへ描き写し、Blob(画像ファイル)に変換して写真ギャラリーに追加します。
 */
function captureWebcamPhoto() {
    if (!webcamVideo.videoWidth) return;
    
    const canvas = webcamCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = webcamVideo.videoWidth;
    canvas.height = webcamVideo.videoHeight;
    
    // ビデオの現在のコマを一時的なCanvasに描画
    ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);
    
    // CanvasをJPEG Blobに変換してファイルオブジェクト化
    canvas.toBlob((blob) => {
        const file = new File([blob], `captured_${Date.now()}.jpg`, { type: "image/jpeg" });
        handlePhotosSelect([file]); // 写真ギャラリーへ追加
        closeWebcam();
    }, 'image/jpeg', 0.9);
}

/**
 * ぼかし編集モーダルを開き、選択された写真をCanvas上に準備する関数
 */
/**
 * ぼかし編集モーダルを開き、選択された写真をCanvas上に準備する関数
 */
function openBlurEditor(photoIndex) {
    if (photoIndex === undefined || photoIndex < 0 || photoIndex >= uploadedPhotos.length) return;
    
    currentBlurPhotoIndex = photoIndex;
    const photoItem = uploadedPhotos[photoIndex];
    if (!photoItem || !photoItem.previewUrl) return;

    modalBlur.classList.remove('hidden');
    
    const img = new Image();
    // 外部ドメインや別オリジン画像のCORS対策
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
        // パフォーマンスおよび操作性の観点から、内部キャンバスの実ピクセル最大寸法を1200pxに設定
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
            if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
            } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
            }
        }
        
        // 編集用キャンバスの実ピクセルサイズを設定
        editorCanvas.width = w;
        editorCanvas.height = h;
        editorCanvasOriginalWidth = w;
        editorCanvasOriginalHeight = h;
        
        editorCtx = editorCanvas.getContext('2d');
        // オリジナル画像を描画
        editorCtx.drawImage(img, 0, 0, w, h);
        
        // リセット用にオリジナル画像を保持
        editorOriginalImage = img;
        
        // 【非表示キャンバスの作成】: あらかじめ全体にぼかしを施した画像を作成
        editorBlurredCanvas = document.createElement('canvas');
        editorBlurredCanvas.width = w;
        editorBlurredCanvas.height = h;
        const bCtx = editorBlurredCanvas.getContext('2d');
        bCtx.filter = 'blur(16px)'; // ガウスぼかし
        bCtx.drawImage(img, 0, 0, w, h);

        // 表示コンテナの寸法に合わせて、画面にフィットする100%基準表示サイズ（Base Size）を計算
        setTimeout(() => {
            const containerW = editorCanvasContainer ? (editorCanvasContainer.clientWidth || 360) : 360;
            const containerH = editorCanvasContainer ? (editorCanvasContainer.clientHeight || 320) : 320;
            const availW = Math.max(containerW - 36, 260);
            const availH = Math.max(containerH - 36, 220);
            
            let baseW = availW;
            let baseH = Math.round(availW * (h / w));
            if (baseH > availH) {
                baseH = availH;
                baseW = Math.round(availH * (w / h));
            }
            
            baseDisplayWidth = baseW;
            baseDisplayHeight = baseH;

            // 初期ズームを100%等倍に初期化
            currentZoom = 1.0;
            updateCanvasZoomUI();
            if (editorCanvasContainer) {
                editorCanvasContainer.scrollTop = 0;
                editorCanvasContainer.scrollLeft = 0;
            }
        }, 50);
    };
    
    img.src = photoItem.previewUrl;
}

/**
 * ズーム率の増減
 */
function adjustZoom(delta) {
    setZoom(currentZoom + delta);
}

/**
 * ズームの等倍リセット
 */
function resetZoom() {
    setZoom(1.0);
    if (editorCanvasContainer) {
        editorCanvasContainer.scrollTop = 0;
        editorCanvasContainer.scrollLeft = 0;
    }
}

/**
 * ズーム倍率を設定し、Canvas表示サイズとUI表示を更新
 */
function setZoom(val) {
    // 1.0倍(100%)〜3.0倍(300%)の範囲に制限
    currentZoom = Math.min(Math.max(val, 1.0), 3.0);
    currentZoom = Math.round(currentZoom * 100) / 100;
    updateCanvasZoomUI();
}

function updateCanvasZoomUI() {
    const pct = Math.round(currentZoom * 100);
    if (zoomLevelText) {
        zoomLevelText.textContent = `${pct}%`;
    }
    if (zoomRange) {
        zoomRange.value = pct;
    }
    if (editorCanvas && baseDisplayWidth > 0) {
        const targetW = Math.round(baseDisplayWidth * currentZoom);
        const targetH = Math.round(baseDisplayHeight * currentZoom);
        editorCanvas.style.width = `${targetW}px`;
        editorCanvas.style.height = `${targetH}px`;
        editorCanvas.style.minWidth = `${targetW}px`;
        editorCanvas.style.minHeight = `${targetH}px`;
        editorCanvas.style.maxWidth = 'none';
        editorCanvas.style.maxHeight = 'none';
    }
}

/**
 * ぼかし編集を破棄して閉じる関数
 */
function closeBlurEditor() {
    modalBlur.classList.add('hidden');
    editorCtx = null;
    editorOriginalImage = null;
    editorBlurredCanvas = null;
    currentBlurPhotoIndex = null;
    currentZoom = 1.0;
}

/**
 * ぼかし編集をリセットし、オリジナル画像でキャンバスを塗り直す関数
 */
function resetBlurCanvas() {
    if (!editorOriginalImage || !editorCtx) return;
    
    const w = editorCanvas.width;
    const h = editorCanvas.height;
    
    editorCtx.clearRect(0, 0, w, h);
    editorCtx.drawImage(editorOriginalImage, 0, 0, w, h);
}

/**
 * ぼかしたCanvasの内容をBlob(JPEG)としてエクスポートし、対象写真カードを更新する関数
 */
function saveBlurCanvas() {
    if (!editorCtx || currentBlurPhotoIndex === null) return;
    
    editorCanvas.toBlob((blob) => {
        const file = new File([blob], `blurred_${Date.now()}.jpg`, { type: "image/jpeg" });
        const newPreviewUrl = URL.createObjectURL(file);
        
        if (currentBlurPhotoIndex >= 0 && currentBlurPhotoIndex < uploadedPhotos.length) {
            const item = uploadedPhotos[currentBlurPhotoIndex];
            if (item.previewUrl && !item.isExisting) {
                URL.revokeObjectURL(item.previewUrl);
            }
            item.file = file;
            item.previewUrl = newPreviewUrl;
            item.isExisting = false; // 編集されたため新規ファイルとして扱う
            renderPhotosGallery();
        }
        
        closeBlurEditor();
    }, 'image/jpeg', 0.92);
}

/**
 * Canvas描画関連のイベントリスナー（マウスおよびタッチ）の初期化を行う関数
 */
function setupEditorCanvasDrawing() {
    /**
     * イベント(e)が発生した座標から、Canvas上での実描画ピクセル座標を算出するヘルパー関数
     * ※レスポンシブおよびズーム（拡大表示）時でも、正しい描画座標を維持します。
     */
    const getCoordinates = (e) => {
        const rect = editorCanvas.getBoundingClientRect();
        const scaleX = editorCanvas.width / rect.width;   // CSSサイズと実ピクセルサイズの比率X
        const scaleY = editorCanvas.height / rect.height; // CSSサイズと実ピクセルサイズの比率Y
        
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            // スマートフォンのタッチ座標
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            // PCのマウス座標
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };
    
    /**
     * マウスや指でなぞった位置に、事前に作成した「ぼかし済画像」を部分的にクリップして上書き描画する関数
     */
    const drawBlur = (e) => {
        if (!isDrawingOnEditor || !editorCtx || !editorBlurredCanvas) return;
        
        const coords = getCoordinates(e);
        const radius = parseInt(brushSize.value) / 2; // ブラシの半径
        
        // 円形のパスを作成し、その中身だけをぼかし画像で置き換える (クリッピング描画)
        editorCtx.save();
        editorCtx.beginPath();
        editorCtx.arc(coords.x, coords.y, radius, 0, Math.PI * 2);
        editorCtx.clip();
        editorCtx.drawImage(editorBlurredCanvas, 0, 0); // ぼかし済画像を全体に重ね描き（円内のみマスク適用）
        editorCtx.restore();
    };
    
    // PC向け マウスイベントリスナー
    editorCanvas.addEventListener('mousedown', (e) => {
        isDrawingOnEditor = true;
        drawBlur(e);
    });
    
    editorCanvas.addEventListener('mousemove', (e) => {
        if (isDrawingOnEditor) {
            drawBlur(e);
        }
    });
    
    window.addEventListener('mouseup', () => {
        isDrawingOnEditor = false;
    });
    
    // スマホ向け タッチイベントリスナー
    editorCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            e.preventDefault(); // なぞり描画中に画面全体がスクロールするのを防止
            isDrawingOnEditor = true;
            drawBlur(e);
        }
    }, { passive: false });
    
    editorCanvas.addEventListener('touchmove', (e) => {
        if (isDrawingOnEditor && e.touches.length === 1) {
            e.preventDefault(); // なぞり描画中に画面全体がスクロールするのを防止
            drawBlur(e);
        }
    }, { passive: false });
    
    window.addEventListener('touchend', () => {
        isDrawingOnEditor = false;
    });
}
