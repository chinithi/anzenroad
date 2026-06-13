// AnzenRoad Frontend Controller

let map;
let marker;
let selectedLatLng = null;
let selectedAddress = "";
let uploadedPhotoFile = null;
let generatedPdfBlobUrl = null;
let currentClosestJurisdiction = null;
let existingSpots = [];

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

const photoDropzone = document.getElementById('photo-dropzone');
const photoInput = document.getElementById('photo-input');
const dropzonePrompt = document.getElementById('dropzone-prompt');
const dropzonePreview = document.getElementById('dropzone-preview');
const previewImg = document.getElementById('preview-img');
const btnRemovePhoto = document.getElementById('btn-remove-photo');
const btnTriggerCamera = document.getElementById('btn-trigger-camera');
const btnTriggerBlur = document.getElementById('btn-trigger-blur');

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
const brushSize = document.getElementById('brush-size');
const brushSizeVal = document.getElementById('brush-size-val');

// Global state for camera/editor
let webcamStream = null;
let currentFacingMode = 'environment'; // default to rear camera
let editorOriginalImage = null;
let editorBlurredCanvas = null;
let editorCtx = null;
let isDrawingOnEditor = false;

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

    // Dropzone Photo Upload
    photoDropzone.addEventListener('click', () => photoInput.click());
    
    photoInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handlePhotoSelect(e.target.files[0]);
        }
    });

    // Drag and drop event handlers
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
        if (files.length > 0) {
            handlePhotoSelect(files[0]);
        }
    });

    btnRemovePhoto.addEventListener('click', (e) => {
        e.stopPropagation(); // Avoid triggering dropzone click
        removePhoto();
    });

    // Webcam Events
    btnTriggerCamera.addEventListener('click', openWebcam);
    btnCloseWebcam.addEventListener('click', closeWebcam);
    btnCaptureWebcam.addEventListener('click', captureWebcamPhoto);
    btnSwitchCamera.addEventListener('click', switchWebcam);

    // Blur Editor Events
    btnTriggerBlur.addEventListener('click', openBlurEditor);
    btnCloseBlur.addEventListener('click', closeBlurEditor);
    btnResetBlur.addEventListener('click', resetBlurCanvas);
    btnSaveBlur.addEventListener('click', saveBlurCanvas);
    brushSize.addEventListener('input', (e) => {
        brushSizeVal.textContent = e.target.value;
    });

    // Canvas drawing setup
    setupEditorCanvasDrawing();

    // PDF Preview Trigger
    btnPreviewPdf.addEventListener('click', generatePdfPreview);
    
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
}

// 3. Photo Handling
function handlePhotoSelect(file) {
    if (!file.type.startsWith('image/')) {
        alert('画像ファイルのみ添付可能です。');
        return;
    }
    
    uploadedPhotoFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        dropzonePrompt.classList.add('hidden');
        dropzonePreview.classList.remove('hidden');
        btnTriggerBlur.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    uploadedPhotoFile = null;
    photoInput.value = '';
    previewImg.src = '';
    dropzonePrompt.classList.remove('hidden');
    dropzonePreview.classList.add('hidden');
    btnTriggerBlur.classList.add('hidden');
}

// 4. Jurisdiction resolving
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
                target_type: targetType
            })
        });
        
        if (response.ok) {
            currentClosestJurisdiction = await response.json();
            
            // Update UI preview box
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
    } catch (err) {
        console.error("Jurisdiction fetch failed:", err);
    }
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
    const suffix = targetType === 'police' ? '長 殿' : ' 道路整備担当課 御中';
    formData.append('target_office_name', `${currentClosestJurisdiction.name}${suffix}`);
    
    formData.append('requester_name', document.getElementById('requester_name').value);
    formData.append('requester_address', document.getElementById('requester_address').value);
    formData.append('requester_phone', document.getElementById('requester_phone').value);
    
    formData.append('danger_category', document.getElementById('danger_category').value);
    formData.append('description', document.getElementById('description').value);
    
    if (uploadedPhotoFile) {
        formData.append('photo', uploadedPhotoFile);
    }
    
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
            throw new Error("Failed to generate PDF");
        }
    } catch (err) {
        console.error("PDF preview generation error:", err);
        alert("要望書PDFのプレビュー作成に失敗しました。入力内容を確認の上、再試行してください。");
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
    
    if (uploadedPhotoFile) {
        formData.append('photo', uploadedPhotoFile);
    }
    
    try {
        const response = await fetch('/api/spots', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            // Reload spots on map
            loadExistingSpots();
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
    removePhoto();
    
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
        const file = new File([blob], "captured_photo.jpg", { type: "image/jpeg" });
        handlePhotoSelect(file); // メインの写真プレビュー領域へ受け渡し
        closeWebcam();
    }, 'image/jpeg', 0.9);
}

