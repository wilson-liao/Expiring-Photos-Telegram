let attachedTabs = new Set();
let patchedTabs = new Set();
// Old Worker Name "2026.b8fb401b0f58b6ab09af.js"
const workerName = "81.126e8b82c436e2fa8999.js";

console.log("Background script loaded");

// Helper: send CDP command
function sendCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(result);
    });
  });
}

// Attach debugger and enable interception
async function attach(tabId, tabUrl) {
  if (attachedTabs.has(tabId) || patchedTabs.has(tabId)) return;
  if (!tabUrl.startsWith("https://web.telegram.org/a/")) return;

  try {
    await new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId }, "1.3", () => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message.includes("Another debugger is already attached")) {
            console.warn(`Debugger already attached to tab ${tabId}, skipping attach.`);
            resolve();
          } else {
            reject(chrome.runtime.lastError);
          }
        } else resolve();
      });
    });

    attachedTabs.add(tabId);

    // Enable network interception and bypass cache / SW
    await sendCommand(tabId, "Network.enable");
    await sendCommand(tabId, "Network.setCacheDisabled", { cacheDisabled: true });
    await sendCommand(tabId, "Network.setBypassServiceWorker", { bypass: true });

    await sendCommand(tabId, "Fetch.enable", {
      patterns: [{ requestStage: "Response", urlPattern: "*telegram.org*" }]
    });

    console.log(`Debugger attached to tab ${tabId} (patching ${workerName} worker)`);

  } catch (err) {
    console.error(`Failed to attach debugger to tab ${tabId}:`, err);
  }
}

// Detach debugger
async function detach(tabId) {
  if (!attachedTabs.has(tabId)) return;
  await new Promise(resolve => chrome.debugger.detach({ tabId }, resolve));
  attachedTabs.delete(tabId);
  console.log(`Debugger detached from tab ${tabId} after patching`);
}

// Intercept network responses and patch worker
chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (method !== "Fetch.requestPaused") return;
  const { requestId, request, responseHeaders } = params;
  const tabId = source.tabId;

  if (!request.url.includes(workerName)) {
    await sendCommand(tabId, "Fetch.continueRequest", { requestId });
    return;
  }

  if (patchedTabs.has(tabId)) {
    await sendCommand(tabId, "Fetch.continueRequest", { requestId });
    return;
  }

  try {
    const { body, base64Encoded } = await sendCommand(tabId, "Fetch.getResponseBody", { requestId });
    let js = base64Encoded ? atob(body) : body;

    // Inject global TTL listener at the top
    // Inject global TTL listener at the top using BroadcastChannel
    const listenerCode = `
      self.customTTL = 0;
      try {
        const ttlChannel = new BroadcastChannel("tg_ttl_channel");
        ttlChannel.onmessage = (e) => {
          if (e.data && e.data.type === "UPDATE_TTL") {
            self.customTTL = e.data.value;
            console.log("Worker received custom TTL via BC:", self.customTTL);
          }
        };
        // Announce ready to get immediate sync
        setTimeout(() => ttlChannel.postMessage({ type: "WORKER_READY" }), 100);
      } catch (e) {
        console.error("Failed to init BroadcastChannel in worker:", e);
      }
    `;
    js = listenerCode + js;

    // Patch InputMediaUploadedPhoto to include ttlSeconds from global
    const mediaRegex = /if\s*\(\s*U\.has\(i\)\s*&&\s*i\s*!==\s*k\s*\)\s*return\s*new\s+Qe\.InputMediaUploadedPhoto\s*\(\s*\{\s*file\s*:\s*_,\s*spoiler\s*:\s*l\s*\}\s*\)\s*;/;

    if (mediaRegex.test(js)) {
      js = js.replace(mediaRegex, `
if (U.has(i) && i !== k)
{
    const ttlSeconds = self.customTTL || 0;
    const mediaToReturn = new Qe.InputMediaUploadedPhoto({
        file: _,
        spoiler: l,
        ttlSeconds
    });
    console.log("Applying TTL:", ttlSeconds);
    return mediaToReturn;
}
`);
    }
    console.log("Patched worker code length:", js.length);

    // Remove headers that can break caching
    const newHeaders = (responseHeaders || []).filter(h => {
      const n = h.name.toLowerCase();
      return !["content-length", "cache-control", "etag", "last-modified"].includes(n);
    });
    newHeaders.push({ name: "Cache-Control", value: "no-store" });

    // Fulfill patched request
    await sendCommand(tabId, "Fetch.fulfillRequest", {
      requestId,
      responseCode: 200,
      responseHeaders: newHeaders,
      body: btoa(js)
    });

    patchedTabs.add(tabId);
    await detach(tabId);

  } catch (err) {
    console.error("Failed to patch JS:", err);
    await sendCommand(tabId, "Fetch.continueRequest", { requestId });
  }
});

// Listen for the content script to tell us the page actually loaded
chrome.runtime.onMessage.addListener(async (message, sender) => {
  if (message.type === "PAGE_LOADED" && sender.tab) {
    const tabId = sender.tab.id;
    const url = sender.tab.url;

    if (url && url.startsWith("https://web.telegram.org/a/")) {
      console.log(`Page loaded in tab ${tabId}, resetting debugger state.`);

      // Clear state for this tab so we can re-attach/re-patch
      try {
        await detach(tabId);
      } catch (e) { /* ignore if not attached */ }

      patchedTabs.delete(tabId);
      attachedTabs.delete(tabId);

      await attach(tabId, url);
    }
  }
});

// Cleanup when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  patchedTabs.delete(tabId);
  attachedTabs.delete(tabId);
});
