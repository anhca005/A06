# A06 Financial Forecaster — Frontend Web App

Gồm **2 trang web tĩnh độc lập**, mỗi trang chuyên biệt cho 1 tài sản, cùng gọi chung 1 REST API backend:

- `amzn/` — Dự đoán giá cổ phiếu Amazon (Keras GRU)
- `gold/` — Dự đoán giá Vàng (Keras LSTM)

`index.html` ở thư mục gốc chỉ là trang chủ liên kết tới 2 trang trên (không gọi API).

Mỗi trang con có `index.html`, `app.js`, `styles.css` riêng (độc lập hoàn toàn, không chia sẻ state) — `app.js` của mỗi trang khai báo hằng số `FIXED_ASSET_ID` để chỉ tải đúng 1 tài sản từ `GET /api/assets`.

---

## 1. Công nghệ sử dụng
- **HTML5 & CSS3 thuần** (Vanilla): Không dùng framework nặng, không cần bước build (`npm run build`).
- **JavaScript thuần** (Vanilla ES6+).
- **Chart.js** (v4.4.x via CDN): Vẽ biểu đồ thời gian thực với đường giá lịch sử và nét đứt dự đoán nối tiếp.
- **Thiết kế**: Giao diện tối hiện đại (Modern Dark Theme), chuẩn tài chính/fintech, hỗ trợ Responsive toàn diện cho máy tính và thiết bị di động.

---

## 2. Cấu hình Backend URL
Tại đầu mỗi file `amzn/app.js` và `gold/app.js`, cấu hình biến `API_BASE_URL` (sửa riêng từng file, vì 2 trang độc lập):
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
Sau đó truy cập: [http://localhost:3000](http://localhost:3000) (trang chủ), hoặc thẳng
`http://localhost:3000/amzn/` / `http://localhost:3000/gold/`.

### Cách 2: Mở trực tiếp file `index.html`
- Vào thư mục `amzn/` hoặc `gold/`, click đúp `index.html` để mở bằng trình duyệt.

---

## 4. Cách deploy lên GitHub Pages

Vì đây là web tĩnh 100% không cần build step, việc deploy lên GitHub Pages rất đơn giản:

Repo này dùng GitHub Actions (file `.github/workflows/deploy-pages.yml` ở gốc repo) để
publish toàn bộ thư mục `frontend/` lên GitHub Pages mỗi khi có thay đổi trong `frontend/**`
trên nhánh `main`. Vì `frontend/` chứa 2 thư mục con `amzn/` và `gold/`, kết quả là **2 URL
độc lập** dưới cùng 1 domain Pages:

- `https://<username>.github.io/<repo-name>/amzn/`
- `https://<username>.github.io/<repo-name>/gold/`
- `https://<username>.github.io/<repo-name>/` — trang chủ liên kết tới 2 trang trên.

Bật Pages: **Settings &rarr; Pages &rarr; Build and deployment &rarr; Source**, chọn
**GitHub Actions** (không chọn nhánh/thư mục thủ công).

---

## 5. Lưu ý về Backend Render Cold-Start
Backend triển khai trên Render gói miễn phí (Free Tier) sẽ tự động "ngủ" sau một khoảng thời gian không có lượt truy cập.
- Khi người dùng gửi request đầu tiên, backend có thể mất **30–60 giây** để khởi động lại máy chủ (Spin-up).
- Giao diện đã được thiết kế sẵn thông báo thân thiện và thanh trạng thái tự động hiển thị để người dùng biết máy chủ đang thức giấc, tránh tình trạng tưởng nhầm trang bị treo.

