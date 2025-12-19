// sync-service.js
// Service đồng bộ dữ liệu giữa Firebase và Google Sheets

class SyncService {
    constructor() {
        this.syncing = false;
        this.syncQueue = [];
    }

    _getSheetsEnabled() {
        return typeof USE_GOOGLE_SHEETS !== 'undefined' ? USE_GOOGLE_SHEETS :
            (typeof window !== 'undefined' && window.USE_GOOGLE_SHEETS);
    }

    _getSheetsConfig() {
        return typeof GOOGLE_SHEETS_CONFIG !== 'undefined' ? GOOGLE_SHEETS_CONFIG :
            (typeof window !== 'undefined' && window.GOOGLE_SHEETS_CONFIG);
    }

    async _parseResponseAsJsonOrText(response) {
        const contentType = response.headers && response.headers.get ? (response.headers.get('content-type') || '') : '';
        if (contentType.includes('application/json')) {
            return await response.json();
        }
        // Try JSON first anyway (Apps Script sometimes returns JSON without proper header)
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (_) {
            return { raw: text };
        }
    }

    _jsonp(url, timeoutMs = 12000) {
        // JSONP helper: bypasses CORS by using <script src="...&callback=...">
        // Requires the WebApp to support `callback` query param.
        if (typeof document === 'undefined') {
            return Promise.reject(new Error('JSONP chỉ chạy được trong trình duyệt'));
        }
        return new Promise((resolve, reject) => {
            const cbName = `__syncJsonpCb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
            const script = document.createElement('script');
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout khi gọi WebApp (JSONP)'));
            }, timeoutMs);

            function cleanup() {
                clearTimeout(timer);
                try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
                if (script && script.parentNode) script.parentNode.removeChild(script);
            }

            window[cbName] = (payload) => {
                cleanup();
                resolve(payload);
            };

            script.onerror = () => {
                cleanup();
                reject(new Error('Không tải được WebApp (JSONP) - có thể WebApp chưa public/đang redirect login'));
            };

            const hasQuery = url.includes('?');
            script.src = `${url}${hasQuery ? '&' : '?'}callback=${encodeURIComponent(cbName)}`;
            document.head.appendChild(script);
        });
    }

    async getWebAppInfo() {
        const cfg = this._getSheetsConfig();
        if (!cfg || !cfg.WEB_APP_URL) throw new Error('Chưa có WEB_APP_URL');
        const url = `${cfg.WEB_APP_URL}?action=info&sheetId=${encodeURIComponent(cfg.SHEET_ID || '')}`;
        try {
            // Try fetch first (if CORS allows)
            const res = await fetch(url);
            const data = await this._parseResponseAsJsonOrText(res);
            if (!res.ok) throw new Error(`WebApp info failed: HTTP ${res.status}`);
            return data;
        } catch (_) {
            // Fallback to JSONP
            return await this._jsonp(url);
        }
    }

    // ========== ĐỒNG BỘ SẢN PHẨM ==========
    
    // Đồng bộ từ Firebase sang Google Sheets
    async syncProductsToSheet() {
        const useSheets = this._getSheetsEnabled();
        if (!useSheets) {
            console.log('Google Sheets chưa được cấu hình hoặc đã tắt');
            return { enabled: false, sheet: null, count: 0 };
        }
        if (typeof db === 'undefined' || !db) {
            throw new Error('Firebase db chưa được khởi tạo!');
        }
        
        const snapshot = await db.collection('products').get();
        const products = [];
        
        snapshot.forEach(doc => {
            const product = doc.data();
            if (product && product.deleted === true) return;
            const sizes = JSON.stringify(product.sizes || {});
            const mainImage = (product.images && Array.isArray(product.images) && product.images.length > 0)
                ? product.images[0]
                : (product.image || '');
            products.push([
                product.id || doc.id,
                product.name || '',
                product.desc || '',
                mainImage,
                sizes,
                product.importPrice || 0,
                product.rentPrice || 0,
                product.renting || 0,
                product.rentalCount || 0
            ]);
        });

        const config = this._getSheetsConfig();
        if (!config || !config.SHEETS || !config.SHEETS.PRODUCTS) {
            throw new Error('Thiếu cấu hình GOOGLE_SHEETS_CONFIG.SHEETS.PRODUCTS');
        }
        const res = await this.writeToSheet(config.SHEETS.PRODUCTS, products);
        if (res && res.error) throw new Error(String(res.error));

        // If we couldn't read a CORS-safe response (opaque), verify by reading back via JSONP.
        if (res && res.opaque === true) {
            try {
                await this.readViaWebApp(config.SHEETS.PRODUCTS);
            } catch (e) {
                throw new Error(
                    'Không xác minh được đồng bộ Google Sheets (Web App có thể đang yêu cầu đăng nhập / chưa deploy "Anyone"). ' +
                    'Hãy deploy lại Apps Script Web App (Who has access: Anyone) và cập nhật WEB_APP_URL.'
                );
            }
        }

        console.log('Đã đồng bộ sản phẩm lên Google Sheets:', products.length);
        return { enabled: true, sheet: config.SHEETS.PRODUCTS, count: products.length, response: res };
    }

    // Đồng bộ từ Google Sheets sang Firebase
    async syncProductsFromSheet() {
        const useSheets = this._getSheetsEnabled();
        if (!useSheets) {
            console.log('Google Sheets chưa được cấu hình hoặc đã tắt');
            return { enabled: false, sheet: null, count: 0 };
        }
        if (typeof db === 'undefined' || !db) {
            throw new Error('Firebase db chưa được khởi tạo!');
        }
        
        const config = this._getSheetsConfig();
        if (!config || !config.SHEETS || !config.SHEETS.PRODUCTS) {
            throw new Error('Thiếu cấu hình GOOGLE_SHEETS_CONFIG.SHEETS.PRODUCTS');
        }

        const data = await this.readFromSheet(config.SHEETS.PRODUCTS);
        
        // Bỏ qua header row
        const rows = data.slice(1);
        let imported = 0;
        
        for (const row of rows) {
            if (row[0]) { // Có ID
                const product = {
                    id: row[0],
                    name: row[1] || '',
                    desc: row[2] || '',
                    image: row[3] || '',
                    images: row[3] ? [row[3]] : [],
                    sizes: this.parseSizes(row[4]),
                    importPrice: parseInt(row[5]) || 0,
                    rentPrice: parseInt(row[6]) || 0,
                    renting: parseInt(row[7]) || 0,
                    rentalCount: parseInt(row[8]) || 0
                };
                
                await db.collection('products').doc(product.id).set(product);
                imported++;
            }
        }
        
        console.log('Đã đồng bộ sản phẩm từ Google Sheets:', imported);
        return { enabled: true, sheet: config.SHEETS.PRODUCTS, count: imported };
    }

    // Thêm/Sửa sản phẩm - đồng bộ cả 2 nơi
    async saveProduct(product) {
        // Lưu vào Firebase
        if (typeof db === 'undefined' || !db) {
            throw new Error('Firebase db chưa được khởi tạo!');
        }
        await db.collection('products').doc(product.id).set(product);
        
        // Đồng bộ lên Google Sheets
        const useSheets = this._getSheetsEnabled();
        if (useSheets) {
            try {
                await this.syncProductsToSheet();
            } catch (error) {
                console.warn('Không thể đồng bộ sản phẩm lên Google Sheets:', error);
            }
        }
    }

    // Xóa sản phẩm - đồng bộ cả 2 nơi (hard delete - xóa vĩnh viễn)
    async deleteProduct(productId) {
        // Xóa từ Firebase
        if (typeof db === 'undefined' || !db) {
            throw new Error('Firebase db chưa được khởi tạo!');
        }
        await db.collection('products').doc(productId).delete();
        
        // Xóa từ Google Sheets (bỏ qua lỗi CORS)
        const useSheets = typeof USE_GOOGLE_SHEETS !== 'undefined' ? USE_GOOGLE_SHEETS : 
                         (typeof window !== 'undefined' && window.USE_GOOGLE_SHEETS);
        if (useSheets) {
            try {
                const config = typeof GOOGLE_SHEETS_CONFIG !== 'undefined' ? GOOGLE_SHEETS_CONFIG : 
                              (typeof window !== 'undefined' && window.GOOGLE_SHEETS_CONFIG);
                if (config && config.WEB_APP_URL && config.WEB_APP_URL !== 'YOUR_WEB_APP_URL') {
                    await this.deleteFromSheet(config.SHEETS.PRODUCTS, productId, 0);
                    await this.syncProductsToSheet(); // Đồng bộ lại
                }
            } catch (error) {
                // Bỏ qua lỗi CORS hoặc lỗi Google Sheets
                console.warn('Không thể đồng bộ với Google Sheets (có thể do CORS):', error);
                // Vẫn tiếp tục vì đã xóa Firebase thành công
            }
        }
    }

    // ========== ĐỒNG BỘ ĐƠN HÀNG ==========
    
    // Đồng bộ từ Firebase sang Google Sheets
    async syncOrdersToSheet() {
        const useSheets = this._getSheetsEnabled();
        if (!useSheets) {
            console.log('Google Sheets chưa được cấu hình hoặc đã tắt');
            return { enabled: false, sheet: null, count: 0 };
        }
        if (typeof db === 'undefined' || !db) {
            throw new Error('Firebase db chưa được khởi tạo!');
        }
        
        const snapshot = await db.collection('orders').get();
        const orders = [];
        
        snapshot.forEach(doc => {
            const order = doc.data();
            const items = JSON.stringify(order.items || []);
            const createdAt = order.createdAt?.toDate ? 
                order.createdAt.toDate().toISOString() : 
                (order.createdAt || new Date().toISOString());
            
            orders.push([
                doc.id,
                order.customerName || '',
                order.customerPhone || '',
                order.customerAddress || '',
                items,
                order.total || 0,
                order.status || 'pending',
                createdAt,
                order.rentalDate || ''
            ]);
        });

        const config = this._getSheetsConfig();
        if (!config || !config.SHEETS || !config.SHEETS.ORDERS) {
            throw new Error('Thiếu cấu hình GOOGLE_SHEETS_CONFIG.SHEETS.ORDERS');
        }
        const res = await this.writeToSheet(config.SHEETS.ORDERS, orders);
        if (res && res.error) throw new Error(String(res.error));

        if (res && res.opaque === true) {
            try {
                await this.readViaWebApp(config.SHEETS.ORDERS);
            } catch (e) {
                throw new Error(
                    'Không xác minh được đồng bộ Google Sheets (Web App có thể đang yêu cầu đăng nhập / chưa deploy "Anyone"). ' +
                    'Hãy deploy lại Apps Script Web App (Who has access: Anyone) và cập nhật WEB_APP_URL.'
                );
            }
        }

        console.log('Đã đồng bộ đơn hàng lên Google Sheets:', orders.length);
        return { enabled: true, sheet: config.SHEETS.ORDERS, count: orders.length, response: res };
    }

    // Thêm đơn hàng - đồng bộ cả 2 nơi
    async saveOrder(order) {
        // Lưu vào Firebase
        if (typeof db === 'undefined' || !db) {
            throw new Error('Firebase db chưa được khởi tạo!');
        }
        const docRef = await db.collection('orders').add(order);
        
        // Đồng bộ lên Google Sheets
        const useSheets = this._getSheetsEnabled();
        if (useSheets) {
            try {
                await this.syncOrdersToSheet();
            } catch (error) {
                console.warn('Không thể đồng bộ đơn hàng lên Google Sheets:', error);
            }
        }
        
        return docRef.id;
    }

    // Cập nhật đơn hàng - đồng bộ cả 2 nơi
    async updateOrder(orderId, updates) {
        // Cập nhật Firebase
        if (typeof db === 'undefined' || !db) {
            throw new Error('Firebase db chưa được khởi tạo!');
        }
        await db.collection('orders').doc(orderId).update(updates);
        
        // Đồng bộ lên Google Sheets
        const useSheets = this._getSheetsEnabled();
        if (useSheets) {
            try {
                await this.syncOrdersToSheet();
            } catch (error) {
                console.warn('Không thể đồng bộ đơn hàng lên Google Sheets:', error);
            }
        }
    }

    // ========== GOOGLE SHEETS API ==========
    
    // Đọc dữ liệu từ Google Sheet
    async readFromSheet(sheetName) {
        const config = this._getSheetsConfig();
        if (config && config.WEB_APP_URL && config.WEB_APP_URL !== 'YOUR_WEB_APP_URL') {
            // Sử dụng Apps Script Web App
            return await this.readViaWebApp(sheetName);
        } else {
            // Sử dụng Google Sheets API trực tiếp
            return await this.readViaAPI(sheetName);
        }
    }

    // Đọc qua Apps Script Web App
    async readViaWebApp(sheetName) {
        const config = this._getSheetsConfig();
        const url = `${config.WEB_APP_URL}?action=read&sheet=${encodeURIComponent(sheetName)}&sheetId=${encodeURIComponent(config.SHEET_ID || '')}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`WebApp read failed: HTTP ${response.status}`);
            const data = await this._parseResponseAsJsonOrText(response);
            if (data && data.error) throw new Error(String(data.error));
            return data.values || [];
        } catch (error) {
            // Common case: CORS/302 redirect -> fallback to JSONP
            const payload = await this._jsonp(url);
            if (payload && payload.error) throw new Error(String(payload.error));
            return payload.values || [];
        }
    }

