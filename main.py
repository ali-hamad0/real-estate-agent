 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import predict, stats

app = FastAPI(
    title="AI Real Estate Agent",
    description="Natural language house price prediction using LLM prompt chaining and ML.",
    version="1.0.0",
)

# Allow the UI (served from a different origin in dev) to call the API
# TODO: restrict allow_origins to specific domains in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check — must be registered BEFORE the static files mount
# otherwise the "/" mount intercepts it
@app.get("/health")
def health_check() -> dict:
    """Return service health status."""
    return {"status": "ok"}

# Register the predict router — adds POST /predict
app.include_router(predict.router)
app.include_router(stats.router)

# Static UI mount comes LAST — it catches everything not matched above
app.mount("/", StaticFiles(directory="ui", html=True), name="ui")