#!/usr/bin/env python3
"""Equity Price Fetcher — get latest/historical stock prices and forex rates.

Usage:
    python3 equity-price-fetcher.py <ticker> [--period 5d]     # single ticker
    python3 equity-price-fetcher.py CSV_STRING                 # batch fetch (pipe or comma separated)
    python3 equity-price-fetcher.py --forex                  # MYR/USD rate (default)
    python3 equity-price-fetcher.py --forex=EUR/USD          # fetch EUR/USD
    python3 equity-price-fetcher.py --forex=GBP/USD          # fetch GBP/USD

Examples:
    python3 equity-price-fetcher.py VTI --period 5d
    python3 equity-price-fetcher.py "VTI|VOO|QQQ"            # batch fetch all at once
    python3 equity-price-fetcher.py --forex                   # get MYR/USD rate

The skill handles table parsing, portfolio updates, and dry-run previews — this script only fetches.
"""

import sys

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance not installed. Run: pip3 install yfinance", file=sys.stderr)
    sys.exit(1)


# ─── Core Fetch Functions ────────────────────────────────────────

def fetch_ticker_price(ticker: str, period: str = "5d") -> dict:
    """Fetch the latest (or historical) price for a ticker.

    Args:
        ticker: Yahoo Finance symbol (e.g. "VTI", "USDMYR=X")
        period: Time range to look back ("1d", "5d", "1mo", "6mo", ...)

    Returns:
        dict with price info or error message.
    """
    result = {"symbol": ticker, "price": None, "currency": None, "error": None}

    try:
        data = yf.download(ticker, period=period)
        if not data.empty and "Close" in data.columns:
            # Use .values[-1] for robust scalar extraction across pandas versions
            close_series = data["Close"]
            price = float(close_series.iloc[0].item()) if len(close_series) > 0 else None
            result["price"] = round(price, 4)
            # Try to extract currency from Yahoo Finance metadata
            try:
                info = yf.Ticker(ticker).info
                if "currency" in info and isinstance(info.get("currency"), str):
                    result["currency"] = info["currency"].upper()
            except Exception:
                pass
        else:
            # Fallback to regularMarketPrice for some symbols (e.g. forex)
            t = yf.Ticker(ticker)
            try:
                price = float(t.info.get("regularMarketPrice", 0))
                result["price"] = round(price, 4) if price > 0 else None
            except Exception as e:
                result["error"] = f"No data found: {e}"

    except Exception as e:
        result["error"] = str(e)

    return result


def fetch_forex(symbol: str, rate: float | None = None, period: str = "5d") -> dict:
    """Fetch forex exchange rate from Yahoo Finance.

    Args:
        symbol: Forex pair (e.g. "USDMYR=X" for MYR/USD, "EURUSD=X" for EUR/USD).
        rate: Optional — if provided, returns this fixed rate instead of fetching.
              Useful when you already know the current rate.
        period: Time range for historical data ("1d", "5d", "1mo", ...).

    Returns:
        dict with forex info or error message. Note that Yahoo Finance uses
        the convention `X` = base currency, so USDMYR=X gives MYR per USD.
    """
    result: dict[str, object] = {"symbol": symbol, "error": None}

    if rate is not None:
        # Return fixed rate (no network call)
        result["rate"] = round(rate, 4)
        return result

    try:
        hist = yf.Ticker(symbol).history(period=period)
        if not hist.empty:
            rate = float(hist["Close"].iloc[-1])
            result["rate"] = round(rate, 4)
        else:
            raise ValueError("No forex data")

    except Exception as e:
        result["error"] = str(e)

    return result


# ─── Convenience: fetch multiple tickers at once ──────────────────

def batch_fetch_csv(csv_string: str, period: str = "5d") -> dict:
    """Fetch prices from a comma/pipe-separated string (e.g. 'VTI|VOO|QQQ').

    Args:
        csv_string: Symbols like "VTI|VOO|QQQ" or "VTI,VOO,QQQ"
        period: Time range ("1d", "5d", "1mo", ...).

    Returns:
        dict keyed by symbol.
    """
    tickers = _split_csv(csv_string)
    return {t: fetch_ticker_price(t, period) for t in tickers}


def fetch_tickers(tickers: list[str], period: str = "5d") -> dict:
    """Fetch prices for a list of ticker symbols.

    Args:
        tickers: List of Yahoo Finance symbols (e.g. ["VTI", "VOO", "USDMYR=X"])
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
        if "error" in result:
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
            if "error" in result:
                print(f"Error: {result['error']}")


if __name__ == "__main__":
    main()
