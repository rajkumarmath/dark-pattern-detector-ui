// API Configuration - Updated for Netlify
const API_BASE = window.location.hostname === 'localhost' 
    ? '/api'  // Local development
    : '/.netlify/functions/proxy';  // Netlify production

console.log('🌐 Using API endpoint:', API_BASE);

// State
let currentInputType = 'text';
let selectedFile = null;
let isAnalyzing = false;

// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingState = document.getElementById('loadingState');
const initialState = document.getElementById('initialState');
const resultsDisplay = document.getElementById('resultsDisplay');
const toastContainer = document.getElementById('toastContainer');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAPIHealth();
    initializeEventListeners();
    startBackgroundAnimation();
});

// Event Listeners
function initializeEventListeners() {
    // Input type buttons
    document.querySelectorAll('.input-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.input-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentInputType = btn.dataset.type;
            document.querySelectorAll('.input-panel').forEach(panel => panel.classList.add('hidden'));
            document.getElementById(`${currentInputType}Panel`).classList.remove('hidden');
        });
    });

    // Analyze button
    analyzeBtn.addEventListener('click', analyze);

    // Clear text
    document.getElementById('clearText').addEventListener('click', () => {
        document.getElementById('textInput').value = '';
        updateCharCount();
    });

    // Text input counting
    document.getElementById('textInput').addEventListener('input', updateCharCount);

    // File upload
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    if (uploadArea) {
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleFileSelect(file);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    // Example buttons
    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const example = btn.dataset.example;
            loadExample(example);
        });
    });
}

// API Health Check
async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        
        if (data.frontend?.status === 'healthy' || data.status === 'healthy') {
            statusBadge.className = 'status-badge connected';
            statusText.textContent = 'API Connected';
            showToast('API connected successfully', 'success');
            console.log('✅ Backend connected:', data);
        } else {
            throw new Error('API unhealthy');
        }
    } catch (error) {
        console.error('Health check failed:', error);
        statusBadge.className = 'status-badge disconnected';
        statusText.textContent = 'API Disconnected';
        showToast(`API connection failed: ${error.message}`, 'error');
    }
}

// Analysis Function
async function analyze() {
    if (isAnalyzing) return;
    
    // Show loading
    isAnalyzing = true;
    analyzeBtn.disabled = true;
    loadingState.classList.remove('hidden');
    initialState.classList.add('hidden');
    resultsDisplay.classList.add('hidden');
    
    try {
        // Handle different input types
        if (currentInputType === 'text') {
            const text = document.getElementById('textInput').value.trim();
            if (!text) {
                showToast('Please enter text to analyze', 'error');
                resetLoadingState();
                return;
            }
            
            const response = await fetch(`${API_BASE}/detect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.detail || 'Analysis failed');
            }

            displayResults(data);
            showToast('Analysis complete!', 'success');
            
        } else if (currentInputType === 'url') {
            const url = document.getElementById('urlInput').value.trim();
            if (!url) {
                showToast('Please enter a URL', 'error');
                resetLoadingState();
                return;
            }
            
            const response = await fetch(`${API_BASE}/detect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.detail || 'Analysis failed');
            }

            displayResults(data);
            showToast('Analysis complete!', 'success');
            
        } else if (currentInputType === 'screenshot') {
            if (!selectedFile) {
                showToast('Please select a screenshot', 'error');
                resetLoadingState();
                return;
            }

            // Create FormData for file upload
            const formData = new FormData();
            formData.append('file', selectedFile);

            // Make the API call to screenshot endpoint
            const response = await fetch(`${API_BASE}/detect/screenshot`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.detail || 'Analysis failed');
            }

            // Display screenshot results
            displayScreenshotResults(data);
            showToast('Screenshot analysis complete!', 'success');
        }
        
    } catch (error) {
        console.error('Analysis error:', error);
        showToast(error.message, 'error');
        initialState.classList.remove('hidden');
        resultsDisplay.classList.add('hidden');
    } finally {
        resetLoadingState();
    }
}

// Helper to reset loading state
function resetLoadingState() {
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    loadingState.classList.add('hidden');
}