/**
 * ぼかし編集モーダルを開き、編集対象の画像をCanvas上に準備する関数
 */
function openBlurEditor() {
    if (!uploadedPhotoFile) return;
    
    modalBlur.classList.remove('hidden');
    
    const img = new Image();
    const objectUrl = URL.createObjectURL(uploadedPhotoFile);
    
    img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        
        // パフォーマンスおよび操作性の観点から、エディタ上での最大寸法を800pxに制限（縮小）
        const maxDim = 800;
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
        
        // 編集用キャンバスのサイズを設定
        editorCanvas.width = w;
        editorCanvas.height = h;
        
        editorCtx = editorCanvas.getContext('2d');
        // オリジナル画像を描画
        editorCtx.drawImage(img, 0, 0, w, h);
        
        // リセット用にオリジナル画像を保持
        editorOriginalImage = img;
        
        // 【非表示キャンバスの作成】: あらかじめ全体にぼかしを施した画像を作成しておきます。
        editorBlurredCanvas = document.createElement('canvas');
        editorBlurredCanvas.width = w;
        editorBlurredCanvas.height = h;
        const bCtx = editorBlurredCanvas.getContext('2d');
        bCtx.filter = 'blur(15px)'; // CSS Filterで15pxのガウスぼかしを適用
        bCtx.drawImage(img, 0, 0, w, h);
    };
    
    img.src = objectUrl;
}

/**
 * ぼかし編集を破棄して閉じる関数
 */
function closeBlurEditor() {
    modalBlur.classList.add('hidden');
    editorCtx = null;
    editorOriginalImage = null;
    editorBlurredCanvas = null;
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
 * ぼかしたCanvasの内容をBlob(JPEG)としてエクスポートし、アップロード用ファイルとして確定する関数
 */
function saveBlurCanvas() {
    if (!editorCtx) return;
    
    editorCanvas.toBlob((blob) => {
        const file = new File([blob], "edited_photo.jpg", { type: "image/jpeg" });
        
        // 編集後ファイル(ぼかし画像)でuploadedPhotoFileを更新し、プレビューにも反映
        uploadedPhotoFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
        
        closeBlurEditor();
    }, 'image/jpeg', 0.9);
}

/**
 * Canvas描画関連のイベントリスナー（マウスおよびタッチ）の初期化を行う関数
 */
function setupEditorCanvasDrawing() {
    /**
     * イベント(e)が発生した座標から、Canvas上での実描画ピクセル座標を算出するヘルパー関数
     * ※レスポンシブでCanvasが表示縮小されていても、正しい描画座標を維持するためのスケーリング計算を含みます。
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
    
    editorCanvas.addEventListener('mousemove', drawBlur);
    
    window.addEventListener('mouseup', () => {
        isDrawingOnEditor = false;
    });
    
    // スマホ向け タッチイベントリスナー
    editorCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // なぞった際にスマホ画面全体がスクロールしてしまうのを防止
        isDrawingOnEditor = true;
        drawBlur(e);
    }, { passive: false });
    
    editorCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); // なぞった際にスマホ画面全体がスクロールしてしまうのを防止
        drawBlur(e);
    }, { passive: false });
    
    window.addEventListener('touchend', () => {
        isDrawingOnEditor = false;
    });
}
