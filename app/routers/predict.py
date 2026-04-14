
from typing import Union
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.extraction import HouseFeatures
from app.schemas.response import PredictRequest, PredictResponse, InsightsResponse, ErrorResponse
from app.services.llm_stage1 import extract_features
from app.services.llm_stage2 import interpret_prediction
from app.services.predictor import predict_price
from app.services.intent_classifier import classify_intent
from app.services.market_insights import get_market_insights

router = APIRouter(prefix="/predict", tags=["predict"])


@router.post("")
def predict(request: PredictRequest) -> Union[PredictResponse, InsightsResponse]:

    # ── Classify intent ───────────────────────────────────────────────────────
    intent = classify_intent(request.query)

    if intent == "analysis":
        narrative, highlights = get_market_insights(request.query)
        return InsightsResponse(
            query=request.query,
            narrative=narrative,
            highlights=highlights,
        )

    # ── Stage 1: extract features from natural language ──────────────────────
    extraction = extract_features(request.query)

    # ── Merge manually filled features from the UI ───────────────────────────
    if request.filled_features:
        extraction = _merge_filled_features(extraction, request.filled_features)

    # ── Check completeness ────────────────────────────────────────────────────
    if not extraction.is_complete:
        return PredictResponse(
            extraction=extraction,
            prediction=None,
            interpretation=None,
            is_complete=False,
        )

    # ── ML prediction ─────────────────────────────────────────────────────────
    try:
        features_dict = extraction.features.model_dump()
        predicted_price = predict_price(features_dict)
    except ValueError as e:
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(
                error="prediction_failed",
                detail=str(e),
            ).model_dump(),
        )

    # ── Stage 2: interpret the prediction ────────────────────────────────────
    interpretation = interpret_prediction(
        features=extraction.features.model_dump(),
        prediction=predicted_price,
    )

    return PredictResponse(
        extraction=extraction,
        prediction=predicted_price,
        interpretation=interpretation,
        is_complete=True,
    )


def _merge_filled_features(extraction, filled: HouseFeatures):

    from app.schemas.extraction import ExtractionResult

    current = extraction.features.model_dump()
    filled_dict = filled.model_dump(exclude_none=True)

    merged = {**current, **{k: v for k, v in filled_dict.items() if current[k] is None}}

    new_features = HouseFeatures(**merged)
    new_missing = [k for k, v in merged.items() if v is None]

    return ExtractionResult(features=new_features, missing_features=new_missing)
