
import logging

from groq import Groq

from app.config import GROQ_API_KEY

logger = logging.getLogger(__name__)

_client = Groq(api_key=GROQ_API_KEY)

# Keywords that almost always signal a market analysis query.
# Checked first — no API call needed for obvious cases.
_ANALYSIS_KEYWORDS = [
    "which neighborhood", "which neighbourh", "what neighborhood",
    "most affordable", "cheapest", "least expensive",
    "most expensive", "priciest",
    "average price", "average house", "average home",
    "median price", "median house",
    "how does", "how do",
    "affect price", "affect the price",
    "market", "statistics", "stats", "trend",
    "compare neighborhood", "compare area",
    "typical range", "price range",
    "what's the average", "what is the average",
    "affordable neighborhood", "expensive neighborhood",
    "best neighborhood", "worst neighborhood",
    "price by", "prices by",
]

_SYSTEM = """Classify a real estate query as 'prediction' or 'analysis'. Reply with one word only.

prediction — the user describes a specific property and wants to know its price
analysis   — the user wants market statistics, neighborhood comparisons, trends, or general insights

Examples:
"3 bed 2 bath built in 2000" → prediction
"which neighborhoods are cheapest?" → analysis
"is CollgCr expensive compared to OldTown?" → analysis
"1800 sqft ranch with 2-car garage, good quality" → prediction
"what is the average house price in Ames?" → analysis
"how does overall quality affect price?" → analysis
"4 bedroom home excellent condition large lot" → prediction"""


def classify_intent(query: str) -> str:
    """Returns 'prediction' or 'analysis'.

    Checks keywords first (fast path). Falls back to LLM for ambiguous
    queries. Defaults to 'prediction' if the LLM call fails.
    """
    q = query.lower()

    # Fast path — keyword match catches most analysis queries immediately
    if any(kw in q for kw in _ANALYSIS_KEYWORDS):
        return "analysis"

    # LLM path — for queries that didn't match any keyword
    try:
        msg = _client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=5,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": query},
            ],
        )
        result = msg.choices[0].message.content.strip().lower()
        return "analysis" if "analysis" in result else "prediction"
    except Exception as e:
        logger.error("Intent classification failed, defaulting to prediction: %s", e)
        return "prediction"
