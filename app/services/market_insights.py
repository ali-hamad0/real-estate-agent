
import logging

from groq import Groq

from app.config import GROQ_API_KEY

logger = logging.getLogger(__name__)

_client = Groq(api_key=GROQ_API_KEY)

# Pre-computed from training set (real_estate_ml.ipynb — 1,022 sales)
MARKET_STATS = {
    "overall": {
        "median_price": 165000,
        "mean_price":   181312,
        "min_price":    34900,
        "max_price":    745000,
        "p25_price":    130000,
        "p75_price":    215000,
        "total_sales":  1022,
    },
    "by_neighborhood": {
        "NoRidge":  {"median": 335000, "tier": "luxury"},
        "NridgHt":  {"median": 315000, "tier": "luxury"},
        "StoneBr":  {"median": 310000, "tier": "luxury"},
        "Timber":   {"median": 228000, "tier": "upscale"},
        "Somerst":  {"median": 225000, "tier": "upscale"},
        "Veenker":  {"median": 218000, "tier": "upscale"},
        "Crawfor":  {"median": 210000, "tier": "upscale"},
        "ClearCr":  {"median": 200000, "tier": "mid"},
        "CollgCr":  {"median": 197000, "tier": "mid"},
        "Blmngtn":  {"median": 194000, "tier": "mid"},
        "NWAmes":   {"median": 183000, "tier": "mid"},
        "Gilbert":  {"median": 181000, "tier": "mid"},
        "SawyerW":  {"median": 180000, "tier": "mid"},
        "Mitchel":  {"median": 153000, "tier": "affordable"},
        "NPkVill":  {"median": 146000, "tier": "affordable"},
        "NAmes":    {"median": 140000, "tier": "affordable"},
        "SWISU":    {"median": 139000, "tier": "affordable"},
        "Blueste":  {"median": 138000, "tier": "affordable"},
        "Sawyer":   {"median": 135000, "tier": "affordable"},
        "BrkSide":  {"median": 124000, "tier": "budget"},
        "Edwards":  {"median": 122000, "tier": "budget"},
        "OldTown":  {"median": 119000, "tier": "budget"},
        "BrDale":   {"median": 104000, "tier": "budget"},
        "IDOTRR":   {"median": 103000, "tier": "budget"},
        "MeadowV":  {"median": 98000,  "tier": "budget"},
    },
    "by_quality": {
        1: 65000, 2: 75000, 3: 87000, 4: 107000, 5: 130000,
        6: 147000, 7: 200000, 8: 265000, 9: 345000, 10: 430000,
    },
    "by_decade": {
        "pre-1940":  110000,
        "1940-1959": 113000,
        "1960-1979": 139000,
        "1980-1999": 165000,
        "2000-2010": 220000,
    },
}


def get_market_insights(query: str) -> tuple[str, list[dict]]:
    """Call the LLM with pre-computed stats to answer a market analysis query.

    Returns:
        narrative  — LLM-generated answer grounded in the stats
        highlights — 4 key stat cards for the UI
    """
    prompt = f"""You are a real estate market analyst for Ames, Iowa.

User question: "{query}"

Use ONLY the data below to answer. Every number you cite must come from this data. Do not invent figures.

{_format_stats()}

Write 3-4 sentences that directly answer the question with specific numbers and useful comparisons. Be conversational."""

    try:
        msg = _client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=350,
            messages=[{"role": "user", "content": prompt}],
        )
        narrative = msg.choices[0].message.content
    except Exception as e:
        logger.error("Market insights LLM call failed: %s", e)
        o = MARKET_STATS["overall"]
        narrative = (
            f"The Ames Iowa market has a median price of ${o['median_price']:,}, "
            f"with most homes falling between ${o['p25_price']:,} and ${o['p75_price']:,}."
        )

    return narrative, _get_highlights(query)


