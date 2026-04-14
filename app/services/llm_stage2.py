

import logging

from groq import Groq

from app.config import GROQ_API_KEY

logger = logging.getLogger(__name__)

# Training data stats from real-estate-ml.ipynb (cell 17 output)
TRAINING_STATS = {
    "median_price": 165000,
    "mean_price":   181312,
    "min_price":    34900,
    "max_price":    745000,
    "std_price":    77617,
    "p25_price":    130000,
    "p75_price":    215000,
}

_client = Groq(api_key=GROQ_API_KEY)


def interpret_prediction(features: dict, prediction: float) -> str:
    """Generate a human-readable explanation of the predicted price.

    Args:
        features: Dict of house features used for prediction.
        prediction: The ML model's predicted price in USD.

    Returns:
        A 3-4 sentence narrative contextualising the prediction.
    """
    prompt = f"""You are a helpful real estate assistant explaining a house price prediction to a user.

House features:
{_format_features(features)}

Predicted price: ${prediction:,.0f}

Training data context (Ames Iowa housing market):
- Median price:  ${TRAINING_STATS['median_price']:,}
- Average price: ${TRAINING_STATS['mean_price']:,}
- Typical range: ${TRAINING_STATS['p25_price']:,} – ${TRAINING_STATS['p75_price']:,}
- Min price:     ${TRAINING_STATS['min_price']:,}
- Max price:     ${TRAINING_STATS['max_price']:,}

Write a short 3-4 sentence explanation for the user that:
1. States whether this price is high, average, or low compared to the market
2. Identifies 1-2 specific features that are most likely driving the price
3. Gives useful context (e.g. how it compares to the median)

Be direct and conversational. Do not repeat the raw numbers back — explain what they mean."""

    try:
        message = _client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=300,
            messages=[
                {"role": "user", "content": prompt},
            ],
        )
        return message.choices[0].message.content

    except Exception as e:
        logger.error("Prediction interpretation failed: %s", e)
        return (
            f"The predicted price of ${prediction:,.0f} is "
            f"{'above' if prediction > TRAINING_STATS['median_price'] else 'below'} "
            f"the market median of ${TRAINING_STATS['median_price']:,}."
        )


def _format_features(features: dict) -> str:
    """Format the features dict into a readable list for the prompt."""
    labels = {
        "GrLivArea":    "Living area",
        "GarageCars":   "Garage capacity",
        "TotalBsmtSF":  "Basement area",
        "YearBuilt":    "Year built",
        "FullBath":     "Full bathrooms",
        "BedroomAbvGr": "Bedrooms",
        "LotArea":      "Lot size",
        "OverallQual":  "Overall quality (1-10)",
        "OverallCond":  "Overall condition (1-10)",
        "Neighborhood": "Neighborhood",
    }
    lines = []
    for key, label in labels.items():
        value = features.get(key)
        if value is not None:
            lines.append(f"  - {label}: {value}")
    return "\n".join(lines)