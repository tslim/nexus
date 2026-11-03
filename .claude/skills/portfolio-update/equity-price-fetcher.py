#!/usr/bin/env python3
"""Equity Price Fetcher — get latest/historical stock prices and forex rates.

Usage:
    python3 equity-price-fetcher.py <ticker> [--period 5d]     # single ticker
    python3 equity-price-fetcher.py CSV_STRING                 # batch fetch (pipe or comma separated)
    python3 equity-price-fetcher.py --forex                  # MYR/USD rate (default)
    python3 equity-price-fetcher.py --forex=EUR/USD          # fetch EUR/USD
    python3 equity-price-fetcher.py --forex=GBP/USD          # fetch GBP/USD

Examples:
    python3 equity-price-fetcher.py AAPL --period 5d
    python3 equity-price-fetcher.py "AAPL|MSFT|SPY"           # batch fetch all at once
    python3 equity-price-fetcher.py --forex                   # get MYR/USD rate

The skill handles table parsing, portfolio updates, and dry-run previews — this script only fetches.
"""

import sys

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance not installed. Run: pip3 install yfinance", file=sys.stderr)
    sys.exit(1)

import pandas as pd
from datetime import date, datetime, timedelta, timezone


# ─── Helpers ─────────────────────────────────────────────────────

def _warn(msg: str) -> None:
    print(f"WARNING: {msg}", file=sys.stderr)


def _last_trading_day(today: "date | None" = None) -> "date":
    """Most recent weekday on or before today (UTC). Ignores exchange holidays."""
    d = today or datetime.now(timezone.utc).date()
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def _live_quote(t) -> tuple[float | None, "datetime | None"]:
    """Latest regular-market price and its timestamp, or (None, None)."""
    try:
        info = t.info or {}
        price = info.get("regularMarketPrice")
        if price is not None and not pd.isna(price) and float(price) > 0:
            ts = info.get("regularMarketTime")
            when = datetime.fromtimestamp(int(ts), timezone.utc) if ts else None
            return float(price), when
    except Exception:
        pass
    try:
        price = t.fast_info.last_price
        if price is not None and not pd.isna(price) and float(price) > 0:
            return float(price), None
    except Exception:
        pass
    return None, None


def _close_series(data: "pd.DataFrame") -> "pd.Series":
    """Select the Close column by name (works for flat and MultiIndex columns)."""
    if isinstance(data.columns, pd.MultiIndex):
        for level in range(data.columns.nlevels):
            if "Close" in data.columns.get_level_values(level):
                close = data.xs("Close", axis=1, level=level)
                return close.iloc[:, 0] if isinstance(close, pd.DataFrame) else close
        raise ValueError("No Close column")
    if "Close" in data.columns:
        return data["Close"]
    raise ValueError("No Close column")


def _last_valid_close(series: "pd.Series") -> tuple[float | None, "date | None", bool]:
    """Last non-NaN close, its date, and whether newer rows had NaN closes."""
    valid = series.dropna()
    if valid.empty:
        return None, None, False
    last_idx = valid.index[-1]
    skipped_nan = valid.index[-1] != series.index[-1]
    return float(valid.iloc[-1]), pd.Timestamp(last_idx).date(), skipped_nan


def _check_stale(symbol: str, when: "date | None", source: str) -> None:
    if when is None:
        return
    ltd = _last_trading_day()
    if when < ltd:
        _warn(f"{symbol}: price from {source} is dated {when}, older than the last trading day {ltd}.")


# ─── Core Fetch Functions ────────────────────────────────────────

def fetch_ticker_price(ticker: str, period: str = "5d") -> dict:
    """Fetch the latest price for a ticker.

    Prefers Yahoo's live regular-market price (with its timestamp). Falls back to the
    last non-NaN daily Close only when no live price is available, and warns on
    stderr when the price used is older than the last trading day.

    Returns:
        dict with symbol, price, currency, as_of (ISO date or None), source, error.
    """
    result = {"symbol": ticker, "price": None, "currency": None,
              "as_of": None, "source": None, "error": None}

    try:
        t = yf.Ticker(ticker)
        try:
            info = t.info or {}
            if isinstance(info.get("currency"), str):
                result["currency"] = info["currency"].upper()
        except Exception:
            pass

        price, when = _live_quote(t)
        if price is not None:
            result["price"] = round(price, 4)
            result["source"] = "regularMarketPrice"
            if when is not None:
                result["as_of"] = when.date().isoformat()
                _check_stale(ticker, when.date(), "regularMarketPrice")
            return result

        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            data = yf.download(ticker, period=period, progress=False)
        if data is None or data.empty:
            raise ValueError("No data found")
        close, day, skipped_nan = _last_valid_close(_close_series(data))
        if close is None:
            raise ValueError("No valid Close values")
        result["price"] = round(close, 4)
        result["source"] = "daily Close"
        result["as_of"] = day.isoformat() if day else None
        if skipped_nan:
            _warn(f"{ticker}: newest daily row has NaN Close; using {day} close instead.")
        _check_stale(ticker, day, "daily Close")

    except Exception as e:
        result["error"] = str(e)

    return result


