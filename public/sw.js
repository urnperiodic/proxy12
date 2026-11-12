importScripts("/scramjet/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Normalize response headers and body statuses for cross-origin isolated iframe compatibility
scramjet.addEventListener("handleResponse", (event) => {
  if ([101, 204, 205, 304].includes(event.status)) {
    event.responseBody = null;
  }
  if (event.responseHeaders) {
    event.responseHeaders["cross-origin-resource-policy"] = "cross-origin";
    delete event.responseHeaders["x-frame-options"];
    delete event.responseHeaders["content-security-policy"];
    delete event.responseHeaders["content-security-policy-report-only"];
  }
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      try {
        await scramjet.loadConfig();
        if (scramjet.config && scramjet.route(event)) {
          return await scramjet.fetch(event);
        }
      } catch (err) {
        console.error("[sw] Scramjet fetch error:", err);
      }
      return fetch(event.request);
    })()
  );
});
