# Prompt cho Codex CLI — Backend + Deploy (chạy trong thư mục `A06/webapp/`)

Dán nguyên văn phần dưới đây làm prompt đầu tiên cho Codex CLI, chạy với working directory
là `D:\HOCTAP\PTHTTM\A06\webapp`.

---

Bạn là backend engineer. Nhiệm vụ: xây dựng một FastAPI service để serve 3 mô hình
RNN/GRU dự đoán giá (cổ phiếu Amazon, vàng, bạc) đã được huấn luyện sẵn, rồi deploy lên
Render.com. KHÔNG train lại model — chỉ load model có sẵn và phục vụ inference qua REST API.

## Việc 1 — Đọc kỹ 2 file trước khi code

1. Đọc `API_CONTRACT.md` ở thư mục gốc project (`A06/webapp/API_CONTRACT.md`) — đây là
   đặc tả API BẮT BUỘC phải tuân thủ chính xác (đường dẫn endpoint, tên field JSON, định
   dạng response, định dạng lỗi). Một đội khác đang code frontend dựa đúng trên file này,
   nên sai lệch dù nhỏ (tên field, path) sẽ làm frontend không gọi được.
2. Xem cấu trúc file đã có sẵn trong `backend/app/assets/{amzn,gold,silver}/` — đó là
   model/scaler/CSV thật đã train xong, đường dẫn đã đúng theo API_CONTRACT.md, không cần
   di chuyển hay đổi tên.

## Việc 2 — Cấu trúc project

Tạo trong `backend/`:
```
backend/
  app/
    main.py              # FastAPI app, định nghĩa 4 route theo đúng API_CONTRACT.md
    assets/               # ĐÃ CÓ SẴN — đừng xoá/đổi tên các file bên trong
      amzn/  gold/  silver/
    models.py             # load 3 model (lazy load, load 1 lần khi app start)
    inference.py          # hàm predict_next_n(asset_id, days_ahead) dùng chung logic
                           # recursive forecasting mô tả trong API_CONTRACT.md mục 5
    schemas.py            # Pydantic models cho request/response
  requirements.txt
  render.yaml             # Blueprint Render.com (xem Việc 4)
  README.md               # hướng dẫn chạy local + deploy
```

## Việc 3 — Cài đặt đúng 3 model (đọc kỹ bảng trong API_CONTRACT.md mục 5)

- `amzn`: Keras GRU, `sequence_length=60`, cột `Close` trong `assets/amzn/AMZN.csv`.
- `gold`: Keras LSTM, `sequence_length=10`, cột `price` trong `assets/gold/gold_price.csv`
  (có thể có NaN — phải `dropna()` trước khi lấy các điểm cuối).
- `silver`: PyTorch, `sequence_length=10`, cột `price` trong
  `assets/silver/silver_price.csv` (cũng có NaN). File `.pth` chỉ chứa `state_dict` —
  PHẢI định nghĩa lại đúng class `VanillaRNN` (copy chính xác từ API_CONTRACT.md mục 5,
  đừng tự đoán kiến trúc khác) rồi `load_state_dict()`.

Cả 3 đều dùng `MinMaxScaler` (sklearn, đã fit sẵn, load bằng `joblib.load(...)`) —
`scaler.transform()` trước khi đưa vào model, `scaler.inverse_transform()` sau khi model
trả kết quả, để trả về giá trị USD thật chứ không phải giá trị đã chuẩn hoá 0..1.

Implement đúng thuật toán "recursive forecasting" ở mục 5 của API_CONTRACT.md cho
`days_ahead > 1`: mỗi bước dự đoán xong phải nối vào cuối chuỗi (đã chuẩn hoá) và bỏ phần
tử đầu, rồi dự đoán tiếp — không phải chạy lại model 1 lần cho toàn bộ N bước.

## Việc 4 — requirements.txt và deploy

- `requirements.txt` cần: `fastapi`, `uvicorn[standard]`, `tensorflow-cpu` (hoặc
  `tensorflow`), `torch` (bản CPU, dùng `--index-url https://download.pytorch.org/whl/cpu`
  nếu cần ghi rõ trong README để tránh tải bản GPU quá nặng), `scikit-learn`, `joblib`,
  `pandas`, `numpy`.
- Bật CORS: `allow_origins=["*"]`, `allow_methods=["*"]`, `allow_headers=["*"]`.
- Viết `render.yaml` kiểu Blueprint cho Render.com, service Python, start command:
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Free tier Render ngủ sau 15 phút
  không dùng — ghi chú rõ điều này trong README (lần gọi đầu sau khi ngủ sẽ mất
  30-50 giây để "thức dậy", đây là lý do có endpoint `/api/health`).
- README.md backend phải có: cách chạy local (`uvicorn app.main:app --reload`), cách test
  nhanh bằng `curl` cho cả 4 endpoint, và các bước deploy lên Render (tạo Web Service mới
  từ repo GitHub, hoặc dùng `render.yaml` Blueprint).

## Việc 5 — Kiểm thử trước khi báo xong

1. Chạy `uvicorn app.main:app --reload` tại `backend/`, gọi thử cả 4 endpoint bằng `curl`
   hoặc Python `requests`, với cả 3 `asset_id` (`amzn`, `gold`, `silver`), kiểm tra:
   - `/api/predict/amzn` với `days_ahead=5` trả về 5 điểm, giá trị nằm trong khoảng hợp lý
     (so với giá gần nhất trong `assets/amzn/AMZN.csv`, không phải số 0..1 hay số âm/vô lý).
   - `/api/predict/silver` (model PyTorch) chạy không lỗi — đây là phần dễ sai kiến trúc
     nhất, kiểm tra kỹ.
   - `/api/history/gold?limit=50` trả đúng 50 điểm gần nhất, không có NaN trong mảng
     `prices`.
2. Nếu có lỗi shape/kiểu dữ liệu, tự sửa — không cần hỏi lại, cứ đối chiếu API_CONTRACT.md.
3. Khi mọi endpoint chạy đúng local, commit code (chưa cần push/deploy nếu chưa có repo
   git sẵn — nếu đã có `.git` ở thư mục cha thì tạo branch mới, đừng commit thẳng vào
   `main`/`master`).

Không cần hỏi lại tôi về lựa chọn công nghệ (đã chốt: FastAPI + Render) — nếu gặp quyết
định nhỏ không ảnh hưởng tới API_CONTRACT.md thì tự quyết và ghi chú lại trong README.