def _get_highlights(query: str) -> list[dict]:
    q  = query.lower()
    nb = MARKET_STATS["by_neighborhood"]
    bq = MARKET_STATS["by_quality"]
    bd = MARKET_STATS["by_decade"]
    o  = MARKET_STATS["overall"]

    # ── Quality question ──────────────────────────────────────────────────
    if any(kw in q for kw in ["quality", "rating", "condition", "qual"]):
        best  = max(bq.items(), key=lambda x: x[0])
        worst = min(bq.items(), key=lambda x: x[0])
        mid   = bq[5]
        premium = round((best[1] - worst[1]) / worst[1] * 100)
        return [
            {"label": "Quality 10 Median",  "value": f"${best[1]:,}"},
            {"label": "Quality 1 Median",   "value": f"${worst[1]:,}"},
            {"label": "Mid-Range (Q5)",      "value": f"${mid:,}"},
            {"label": "Top vs Bottom",       "value": f"+{premium}% premium"},
        ]

    # ── Decade / age / year question ──────────────────────────────────────
    if any(kw in q for kw in ["decade", "year", "built", "age", "old", "new", "recent"]):
        decades = list(bd.items())
        newest  = decades[-1]
        oldest  = decades[0]
        premium = round((newest[1] - oldest[1]) / oldest[1] * 100)
        return [
            {"label": "Newest (2000s)",  "value": f"${newest[1]:,}"},
            {"label": "Oldest (pre-1940)", "value": f"${oldest[1]:,}"},
            {"label": "Market Median",   "value": f"${o['median_price']:,}"},
            {"label": "New vs Old",      "value": f"+{premium}% premium"},
        ]

    # ── Neighborhood / area / location question ───────────────────────────
    if any(kw in q for kw in [
        "neighborhood", "neighbourh", "area", "location", "district",
        "affordable", "cheap", "expensive", "pric", "where"
    ]):
        top    = max(nb.items(), key=lambda x: x[1]["median"])
        bottom = min(nb.items(), key=lambda x: x[1]["median"])
        luxury_count     = sum(1 for d in nb.values() if d["tier"] == "luxury")
        affordable_count = sum(1 for d in nb.values() if d["tier"] in ("affordable", "budget"))
        return [
            {"label": "Most Expensive",  "value": f"{top[0]}  ·  ${top[1]['median']:,}"},
            {"label": "Most Affordable", "value": f"{bottom[0]}  ·  ${bottom[1]['median']:,}"},
            {"label": "Luxury Areas",    "value": f"{luxury_count} neighborhoods"},
            {"label": "Budget Areas",    "value": f"{affordable_count} neighborhoods"},
        ]

    # ── General / average / market question ──────────────────────────────
    return [
        {"label": "Market Median",  "value": f"${o['median_price']:,}"},
        {"label": "Average Price",  "value": f"${o['mean_price']:,}"},
        {"label": "Typical Range",  "value": f"${o['p25_price']:,} – ${o['p75_price']:,}"},
        {"label": "Total Sales",    "value": f"{o['total_sales']:,}"},
    ]


def _format_stats() -> str:
    o = MARKET_STATS["overall"]
    lines = [
        f"OVERALL MARKET ({o['total_sales']} sales, Ames Iowa training set):",
        f"  Median: ${o['median_price']:,}  |  Mean: ${o['mean_price']:,}",
        f"  Full range: ${o['min_price']:,} – ${o['max_price']:,}",
        f"  Middle 50% (IQR): ${o['p25_price']:,} – ${o['p75_price']:,}",
        "",
        "NEIGHBORHOODS (median sale price, sorted high to low):",
    ]
    for name, d in sorted(MARKET_STATS["by_neighborhood"].items(), key=lambda x: -x[1]["median"]):
        lines.append(f"  {name}: ${d['median']:,}  ({d['tier']})")

    lines += ["", "MEDIAN PRICE BY OVERALL QUALITY RATING (1=very poor, 10=excellent):"]
    for q, price in MARKET_STATS["by_quality"].items():
        lines.append(f"  Quality {q}: ${price:,}")

    lines += ["", "MEDIAN PRICE BY DECADE BUILT:"]
    for decade, price in MARKET_STATS["by_decade"].items():
        lines.append(f"  {decade}: ${price:,}")

    return "\n".join(lines)
