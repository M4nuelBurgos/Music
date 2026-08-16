let translations = {};
let currentLanguage = localStorage.getItem('language') || 'en';
let currentTheme = localStorage.getItem('theme') || 'dark';
let downloadHistory = JSON.parse(localStorage.getItem('downloadHistory')) || [];

// Load translations
async function loadTranslations() {
    try {
        const response = await fetch('/static/translations.json');
        translations = await response.json();
        setLanguage(currentLanguage);
    } catch (error) {
        console.error('Failed to load translations:', error);
    }
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

// Delete history item
function deleteHistoryItem(index) {
    downloadHistory.splice(index, 1);
    localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory));
    displayHistory();
}

// Simulate progress (will be replaced with real progress from server)
function simulateProgress(progressBar, progressPercent, duration = 3000) {
    let currentProgress = 0;
    const increment = Math.random() * 30 + 10;
    
    const interval = setInterval(() => {
        currentProgress += increment;
        if (currentProgress > 90) {
            currentProgress = 90;
        }
        
        progressBar.style.width = currentProgress + '%';
        progressPercent.textContent = Math.floor(currentProgress) + '%';
        
        if (currentProgress >= 90) {
            clearInterval(interval);
        }
    }, duration / 30);
    
    return interval;
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
        if (confirm(translations[currentLanguage]['clearHistory'] + '?')) {
            downloadHistory = [];
            localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory));
            displayHistory();
        }
    });
    
    const form = document.getElementById('downloadForm');
    const urlInput = document.getElementById('urlInput');
    const mp3Toggle = document.getElementById('mp3Toggle');
    const downloadBtn = document.getElementById('downloadBtn');
    
    const statusArea = document.getElementById('statusArea');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    
    const songTitle = document.getElementById('songTitle');
    const downloadLink = document.getElementById('downloadLink');
    const errorMessage = document.getElementById('errorMessage');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawText = urlInput.value;
        const urls = rawText.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        const convertToMp3 = mp3Toggle.checked;
        
        if (urls.length === 0) {
            errorArea.classList.remove('hidden');
            errorMessage.textContent = translations[currentLanguage]['noUrls'];
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

        // Simulate progress
        const progressInterval = simulateProgress(progressBar, progressPercent);

        try {
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ urls: urls, convert_to_mp3: convertToMp3 })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || translations[currentLanguage]['errorOccurred']);
            }

            // Complete progress
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            progressPercent.textContent = '100%';

            // Success
            setTimeout(() => {
                statusArea.classList.add('hidden');
                resultArea.classList.remove('hidden');
                
                songTitle.textContent = data.title;
                document.getElementById('messageText').textContent = data.message;
                downloadLink.href = `/file/${encodeURIComponent(data.filename)}`;
                
                // Add to history
                addToHistory(data.title);
            }, 500);
            
        } catch (error) {
            clearInterval(progressInterval);
            statusArea.classList.add('hidden');
            errorArea.classList.remove('hidden');
            errorMessage.textContent = error.message;
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.style.opacity = '1';
        }
    });
});
