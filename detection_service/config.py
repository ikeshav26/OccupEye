import os
from pathlib import Path
from dotenv import load_dotenv

root_env = Path(__file__).resolve().parent.parent / ".env"
local_env = Path(__file__).resolve().parent / ".env"

if root_env.exists():
    load_dotenv(dotenv_path=root_env)
elif local_env.exists():
    load_dotenv(dotenv_path=local_env)
else:
    load_dotenv()


def resolve_model_path(model_path: str) -> str:
    """Resolves relative model path against current directory, service dir, or root."""
    path = Path(model_path)
    if path.exists():
        return str(path)
    cur_dir = Path(__file__).resolve().parent / model_path
    if cur_dir.exists():
        return str(cur_dir)
    parent_dir = Path(__file__).resolve().parent.parent / model_path
    if parent_dir.exists():
        return str(parent_dir)
    return model_path


CAMERA_SOURCE = int(os.getenv("CAMERA_SOURCE", 0))
CLASSROOM_ID = os.getenv("CLASSROOM_ID", "room_101")

STUDENT_MODEL_PATH = resolve_model_path(os.getenv("STUDENT_MODEL_PATH", "yolov8n.pt"))
CONF_THRESHOLD = float(os.getenv("CONF_THRESHOLD", 0.40))

# Local YOLO model for fan detection (data.pt trained on fan_blur / fan_stable)
FAN_MODEL_PATH = resolve_model_path(os.getenv("FAN_MODEL_PATH", "data.pt"))
FAN_CONFIDENCE_THRESHOLD = float(os.getenv("FAN_CONFIDENCE_THRESHOLD", 0.35))

FAN_CHECK_INTERVAL_SECONDS = float(os.getenv("FAN_CHECK_INTERVAL_SECONDS", 0.5))
FAN_STALE_TIMEOUT_SECONDS = float(os.getenv("FAN_STALE_TIMEOUT_SECONDS", 6.0))
FAN_STABILIZATION_COUNT = int(os.getenv("FAN_STABILIZATION_COUNT", 2))

IDLE_TIME_THRESHOLD = int(os.getenv("IDLE_TIME_THRESHOLD", 10))
ALERT_REPEAT_INTERVAL = int(os.getenv("ALERT_REPEAT_INTERVAL", 30))
SERVER_WEBHOOK_URL = os.getenv("SERVER_WEBHOOK_URL", "https://occupeye.onrender.com/api/alerts")
SNAPSHOT_DIR = os.getenv("SNAPSHOT_DIR", "snapshots")