// Display Results for Text/URL
function displayResults(data) {
    resultsDisplay.classList.remove('hidden');
    initialState.classList.add('hidden');

    // Pattern badge
    const patternBadge = document.getElementById('patternBadge');
    if (patternBadge) {
        patternBadge.className = `pattern-badge ${data.risk_score?.level || 'none'}`;
        patternBadge.textContent = (data.pattern_name || 'none').replace(/_/g, ' ').toUpperCase();
    }

    // Confidence
    const confidenceEl = document.getElementById('confidence');
    if (confidenceEl) {
        confidenceEl.textContent = `${Math.round((data.confidence || 0.85) * 100)}%`;
    }

    // Risk score
    const riskScoreEl = document.getElementById('riskScore');
    const riskLevelEl = document.getElementById('riskLevel');
    const riskBarEl = document.getElementById('riskBar');
    
    if (riskScoreEl) riskScoreEl.textContent = data.risk_score?.score || 0;
    if (riskLevelEl) riskLevelEl.textContent = (data.risk_score?.level || 'none').toUpperCase();
    if (riskBarEl) riskBarEl.style.width = `${data.risk_score?.score || 0}%`;
    
    // Risk breakdown
    const baseScoreEl = document.getElementById('baseScore');
    const intensityEl = document.getElementById('intensity');
    const contextEl = document.getElementById('context');
    
    if (baseScoreEl) baseScoreEl.textContent = data.risk_score?.breakdown?.base || 0;
    if (intensityEl) intensityEl.textContent = `${data.risk_score?.breakdown?.intensity_multiplier || 1}x`;
    if (contextEl) contextEl.textContent = `${data.risk_score?.breakdown?.context_multiplier || 1}x`;

    // Explanation
    const explanationEl = document.getElementById('explanation');
    if (explanationEl) {
        explanationEl.textContent = (data.explanation || '')
            .replace(/\*\*/g, '')
            .replace(/⚠️/g, '')
            .trim();
    }

    // Manipulative phrases
    const phrasesContainer = document.getElementById('manipulativePhrases');
    if (phrasesContainer) {
        phrasesContainer.innerHTML = '';
        const phrases = data.explanation?.match(/\*\*Key manipulative phrases:\*\* (.*)/);
        if (phrases && phrases[1]) {
            phrases[1].split(',').forEach(phrase => {
                const badge = document.createElement('span');
                badge.className = 'px-2 py-1 bg-dark-800 rounded-full text-xs text-primary-400';
                badge.textContent = phrase.trim();
                phrasesContainer.appendChild(badge);
            });
        }
    }

    // Ethical suggestion
    const suggestionTitleEl = document.getElementById('suggestionTitle');
    const suggestionDescEl = document.getElementById('suggestionDescription');
    
    if (suggestionTitleEl) {
        suggestionTitleEl.textContent = data.ethical_recommendation?.title || '';
    }
    if (suggestionDescEl) {
        suggestionDescEl.textContent = data.ethical_recommendation?.description || '';
    }

    // Alternatives
    const alternativesEl = document.getElementById('alternatives');
    if (alternativesEl) {
        alternativesEl.innerHTML = '';
        if (data.ethical_recommendation?.alternatives) {
            data.ethical_recommendation.alternatives.forEach(alt => {
                const div = document.createElement('div');
                div.className = 'flex items-start gap-2 text-sm';
                div.innerHTML = `
                    <span class="text-success">✓</span>
                    <span class="text-gray-300">${alt}</span>
                `;
                alternativesEl.appendChild(div);
            });
        }
    }

    // Code example
    const codeExampleEl = document.getElementById('codeExample');
    if (codeExampleEl) {
        codeExampleEl.textContent = data.ethical_recommendation?.example || '// No code example available';
    }
}

