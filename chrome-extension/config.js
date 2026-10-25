// Where the extension talks to. The one place to change it (a development copy can point it at
// http://localhost:3000; add that origin to host_permissions and externally_connectable as well).
// Loaded by the service worker (importScripts) and by the popup and cropper pages.
self.RW_API_BASE_URL = 'https://www.receiptwise.io';
