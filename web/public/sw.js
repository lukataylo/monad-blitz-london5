// Forfit service worker.
// - /assets/* (hashed Vite bundles) + /models/* (MediaPipe task + wasm):
//   cache-first — immutable or huge, either way fetch once.
// - navigations: network-first with cache fallback so the app shell still
//   opens offline after the first visit.
const CACHE = "walkthewalk-v1";

self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
            );
            await self.clients.claim();
        })()
    );
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
    }
    return response;
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached =
            (await caches.match(request)) ?? (await caches.match("/"));
        if (cached) return cached;
        throw err;
    }
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return; // RPC etc. — hands off

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
        return;
    }
    if (
        url.pathname.startsWith("/assets/") ||
        url.pathname.startsWith("/models/")
    ) {
        event.respondWith(cacheFirst(request));
    }
});
