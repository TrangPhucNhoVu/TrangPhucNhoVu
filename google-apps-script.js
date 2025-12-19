// google-apps-script.js
// Code này cần được copy vào Google Apps Script
// Vào: https://script.google.com -> Tạo project mới -> Dán code này

// Lấy ID của Google Sheet từ URL
const DEFAULT_SHEET_ID = '1MSCSvMj1hxm7JVmgzsP2dCG2ZQT994GPc_Bl4Xhvmek'; // Thay bằng ID sheet của bạn

function getSheetIdFromRequest(e) {
  // Allow passing sheetId from client config to avoid “sync ok but wrote to another file” issues.
  // GET: ?sheetId=...
  // POST: { sheetId: "..." }
  try {
    if (e && e.parameter && e.parameter.sheetId) return String(e.parameter.sheetId);
  } catch (_) {}
  return DEFAULT_SHEET_ID;
}

function withCors(textOutput) {
  // Add CORS headers so browser fetch() from localhost works.
  // Some deployments may not support setting headers; fail-safe in that case.
  try {
    textOutput.setHeader('Access-Control-Allow-Origin', '*');
    textOutput.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    textOutput.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  } catch (e) {
    // ignore
  }
  return textOutput;
}

function out(obj, callback) {
  // Support JSONP for browser clients that are blocked by CORS/redirects.
  if (callback) {
    // NOTE: JSONP bypasses CORS, but only works for GET.
    return withCors(
      ContentService.createTextOutput(`${callback}(${JSON.stringify(obj)});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
    );
  }
  return withCors(
    ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

function doGet(e) {
  const action = e.parameter.action;
  const sheetName = e.parameter.sheet;
  const sheetId = getSheetIdFromRequest(e);
  const callback = e.parameter.callback;
  
  if (action === 'read') {
    return readSheet(sheetId, sheetName, callback);
  } else if (action === 'clear') {
    return clearSheet(sheetId, sheetName, callback);
  } else if (action === 'delete') {
    const value = e.parameter.value;
    const column = parseInt(e.parameter.column);
    return deleteRow(sheetId, sheetName, value, column, callback);
  } else if (action === 'info') {
    return out({
      success: true,
      sheetId: sheetId,
      defaultSheetId: DEFAULT_SHEET_ID
    }, callback);
  }
  
  return out({ error: 'Invalid action' }, callback);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  const sheetName = data.sheet;
  const values = data.values;
  const sheetId = data.sheetId || DEFAULT_SHEET_ID;
  
  if (action === 'write') {
    return writeSheet(sheetId, sheetName, values);
  }
  
  return out({ error: 'Invalid action' }, null);
}

function readSheet(sheetId, sheetName, callback) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return out({ error: 'Sheet not found', sheetId: sheetId, sheet: sheetName }, callback);
    }
    
    const data = sheet.getDataRange().getValues();
    
    return out({ values: data }, callback);
  } catch (error) {
    return out({ error: error.toString() }, callback);
  }
}

function writeSheet(sheetId, sheetName, values) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // Thêm header nếu là sheet mới
      if (sheetName === 'Products') {
        sheet.appendRow(['ID', 'Tên', 'Mô Tả', 'Ảnh', 'Sizes (JSON)', 'Giá Vốn', 'Giá Thuê', 'Đang Thuê', 'Lượt Đã Thuê']);
      } else if (sheetName === 'Orders') {
        sheet.appendRow(['ID', 'Tên KH', 'SĐT', 'Địa Chỉ', 'Items (JSON)', 'Tổng Tiền', 'Trạng Thái', 'Ngày Tạo', 'Ngày Thuê']);
      }
    }
    
    // Xóa dữ liệu cũ
    sheet.clear();
    
    // Thêm header
    if (sheetName === 'Products') {
      sheet.appendRow(['ID', 'Tên', 'Mô Tả', 'Ảnh', 'Sizes (JSON)', 'Giá Vốn', 'Giá Thuê', 'Đang Thuê', 'Lượt Đã Thuê']);
    } else if (sheetName === 'Orders') {
      sheet.appendRow(['ID', 'Tên KH', 'SĐT', 'Địa Chỉ', 'Items (JSON)', 'Tổng Tiền', 'Trạng Thái', 'Ngày Tạo', 'Ngày Thuê']);
    }
    
    // Ghi dữ liệu mới
    if (values && values.length > 0) {
      values.forEach(row => {
        sheet.appendRow(row);
      });
    }
    
    return out({ success: true }, null);
  } catch (error) {
    return out({ error: error.toString() }, null);
  }
}

function clearSheet(sheetId, sheetName, callback) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (sheet) {
      sheet.clear();
    }
    
    return out({ success: true }, callback);
  } catch (error) {
    return out({ error: error.toString() }, callback);
  }
}

function deleteRow(sheetId, sheetName, searchValue, columnIndex, callback) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return out({ error: 'Sheet not found' }, callback);
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][columnIndex] === searchValue) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    
    return out({ success: true }, callback);
  } catch (error) {
    return out({ error: error.toString() }, callback);
  }
}

