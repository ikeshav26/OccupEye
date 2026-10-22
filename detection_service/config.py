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

CAMERA_SOURCE = int(os.getenv("CAMERA_SOURCE", 0))
CLASSROOM_ID = os.getenv("CLASSROOM_ID", "room_101")

STUDENT_MODEL_PATH = os.getenv("STUDENT_MODEL_PATH", "yolov8n.pt")
CONF_THRESHOLD = float(os.getenv("CONF_THRESHOLD", 0.40))

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "")
ROBOFLOW_API_URL = os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com")

FAN_MODEL_ID = os.getenv("FAN_MODEL_ID", "ceiling-fan-detection-epfsk/1")
FAN_CONFIDENCE_THRESHOLD = float(os.getenv("FAN_CONFIDENCE_THRESHOLD", 0.45))

FAN_CHECK_INTERVAL_SECONDS = float(os.getenv("FAN_CHECK_INTERVAL_SECONDS", 0.5))
FAN_INFERENCE_TIMEOUT_SECONDS = float(os.getenv("FAN_INFERENCE_TIMEOUT_SECONDS", 5.0))
FAN_STALE_TIMEOUT_SECONDS = float(os.getenv("FAN_STALE_TIMEOUT_SECONDS", 6.0))
FAN_STABILIZATION_COUNT = int(os.getenv("FAN_STABILIZATION_COUNT", 2))


IDLE_TIME_THRESHOLD = int(os.getenv("IDLE_TIME_THRESHOLD", 10))
ALERT_REPEAT_INTERVAL = int(os.getenv("ALERT_REPEAT_INTERVAL", 30))
SERVER_WEBHOOK_URL = os.getenv("SERVER_WEBHOOK_URL", "https://occupeye.onrender.com/api/alerts")