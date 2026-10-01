# API Contract — A06 RNN/GRU Price Prediction Web App

Nguồn chân lý duy nhất cho giao tiếp Backend ↔ Frontend. Cả `backend/` (Codex CLI) và
`frontend/` (Gemini CLI) đều phải tuân thủ đúng hợp đồng này — đây là cách hai AI làm
việc độc lập vẫn ghép nối đúng với nhau.

Base URL (dev): `http://127.0.0.1:8000`
Base URL (prod): sẽ là URL Render sau khi deploy, ví dụ `https://a06-rnn-api.onrender.com`

Tất cả response đều là JSON. CORS bật `allow_origins=["*"]` (backend public, không có auth).

---

## 1. `GET /api/health`

Kiểm tra server sống (cũng dùng để "đánh thức" Render free tier từ sleep).

**Response 200**
```json
{ "status": "ok" }
```

---

## 2. `GET /api/assets`

Danh sách 3 tài sản khả dụng + metadata hiển thị trên UI.

**Response 200**
```json
[
  {
    "id": "amzn",
    "name": "Amazon (AMZN) — Giá đóng cửa",
    "unit": "USD",
    "framework": "Keras GRU",
    "sequence_length": 60
  },
  {
    "id": "gold",
    "name": "Vàng",
    "unit": "USD/Ounce",
    "framework": "Keras LSTM",
    "sequence_length": 10
  },
  {
    "id": "silver",
    "name": "Bạc",
    "unit": "USD/Ounce",
    "framework": "PyTorch Vanilla RNN",
    "sequence_length": 10
  }
]
```

`id` ∈ {`amzn`, `gold`, `silver`} — dùng làm `{asset_id}` ở 2 endpoint dưới.

---

## 3. `GET /api/history/{asset_id}?limit=200`

Dữ liệu lịch sử THẬT (không phải dự đoán) để vẽ biểu đồ nền. `limit` optional, default 200,
max 2000 — trả về `limit` điểm dữ liệu **gần nhất** (cuối chuỗi thời gian), theo đúng thứ tự
thời gian tăng dần.

**Response 200**
```json
{
  "asset_id": "amzn",
  "unit": "USD",
  "dates": ["2024-01-02", "2024-01-03", "..."],
  "prices": [148.04, 149.1, 150.2]
}
```

**Response 404** nếu `asset_id` không hợp lệ:
```json
{ "detail": "Unknown asset_id: xyz" }
```

---

## 4. `POST /api/predict/{asset_id}`

Dự đoán N bước tiếp theo bằng cách lặp lại (recursive forecasting): dự đoán bước 1, nối giá
trị đó vào cuối chuỗi, bỏ điểm cũ nhất ra, dự đoán bước 2, lặp lại đến khi đủ `days_ahead`.

**Request body** (JSON, tất cả optional)
```json
{ "days_ahead": 5 }
```
- `days_ahead`: số nguyên, mặc định `5`, giới hạn `1..30`. Nếu client không gửi body, dùng
  mặc định.

**Response 200**
```json
{
  "asset_id": "amzn",
  "unit": "USD",
  "last_known_date": "2024-06-10",
  "last_known_price": 180.23,
  "predictions": [
    { "date": "2024-06-11", "predicted_price": 181.05 },
    { "date": "2024-06-12", "predicted_price": 181.80 }
  ],
  "note": null
}
```
- `note` (string hoặc `null`): khác `null` trong 2 trường hợp — (1) giá đầu vào hiện tại nằm
  ngoài khoảng dữ liệu mà scaler/model được huấn luyện (hiếm gặp sau khi đã retrain trên dữ
  liệu live đến hiện tại, nhưng vẫn giữ làm lưới an toàn), hoặc (2) với `amzn`/`gold`, không
  lấy được giá trực tuyến từ Yahoo Finance lúc đó nên hệ thống đang dùng dữ liệu CSV nội bộ
  (có thể không phải phiên gần nhất thật). Khi `note` khác `null`, **frontend PHẢI hiển thị
  rõ ràng** dòng cảnh báo này cho người dùng (ví dụ banner màu vàng phía trên bảng kết quả dự
  đoán), không được bỏ qua hay chỉ log ra console.
- `date` của mỗi điểm dự đoán = ngày lịch tăng dần +1 ngày mỗi bước kể từ
  `last_known_date` (xấp xỉ đơn giản, KHÔNG cần loại trừ cuối tuần/ngày lễ — ghi chú rõ
  trong UI rằng đây là "phiên kế tiếp", không phải ngày dương lịch chính xác).
- `predicted_price` đã được `scaler.inverse_transform()` về đúng đơn vị gốc (USD hoặc
  USD/Ounce), KHÔNG trả giá trị đã chuẩn hoá (0..1).

**Response 422** nếu `days_ahead` ngoài khoảng 1..30, hoặc 404 nếu `asset_id` sai, theo
đúng format lỗi chuẩn của FastAPI (`{"detail": "..."}`).

---

## 5. Đặc tả 3 mô hình (để backend cài đặt đúng tiền xử lý/hậu xử lý)

