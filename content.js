// content.js
const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js'); // points to your inject.js
s.onload = () => s.remove(); // remove after injection
(document.head || document.documentElement).appendChild(s);

// Relay TTL changes to inject.js
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.customTTL) {
        window.postMessage({ type: 'SET_TTL', payload: changes.customTTL.newValue }, '*');
    }
});

// Listen for request from inject.js
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GET_TTL') {
        chrome.storage.local.get(['customTTL'], (result) => {
            console.log("Responding to GET_TTL with:", result.customTTL);
            window.postMessage({ type: 'SET_TTL', payload: result.customTTL || 0 }, '*');
        });
    }
});

// Send initial TTL
chrome.storage.local.get(['customTTL'], (result) => {
    console.log("INITIAL TTL IN CONTENTS.JS", result.customTTL);
    window.postMessage({ type: 'SET_TTL', payload: result.customTTL || 0 }, '*');
});
