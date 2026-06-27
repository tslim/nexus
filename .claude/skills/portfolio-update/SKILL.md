---
name: portfolio-update
description: Fetches live prices for equities in `memory/projects/investment_portfolio.md`.
tools: [Bash]
---

# Portfolio Update

Refresh your equities holdings table in `memory/projects/investment_portfolio.md` by fetching the latest Yahoo Finance prices for each ticker plus MYR/USD forex rate.

## Workflow

1. Check if `memory/projects/investment_portfolio.md` exists and has a **Holdings** section with a markdown table
2. Parse holdings: symbol, shares, cost basis USD/share from that table
3. Batch fetch all tickers + forex in one call (fastest):
   ```bash
   python3 equity-price-fetcher.py "XXX|YYY|ZZZ"  # fetches all at once
   python3 equity-price-fetcher.py --forex=USDMYR=X    # MYR/USD rate
   ```
4. Calculate Live Value (USD), Live Value (RM), and Unrealized P/L for each holding
5. Write back updated snapshot table to `memory/projects/investment_portfolio.md`

## First-Time Setup (portfolio.md missing)

If `memory/projects/investment_portfolio.md` doesn't exist, create a template with your tickers:

```
| Symbol | Shares | Cost Price | Live Price | RM Cost Basis | Live Value (USD) | Live Value (RM)* | Unrealized |
|--------|--------|------------|------------|---------------|------------------|------------------|------------|
```

Fill in your tickers, shares, and cost prices. Then run the update skill to fetch live prices:

```bash
python3 equity-price-fetcher.py "XXX|YYY|ZZZ"  # batch fetch all at once
python3 equity-price-fetcher.py --forex=USDMYR=X    # get MYR/USD rate
```

## Individual Price Check (no write-back)

```bash
python3 equity-price-fetcher.py XXX --period 5d     # latest price
python3 equity-price-fetcher.py YYY --period 6mo    # historical
python3 equity-price-fetcher.py --forex=USDMYR=X    # MYR/USD rate
```

## Portfolio.md Format

The holdings table in `memory/projects/investment_portfolio.md` must be in this table format:

| Symbol | Shares | Cost Price | Live Price | RM Cost Basis | Live Value (USD) | Live Value (RM)* | Unrealized |
|--------|--------|------------|------------|---------------|------------------|------------------|------------|
| XXX    | 10     | $50.00     | **$52.30**   | RM 2,615    | $523             | RM 2,040        | RM +230   |
| YYY    | 5      | $200.00    | **$198.50** | RM 993      | $992.5           | RM 3,871        | RM -7.5   |
| ZZZ    | 20     | $15.00     | **$16.10**   | RM 483       | $322             | RM 1,256        | RM +22    |
| **Total** |      |            |            | **RM 4,091** | **$1,837.5**    | **RM 7,167**   | **RM +244.5 ✅** |

The update script reads this table, fetches live prices for each symbol via equity-price-fetcher.py, and rewrites the Holdings section with current values (price, RM value, unrealized P/L).
