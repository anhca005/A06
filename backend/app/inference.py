from datetime import timedelta

import numpy as np
import pandas as pd
import torch

from .models import ASSET_CONFIG, load_model, load_scaler


def read_asset_data(asset_id: str) -> pd.DataFrame:
    config = ASSET_CONFIG[asset_id]
    frame = pd.read_csv(config["csv"])
    frame[config["price_column"]] = pd.to_numeric(
        frame[config["price_column"]], errors="coerce"
    )
    return frame.dropna(subset=[config["price_column"]]).copy()


def predict_next_n(asset_id: str, days_ahead: int) -> dict:
    config = ASSET_CONFIG[asset_id]
    frame = read_asset_data(asset_id)
    sequence_length = config["sequence_length"]
    if len(frame) < sequence_length:
        raise ValueError(f"Not enough data for {asset_id}")

    recent = frame[config["price_column"]].to_numpy(dtype=np.float64)[-sequence_length:]
    scaler = load_scaler(asset_id)

    # Bảo vệ khỏi lệch dữ liệu: nếu giá thực tế hiện vượt khoảng scaler đã được
    # fit lúc huấn luyện (ví dụ scaler AMZN chỉ thấy giá tới ~$95 nhưng CSV đã có
    # giá tới ~$186), scaler.transform() sẽ cho ra giá trị ngoài [0,1] khiến model
    # ngoại suy vô nghĩa (quan sát thực tế: dự đoán AMZN giảm ~20% liên tục 5 ngày).
    # Clip về đúng khoảng đã fit trước khi chuẩn hoá để model luôn nhận input nằm
    # trong vùng nó từng học, thay vì rơi vào vùng chưa từng thấy.
    fit_min = float(scaler.data_min_[0])
    fit_max = float(scaler.data_max_[0])
    clipped = np.clip(recent, fit_min, fit_max)
    was_clipped = bool(np.any(recent != clipped))

    sequence = scaler.transform(clipped.reshape(-1, 1)).astype(np.float32)
    model = load_model(asset_id)
    predicted_prices: list[float] = []

    for _ in range(days_ahead):
        model_input = sequence.reshape(1, sequence_length, 1)
        if config["model_kind"] == "keras":
            pred_scaled = float(model.predict(model_input, verbose=0)[0, 0])
        else:
            with torch.no_grad():
                tensor = torch.tensor(model_input, dtype=torch.float32)
                pred_scaled = float(model(tensor).item())

        # Kẹp giá trị dự đoán (đã chuẩn hoá) về [0, 1] trước khi vòng lặp hồi quy
        # dùng nó làm input bước kế tiếp — tránh sai số tích luỹ đẩy chuỗi ra
        # ngoài vùng [0,1] sau nhiều bước đệ quy.
        pred_scaled_clamped = min(max(pred_scaled, 0.0), 1.0)
        price = float(scaler.inverse_transform([[pred_scaled_clamped]])[0, 0])
        predicted_prices.append(price)
        sequence = np.append(sequence[1:], [[pred_scaled_clamped]], axis=0).astype(np.float32)

    last_row = frame.iloc[-1]
    last_date = pd.to_datetime(last_row[config["date_column"]]).date()
    note = None
    if was_clipped:
        note = (
            "Giá gần nhất của tài sản này vượt khoảng dữ liệu mà mô hình được huấn "
            "luyện (scaler fit trên khoảng "
            f"{fit_min:.4g}–{fit_max:.4g} {config['unit']}); giá trị đầu vào đã được "
            "giới hạn (clip) về khoảng này trước khi dự đoán, nên kết quả chỉ mang "
            "tính tham khảo, độ chính xác thấp hơn bình thường."
        )
    return {
        "asset_id": asset_id,
        "unit": config["unit"],
        "last_known_date": last_date.isoformat(),
        "last_known_price": float(last_row[config["price_column"]]),
        "predictions": [
            {
                "date": (last_date + timedelta(days=index)).isoformat(),
                "predicted_price": price,
            }
            for index, price in enumerate(predicted_prices, start=1)
        ],
        "note": note,
    }
