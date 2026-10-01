from typing import Annotated

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .inference import predict_next_n, read_asset_data
from .models import ASSET_CONFIG
from .schemas import (
    AssetResponse,
    HealthResponse,
    HistoryResponse,
    PredictRequest,
    PredictResponse,
)

app = FastAPI(title="A06 RNN/GRU Price Prediction API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_asset(asset_id: str) -> dict:
    if asset_id not in ASSET_CONFIG:
        raise HTTPException(status_code=404, detail=f"Unknown asset_id: {asset_id}")
    return ASSET_CONFIG[asset_id]


@app.get("/api/health", response_model=HealthResponse)
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/assets", response_model=list[AssetResponse])
def assets() -> list[dict]:
    return [
        {
            "id": asset_id,
            "name": config["name"],
            "unit": config["unit"],
            "framework": config["framework"],
            "sequence_length": config["sequence_length"],
        }
        for asset_id, config in ASSET_CONFIG.items()
    ]


@app.get("/api/history/{asset_id}", response_model=HistoryResponse)
def history(
    asset_id: str,
    limit: Annotated[int, Query(ge=1, le=2000)] = 200,
) -> dict:
    config = require_asset(asset_id)
    frame = read_asset_data(asset_id).tail(limit)
    dates = frame[config["date_column"]].map(
        lambda value: str(value)[:10]
    ).tolist()
    return {
        "asset_id": asset_id,
        "unit": config["unit"],
        "dates": dates,
        "prices": frame[config["price_column"]].astype(float).tolist(),
    }


@app.post("/api/predict/{asset_id}", response_model=PredictResponse)
def predict(
    asset_id: str,
    payload: Annotated[PredictRequest | None, Body()] = None,
) -> dict:
    require_asset(asset_id)
    days_ahead = payload.days_ahead if payload is not None else 5
    return predict_next_n(asset_id, days_ahead)
