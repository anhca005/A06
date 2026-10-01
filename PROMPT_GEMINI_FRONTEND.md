# Prompt cho Gemini CLI — Frontend (chạy trong thư mục `A06/webapp/`)

Dán nguyên văn phần dưới đây làm prompt đầu tiên cho Gemini CLI, chạy với working
directory là `D:\HOCTAP\PTHTTM\A06\webapp`.

---

Bạn là frontend engineer. Nhiệm vụ: xây dựng một trang web tĩnh (không cần build
step/framework nặng) để người dùng xem biểu đồ giá lịch sử và xin dự đoán giá những ngày
tới cho 3 tài sản (cổ phiếu Amazon, vàng, bạc), gọi tới một REST API backend đã có sẵn
(do một kỹ sư khác làm riêng — bạn không cần và không được sửa code backend).

## Việc 1 — Đọc kỹ API_CONTRACT.md trước khi code

Đọc file `API_CONTRACT.md` ở thư mục gốc project (`A06/webapp/API_CONTRACT.md`) — đây là
đặc tả ĐẦY ĐỦ và CHÍNH XÁC của API bạn sẽ gọi (4 endpoint, định dạng JSON request/response).
Code frontend PHẢI khớp chính xác với file này (tên field, path, kiểu dữ liệu) — backend
được code độc lập dựa trên đúng file đó, nên đừng đoán hay tự đổi tên field.

## Việc 2 — Yêu cầu sản phẩm

Tạo trong thư mục `frontend/`: một trang web thuần HTML/CSS/JavaScript (vanilla, KHÔNG dùng
React/Vue/build tool — để deploy được thẳng lên GitHub Pages/Netlify dạng static site,
không cần bước build). Dùng thư viện **Chart.js** qua CDN để vẽ biểu đồ đường.

Giao diện tiếng Việt, có các phần sau:

1. **Chọn tài sản**: 3 tab hoặc nút chọn — "Cổ phiếu Amazon (AMZN)", "Vàng", "Bạc". Khi
   load trang, gọi `GET /api/assets` để lấy danh sách + metadata (tên hiển thị, đơn vị,
   framework dùng) hiển thị dưới mỗi tab/nút (ví dụ "Keras GRU", "PyTorch Vanilla RNN").
2. **Biểu đồ giá lịch sử**: khi chọn 1 tài sản, gọi `GET /api/history/{asset_id}?limit=200`
   và vẽ đường giá thật 200 phiên gần nhất (trục X = ngày, trục Y = giá, đơn vị lấy từ
   field `unit` trong response).
3. **Điều khiển dự đoán**: một ô chọn số ngày muốn dự đoán tiếp (slider hoặc input number,
   giá trị 1–30, mặc định 5) và nút "Dự đoán". Khi bấm, gọi
   `POST /api/predict/{asset_id}` với body `{"days_ahead": <giá trị đã chọn>}`.
4. **Hiển thị kết quả dự đoán**: vẽ thêm các điểm dự đoán NỐI TIẾP ngay sau điểm cuối của
   đường giá thật trên CÙNG một biểu đồ, bằng màu khác và nét đứt (để phân biệt rõ với dữ
   liệu thật) — không vẽ biểu đồ riêng. Đồng thời hiển thị một bảng nhỏ liệt kê từng ngày
   dự đoán + giá dự đoán (làm tròn 2 chữ số thập phân) bên dưới biểu đồ.
   - Response của `/api/predict/{asset_id}` có thêm field `note` (string hoặc `null`) — CHỈ
     khác `null` với tài sản `amzn` khi giá hiện tại vượt khoảng dữ liệu model được huấn
     luyện (đã xảy ra thật, xem `API_CONTRACT.md`). Khi `note` khác `null`, PHẢI hiển thị
     rõ ràng dòng cảnh báo này (ví dụ banner nền vàng nhạt phía trên bảng kết quả dự đoán,
     icon ⚠️), không được bỏ qua — đây là cảnh báo về độ tin cậy kết quả, người dùng cần
     thấy ngay, không chỉ log console.
5. **Trạng thái loading/lỗi**:
   - Khi đang gọi API (đặc biệt lần đầu, vì backend chạy trên Render free tier có thể
     "ngủ" và mất 30–50 giây để phản hồi lần gọi đầu tiên sau khi không dùng), hiển thị rõ
     dòng chữ kiểu "Đang khởi động máy chủ, có thể mất tới 1 phút cho lần gọi đầu tiên..."
     thay vì để người dùng tưởng trang bị treo.
   - Nếu API lỗi (network error, 404, 422, 500), hiển thị thông báo lỗi thân thiện, không
     để trang trắng hay console error im lặng.
6. **Responsive**: dùng được tốt trên cả màn hình máy tính và điện thoại (CSS Flexbox/Grid
   cơ bản là đủ, không cần framework CSS).

## Việc 3 — Cấu hình URL backend

Ở đầu file JS chính, khai báo RÕ RÀNG một hằng số dễ tìm:
```js
const API_BASE_URL = "http://127.0.0.1:8000"; // TODO: đổi thành URL Render sau khi backend deploy xong
```
Đừng hardcode URL rải rác nhiều chỗ — chỉ sửa 1 dòng này là đổi được môi trường.

## Việc 4 — Kiểm thử

Vì backend có thể CHƯA chạy khi bạn code xong, hãy:
1. Viết một backend giả lập tối thiểu (mock) CHỈ để tự kiểm thử UI — ví dụ một file JSON
   tĩnh hoặc một script Python `http.server` đơn giản trả đúng format của API_CONTRACT.md
   — rồi xoá/bỏ qua phần mock này sau khi xác nhận UI chạy đúng (không commit code mock
   vào `frontend/`, chỉ dùng tạm để tự test).
2. Nếu vào lúc bạn code mà backend thật (`http://127.0.0.1:8000`, được một kỹ sư khác chạy
   song song) đã sẵn sàng, ưu tiên test trực tiếp với backend thật thay vì mock.
3. Mở trang bằng trình duyệt thật (không chỉ đọc code), thử cả 3 tab, thử đổi số ngày dự
   đoán, thử bấm dự đoán nhiều lần liên tiếp, kiểm tra biểu đồ cập nhật đúng và không bị
   vẽ chồng lên lần cũ.

## Việc 5 — Bàn giao

Viết `frontend/README.md` ngắn gọn: cách mở trang local (mở thẳng `index.html` hoặc chạy
`python -m http.server`), cách deploy lên GitHub Pages (chỉ cần push thư mục `frontend/`
lên 1 repo GitHub rồi bật Pages trỏ vào nhánh/thư mục đó — không cần build step).

Không cần hỏi lại tôi về lựa chọn công nghệ (đã chốt: vanilla JS + Chart.js + GitHub
Pages) — nếu gặp quyết định nhỏ về UI/UX không ảnh hưởng tới API_CONTRACT.md thì tự quyết.
