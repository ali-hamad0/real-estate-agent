
import json
import logging

from groq import Groq

from app.config import GROQ_API_KEY
from app.schemas.extraction import ExtractionResult, HouseFeatures

logger = logging.getLogger(__name__)

# Winning prompt from prompt experiments notebook (v1_detailed)
SYSTEM_PROMPT = """You are a real estate data extractor.
Read the user's property description and extract the following features for a price prediction model.

Features to extract (use null if the user did not mention it):
- GrLivArea: above-ground living area in square feet (integer)
- GarageCars: garage capacity in number of cars, 0 if no garage (integer)
- TotalBsmtSF: total basement square feet, 0 if no basement (integer)
- YearBuilt: year the house was built (integer)
- FullBath: number of full bathrooms (integer)
- BedroomAbvGr: number of bedrooms above ground (integer)
- LotArea: total lot size in square feet (integer)
- OverallQual: overall material and finish quality on a scale of 1-10, where 1 is very poor and 10 is excellent (integer)
- OverallCond: overall condition on a scale of 1-10, where 1 is very poor and 10 is excellent (integer)
- Neighborhood: neighborhood name in Ames, Iowa (string, null if not mentioned)

Rules:
- Never guess or fill in a value the user did not provide.
- Use null for any feature that was not clearly stated or strongly implied.
- missing_features must list every key that has a null value.

Return ONLY a JSON object in this exact format, with no extra text:
{
  "features": {
    "GrLivArea": <int or null>,
    "GarageCars": <int or null>,
    "TotalBsmtSF": <int or null>,
    "YearBuilt": <int or null>,
    "FullBath": <int or null>,
    "BedroomAbvGr": <int or null>,
    "LotArea": <int or null>,
    "OverallQual": <int or null>,
    "OverallCond": <int or null>,
    "Neighborhood": <string or null>
  },
  "missing_features": [<list of feature names that are null>]
}"""

# Fallback returned when extraction completely fails
_FALLBACK = ExtractionResult(
    features=HouseFeatures(),
    missing_features=[
        "GrLivArea", "GarageCars", "TotalBsmtSF", "YearBuilt",
        "FullBath", "BedroomAbvGr", "LotArea",
        "OverallQual", "OverallCond", "Neighborhood",
    ],
)

_client = Groq(api_key=GROQ_API_KEY)


def extract_features(query: str) -> ExtractionResult:
    """Extract structured house features from a natural language description.

    Args:
        query: Free-text property description from the user.

    Returns:
        ExtractionResult with parsed features and a list of missing keys.
    """
    try:
        message = _client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=1000,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
        )

        raw = message.choices[0].message.content

        # Parse JSON response
        data = json.loads(raw)

        # Validate expected keys exist
        if "features" not in data or "missing_features" not in data:
            return _FALLBACK

        features = HouseFeatures(**data["features"])
        missing = data["missing_features"]

        return ExtractionResult(features=features, missing_features=missing)

    except json.JSONDecodeError as e:
        logger.error("Failed to parse LLM JSON response: %s", e)
        return _FALLBACK
    except Exception as e:
        logger.error("Feature extraction failed: %s", e)
        return _FALLBACK