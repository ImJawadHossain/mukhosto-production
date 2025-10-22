self.addEventListener('install', event => {
  console.log('Service Worker installed');
});

self.addEventListener('fetch', function (event) {
  // Add offline cache logic here if needed
});