    // Đọc qua Google Sheets API
    async readViaAPI(sheetName) {
        const config = this._getSheetsConfig();
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.SHEET_ID}/values/${sheetName}?key=${config.API_KEY}`;
        const response = await fetch(url);
        const data = await this._parseResponseAsJsonOrText(response);
        if (!response.ok) throw new Error(`Sheets API read failed: HTTP ${response.status}`);
        if (data && data.error) throw new Error(JSON.stringify(data.error));
        return data.values || [];
    }

    // Ghi dữ liệu vào Google Sheet
    async writeToSheet(sheetName, values) {
        const config = this._getSheetsConfig();
        if (config && config.WEB_APP_URL && config.WEB_APP_URL !== 'YOUR_WEB_APP_URL') {
            // Sử dụng Apps Script Web App
            return await this.writeViaWebApp(sheetName, values);
        } else {
            // Sử dụng Google Sheets API trực tiếp
            return await this.writeViaAPI(sheetName, values);
        }
    }

    // Ghi qua Apps Script Web App
    async writeViaWebApp(sheetName, values) {
        const config = this._getSheetsConfig();
        const payload = JSON.stringify({
            action: 'write',
            sheet: sheetName,
            sheetId: config.SHEET_ID || '',
            values: values
        });

        // Try normal CORS first (best: can read response)
        try {
            const response = await fetch(config.WEB_APP_URL, {
                method: 'POST',
                headers: {
                    // IMPORTANT: use a "simple" content-type to avoid CORS preflight (OPTIONS)
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: payload
            });
            const data = await this._parseResponseAsJsonOrText(response);
            if (!response.ok) throw new Error(`WebApp write failed: HTTP ${response.status}`);
            if (data && data.error) throw new Error(String(data.error));
            return data;
        } catch (error) {
            // If the WebApp redirects to Google login (302), we should fail loudly with a clear message.
            try {
                await this.getWebAppInfo();
            } catch (_) {
                throw new Error(
                    'Google Apps Script Web App đang yêu cầu đăng nhập (302 -> accounts.google.com). ' +
                    'Cần Deploy Web App với "Who has access: Anyone" và dùng đúng WEB_APP_URL mới.'
                );
            }

            // Fallback: send request without CORS (opaque response).
            // NOTE: this confirms the request was SENT, not that Apps Script executed successfully.
            await fetch(config.WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: payload
            });
            return { success: true, opaque: true };
        }
    }

    // Ghi qua Google Sheets API
    async writeViaAPI(sheetName, values) {
        const config = this._getSheetsConfig();
        // Xóa dữ liệu cũ trước
        await this.clearSheet(sheetName);
        
        // Ghi dữ liệu mới
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.SHEET_ID}/values/${sheetName}!A1:append?valueInputOption=RAW&key=${config.API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                values: values
            })
        });
        const data = await this._parseResponseAsJsonOrText(response);
        if (!response.ok) throw new Error(`Sheets API write failed: HTTP ${response.status}`);
        if (data && data.error) throw new Error(JSON.stringify(data.error));
        return data;
    }

    // Xóa dữ liệu trong sheet
    async clearSheet(sheetName) {
        const config = this._getSheetsConfig();
        if (config && config.WEB_APP_URL && config.WEB_APP_URL !== 'YOUR_WEB_APP_URL') {
            const response = await fetch(`${config.WEB_APP_URL}?action=clear&sheet=${encodeURIComponent(sheetName)}&sheetId=${encodeURIComponent(config.SHEET_ID || '')}`);
            const data = await this._parseResponseAsJsonOrText(response);
            if (!response.ok) throw new Error(`WebApp clear failed: HTTP ${response.status}`);
            if (data && data.error) throw new Error(String(data.error));
            return data;
        } else if (config && config.API_KEY && config.API_KEY !== 'YOUR_API_KEY') {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.SHEET_ID}/values/${sheetName}!A:Z:clear?key=${config.API_KEY}`;
            const response = await fetch(url, {
                method: 'POST'
            });
            const data = await this._parseResponseAsJsonOrText(response);
            if (!response.ok) throw new Error(`Sheets API clear failed: HTTP ${response.status}`);
            if (data && data.error) throw new Error(JSON.stringify(data.error));
            return data;
        }
    }

    // Xóa một dòng cụ thể
    async deleteFromSheet(sheetName, searchValue, columnIndex) {
        const config = typeof GOOGLE_SHEETS_CONFIG !== 'undefined' ? GOOGLE_SHEETS_CONFIG : 
                      (typeof window !== 'undefined' && window.GOOGLE_SHEETS_CONFIG);
        if (config && config.WEB_APP_URL && config.WEB_APP_URL !== 'YOUR_WEB_APP_URL') {
            try {
                const response = await fetch(`${config.WEB_APP_URL}?action=delete&sheet=${encodeURIComponent(sheetName)}&value=${encodeURIComponent(searchValue)}&column=${columnIndex}&sheetId=${encodeURIComponent(config.SHEET_ID || '')}`, {
                    method: 'GET',
                    mode: 'no-cors' // Bỏ qua CORS
                });
                // Với no-cors, không thể đọc response, nhưng request vẫn được gửi
                return { success: true };
            } catch (error) {
                console.warn('Lỗi khi xóa từ Google Sheets:', error);
                throw error;
            }
        }
    }

    // Parse sizes từ string
    parseSizes(sizesStr) {
        try {
            if (typeof sizesStr === 'string') {
                return JSON.parse(sizesStr);
            }
            return sizesStr || {};
        } catch (e) {
            return {};
        }
    }

    // Đồng bộ 2 chiều (từ cả 2 nguồn)
    async syncBothWays() {
        const useSheets = this._getSheetsEnabled();
        if (!useSheets) {
            console.log('Google Sheets chưa được cấu hình hoặc đã tắt');
            return { enabled: false, products: { count: 0 }, orders: { count: 0 } };
        }
        
        this.syncing = true;
        try {
            // Đồng bộ sản phẩm: Firebase -> Sheets
            const products = await this.syncProductsToSheet();
            
            // Đồng bộ đơn hàng: Firebase -> Sheets
            const orders = await this.syncOrdersToSheet();
            
            console.log('Đã đồng bộ hoàn tất!');
            return { enabled: true, products, orders };
        } finally {
            this.syncing = false;
        }
    }
}

// Khởi tạo service
const syncService = new SyncService();

