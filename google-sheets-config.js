// google-sheets-config.js
// Cấu hình Google Sheets API

const GOOGLE_SHEETS_CONFIG = {
    // ID của Google Sheet (lấy từ URL: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit)
    SHEET_ID: '1MSCSvMj1hxm7JVmgzsP2dCG2ZQT994GPc_Bl4Xhvmek',
    
    // Tên các sheet trong file
    SHEETS: {
        PRODUCTS: 'Products',      // Sheet chứa sản phẩm
        ORDERS: 'Orders'            // Sheet chứa đơn hàng
    },
    
    // API Key (tạo từ Google Cloud Console)
    API_KEY: 'YOUR_API_KEY',
    
    // Hoặc sử dụng OAuth2 (khuyến nghị cho production)
    // Client ID từ Google Cloud Console
    CLIENT_ID: 'YOUR_CLIENT_ID',
    
    // Sử dụng Apps Script Web App URL (phương pháp đơn giản hơn)
    // Tạo Apps Script và deploy as Web App, lấy URL ở đây
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbyuhJsPm0ecBe1YWmgn4w6DAmTns1tm1Gr88H_B-_RVGPOsliPPnwgwPRQfWigeYGjD/exec'
};

// Kiểm tra xem có sử dụng Google Sheets không
// Điều kiện đúng khi:
// - Có SHEET_ID hợp lệ
// - Và có ít nhất 1 cách truy cập: WEB_APP_URL (Apps Script) hoặc API_KEY (Sheets API)
const PLACEHOLDERS = {
    SHEET_ID: 'YOUR_SHEET_ID',
    API_KEY: 'YOUR_API_KEY',
    WEB_APP_URL: 'YOUR_WEB_APP_URL'
};

const hasSheetId =
    !!GOOGLE_SHEETS_CONFIG.SHEET_ID &&
    GOOGLE_SHEETS_CONFIG.SHEET_ID !== PLACEHOLDERS.SHEET_ID;

const hasApiKey =
    !!GOOGLE_SHEETS_CONFIG.API_KEY &&
    GOOGLE_SHEETS_CONFIG.API_KEY !== PLACEHOLDERS.API_KEY;

const hasWebAppUrl =
    !!GOOGLE_SHEETS_CONFIG.WEB_APP_URL &&
    GOOGLE_SHEETS_CONFIG.WEB_APP_URL !== PLACEHOLDERS.WEB_APP_URL;

const USE_GOOGLE_SHEETS = Boolean(hasSheetId && (hasWebAppUrl || hasApiKey));

// Make it available globally
if (typeof window !== 'undefined') {
    window.USE_GOOGLE_SHEETS = USE_GOOGLE_SHEETS;
    window.GOOGLE_SHEETS_CONFIG = GOOGLE_SHEETS_CONFIG;
}

