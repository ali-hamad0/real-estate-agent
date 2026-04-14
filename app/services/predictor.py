

import os
import joblib
import pandas as pd

# Path to the serialized model — relative to project root
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "house_price_model.pkl")

# Load once at import time
try:
    _pipeline = joblib.load(MODEL_PATH)
except FileNotFoundError:
    raise RuntimeError(
        f"Model file not found at {MODEL_PATH}. "
    )


def predict_price(features: dict) -> float:
    """Run the ML pipeline and return a predicted house price.

    Args:
        features: Dict mapping the 10 expected feature names to their values.

    Returns:
        Predicted sale price in USD as a float.

    Raises:
        ValueError: If any required feature is missing from the input.
    """
    required = [
        "GrLivArea", "GarageCars", "TotalBsmtSF", "YearBuilt",
        "FullBath", "BedroomAbvGr", "LotArea",
        "OverallQual", "OverallCond", "Neighborhood",
    ]

    missing = [f for f in required if features.get(f) is None]
    if missing:
        raise ValueError(f"Cannot predict — missing features: {missing}")

    # Pipeline expects a DataFrame with the correct column names
    input_df = pd.DataFrame([features])

    prediction = _pipeline.predict(input_df)[0]
    return float(prediction)