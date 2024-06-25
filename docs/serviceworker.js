const staticDevCoffee = "Wallet-v1"
const assets = [
  "/",
  "/index.html",
  "/android-chrome-192x192.png",
  "docs/android-chrome-512x512.png",
  "docs/apple-touch-icon.png",
  "docs/favicon-16x16.png",
  "docs/favicon-32x32.png",
  "docs/favicon.ico",

]

self.addEventListener("install", installEvent => {
  installEvent.waitUntil(
    caches.open(staticDevCoffee).then(cache => {
      cache.addAll(assets)
    })
  )
})