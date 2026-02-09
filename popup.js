document.addEventListener('DOMContentLoaded', () => {
    const ttlInput = document.getElementById('ttl');
    const saveBtn = document.getElementById('save');

    // Load saved TTL
    chrome.storage.local.get(['customTTL'], (result) => {
        console.log("INITIAL TTL", result.customTTL);
        ttlInput.value = result.customTTL || 0;
    });

    // Save TTL
    saveBtn.addEventListener('click', () => {
        let ttl = parseInt(ttlInput.value, 10) || 0;
        if (ttl > 60) ttl = 60;
        if (ttl < 1) ttl = 1;

        // Update input to reflect clamped value
        console.log("saving ttl value to ", ttl);
        ttlInput.value = ttl;
        saveTTL(ttl);
    });

    document.getElementById('disable').addEventListener('click', () => {
        ttlInput.value = 0;
        saveTTL(0);
    });

    function saveTTL(ttl) {
        chrome.storage.local.set({ customTTL: ttl }, () => {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            setTimeout(() => saveBtn.textContent = originalText, 1000);
        });
    }
});
