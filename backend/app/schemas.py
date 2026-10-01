from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str


class AssetResponse(BaseModel):
    id: str
    name: str
    unit: str
    framework: str
    sequence_length: int


class HistoryResponse(BaseModel):
    asset_id: str
    unit: str
    dates: list[str]
    prices: list[float]


class PredictRequest(BaseModel):
    days_ahead: int = Field(default=5, ge=1, le=30)


class PredictionPoint(BaseModel):
    date: str
    predicted_price: float


class PredictResponse(BaseModel):
    asset_id: str
    unit: str
    last_known_date: str
    last_known_price: float
    predictions: list[PredictionPoint]
    note: str | None = None