| asset_id | File model | Framework | sequence_length | Input shape | Cột dữ liệu | Scaler file | CSV nguồn |
|---|---|---|---|---|---|---|---|
| `amzn` | `assets/amzn/gru_amzn.keras` | `tf.keras.models.load_model` | 60 | `(1, 60, 1)` | `Close` | `assets/amzn/scaler.pkl` (joblib, sklearn `MinMaxScaler(0,1)`) | `assets/amzn/AMZN.csv` (cột `Date,Open,High,Low,Close,Adj Close,Volume`) |
| `gold` | `assets/gold/best_model_Vàng.keras` | `tf.keras.models.load_model` | 10 | `(1, 10, 1)` | `price` | `assets/gold/scaler_Vàng.pkl` (joblib, `MinMaxScaler(0,1)`) | `assets/gold/gold_price.csv` (cột `date,price`) |
| `silver` | `assets/silver/best_model_Bạc.pth` | PyTorch `state_dict` — xem class bên dưới | 10 | `(1, 10, 1)` | `price` | `assets/silver/scaler_Bạc.pkl` (joblib, `MinMaxScaler(0,1)`) | `assets/silver/silver_price.csv` (cột `date,price`) |

**Class PyTorch để load `best_model_Bạc.pth`** (phải định nghĩa lại y hệt, vì `.pth` chỉ lưu
`state_dict`, không lưu kiến trúc):
```python
import torch.nn as nn

class VanillaRNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.rnn = nn.RNN(input_size=1, hidden_size=32, batch_first=True)
        self.linear = nn.Linear(32, 1)

    def forward(self, x):
        out, _ = self.rnn(x)
        return self.linear(out[:, -1, :])

model = VanillaRNN()
model.load_state_dict(torch.load("assets/silver/best_model_Bạc.pth", map_location="cpu"))
model.eval()
```

**Quy trình dự đoán 1 bước (áp dụng cho cả 3, chỉ khác sequence_length/model):**
1. Lấy `sequence_length` giá trị gần nhất của cột giá từ CSV tương ứng (ví dụ 60 giá `Close`
   cuối của AMZN.csv, hoặc 10 giá `price` cuối của gold/silver csv).
2. `scaler.transform(values.reshape(-1, 1))` → mảng đã chuẩn hoá [0,1].
3. Reshape thành `(1, sequence_length, 1)`.
4. Keras: `model.predict(x, verbose=0)` → lấy `[0,0]`.
   PyTorch: `model(torch.tensor(x, dtype=torch.float32))` trong `torch.no_grad()` → lấy
   `.item()`.
5. `scaler.inverse_transform([[pred_scaled]])[0,0]` → giá dự đoán thật (USD).
6. Để dự đoán nhiều bước: nối `pred_scaled` vào cuối chuỗi đã chuẩn hoá, bỏ phần tử đầu
   (`new_seq = np.append(seq_scaled[1:], [[pred_scaled]], axis=0)`), lặp lại bước 3–6.

Dữ liệu CSV có thể có dòng `price` rỗng (NaN) — khi đọc lịch sử phải `dropna()` trên cột
giá trước khi lấy `sequence_length` điểm cuối, đúng như cách notebook gốc xử lý.

**Lịch sử phát hiện & đã vá:** bản đầu tiên của scaler `amzn` được fit trên khoảng giá
$0.07–$94.93, trong khi `AMZN.csv` đi kèm có giá thực tới ~$186 — lệch dữ liệu từ lúc export
model gốc. Backend từng xử lý tạm bằng cách clip giá trị đầu vào về đúng khoảng scaler đã
fit (field `note` cảnh báo khi việc này xảy ra). Vấn đề này **đã được giải quyết triệt để**
bằng cách train lại cả 2 model `amzn` và `gold` trên dữ liệu giá thật lấy từ Yahoo Finance
(`yfinance`, ticker `AMZN` và `GC=F`) với scaler fit trên toàn bộ khoảng giá — cơ chế clip
vẫn được giữ lại làm lưới an toàn cho tương lai, không xoá khỏi code.

**Lấy giá live (mục 7):** `amzn` và `gold` giờ fetch giá thật mỗi lần gọi API (cache 60 giây,
xem mục 7) thay vì đọc cố định từ CSV tĩnh — nên "giá gần nhất" luôn là phiên giao dịch gần
nhất thật, không bị "đóng băng" ở ngày export model nữa. `silver` vẫn dùng CSV tĩnh (không có
nguồn live được cấu hình, không có web riêng theo yêu cầu hiện tại).

---

## 7. Cơ chế lấy giá live (`app/live_data.py`)

`amzn` và `gold` lấy dữ liệu qua thư viện `yfinance` (ticker `AMZN` và `GC=F` — hợp đồng
tương lai vàng COMEX, giá theo USD/Ounce):

1. Mỗi lần `read_asset_data(asset_id)` được gọi (từ cả `/api/history` và
   `/api/predict`), hệ thống thử lấy dữ liệu live trước.
2. Kết quả được **cache trong bộ nhớ 60 giây** (`CACHE_TTL_SECONDS` trong
   `live_data.py`) — tránh gọi Yahoo Finance liên tục trên mỗi request, giảm độ trễ
   và rủi ro bị rate-limit/chặn IP server.
3. Nếu fetch live thất bại (lỗi mạng, Yahoo chặn, response rỗng...): dùng lại cache
   cũ nếu còn (dù đã quá 60s), nếu không có cache nào thì fallback về file CSV tĩnh
   trong `app/assets/<asset>/`. Field `note` trong response `/api/predict` sẽ báo rõ
   khi đang dùng dữ liệu CSV nội bộ thay vì giá live.
4. `silver` không có ticker live được cấu hình trong `LIVE_TICKERS`, nên luôn đọc từ
   CSV tĩnh (hành vi không đổi).

Vì cơ chế này chạy ở cấp `read_asset_data()`, nó áp dụng cho cả lịch sử giá
(`/api/history`) lẫn dữ liệu đầu vào dùng để dự đoán (`/api/predict`) — cả 2 đều
dùng chung 1 nguồn dữ liệu nhất quán trong cùng 1 request.
