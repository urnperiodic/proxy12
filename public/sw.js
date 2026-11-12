importScripts("/scramjet/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const SCRAMJET_STATIC_FILES = new Set([
  "/scramjet/scramjet.all.js",
  "/scramjet/scramjet.all.js.map",
  "/scramjet/scramjet.bundle.js",
  "/scramjet/scramjet.bundle.js.map",
  "/scramjet/scramjet.sync.js",
  "/scramjet/scramjet.sync.js.map",
]);

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
  const url = new URL(event.request.url);

  // Allow Scramjet's own static JS bundles to load directly from the server
  if (url.origin === self.location.origin && SCRAMJET_STATIC_FILES.has(url.pathname)) {
    return;
  }

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