// Display Screenshot Results
function displayScreenshotResults(data) {
    resultsDisplay.classList.remove('hidden');
    initialState.classList.add('hidden');
    
    // Clear previous results
    const explanationEl = document.getElementById('explanation');
    const suggestionTitleEl = document.getElementById('suggestionTitle');
    const suggestionDescEl = document.getElementById('suggestionDescription');
    const alternativesEl = document.getElementById('alternatives');
    const codeExampleEl = document.getElementById('codeExample');
    const phrasesContainer = document.getElementById('manipulativePhrases');
    
    if (explanationEl) explanationEl.innerHTML = '';
    if (suggestionTitleEl) suggestionTitleEl.innerHTML = '';
    if (suggestionDescEl) suggestionDescEl.innerHTML = '';
    if (alternativesEl) alternativesEl.innerHTML = '';
    if (codeExampleEl) codeExampleEl.innerHTML = '';
    if (phrasesContainer) phrasesContainer.innerHTML = '';
    
    // Display overall risk
    const patternBadge = document.getElementById('patternBadge');
    if (patternBadge) {
        patternBadge.className = `pattern-badge ${data.overall_risk || 'medium'}`;
        patternBadge.textContent = `VISUAL ANALYSIS: ${(data.overall_risk || 'UNKNOWN').toUpperCase()}`;
    }
    
    // Set confidence
    const confidenceEl = document.getElementById('confidence');
    if (confidenceEl) confidenceEl.textContent = '100%';
    
    // Set risk score based on overall risk
    let riskScore = 0;
    if (data.overall_risk === 'high') riskScore = 85;
    else if (data.overall_risk === 'medium') riskScore = 55;
    else if (data.overall_risk === 'low') riskScore = 25;
    else riskScore = 0;
    
    const riskScoreEl = document.getElementById('riskScore');
    const riskLevelEl = document.getElementById('riskLevel');
    const riskBarEl = document.getElementById('riskBar');
    
    if (riskScoreEl) riskScoreEl.textContent = riskScore;
    if (riskLevelEl) riskLevelEl.textContent = (data.overall_risk || 'none').toUpperCase();
    if (riskBarEl) riskBarEl.style.width = `${riskScore}%`;
    
    // Build explanation HTML
    let explanationHTML = '<div class="space-y-4">';
    
    // Add extracted text if available
    if (data.visual_analysis?.text_extracted) {
        explanationHTML += `
            <div class="glass-effect rounded-xl p-4">
                <h4 class="font-semibold text-primary-400 mb-2">📝 Extracted Text</h4>
                <p class="text-gray-300 text-sm">${data.visual_analysis.text_extracted}</p>
            </div>
        `;
    }
    
    // Add detected visual patterns
    if (data.detected_patterns && data.detected_patterns.length > 0) {
        explanationHTML += '<div class="glass-effect rounded-xl p-4"><h4 class="font-semibold text-primary-400 mb-3">👁️ Detected Visual Patterns</h4>';
        
        data.detected_patterns.forEach(pattern => {
            explanationHTML += `
                <div class="mb-3 p-3 bg-dark-800 rounded-lg">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-primary-300">${pattern.name.replace(/_/g, ' ')}</span>
                        <span class="px-2 py-1 text-xs rounded-full bg-danger/20 text-danger">DETECTED</span>
                    </div>
                    <p class="text-sm text-gray-400">${pattern.description}</p>
            `;
            
            // Add details if available
            if (pattern.details?.analysis) {
                explanationHTML += '<div class="mt-2 text-xs text-gray-500">';
                for (const [key, value] of Object.entries(pattern.details.analysis)) {
                    explanationHTML += `<div>${key.replace(/_/g, ' ')}: ${value}</div>`;
                }
                explanationHTML += '</div>';
            }
            
            explanationHTML += '</div>';
        });
        
        explanationHTML += '</div>';
    }
    
    // Add text analysis if available
    if (data.text_analysis) {
        explanationHTML += `
            <div class="glass-effect rounded-xl p-4">
                <h4 class="font-semibold text-primary-400 mb-2">📄 Text Analysis</h4>
                <p class="text-gray-300">Pattern: ${data.text_analysis.pattern_name || 'none'}</p>
            </div>
        `;
    }
    
    explanationHTML += '</div>';
    
    if (explanationEl) explanationEl.innerHTML = explanationHTML;
    
    // Set ethical suggestion based on detected patterns
    if (data.detected_patterns && data.detected_patterns.length > 0) {
        const pattern = data.detected_patterns[0];
        if (suggestionTitleEl) suggestionTitleEl.innerHTML = `Fix: ${pattern.name.replace(/_/g, ' ')}`;
        
        if (pattern.name === 'misleading_contrast') {
            if (suggestionDescEl) {
                suggestionDescEl.innerHTML = 'Use equal visual weight for all options. Avoid using color to manipulate user choices.';
            }
            if (alternativesEl) {
                alternativesEl.innerHTML = `
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Use same font size for all buttons</div>
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Give equal prominence to all choices</div>
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Avoid grayed-out "decline" options</div>
                `;
            }
        } else if (pattern.name === 'tiny_buttons') {
            if (suggestionDescEl) {
                suggestionDescEl.innerHTML = 'Make all interactive elements easily clickable. Avoid tiny, hard-to-find buttons.';
            }
            if (alternativesEl) {
                alternativesEl.innerHTML = `
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Use minimum 44x44px touch targets</div>
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Place important buttons in prominent locations</div>
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Ensure sufficient contrast for all buttons</div>
                `;
            }
        } else if (pattern.name === 'hidden_elements') {
            if (suggestionDescEl) {
                suggestionDescEl.innerHTML = 'Make all options clearly visible. Avoid hiding important controls.';
            }
            if (alternativesEl) {
                alternativesEl.innerHTML = `
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Ensure sufficient contrast for all text</div>
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Don't hide unsubscribe/cancel options</div>
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Use standard UI patterns users expect</div>
                `;
            }
        } else if (pattern.name === 'pre_selected') {
            if (suggestionDescEl) {
                suggestionDescEl.innerHTML = 'Let users make active choices. Avoid pre-selecting options that benefit you.';
            }
            if (alternativesEl) {
                alternativesEl.innerHTML = `
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Use unchecked boxes by default</div>
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Make opt-in explicit</div>
                    <div class="flex items-start gap-2 text-sm"><span class="text-success">✓</span>Clearly label all options</div>
                `;
            }
        }
    } else {
        if (suggestionTitleEl) suggestionTitleEl.innerHTML = 'No Issues Detected';
        if (suggestionDescEl) suggestionDescEl.innerHTML = 'Your interface appears visually ethical.';
    }
}

