# Expiring-Photos-Telegram

A Chrome Extension that allows you to send **disappearing/self-destructing photos** (with a custom TTL) via [Telegram Web A](https://web.telegram.org/a/).

## Features
- Set a custom Time-To-Live (TTL) for any photo you upload.
- Works on all photo uploads in chats.
- Adjustable TTL range: **1 to 60 seconds**.
- Easy toggle to **Disable** (reset to normal photo sending).

## Installation
1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked**.
5. Select the folder containing this project (where `manifest.json` is located).

## Usage
1. Open [Telegram Web A](https://web.telegram.org/a/).
2. Click the extension icon in your toolbar.
3. Enter a TTL value (in seconds) or use the **Disable** button.
4. Click **Save**.
5. Send a photo in any chat. It will be sent as a self-destructing media with the specified timer.

## Troubleshooting
- If the fire icon doesn't appear on your sent photo, try refreshing the page.
- Ensure you are using the "Web A" version of Telegram (`https://web.telegram.org/a/`).
