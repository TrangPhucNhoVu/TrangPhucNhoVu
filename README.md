# Website Cho Thuê Trang Phục Nhớ Vũ

Hệ thống quản lý cho thuê trang phục với Firebase và Google Sheets, bao gồm trang chủ, giỏ hàng, hóa đơn và trang quản trị. Hỗ trợ đồng bộ 2 chiều giữa Firebase và Google Sheets.

## 📋 Mục Lục

- [Tính Năng](#tính-năng)
- [Cài Đặt](#cài-đặt)
- [Cấu Hình Firebase](#cấu-hình-firebase)
- [Cấu Hình Google Sheets](#cấu-hình-google-sheets)
- [Cấu Trúc Dự Án](#cấu-trúc-dự-án)
- [Hướng Dẫn Sử Dụng](#hướng-dẫn-sử-dụng)

## ✨ Tính Năng

### Trang Chủ (index.html)
- Hiển thị danh sách sản phẩm từ Firebase
- Giỏ hàng với localStorage
- Thêm sản phẩm vào giỏ hàng
- Đặt hàng và tạo đơn hàng
- Hiển thị thông tin tồn kho, giá vốn, giá thuê
- Badge hiển thị lãi/lỗ cho từng sản phẩm

### Trang Hóa Đơn (hoadon.html)
- Tự động điền thông tin từ đơn hàng
- In hóa đơn A4
- Tính toán tổng tiền, tiền cọc, còn lại
- Thêm/sửa/xóa dòng sản phẩm

### Trang Quản Trị (admin.html)
- **Dashboard**: Thống kê tổng quan
  - Tổng sản phẩm
  - Tổng đơn hàng
  - Tổng doanh thu
  - Đơn hàng chờ xử lý
  - Danh sách đơn hàng mới nhất

- **Quản Lý Sản Phẩm**:
  - Thêm/Sửa/Xóa sản phẩm
  - Tìm kiếm sản phẩm
  - Xem trước ảnh
  - Quản lý số lượng theo size
  - Quản lý giá vốn, giá thuê

- **Quản Lý Đơn Hàng**:
  - Xem danh sách đơn hàng
  - Lọc theo trạng thái (Chờ xử lý, Đã xác nhận, Hoàn thành, Đã hủy)
  - Cập nhật trạng thái đơn hàng
  - Xem chi tiết đơn hàng
  - In hóa đơn

- **Thống Kê**:
  - Doanh thu hôm nay
  - Doanh thu tuần này
  - Doanh thu tháng này
  - Top sản phẩm bán chạy

## 🚀 Cài Đặt

1. **Clone hoặc tải dự án về máy**

2. **Cài đặt Firebase**:
   - Tạo project mới tại [Firebase Console](https://console.firebase.google.com)
   - Bật Firestore Database
   - Lấy thông tin config

3. **Cấu hình Firebase**:
   - Mở file `firebase-config.js`
   - Thay thế các giá trị bằng thông tin từ Firebase project của bạn:
     ```javascript
     const firebaseConfig = {
         apiKey: "YOUR_API_KEY",
         authDomain: "YOUR_AUTH_DOMAIN",
         projectId: "YOUR_PROJECT_ID",
         storageBucket: "YOUR_STORAGE_BUCKET",
         messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
         appId: "YOUR_APP_ID"
     };
     ```

4. **Chạy dự án**:
   - Mở file `index.html` bằng trình duyệt
   - Hoặc sử dụng local server (khuyến nghị):
     ```bash
     # Sử dụng Python
     python -m http.server 8000
     
     # Hoặc sử dụng Node.js
     npx http-server
     ```

## 🔥 Cấu Hình Firebase

### 1. Tạo Firestore Database

1. Vào Firebase Console → Firestore Database
2. Tạo database mới (chọn chế độ Production hoặc Test)
3. Thiết lập quy tắc bảo mật (cho phép đọc/ghi trong môi trường test):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Chỉ dùng cho test, cần cấu hình bảo mật cho production
    }
  }
}
```

### 2. Tạo Collections

Firestore sẽ tự động tạo collections khi bạn thêm dữ liệu. Cấu trúc dữ liệu:

#### Collection: `products`
```json
{
  "id": "SP01",
  "name": "Váy Cô Dâu",
  "desc": "Mô tả sản phẩm",
  "image": "https://example.com/image.jpg",
  "sizes": {
    "S": 10,
    "M": 20,
    "L": 15,
    "XL": 5
  },
  "importPrice": 500000,
  "rentPrice": 200000,
  "renting": 5,
  "rentalCount": 30
}
```

#### Collection: `orders`
```json
{
  "customerName": "Nguyễn Văn A",
  "customerPhone": "0123456789",
  "customerAddress": "123 Đường ABC",
  "items": [
    {
      "productId": "SP01",
      "name": "Váy Cô Dâu",
      "quantity": 1,
      "price": 200000
    }
  ],
  "total": 200000,
  "status": "pending",
  "createdAt": "2024-01-01T00:00:00Z",
  "rentalDate": "2024-01-01"
}
```

### 3. Thêm Dữ Liệu Mẫu

Bạn có thể thêm sản phẩm mẫu từ trang Admin hoặc thêm trực tiếp trong Firestore Console.

## 📁 Cấu Trúc Dự Án

```
.
├── index.html                    # Trang chủ - Hiển thị sản phẩm và giỏ hàng
├── hoadon.html                   # Trang hóa đơn - In hóa đơn
├── admin.html                    # Trang quản trị - Quản lý sản phẩm và đơn hàng
├── firebase-config.js            # Cấu hình Firebase
├── google-sheets-config.js        # Cấu hình Google Sheets (tùy chọn)
├── sync-service.js               # Service đồng bộ Firebase và Google Sheets
├── google-apps-script.js         # Code Google Apps Script (để copy vào Apps Script)
├── README.md                      # File hướng dẫn này
└── HUONG_DAN_GOOGLE_SHEETS.md    # Hướng dẫn chi tiết về Google Sheets
```

## 📖 Hướng Dẫn Sử Dụng

### Cho Khách Hàng

1. **Xem Sản Phẩm**:
   - Mở `index.html`
   - Xem danh sách sản phẩm với thông tin chi tiết

2. **Thêm Vào Giỏ Hàng**:
   - Click nút "Thêm" hoặc "Lên đơn ngay"
   - Sản phẩm sẽ được thêm vào giỏ hàng

3. **Thanh Toán**:
   - Click vào icon giỏ hàng ở header
   - Xem các sản phẩm trong giỏ hàng
   - Click "Thanh toán"
   - Nhập thông tin khách hàng
   - Hệ thống sẽ tạo đơn hàng và chuyển đến trang hóa đơn

### Cho Quản Trị Viên

1. **Truy Cập Trang Admin**:
   - Click "Admin" ở header hoặc mở trực tiếp `admin.html`

2. **Quản Lý Sản Phẩm**:
   - Vào mục "Sản Phẩm"
   - Click "Thêm Sản Phẩm" để thêm mới
   - Click "Sửa" để chỉnh sửa
   - Click "Xóa" để xóa sản phẩm

3. **Quản Lý Đơn Hàng**:
   - Vào mục "Đơn Hàng"
   - Xem danh sách đơn hàng
   - Lọc theo trạng thái
   - Cập nhật trạng thái đơn hàng
   - Click "Xem" để xem chi tiết
   - Click "In Hóa Đơn" để in hóa đơn

4. **Xem Thống Kê**:
   - Vào mục "Thống Kê"
   - Xem doanh thu theo ngày/tuần/tháng
   - Xem top sản phẩm bán chạy

## 🔒 Bảo Mật

⚠️ **Lưu ý**: Cấu hình Firestore rules hiện tại cho phép đọc/ghi tự do, chỉ phù hợp cho môi trường test. 

Cho môi trường production, bạn cần:
1. Thiết lập Authentication
2. Cấu hình Firestore Rules phù hợp
3. Bảo vệ API keys

## 📊 Cấu Hình Google Sheets (Tùy chọn)

Hệ thống hỗ trợ đồng bộ 2 chiều với Google Sheets. Khi bạn thay đổi dữ liệu ở một nơi, nó sẽ tự động cập nhật ở nơi còn lại.

### Tính năng:
- ✅ Đồng bộ tự động khi thêm/sửa/xóa sản phẩm
- ✅ Đồng bộ tự động khi tạo/cập nhật đơn hàng
- ✅ Đồng bộ thủ công từ Dashboard
- ✅ Xem và chỉnh sửa dữ liệu trực tiếp trong Google Sheets

### Cách thiết lập:

**Xem hướng dẫn chi tiết trong file:** [`HUONG_DAN_GOOGLE_SHEETS.md`](HUONG_DAN_GOOGLE_SHEETS.md)

Tóm tắt:
1. Tạo Google Sheet mới
2. Tạo Google Apps Script (hoặc sử dụng API Key)
3. Cấu hình trong `google-sheets-config.js`
4. Sử dụng nút đồng bộ trong Admin Dashboard

**Lưu ý**: Google Sheets là tính năng tùy chọn. Bạn vẫn có thể sử dụng hệ thống chỉ với Firebase.

## 🛠️ Công Nghệ Sử Dụng

- **HTML5/CSS3**: Giao diện
- **JavaScript**: Logic xử lý
- **Firebase Firestore**: Database chính
- **Google Sheets API**: Đồng bộ dữ liệu (tùy chọn)
- **Google Apps Script**: Web App để đồng bộ (tùy chọn)
- **Font Awesome**: Icons
- **LocalStorage**: Lưu giỏ hàng tạm thời

## 📝 Ghi Chú

- Giỏ hàng được lưu trong localStorage, sẽ mất khi xóa cache trình duyệt
- Hóa đơn có thể in trực tiếp từ trình duyệt (Ctrl+P hoặc Cmd+P)
- Tất cả dữ liệu được lưu trữ trên Firebase Firestore

## 🐛 Xử Lý Lỗi

Nếu gặp lỗi:
1. Kiểm tra kết nối internet
2. Kiểm tra cấu hình Firebase trong `firebase-config.js`
3. Kiểm tra Firestore Rules
4. Mở Console (F12) để xem lỗi chi tiết

## 📞 Hỗ Trợ

Nếu cần hỗ trợ, vui lòng kiểm tra:
- Firebase Console: https://console.firebase.google.com
- Firebase Documentation: https://firebase.google.com/docs

---

**Chúc bạn sử dụng thành công!** 🎉

