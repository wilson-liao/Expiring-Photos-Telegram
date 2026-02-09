(function () {
  if (!window.tgWorkerHookInstalled) {
    window.tgWorkerHookInstalled = true;
    window.tgWorker = null;
    const workerName = "81.126e8b82c436e2fa8999.js";
    const OriginalWorker = window.Worker;
    window.Worker = function (...args) {
      const worker = new OriginalWorker(...args);
      const url = args[0]?.toString() || "";

      if (url.includes(workerName)) {
        window.tgWorker = worker;
      }
      return worker;
    };
  }

  // Same-origin BroadcastChannel for robust TTL synchronization
  const ttlChannel = new BroadcastChannel("tg_ttl_channel");
  let currentTTL = 0;

  ttlChannel.onmessage = (e) => {
    if (e.data && e.data.type === "WORKER_READY") {
      // Worker just started, send current TTL
      ttlChannel.postMessage({ type: "UPDATE_TTL", value: currentTTL });
    }
  };

  // Listen for TTL updates from content script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_TTL') {
      currentTTL = event.data.payload;
      window.pendingTTL = currentTTL; // Keep this for programmatic usage if needed

      // Broadcast to worker
      ttlChannel.postMessage({ type: "UPDATE_TTL", value: currentTTL });
      console.log("Broadcasting TTL:", currentTTL);
    }
  });

  // Get the currently active chat info from URL hash
  window.getCurrentTGChat = function () {
    const hash = window.location.hash; // e.g., #8087637576
    if (!hash) return null;
    const chatId = hash.slice(1);

    const chatTitle = document.querySelector("[data-peer-title]")?.textContent || "Unknown Chat";

    // Get last message id for the active chat from DOM
    const messageEls = document.querySelectorAll(`[data-peer-id="${chatId}"] [data-message-id]`);
    let lastMessageId = 0;
    if (messageEls.length > 0) {
      const lastMsgEl = messageEls[messageEls.length - 1];
      lastMessageId = parseInt(lastMsgEl.dataset.messageId, 10);
    }

    return {
      id: chatId,
      title: chatTitle,
      type: "chatTypePrivate",
      lastReadInboxMessageId: lastMessageId,
      lastReadOutboxMessageId: 0,
      unreadCount: 0,
      unreadMentionsCount: 0,
      isMin: false,
      accessHash: "0",
      isVerified: false,
      isCallActive: false,
      isCallNotEmpty: false,
      isProtected: false,
      isCreator: false,
      isForum: false,
      isBotForum: false,
      areStoriesHidden: false,
      hasStories: false,
      isListed: true,
      lastMessageId
    };
  };

  // Fetch file and calculate dimensions
  window.fileFromUrl = async function (url, name = "file.jpg") {
    const r = await fetch(url);
    const blob = await r.blob();
    const file = new File([blob], name, { type: blob.type });

    let width = 225, height = 225;
    if (blob.type.startsWith("image/")) {
      const img = await new Promise(resolve => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.src = URL.createObjectURL(blob);
      });
      width = img.width;
      height = img.height;
    }

    return { file, width, height };
  };

  // Send photo to the currently active chat
  window.sendPhotoToCurrentChat = async function (ttl = window.pendingTTL || 0,
    url = "https://web.telegram.org/a/wave_ripple.5d7d9fa793232bef56c0.jpg") {
    if (!window.tgWorker) {
      console.warn("Worker not ready yet.");
      return;
    }

    const chat = window.getCurrentTGChat();
    if (!chat) {
      console.warn("No active chat detected.");
      return;
    }

    const { file, width, height } = await window.fileFromUrl(url, "photo.jpg");
    const blobUrl = URL.createObjectURL(file);

    const params = {
      messageList: { chatId: chat.id, type: "thread", threadId: -1 },
      chat,
      lastMessageId: chat.lastMessageId,
      text: "",
      isSilent: false,
      shouldGroupMessages: true,
      shouldUpdateStickerSetOrder: true,
      wasDrafted: false,
      attachment: {
        blob: file,
        blobUrl,
        previewBlobUrl: blobUrl,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        quick: { width, height },
        uniqueId: Date.now() + "-" + Math.random(),
        shouldSendInHighQuality: false,
      }
    };

    if (ttl > 0) {
      params.attachment.ttlSeconds = ttl; // disappearing photo
    }


    window.tgWorker.postMessage({
      payloads: [
        {
          type: "callMethod",
          name: "sendMessage",
          messageId: crypto.randomUUID(),
          args: [params],
          withCallback: true
        }
      ]
    });

  };

  // Optional: log hash changes when switching chats
  window.addEventListener("hashchange", () => {
    console.log("Active chat changed to:", window.location.hash.slice(1));
  });

  // Request initial TTL
  window.postMessage({ type: 'GET_TTL' }, '*');

})();
