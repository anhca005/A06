# Kế hoạch điều phối — Deploy web A06 (RNN/GRU dự đoán giá)

## Tài sản đã chuẩn bị sẵn

Đã copy 3 bộ model/scaler/CSV thật (không phải giả) vào đúng chỗ backend cần:
```
A06/webapp/backend/app/assets/amzn/    (GRU Keras, 60 bước, giá AMZN)
A06/webapp/backend/app/assets/gold/    (LSTM Keras, 10 bước, giá vàng)
A06/webapp/backend/app/assets/silver/  (Vanilla RNN PyTorch, 10 bước, giá bạc)
```

## 3 file bạn cần dùng

1. **`API_CONTRACT.md`** — đặc tả API dùng chung. Cả 2 AI đều phải đọc file này trước.
   Đây là "keo dán" giữ cho 2 bên code độc lập vẫn ghép khớp.
2. **`PROMPT_CODEX_BACKEND.md`** — dán nguyên văn cho **Codex CLI**, chạy trong
   `A06/webapp/`. Codex làm: FastAPI backend, cài đặt đúng 3 model, deploy Render.
3. **`PROMPT_GEMINI_FRONTEND.md`** — dán nguyên văn cho **Gemini CLI**, chạy trong
   `A06/webapp/`. Gemini làm: trang web tĩnh (HTML/CSS/JS + Chart.js), deploy GitHub Pages.

## Thứ tự chạy khuyến nghị

Hai prompt có thể chạy **song song** (mỗi cái một cửa sổ terminal riêng, cùng trỏ vào
`A06/webapp/`) vì `API_CONTRACT.md` đã cố định sẵn giao diện giữa 2 bên — Codex không cần
đợi Gemini và ngược lại. Nếu muốn an toàn hơn thì chạy Codex trước, đợi backend chạy local
được (`uvicorn ... --reload` ở `localhost:8000`) rồi mới chạy Gemini, để Gemini có backend
thật để test thay vì phải tự mock.

## Sau khi cả 2 xong — việc của bạn (và tôi sẽ hỗ trợ kiểm tra)

1. Chạy backend local, gọi thử `curl http://127.0.0.1:8000/api/health` và
   `curl -X POST http://127.0.0.1:8000/api/predict/amzn -d "{\"days_ahead\":5}" -H "Content-Type: application/json"`
   — báo tôi nếu lỗi, tôi đọc log giúp.
2. Deploy backend lên Render theo README Codex viết ra, lấy URL thật (dạng
   `https://xxx.onrender.com`).
3. Sửa đúng 1 dòng `API_BASE_URL` trong file JS của frontend thành URL Render đó.
4. Deploy frontend lên GitHub Pages, gửi tôi 2 link (backend Render + frontend Pages) —
   tôi sẽ tự mở và kiểm tra tích hợp thật (giống cách tôi từng làm với web app Assignment
   02), báo lại nếu có chỗ nào 2 bên không khớp.

## Trạng thái hiện tại (đã cập nhật)

- ✅ Codex CLI đã build xong `backend/` — đã tôi tự kiểm thử thật cả 4 endpoint bằng môi
  trường TensorFlow sẵn có (không chỉ đọc code), gồm cả 2 model Keras mà Codex không tự
  test được.
- 🐛 **Phát hiện và đã vá**: model AMZN có `scaler.pkl` fit trên khoảng giá cũ hơn
  ($0.07–$94.93) trong khi `AMZN.csv` đi kèm đã có giá tới ~$186 — khiến dự đoán ban đầu bị
  lệch nặng (giảm ~20% liên tục 5 ngày, vô lý). Đã vá bằng cách clip giá trị đầu vào về đúng
  khoảng scaler đã fit trước khi chuẩn hoá (giữ nguyên model/scaler gốc của thành viên làm
  AMZN, không sửa file của họ). API giờ trả thêm field `note` giải thích khi việc clip này
  xảy ra — đã cập nhật cả `API_CONTRACT.md` và `PROMPT_GEMINI_FRONTEND.md` để Gemini hiển
  thị cảnh báo này rõ ràng trên UI.
- Gold/Silver không gặp vấn đề này, dự đoán ổn định ngay từ đầu.
- Backend CHƯA deploy lên Render thật (Codex không có tài khoản/thông tin đăng nhập) —
  `render.yaml` + hướng dẫn trong `backend/README.md` đã sẵn sàng, bạn cần tự tạo Web
  Service trên Render (connect GitHub repo hoặc Blueprint) khi muốn deploy thật.
- Nếu muốn độ chính xác AMZN tốt hơn về lâu dài, cách đúng gốc là nhờ người train lại fit
  scaler trên toàn bộ `AMZN.csv` — bản vá hiện tại chỉ là biện pháp an toàn tạm thời, không
  thay thế việc đó.

## Lưu ý quan trọng

- Model `best_model_Bạc.pth` (bạc) chỉ lưu trọng số (state_dict) — Codex PHẢI định nghĩa
  lại đúng kiến trúc PyTorch (đã ghi sẵn nguyên văn trong `API_CONTRACT.md` mục 5), nếu
  Codex tự đoán kiến trúc khác sẽ load lỗi hoặc dự đoán sai mà không báo lỗi gì — đây là
  chỗ dễ sai nhất, nhớ nhắc Codex kiểm tra kỹ output có hợp lý không (so với giá gần nhất
  trong `silver_price.csv`), không chỉ kiểm tra "chạy không crash".
- Render free tier tự ngủ sau 15 phút — lần gọi API đầu tiên sau khi ngủ mất 30–50 giây,
  đã yêu cầu Gemini xử lý UI loading cho trường hợp này.
