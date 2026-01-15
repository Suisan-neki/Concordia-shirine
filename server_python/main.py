"""
FastAPI application entry point
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.middleware import setup_middleware
from app.core.security import security_service
from app.api.v1 import api_router

# Create FastAPI app
app = FastAPI(
    title="Concordia Shrine API",
    description="Human Decision Security API",
    version="0.1.0",
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url="/api/redoc" if not settings.is_production else None,
)

# Setup CORS
if settings.allowed_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Development: allow all origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Setup custom middleware
setup_middleware(app)

# Include API routers
app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """Start background security tasks"""
    security_service.start_background_tasks()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "Concordia Shrine API"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(settings.node_env == "production" and "8000" or "8000"),
        reload=not settings.is_production,
    )
