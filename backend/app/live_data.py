"""Fetch today's real AMZN / Gold prices from Yahoo Finance, cached for 60s.

Cache avoids hitting Yahoo Finance on every single request (reduces latency
and the risk of Yahoo rate-limiting/blocking the server's IP). On any fetch
failure, callers fall back to the static CSV bundled in app/assets/.
"""

import time
from threading import Lock

import pandas as pd

CACHE_TTL_SECONDS = 60

LIVE_TICKERS = {
    "amzn": {"ticker": "AMZN", "period": "6mo"},
    "gold": {"ticker": "GC=F", "period": "6mo"},
}

_cache: dict[str, tuple[float, pd.DataFrame]] = {}
_lock = Lock()


def fetch_live_dataframe(asset_id: str):
    """Return a DataFrame with columns ["date", "price"] of real recent
    closing prices for asset_id, or None if unavailable (never raises)."""
    config = LIVE_TICKERS.get(asset_id)
    if config is None:
        return None

    now = time.time()
    with _lock:
        cached = _cache.get(asset_id)
        if cached is not None and (now - cached[0]) < CACHE_TTL_SECONDS:
            return cached[1]

    try:
        import yfinance as yf

        raw = yf.download(
            config["ticker"], period=config["period"], progress=False, auto_adjust=False
        )
        if raw is None or raw.empty:
            raise ValueError("empty response from yfinance")

        if isinstance(raw.columns, pd.MultiIndex):
            raw = raw.copy()
            raw.columns = [c[0] for c in raw.columns]
        raw = raw.reset_index()
        raw["date"] = pd.to_datetime(raw["Date"]).dt.strftime("%Y-%m-%d")
        raw["price"] = pd.to_numeric(raw["Close"], errors="coerce")
        df = raw[["date", "price"]].dropna(subset=["price"]).reset_index(drop=True)
        if df.empty:
            raise ValueError("no usable rows after cleaning")
    except Exception:
        with _lock:
            stale = _cache.get(asset_id)
        return stale[1] if stale is not None else None

    with _lock:
        _cache[asset_id] = (now, df)
    return df
