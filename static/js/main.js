document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('downloadForm');
    const urlInput = document.getElementById('urlInput');
    const mp3Toggle = document.getElementById('mp3Toggle');
    const downloadBtn = document.getElementById('downloadBtn');
    
    const statusArea = document.getElementById('statusArea');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    
    const songTitle = document.getElementById('songTitle');
    const downloadLink = document.getElementById('downloadLink');
    const errorMessage = document.getElementById('errorMessage');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawText = urlInput.value;
        const urls = rawText.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        const convertToMp3 = mp3Toggle.checked;
        if (urls.length === 0) return;

        // Reset UI state
        errorArea.classList.add('hidden');
        resultArea.classList.add('hidden');
        statusArea.classList.remove('hidden');
        downloadBtn.disabled = true;
        downloadBtn.style.opacity = '0.7';

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
                throw new Error(data.error || 'Ocurrió un error al procesar los videos.');
            }

            // Success
            statusArea.classList.add('hidden');
            resultArea.classList.remove('hidden');
            
            songTitle.textContent = data.title;
            // Point the download link to our file serving endpoint
            downloadLink.href = `/file/${encodeURIComponent(data.filename)}`;
            
        } catch (error) {
            statusArea.classList.add('hidden');
            errorArea.classList.remove('hidden');
            errorMessage.textContent = error.message;
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.style.opacity = '1';
        }
    });
});
