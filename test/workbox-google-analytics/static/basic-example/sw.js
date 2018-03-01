/* globals workbox */

importScripts('/__WORKBOX/buildFile/workbox-core');
importScripts('/__WORKBOX/buildFile/workbox-background-sync');
importScripts('/__WORKBOX/buildFile/workbox-routing');
importScripts('/__WORKBOX/buildFile/workbox-strategies');
importScripts('/__WORKBOX/buildFile/workbox-google-analytics');

// Spy on .fetch() calls from inside the service worker.
// If `simulateOffline` is set to true, throw a network error.
let simulateOffline = false;
let spiedRequests = [];
const originalFetch = self.fetch;
self.fetch = async (...args) => {
  if (simulateOffline) {
    throw Response.error();
  }
  const clone = args[0] instanceof Request ?
      args[0].clone() : new Request(args[0]);

  spiedRequests.push({
    url: clone.url,
    timestamp: Date.now(),
    body: await clone.text(),
  });
  return originalFetch(...args);
};

// Add a message listener for communication between the client and SW.
self.addEventListener('message', (evt) => {
  switch (evt.data.action) {
    case 'simulate-offline':
      simulateOffline = evt.data.value;
      evt.ports[0].postMessage(null);
      break;
    case 'clear-spied-requests':
      spiedRequests = [];
      evt.ports[0].postMessage(null);
      break;
    case 'get-spied-requests':
      evt.ports[0].postMessage(spiedRequests);
      break;
    case 'dispatch-sync-event':
      {
        // Override `.waitUntil` so we can signal when the sync is done.
        const originalSyncEventWaitUntil = SyncEvent.prototype.waitUntil;
        SyncEvent.prototype.waitUntil = (promise) => {
          return promise.then(() => evt.ports[0].postMessage(null));
        };

        self.dispatchEvent(new SyncEvent('sync', {
          tag: 'workbox-background-sync:workbox-google-analytics',
        }));
        SyncEvent.prototype.waitUntil = originalSyncEventWaitUntil;
      }
      break;
  }
});

workbox.googleAnalytics.initialize();

self.addEventListener('install', (evt) => evt.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (evt) => evt.waitUntil(self.clients.claim()));