// Utility Functions
function updateCharCount() {
    const text = document.getElementById('textInput').value;
    const charCountEl = document.getElementById('charCount');
    if (charCountEl) {
        charCountEl.textContent = `${text.length} characters`;
    }
}

function handleFileSelect(file) {
    selectedFile = file;
    const uploadArea = document.getElementById('uploadArea');
    const preview = document.getElementById('imagePreview');
    const img = document.getElementById('preview');
    const fileNameEl = document.getElementById('fileName');
    
    if (uploadArea) uploadArea.classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = (e) => {
        if (img) img.src = e.target.result;
        if (preview) preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    
    if (fileNameEl) {
        fileNameEl.textContent = `Selected: ${file.name}`;
        fileNameEl.classList.remove('hidden');
    }
    
    showToast(`Selected: ${file.name}`, 'info');
}

function loadExample(type) {
    const examples = {
        forced: "You must create an account to continue",
        shaming: "No thanks, I don't want to save money",
        costs: "Total: $49.99 plus processing fee"
    };
    
    const textInput = document.getElementById('textInput');
    if (textInput) {
        textInput.value = examples[type] || '';
        updateCharCount();
    }
    
    // Switch to text input
    const textBtn = document.querySelector('[data-type="text"]');
    if (textBtn) textBtn.click();
}

function showToast(message, type = 'info') {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `glass-card p-4 max-w-sm animate-slideIn ${
        type === 'error' ? 'border-l-4 border-danger' :
        type === 'success' ? 'border-l-4 border-success' :
        'border-l-4 border-primary'
    }`;
    
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="text-2xl">
                ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}
            </span>
            <p class="text-sm">${message}</p>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Background Animation
function startBackgroundAnimation() {
    const balls = document.querySelectorAll('.animate-float');
    balls.forEach((ball, index) => {
        ball.style.animationDelay = `${index * 2}s`;
    });
}
