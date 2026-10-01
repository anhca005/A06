# A06 Price Prediction Backend

FastAPI service phục vụ ba mô hình đã huấn luyện sẵn: Amazon (Keras GRU), vàng
(Keras LSTM), và bạc (PyTorch Vanilla RNN). Service không huấn luyện lại model.

## Chạy local

Khuyến nghị Python 3.11 hoặc 3.12 (TensorFlow chưa hỗ trợ mọi phiên bản Python mới).

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
```

PyTorch trong `requirements.txt` dùng package mặc định để Render tự chọn wheel phù hợp.
Nếu cài local và muốn chắc chắn chỉ tải bản CPU, cài PyTorch trước bằng:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

## Kiểm tra nhanh

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/assets
curl "http://127.0.0.1:8000/api/history/gold?limit=50"
curl -X POST http://127.0.0.1:8000/api/predict/amzn -H "Content-Type: application/json" -d '{"days_ahead":5}'
```

Đổi `amzn` thành `gold` hoặc `silver` để thử các model còn lại. Body của endpoint
predict có thể bỏ hoàn toàn; khi đó `days_ahead` mặc định là 5.

## Deploy lên Render

Có hai cách:

1. Push repository lên GitHub, vào Render, chọn **New > Blueprint**, kết nối repo và
   áp dụng file `render.yaml` ở gốc repo. Blueprint đã đặt Root Directory là `backend`.
2. Chọn **New > Web Service**, kết nối repo, đặt Root Directory là `backend`, Build
   Command là `pip install -r requirements.txt`, và Start Command là
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Blueprint cố định Python 3.12.7 để TensorFlow có wheel tương thích. Sau deploy, dùng
`https://<service>.onrender.com/api/health` để kiểm tra hoặc đánh thức service. Render
free tier ngủ sau khoảng 15 phút không có request; lần gọi đầu sau khi ngủ thường cần
30–50 giây. `/api/health` tồn tại để frontend có thể đánh thức service trước khi dự đoán.

Ngày dự đoán được tăng từng ngày lịch theo API contract và biểu thị “phiên kế tiếp”; hệ
thống không loại cuối tuần hay ngày lễ.
