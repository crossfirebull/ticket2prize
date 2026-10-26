import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.config import get_settings
from app.log_config import configure_logging
from app.routers import auth, health, orders, prizes, staff, stubs

settings = get_settings()
configure_logging(settings.log_level)
log = logging.getLogger("ticket2prize.request")

app = FastAPI(title="Ticket2Prize API", version="1.0.0")

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def request_log(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    if request.url.path not in ("/healthz", "/readyz", "/metrics"):
        log.info(
            "request",
            extra={
                "extra_fields": {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - start) * 1000, 1),
                }
            },
        )
    return response


for router in (
    health.router,
    prizes.router,
    stubs.router,
    auth.router,
    orders.router,
    staff.router,
):
    app.include_router(router)

Instrumentator(excluded_handlers=["/healthz", "/readyz", "/metrics"]).instrument(app).expose(
    app, include_in_schema=False
)
