const staticDevCoffee = "Wallet-v1"
const assets = [
  "/wallet/",
  "/wallet/index.html",
  "/wallet/android-chrome-192x192.png",
  "wallet/android-chrome-512x512.png",
  "wallet/apple-touch-icon.png",
  "wallet/favicon-16x16.png",
  "wallet/favicon-32x32.png",
  "wallet/favicon.ico"
]

self.addEventListener("install", installEvent => {
  installEvent.waitUntil(
    caches.open(staticDevCoffee).then(cache => {
      cache.addAll(assets)
    })
  )
})