def fetch_forex(symbol: str, rate: float | None = None, period: str = "5d") -> dict:
    """Fetch forex exchange rate from Yahoo Finance.

    Args:
        symbol: Forex pair (e.g. "USDMYR=X" for MYR/USD, "EURUSD=X" for EUR/USD).
        rate: Optional — if provided, returns this fixed rate instead of fetching.
        period: Time range for the history fallback ("1d", "5d", "1mo", ...).

    Same NaN-safe order as fetch_ticker_price: live price first, then the last
    non-NaN daily Close, with a stderr warning when the value is stale.
    Yahoo convention: USDMYR=X gives MYR per USD.
    """
    result: dict[str, object] = {"symbol": symbol, "rate": None, "as_of": None,
                                 "source": None, "error": None}

    if rate is not None:
        result["rate"] = round(rate, 4)
        result["source"] = "fixed"
        return result

    try:
        t = yf.Ticker(symbol)
        price, when = _live_quote(t)
        if price is not None:
            result["rate"] = round(price, 4)
            result["source"] = "regularMarketPrice"
            if when is not None:
                result["as_of"] = when.date().isoformat()
                _check_stale(symbol, when.date(), "regularMarketPrice")
            return result

        hist = t.history(period=period)
        if hist is None or hist.empty:
            raise ValueError("No forex data")
        close, day, skipped_nan = _last_valid_close(_close_series(hist))
        if close is None:
            raise ValueError("No valid forex Close values")
        result["rate"] = round(close, 4)
        result["source"] = "daily Close"
        result["as_of"] = day.isoformat() if day else None
        if skipped_nan:
            _warn(f"{symbol}: newest daily row has NaN Close; using {day} close instead.")
        _check_stale(symbol, day, "daily Close")

    except Exception as e:
        result["error"] = str(e)

    return result


# ─── Convenience: fetch multiple tickers at once ──────────────────

def batch_fetch_csv(csv_string: str, period: str = "5d") -> dict:
    """Fetch prices from a comma/pipe-separated string (e.g. 'AAPL|MSFT|SPY').

    Args:
        csv_string: Symbols like "AAPL|MSFT|SPY" or "AAPL,MSFT,SPY"
        period: Time range ("1d", "5d", "1mo", ...).

    Returns:
        dict keyed by symbol.
    """
    tickers = _split_csv(csv_string)
    return {t: fetch_ticker_price(t, period) for t in tickers}


def fetch_tickers(tickers: list[str], period: str = "5d") -> dict:
    """Fetch prices for a list of ticker symbols.

    Args:
        tickers: List of Yahoo Finance symbols (e.g. ["AAPL", "MSFT", "USDMYR=X"])
        period: Time range ("1d", "5d", "1mo", ...).

    Returns:
        dict keyed by symbol, each value is a price dict from fetch_ticker_price().
    """
    return {t: fetch_ticker_price(t, period) for t in tickers}


def _split_csv(csv_string: str) -> list[str]:
    """Split a CSV-style string into individual ticker symbols."""
    pipe_split = [t.strip() for t in csv_string.split("|") if t.strip()]
    comma_split = [t.strip() for t in csv_string.split(",") if t.strip()]

    if len(pipe_split) > 1:
        return pipe_split
    elif len(comma_split) > 1:
        return comma_split
    else:
        return [csv_string]


# ─── CLI ──────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 equity-price-fetcher.py <ticker> [--period 5d]")
        print("  python3 equity-price-fetcher.py CSV_STRING                 # batch fetch")
        print("  python3 equity-price-fetcher.py --forex                   # MYR/USD rate")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd in ("--forex", "fx") or cmd.startswith("--forex="):
        forex_symbol: str | None = cmd.split("=", 1)[1] if cmd.startswith("--forex=") else None
        rate_arg = None
        i = 2
        while i < len(sys.argv):
            arg = sys.argv[i]
            if arg.startswith("--rate="):
                try:
                    rate_arg = float(arg.split("=", 1)[1])
                except ValueError:
                    pass
            elif arg.startswith("--forex=") and forex_symbol is None:
                forex_symbol = arg.split("=", 1)[1]
            i += 1

        if not forex_symbol:
            print("Error: --forex requires a pair (e.g. USDMYR=X, EURUSD=X). Use: --forex=EUR/USD")
            sys.exit(1)

        result = fetch_forex(forex_symbol, rate_arg)
        print(f"{forex_symbol}: {result['rate']}")
        if result.get("error"):
            print(f"Error: {result['error']}")

    else:
        csv_string = sys.argv[1]
        period = "5d"
        i = 2
        while i < len(sys.argv):
            if sys.argv[i].startswith("--period="):
                period = sys.argv[i].split("=", 1)[1]
            i += 1

        is_batch = "," in csv_string or "|" in csv_string

        if is_batch:
            results = batch_fetch_csv(csv_string, period)
            for symbol, data in sorted(results.items()):
                price = data.get("price") or "N/A"
                currency = f" ({data.get('currency', '')})" if isinstance(data.get("currency"), str) else ""
                print(f"{symbol:<20}: ${price}{currency}")
        else:
            result = fetch_ticker_price(csv_string, period)

            price = result["price"] or "N/A"
            currency = f" ({result['currency']})" if isinstance(result.get("currency"), str) and result.get("currency") else ""
            print(f"{csv_string}: ${price}{currency}")
            if result.get("error"):
                print(f"Error: {result['error']}")


if __name__ == "__main__":
    main()
