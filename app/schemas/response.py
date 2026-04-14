
from typing import Optional
from pydantic import BaseModel

from app.schemas.extraction import ExtractionResult, HouseFeatures


class PredictRequest(BaseModel):
    query: str
    filled_features: Optional[HouseFeatures] = None


class PredictResponse(BaseModel):
    response_type: str = "prediction"
    extraction: ExtractionResult
    prediction: Optional[float] = None
    interpretation: Optional[str] = None
    is_complete: bool


class InsightsResponse(BaseModel):
    response_type: str = "analysis"
    query: str
    narrative: str
    highlights: list[dict]


class ErrorResponse(BaseModel):
    error: str
    detail: str