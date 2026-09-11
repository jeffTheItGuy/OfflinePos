from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    """Dependency-free liveness check for UptimeRobot."""
    return {"status": "ok", "service": "harbor-pos"}
