# A06 Financial Forecaster — Frontend Web App

Giao diện web tĩnh (Static Web App) trực quan hóa dữ liệu giá lịch sử và dự báo giá trong tương lai bằng mô hình Deep Learning (Keras GRU, LSTM, PyTorch Vanilla RNN) cho 3 tài sản: Cổ phiếu Amazon (AMZN), Vàng (Gold), và Bạc (Silver).

---

## 1. Công nghệ sử dụng
- **HTML5 & CSS3 thuần** (Vanilla): Không dùng framework nặng, không cần bước build (`npm run build`).
- **JavaScript thuần** (Vanilla ES6+).
- **Chart.js** (v4.4.x via CDN): Vẽ biểu đồ thời gian thực với đường giá lịch sử và nét đứt dự đoán nối tiếp.
- **Thiết kế**: Giao diện tối hiện đại (Modern Dark Theme), chuẩn tài chính/fintech, hỗ trợ Responsive toàn diện cho máy tính và thiết bị di động.

---

## 2. Cấu hình Backend URL
Tại đầu file `app.js`, cấu hình biến `API_BASE_URL`:
```javascript
const API_BASE_URL = "http://127.0.0.1:8000"; // TODO: đổi thành URL Render sau khi backend deploy xong
```
- Khi chạy thử cục bộ: giữ nguyên `http://127.0.0.1:8000`.
- Khi backend được deploy lên Render: thay bằng URL dịch vụ (ví dụ: `https://a06-rnn-api.onrender.com`).
- *Mẹo tiện ích:* Bạn cũng có thể bấm vào icon bánh răng ⚙️ ở góc trên bên phải giao diện web để đổi nhanh URL Backend mà không cần sửa code.

---

## 3. Cách chạy cục bộ (Local Development)

### Cách 1: Chạy với Python HTTP Server (Khuyên dùng)
Mở terminal tại thư mục `frontend/` và chạy:
```bash
# Python 3
python -m http.server 3000
```
Sau đó truy cập: [http://localhost:3000](http://localhost:3000)

### Cách 2: Mở trực tiếp file `index.html`
- Click đúp trực tiếp vào file `index.html` trên máy tính hoặc mở bằng trình duyệt (Chrome, Edge, Firefox).

---

## 4. Cách deploy lên GitHub Pages

Vì đây là web tĩnh 100% không cần build step, việc deploy lên GitHub Pages rất đơn giản:

1. **Cách A (Nếu repo chỉ chứa frontend):**
   - Đẩy toàn bộ các file trong thư mục `frontend/` (`index.html`, `styles.css`, `app.js`) lên nhánh `main` của GitHub repository.
   - Vào **Settings** của repository &rarr; mục **Pages**.
   - Tại phần **Branch**, chọn `main` và thư mục `/ (root)`, sau đó nhấn **Save**.
   - Sau 1-2 phút, trang web sẽ trực tiếp hoạt động tại `https://<username>.github.io/<repo-name>/`.

2. **Cách B (Nếu repo chung cả backend và frontend):**
   - Đặt thư mục `frontend` vào repo.
   - Sử dụng GitHub Actions hoặc cấu hình Pages trỏ vào thư mục `/docs` (bằng cách copy nội dung `frontend/` sang `docs/`), hoặc dùng action `JamesIves/github-pages-deploy-action` để deploy riêng thư mục `frontend/`.

---

## 5. Lưu ý về Backend Render Cold-Start
Backend triển khai trên Render gói miễn phí (Free Tier) sẽ tự động "ngủ" sau một khoảng thời gian không có lượt truy cập.
- Khi người dùng gửi request đầu tiên, backend có thể mất **30–60 giây** để khởi động lại máy chủ (Spin-up).
- Giao diện đã được thiết kế sẵn thông báo thân thiện và thanh trạng thái tự động hiển thị để người dùng biết máy chủ đang thức giấc, tránh tình trạng tưởng nhầm trang bị treo.

