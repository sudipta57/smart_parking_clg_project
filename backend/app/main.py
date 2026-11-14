"""FastAPI application: wires routers, CORS, error handling and DB setup."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import CORS_ORIGINS
from app.db import init_db
from app.routers import meta, quote, sessions, stats
from app.services import ServiceError


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Create the database tables when the server starts."""
    init_db()
    yield


app = FastAPI(title="Smart Parking Fee Calculator API", version="1.0.0", lifespan=lifespan)

# The Vite dev proxy means the browser never needs CORS in development;
# this is only a fallback if the frontend calls the API directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (meta, quote, sessions, stats):
    app.include_router(module.router, prefix="/api")


@app.exception_handler(ServiceError)
async def service_error_handler(_request: Request, exc: ServiceError) -> JSONResponse:
    """Business-rule errors (404/409/422) -> {"detail": "<message>"}."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Turn Pydantic's list of errors into one readable sentence."""
    return JSONResponse(status_code=422, content={"detail": readable_errors(exc.errors())})


def readable_errors(errors) -> str:
    """Format validation errors as "field: message; field: message"."""
    messages = []
    for err in errors:
        field = ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path"))
        messages.append(f"{field}: {err['msg']}" if field else err["msg"])
    return "; ".join(messages) or "Invalid request"
