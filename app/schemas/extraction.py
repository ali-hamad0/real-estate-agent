
from typing import Optional
from pydantic import BaseModel, Field


class HouseFeatures(BaseModel):

    GrLivArea:    Optional[int] = Field(None, ge=100,  le=10000, description="Above-ground living area in sqft")
    GarageCars:   Optional[int] = Field(None, ge=0,   le=5,     description="Garage capacity in number of cars (0 if no garage)")
    TotalBsmtSF:  Optional[int] = Field(None, ge=0,   le=8000,  description="Total basement area in sqft (0 if no basement)")
    YearBuilt:    Optional[int] = Field(None, ge=1800, le=2030,  description="Year the house was built")
    FullBath:     Optional[int] = Field(None, ge=0,   le=6,     description="Number of full bathrooms")
    BedroomAbvGr: Optional[int] = Field(None, ge=0,   le=10,    description="Number of bedrooms above ground")
    LotArea:      Optional[int] = Field(None, ge=1,   le=200000,description="Total lot size in sqft")
    OverallQual:  Optional[int] = Field(None, ge=1,   le=10,    description="Overall quality 1-10")
    OverallCond:  Optional[int] = Field(None, ge=1,   le=10,    description="Overall condition 1-10")
    Neighborhood: Optional[str] = Field(None, description="Neighborhood name in Ames Iowa")


class ExtractionResult(BaseModel):
    features: HouseFeatures
    missing_features: list[str]

    @property
    def is_complete(self) -> bool:
        return len(self.missing_features) == 0

    @property
    def extracted_count(self) -> int:
        return 10 - len(self.missing_features)