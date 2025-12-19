// firebase-config.js
// Thay thế bằng thông tin Firebase của bạn
// Expose a stable global `db` for other scripts (index/admin/hoadon) to use.
// NOTE: `window.db = ...` alone is not always enough for some bundlers/strict contexts.
var db = null;

const firebaseConfig = {
    apiKey: "AIzaSyCOAXmFrpMHOLqKJxbOyYHWZxP5B8Bcdt0",
    authDomain: "lsc-web-tool-2025.firebaseapp.com",
    projectId: "lsc-web-tool-2025",
    storageBucket: "lsc-web-tool-2025.firebasestorage.app",
    messagingSenderId: "33009267964",
    appId: "1:33009267964:web:ade1095b3a3e0c07ab1379",
    measurementId: "G-SWVQ7DF01J"
};

// Khởi tạo Firebase
(function() {
    const g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : {});
    const DB_WAITERS_KEY = '__dbReadyResolvers__';

    // Allow overriding config without editing this file (optional):
    // <script>window.FIREBASE_CONFIG = {...}</script> before loading firebase-config.js
    const activeConfig = (g && g.FIREBASE_CONFIG) ? g.FIREBASE_CONFIG : firebaseConfig;

    function setDb(dbInstance) {
        db = dbInstance;
        if (g) g.db = dbInstance;

        // Resolve pending waiters
        try {
            const waiters = g[DB_WAITERS_KEY];
            if (Array.isArray(waiters) && waiters.length > 0) {
                waiters.splice(0).forEach(({ resolve }) => {
                    try { resolve(dbInstance); } catch (_) {}
                });
            }
        } catch (_) {}
    }

    // Promise helper for pages that need to wait until Firebase is ready
    if (g && typeof g.waitForDb !== 'function') {
        g.waitForDb = function waitForDb(timeoutMs = 15000) {
            if (g.db) return Promise.resolve(g.db);
            if (!Array.isArray(g[DB_WAITERS_KEY])) g[DB_WAITERS_KEY] = [];

            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    try {
                        const list = g[DB_WAITERS_KEY];
                        if (Array.isArray(list)) {
                            const idx = list.findIndex(x => x && x.resolve === resolve);
                            if (idx >= 0) list.splice(idx, 1);
                        }
                    } catch (_) {}
                    reject(new Error('Timeout: Firebase db chưa sẵn sàng'));
                }, timeoutMs);

                g[DB_WAITERS_KEY].push({
                    resolve: (val) => { clearTimeout(timer); resolve(val); },
                    reject
                });
            });
        };
    }

    // Wait for Firebase to be loaded
    function initFirebase() {
        if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
            try {
                firebase.initializeApp(activeConfig);
                const dbInstance = firebase.firestore();
                setDb(dbInstance);
                console.log('Firebase đã được khởi tạo thành công!');
            } catch (error) {
                console.error('Lỗi khởi tạo Firebase:', error);
            }
        } else if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            // Firebase already initialized, just get db
            setDb(firebase.firestore());
        }
    }
    
    // Try to initialize immediately
    initFirebase();
    
    // If Firebase not loaded yet, wait for it
    if (typeof firebase === 'undefined') {
        let attempts = 0;
        const maxAttempts = 100; // Tăng timeout lên 10 giây
        const checkInterval = setInterval(function() {
            attempts++;
            if (typeof firebase !== 'undefined') {
                clearInterval(checkInterval);
                initFirebase();
            } else if (attempts > maxAttempts) {
                clearInterval(checkInterval);
                console.warn('Firebase SDK đang load, vui lòng đợi thêm...');
                // Tiếp tục thử thêm 50 lần nữa (tổng 15 giây)
                let retryAttempts = 0;
                const retryInterval = setInterval(function() {
                    retryAttempts++;
                    if (typeof firebase !== 'undefined') {
                        clearInterval(retryInterval);
                        initFirebase();
                    } else if (retryAttempts > 50) {
                        clearInterval(retryInterval);
                        console.error('Firebase SDK không thể load sau 15 giây! Vui lòng kiểm tra kết nối mạng.');
                    }
                }, 100);
            }
        }, 100);
    }
})();

