from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib


ASSETS_DIR = Path(__file__).resolve().parent / "assets"

ASSET_CONFIG = {
    "amzn": {
        "name": "Amazon (AMZN) — Giá đóng cửa",
        "unit": "USD",
        "framework": "Keras GRU",
        "sequence_length": 60,
        "price_column": "Close",
        "date_column": "Date",
        "csv": ASSETS_DIR / "amzn" / "AMZN.csv",
        "model": ASSETS_DIR / "amzn" / "gru_amzn.keras",
        "scaler": ASSETS_DIR / "amzn" / "scaler.pkl",
        "model_kind": "keras",
    },
    "gold": {
        "name": "Vàng",
        "unit": "USD/Ounce",
        "framework": "Keras LSTM",
        "sequence_length": 10,
        "price_column": "price",
        "date_column": "date",
        "csv": ASSETS_DIR / "gold" / "gold_price.csv",
        "model": ASSETS_DIR / "gold" / "best_model_Vàng.keras",
        "scaler": ASSETS_DIR / "gold" / "scaler_Vàng.pkl",
        "model_kind": "keras",
    },
    "silver": {
        "name": "Bạc",
        "unit": "USD/Ounce",
        "framework": "PyTorch Vanilla RNN",
        "sequence_length": 10,
        "price_column": "price",
        "date_column": "date",
        "csv": ASSETS_DIR / "silver" / "silver_price.csv",
        "model": ASSETS_DIR / "silver" / "best_model_Bạc.pth",
        "scaler": ASSETS_DIR / "silver" / "scaler_Bạc.pkl",
        "model_kind": "pytorch",
    },
}


@lru_cache(maxsize=3)
def load_model(asset_id: str) -> Any:
    config = ASSET_CONFIG[asset_id]
    if config["model_kind"] == "keras":
        # Import lazily: health/history and the PyTorch model do not require TF startup,
        # and TF's import footprint is large enough to matter on a 512MB instance.
        from tensorflow.keras.models import load_model as keras_load_model

        return keras_load_model(config["model"], compile=False)

    # PyTorch is also imported lazily, for the same memory reason.
    import torch
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
    state_dict = torch.load(config["model"], map_location="cpu", weights_only=True)
    model.load_state_dict(state_dict)
    model.eval()
    return model


@lru_cache(maxsize=3)
def load_scaler(asset_id: str) -> Any:
    return joblib.load(ASSET_CONFIG[asset_id]["scaler"])
