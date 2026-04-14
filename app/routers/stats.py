
from fastapi import APIRouter
from app.services.market_insights import MARKET_STATS

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("")
def get_stats():
    """Return pre-computed market statistics for the dashboard."""
    nb = MARKET_STATS["by_neighborhood"]
    by_qual = MARKET_STATS["by_quality"]
    by_dec  = MARKET_STATS["by_decade"]
    o       = MARKET_STATS["overall"]

    neighborhoods = [
        {"name": name, "median": d["median"], "tier": d["tier"]}
        for name, d in sorted(nb.items(), key=lambda x: -x[1]["median"])
    ]

    quality = [
        {"rating": q, "median": price}
        for q, price in by_qual.items()
    ]

    decade = [
        {"decade": dec, "median": price}
        for dec, price in by_dec.items()
    ]

    return {
        "overall": o,
        "neighborhoods": neighborhoods,
        "quality": quality,
        "decade": decade,
    }
