let translations = {};
let currentLanguage = localStorage.getItem('language') || 'en';
let currentTheme = localStorage.getItem('theme') || 'dark';
let downloadHistory = JSON.parse(localStorage.getItem('downloadHistory')) || [];
let historyPollInterval = null;

// Modal functions - Create modal dynamically if it doesn't exist
function ensureModalExists() {
    if (!document.getElementById('alertModal')) {
        const modalHTML = `
            <div id="alertModal" class="modal hidden">
                <div class="modal-overlay" onclick="closeModal()"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Alert</h3>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p id="modalMessage"></p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-primary" onclick="closeModal()" data-i18n="accept">Accept</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
}

function showModal(title, message) {
    ensureModalExists();
    
    const modal = document.getElementById('alertModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    
    if (modalTitle) modalTitle.textContent = title;
    if (modalMessage) modalMessage.textContent = message;
    if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('alertModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Load translations
async function loadTranslations() {
    try {
        const response = await fetch('/static/translations.json');
        if (!response.ok) {
            console.warn('Failed to load translations (HTTP ' + response.status + '). Using fallback English.');
            loadDefaultTranslations();
            return;
        }
        translations = await response.json();
        setLanguage(currentLanguage);
    } catch (error) {
        console.error('Failed to load translations:', error);
        loadDefaultTranslations();
    }
}

// Fallback translations
function loadDefaultTranslations() {
    translations = {
        'en': {
            'title': 'Download Music',
            'error': 'Error',
            'accept': 'Accept',
            'downloadComplete': 'File saved automatically to your Downloads folder.',
            'noUrls': 'Please provide at least one URL.',
            'errorOccurred': 'An error occurred while processing the videos.'
        },
        'es': {
            'title': 'Descargar Música',
            'error': 'Error',
            'accept': 'Aceptar',
            'downloadComplete': 'Archivo guardado automáticamente en tu carpeta Descargas.',
            'noUrls': 'Por favor proporciona al menos una URL.',
            'errorOccurred': 'Ocurrió un error al procesar los videos.'
        }
    };
}

// Update UI text based on language
function updateUIText(lang) {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                el.placeholder = translations[lang][key];
            } else if (el.tagName === 'A') {
                el.textContent = translations[lang][key];
            } else {
                el.textContent = translations[lang][key];
            }
        }
    });
    // Refresh history display to show translated labels
    displayHistory();
}

// Set language
function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updateUIText(lang);
    
    // Update active button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('lang' + lang.toUpperCase()).classList.add('active');
}

// Set theme
function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('theme', theme);
    document.body.setAttribute('data-theme', theme);
    
    // Update active button
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('theme' + theme.charAt(0).toUpperCase() + theme.slice(1)).classList.add('active');
}

// Add to history
function addToHistory(title) {
    const now = new Date();
    const dateStr = now.toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'en-US');
    
    downloadHistory.unshift({
        title: title,
        date: dateStr,
        timestamp: now.getTime()
    });
    
    // Keep only last 20 downloads
    if (downloadHistory.length > 20) {
        downloadHistory.pop();
    }
    
    localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory));
    displayHistory();
}

// Display history
function displayHistory() {
    const historyList = document.getElementById('historyList');
    const noHistoryMsg = document.getElementById('noHistoryMsg');
    
    // Check if elements exist before accessing them
    if (!historyList || !noHistoryMsg) return;
    
    if (downloadHistory.length === 0) {
        historyList.innerHTML = '';
        noHistoryMsg.style.display = 'block';
        return;
    }
    
    noHistoryMsg.style.display = 'none';
    historyList.innerHTML = downloadHistory.map((item, index) => `
        <div class="history-item">
            <div class="history-item-info">
                <div class="history-item-title">${item.title}</div>
                <div class="history-item-date">${item.date}</div>
            </div>
            <button class="history-item-delete" onclick="deleteHistoryItem(${index})" title="Delete">✕</button>
        </div>
    `).join('');
}

// Sync history from server in real-time
function syncHistoryFromServer() {
    // Store current local history size
    const currentSize = downloadHistory.length;
    // This checks if new downloads happened (you can expand this with actual server sync if needed)
}

// Start real-time history polling
function startHistoryPolling() {
    if (historyPollInterval) clearInterval(historyPollInterval);
    
    historyPollInterval = setInterval(() => {
        syncHistoryFromServer();
    }, 2000); // Poll every 2 seconds
}

// Stop history polling
function stopHistoryPolling() {
    if (historyPollInterval) {
        clearInterval(historyPollInterval);
        historyPollInterval = null;
    }
}

// Delete history item
function deleteHistoryItem(index) {
    downloadHistory.splice(index, 1);
    localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory));
    displayHistory();
}

// Poll a background download job until it's done or errors out.
// Returns the final job object: { status: 'done', result: {...} }
// or { status: 'error', error: '...' }.
function pollJob(jobId, progressBar, progressPercent) {
    return new Promise((resolve, reject) => {
        const iv = setInterval(async () => {
            try {
                const res = await fetch(`/progress/${jobId}`);
                if (!res.ok) {
                    clearInterval(iv);
                    reject(new Error('Lost track of the download job.'));
                    return;
                }
                const job = await res.json();
                const pct = Math.max(0, Math.min(job.percent || 0, 100));
                progressBar.style.width = pct + '%';
                progressPercent.textContent = Math.round(pct) + '%';

                if (job.status === 'done' || job.status === 'error') {
                    clearInterval(iv);
                    resolve(job);
                }
            } catch (err) {
                clearInterval(iv);
                reject(err);
            }
        }, 700);
    });
}

// Very loose check, just to decide whether it's worth asking the server
// for formats — the server does the real validation.
function looksLikeYoutubeUrl(url) {
    return /(youtube\.com|youtu\.be|youtube-nocookie\.com)/.test(url);
}

let formatsAbortController = null;

async function maybeFetchFormats(urlInput, qualityGroup, qualitySelect) {
    const urls = urlInput.value.split('\n').map(u => u.trim()).filter(u => u.length > 0);

    // Quality picking only makes sense for a single URL — with several,
    // each video can offer a different set of format ids.
    if (urls.length !== 1 || !looksLikeYoutubeUrl(urls[0])) {
        qualityGroup.classList.add('hidden');
        qualitySelect.innerHTML = '';
        return;
    }

    if (formatsAbortController) formatsAbortController.abort();
    formatsAbortController = new AbortController();

    qualitySelect.disabled = true;
    qualitySelect.innerHTML = `<option value="">${translations[currentLanguage]['fetchingFormats'] || 'Loading...'}</option>`;
    qualityGroup.classList.remove('hidden');

    try {
        const res = await fetch('/formats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urls[0] }),
            signal: formatsAbortController.signal,
        });

        if (!res.ok) {
            qualityGroup.classList.add('hidden');
            return;
        }

        const data = await res.json();
        const availableFormats = data.formats || [];

        if (availableFormats.length === 0) {
            qualityGroup.classList.add('hidden');
            return;
        }

        const autoLabel = translations[currentLanguage]['autoQuality'] || 'Auto (best available)';
        qualitySelect.innerHTML =
            `<option value="">${autoLabel}</option>` +
            availableFormats.map(f => `<option value="${f.format_id}">${f.label}</option>`).join('');
        qualitySelect.disabled = false;
        qualityGroup.classList.remove('hidden');
    } catch (err) {
        if (err.name !== 'AbortError') {
            qualityGroup.classList.add('hidden');
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load translations and history
    await loadTranslations();
    displayHistory();
    
    // Set initial theme
    setTheme(currentTheme);
    
    // Theme buttons
    document.getElementById('themeDark').addEventListener('click', () => setTheme('dark'));
    document.getElementById('themeLight').addEventListener('click', () => setTheme('light'));
    
    // Language buttons
    document.getElementById('langEN').addEventListener('click', () => setLanguage('en'));
    document.getElementById('langES').addEventListener('click', () => setLanguage('es'));
    
    // Clear history button
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        showModal(
            translations[currentLanguage]['clearHistory'],
            translations[currentLanguage]['clearHistory'] + '?'
        );
        // Simple replace confirm with modal
        const oldCloseModal = closeModal;
        closeModal = function() {
            downloadHistory = [];
            localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory));
            displayHistory();
            document.getElementById('alertModal').classList.add('hidden');
            closeModal = oldCloseModal;
        };
    });
    
    // Start real-time history polling
    startHistoryPolling();
    
    const form = document.getElementById('downloadForm');
    const urlInput = document.getElementById('urlInput');
    const mp3Toggle = document.getElementById('mp3Toggle');
    const downloadBtn = document.getElementById('downloadBtn');
    const qualityGroup = document.getElementById('qualityGroup');
    const qualitySelect = document.getElementById('qualitySelect');

    const statusArea = document.getElementById('statusArea');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    
    const songTitle = document.getElementById('songTitle');
    const downloadLink = document.getElementById('downloadLink');
    const errorMessage = document.getElementById('errorMessage');

    // Debounced lookup of available qualities as the user types/pastes a URL.
    let formatsDebounce;
    urlInput.addEventListener('input', () => {
        clearTimeout(formatsDebounce);
        formatsDebounce = setTimeout(() => {
            maybeFetchFormats(urlInput, qualityGroup, qualitySelect);
        }, 700);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawText = urlInput.value;
        const urls = rawText.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        const convertToMp3 = mp3Toggle.checked;
        const formatId = (!qualityGroup.classList.contains('hidden') && qualitySelect.value)
            ? qualitySelect.value
            : null;
        
        if (urls.length === 0) {
            showModal(
                translations[currentLanguage]['error'],
                translations[currentLanguage]['noUrls']
            );
            return;
        }

        // Reset UI state
        errorArea.classList.add('hidden');
        resultArea.classList.add('hidden');
        statusArea.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        downloadBtn.disabled = true;
        downloadBtn.style.opacity = '0.7';

        try {
            // Step 1: kick off the download job. The server starts it in
            // the background and responds immediately with a job_id.
            const startResponse = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    urls: urls,
                    convert_to_mp3: convertToMp3,
                    format_id: formatId,
                })
            });

            const startData = await startResponse.json();

            if (!startResponse.ok) {
                throw new Error(startData.error || translations[currentLanguage]['errorOccurred']);
            }

            // Step 2: poll /progress/<job_id> until it finishes, updating
            // the real progress bar as yt-dlp reports it.
            const finalJob = await pollJob(startData.job_id, progressBar, progressPercent);

            if (finalJob.status === 'error') {
                throw new Error(finalJob.error || translations[currentLanguage]['errorOccurred']);
            }

            // Success
            setTimeout(() => {
                statusArea.classList.add('hidden');
                resultArea.classList.remove('hidden');
                
                songTitle.textContent = finalJob.result.title;
                document.getElementById('messageText').textContent = '✓ ' + translations[currentLanguage]['downloadComplete'];
                
                // Hide the download link since file is already saved
                downloadLink.style.display = 'none';
                
                // Add to history
                addToHistory(finalJob.result.title);
            }, 300);
            
        } catch (error) {
            statusArea.classList.add('hidden');
            showModal(
                translations[currentLanguage]['error'],
                error.message
            );
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.style.opacity = '1';
        }
    });
});