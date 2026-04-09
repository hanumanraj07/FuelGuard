import hashlib
import os
import re
import tempfile
from statistics import median
from typing import List, Optional

import cv2
import easyocr
import numpy as np
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="FuelGuard AI Service")

READER = easyocr.Reader(["en"], gpu=False)
JUMP_THRESHOLD_L = float(os.getenv("JUMP_THRESHOLD_L", "5.0"))
MAX_FLOW_LPS = float(os.getenv("MAX_FLOW_LPS", "0.83"))
MIN_CONFIDENCE = float(os.getenv("MIN_CONFIDENCE", "0.4"))
LOW_CONFIDENCE_THRESHOLD = float(os.getenv("LOW_CONFIDENCE_THRESHOLD", "0.7"))


class AnalyzeRequest(BaseModel):
  video_url: str = Field(..., alias="video_url")
  language: str = "en"


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
  video_path, video_hash = download_video(request.video_url)
  try:
    extracted = extract_readings(video_path)
    readings = smooth_readings(extracted["readings"])
    if not readings:
      raise HTTPException(
        status_code=422,
        detail="We could not read the meter clearly. Try a steadier video with better lighting.",
      )

    findings = detect_findings(readings)
    status = determine_status(findings)
    metrics = compute_metrics(readings)
    confidence = compute_confidence(readings, findings, extracted["low_confidence_frames"])
    meter_type = infer_meter_type(extracted["meter_samples"])
    audio_flags = infer_audio_anomalies(readings)
    physical_score = compute_physical_inspection_score(
      readings, findings, extracted["low_confidence_frames"]
    )

    result = {
      "status": status,
      "confidence": round(confidence, 2),
      "meter_type": meter_type,
      "physical_inspection_score": physical_score,
      "findings": findings,
      "audio_anomaly_flags": audio_flags,
      "readings": readings,
      "low_confidence_frames": extracted["low_confidence_frames"],
      "frame_hashes": extracted["frame_hashes"],
      "terminal_findings": build_terminal_findings(
        readings, findings, extracted["low_confidence_frames"], audio_flags
      ),
      "chart_data": [{"time": r["seconds"], "value": r["value"]} for r in readings],
      "metrics": metrics,
      "summary": build_summary(readings, findings, status, metrics, request.language),
      "video_sha256": video_hash,
      "video_url": request.video_url,
    }

    return result
  finally:
    if os.path.exists(video_path):
      os.remove(video_path)


def download_video(url: str):
  try:
    response = requests.get(url, stream=True, timeout=30)
    response.raise_for_status()
  except requests.RequestException as exc:
    raise HTTPException(status_code=400, detail="Unable to download video.") from exc

  sha = hashlib.sha256()
  tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
  with tmp as handle:
    for chunk in response.iter_content(chunk_size=1024 * 1024):
      if not chunk:
        continue
      sha.update(chunk)
      handle.write(chunk)
  return tmp.name, sha.hexdigest()


def extract_readings(video_path: str):
  cap = cv2.VideoCapture(video_path)
  if not cap.isOpened():
    raise HTTPException(status_code=400, detail="Unable to open video.")

  fps = cap.get(cv2.CAP_PROP_FPS)
  fps = fps if fps and fps > 0 else 25.0
  interval = max(1, int(round(fps)))

  frame_index = 0
  readings: List[dict] = []
  low_confidence_frames: List[dict] = []
  frame_hashes: List[dict] = []
  meter_samples: List[dict] = []

  while True:
    success, frame = cap.read()
    if not success:
      break

    if frame_index % interval == 0:
      timestamp_seconds = int(frame_index / fps)
      timestamp = format_timestamp(timestamp_seconds)
      frame_hashes.append(
        {
          "frame": frame_index,
          "timestamp": timestamp,
          "sha256": hashlib.sha256(frame.tobytes()).hexdigest(),
        }
      )

      resized = resize_frame(frame)
      brightness = float(np.mean(cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)))
      processed = preprocess_frame(resized, brightness)
      meter_samples.append(classify_meter_sample(processed, brightness))

      value, conf = read_meter_value(resized)
      if value is not None:
        item = {
          "timestamp": timestamp,
          "value": value,
          "confidence": round(conf, 2),
          "frame": frame_index,
          "seconds": timestamp_seconds,
        }
        if conf >= MIN_CONFIDENCE:
          readings.append(item)
        else:
          low_confidence_frames.append(item)

    frame_index += 1

  cap.release()
  return {
    "readings": readings,
    "low_confidence_frames": low_confidence_frames,
    "frame_hashes": frame_hashes,
    "meter_samples": meter_samples,
  }


def read_meter_value(frame: np.ndarray):
  candidates = []
  resized = resize_frame(frame)
  candidates.append(preprocess_frame(resized))
  candidates.append(preprocess_frame(center_crop(resized)))

  best_value = None
  best_conf = 0.0

  for candidate in candidates:
    results = READER.readtext(candidate, detail=1, paragraph=False)
    for _, text, confidence in results:
      value = parse_reading(text)
      if value is None:
        continue
      if confidence > best_conf:
        best_conf = float(confidence)
        best_value = value

  return best_value, best_conf


def resize_frame(frame: np.ndarray):
  height, width = frame.shape[:2]
  target_width = 960
  if width <= target_width:
    return frame
  scale = target_width / float(width)
  new_size = (target_width, int(height * scale))
  return cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)


def center_crop(frame: np.ndarray):
  height, width = frame.shape[:2]
  crop_width = int(width * 0.6)
  crop_height = int(height * 0.35)
  x1 = max(0, (width - crop_width) // 2)
  y1 = max(0, (height - crop_height) // 2)
  x2 = min(width, x1 + crop_width)
  y2 = min(height, y1 + crop_height)
  return frame[y1:y2, x1:x2]


def preprocess_frame(frame: np.ndarray, brightness: Optional[float] = None):
  gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

  avg_brightness = brightness if brightness is not None else float(np.mean(gray))
  if avg_brightness < 85:
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

  gray = cv2.GaussianBlur(gray, (3, 3), 0)
  thresh = cv2.adaptiveThreshold(
    gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
  )
  return thresh


def parse_reading(text: str) -> Optional[float]:
  cleaned = re.sub(r"[^0-9.]", "", text)
  if cleaned.count(".") > 1:
    cleaned = cleaned.replace(".", "", cleaned.count(".") - 1)
  if not cleaned:
    return None
  try:
    value = round(float(cleaned), 2)
    if value < 0 or value > 9999:
      return None
    return value
  except ValueError:
    return None


def smooth_readings(readings: List[dict]):
  if len(readings) < 3:
    return readings

  deltas = []
  for i in range(1, len(readings)):
    delta = readings[i]["value"] - readings[i - 1]["value"]
    if delta >= 0:
      deltas.append(delta)

  if not deltas:
    return readings

  baseline = median(deltas) if deltas else 0
  filtered: List[dict] = [readings[0]]
  for i in range(1, len(readings)):
    prev = filtered[-1]
    current = readings[i]
    delta = current["value"] - prev["value"]

    if delta < -0.2:
      continue
    if baseline > 0 and delta > baseline * 8 and delta < JUMP_THRESHOLD_L:
      continue

    filtered.append(current)

  return filtered


def detect_findings(readings: List[dict]):
  findings = []
  if not readings:
    return findings

  first = readings[0]
  if first["value"] > 0.5:
    findings.append(
      {
        "type": "meter_not_zero",
        "frame": first["frame"],
        "timestamp": first["timestamp"],
        "from_value": 0,
        "to_value": first["value"],
        "delta": first["value"],
      }
    )

  for i in range(1, len(readings)):
    prev = readings[i - 1]
    curr = readings[i]
    delta = round(curr["value"] - prev["value"], 2)
    delta_seconds = max(1, curr["seconds"] - prev["seconds"])
    rate = delta / delta_seconds

    if delta > JUMP_THRESHOLD_L:
      findings.append(
        {
          "type": "sudden_jump",
          "frame": curr["frame"],
          "timestamp": curr["timestamp"],
          "from_value": prev["value"],
          "to_value": curr["value"],
          "delta": delta,
          "delta_seconds": delta_seconds,
        }
      )

    if rate > MAX_FLOW_LPS:
      findings.append(
        {
          "type": "flow_rate_violation",
          "frame": curr["frame"],
          "timestamp": curr["timestamp"],
          "detected_rate_lpm": round(rate * 60, 2),
          "max_physical_lpm": round(MAX_FLOW_LPS * 60, 2),
          "delta_seconds": delta_seconds,
        }
      )

  return findings


def determine_status(findings: List[dict]):
  if any(f["type"] == "flow_rate_violation" for f in findings):
    return "scam"
  if any(f["type"] == "sudden_jump" for f in findings):
    return "scam"
  if any(f["type"] == "meter_not_zero" for f in findings):
    return "suspicious"
  return "normal"


def compute_confidence(readings: List[dict], findings: List[dict], low_confidence_frames: List[dict]):
  avg_conf = sum(r["confidence"] for r in readings) / len(readings)
  penalty = 0.04 * len(findings)
  penalty += min(0.15, len(low_confidence_frames) * 0.01)
  return max(0.45, min(0.99, avg_conf - penalty))


def compute_metrics(readings: List[dict]):
  if not readings:
    return {
      "max_jump_liters": 0,
      "avg_flow_rate_lpm": 0,
      "max_flow_rate_lpm": 0,
      "total_dispensed_liters": 0,
    }

  first = readings[0]
  last = readings[-1]
  duration_seconds = max(1, last["seconds"] - first["seconds"])
  total_dispensed = max(0, last["value"] - first["value"])

  max_jump = 0.0
  max_rate_lpm = 0.0
  for i in range(1, len(readings)):
    prev = readings[i - 1]
    curr = readings[i]
    delta = max(0, curr["value"] - prev["value"])
    seconds = max(1, curr["seconds"] - prev["seconds"])
    max_jump = max(max_jump, delta)
    max_rate_lpm = max(max_rate_lpm, (delta / seconds) * 60)

  avg_rate_lpm = (total_dispensed / duration_seconds) * 60

  return {
    "max_jump_liters": round(max_jump, 2),
    "avg_flow_rate_lpm": round(avg_rate_lpm, 2),
    "max_flow_rate_lpm": round(max_rate_lpm, 2),
    "total_dispensed_liters": round(total_dispensed, 2),
  }


def build_terminal_findings(
  readings: List[dict],
  findings: List[dict],
  low_confidence_frames: List[dict],
  audio_flags: List[dict],
):
  lines = []
  if not readings:
    return lines

  first = readings[0]
  lines.append(
    {
      "time": first["timestamp"],
      "text": f"METER START: {first['value']:.2f}L",
      "status": "ok" if first["value"] <= 0.5 else "error",
    }
  )

  for reading in readings[1:]:
    lines.append(
      {
        "time": reading["timestamp"],
        "text": f"READING: {reading['value']:.2f}L",
        "status": "ok",
      }
    )

  for finding in findings:
    if finding["type"] == "sudden_jump":
      lines.append(
        {
          "time": finding["timestamp"],
          "text": (
            f"READING: {finding['to_value']:.2f}L - JUMP DETECTED "
            f"(+{finding['delta']:.2f}L in {finding.get('delta_seconds', 1)}s)"
          ),
          "status": "error",
        }
      )
    if finding["type"] == "flow_rate_violation":
      lines.append(
        {
          "time": finding["timestamp"],
          "text": (
            f"FLOW RATE: {finding['detected_rate_lpm']:.0f} L/min detected - "
            f"MAX PHYSICAL: {finding['max_physical_lpm']:.0f} L/min"
          ),
          "status": "error",
        }
      )

  for frame in low_confidence_frames[:3]:
    lines.append(
      {
        "time": frame["timestamp"],
        "text": f"LOW CONFIDENCE FRAME: {frame['confidence'] * 100:.0f}% OCR confidence",
        "status": "warning",
      }
    )

  for flag in audio_flags[:2]:
    lines.append(
      {
        "time": flag["timestamp"],
        "text": f"AUDIO/TIMING FLAG: {flag['type']} ({flag['duration_ms']} ms)",
        "status": "warning",
      }
    )

  return lines


def build_summary(
  readings: List[dict],
  findings: List[dict],
  status: str,
  metrics: dict,
  language: str,
):
  summary = build_summary_english(readings, findings, status, metrics)
  return localize_summary(summary, findings, metrics, language)


def build_summary_english(
  readings: List[dict], findings: List[dict], status: str, metrics: dict
):
  if status == "normal":
    return (
      "No material anomalies detected. Meter progression stayed within expected "
      "flow-rate limits for the readable frames."
    )

  jump = next((f for f in findings if f["type"] == "sudden_jump"), None)
  flow = next((f for f in findings if f["type"] == "flow_rate_violation"), None)
  start = next((f for f in findings if f["type"] == "meter_not_zero"), None)

  if jump and flow:
    multiplier = 0.0
    if flow["max_physical_lpm"] > 0:
      multiplier = flow["detected_rate_lpm"] / flow["max_physical_lpm"]
    return (
      f"Meter jumped from {jump['from_value']:.2f}L to {jump['to_value']:.2f}L in "
      f"{jump.get('delta_seconds', 1)} seconds at {jump['timestamp']}. That implies "
      f"{flow['detected_rate_lpm']:.0f} L/min against a physical limit of "
      f"{flow['max_physical_lpm']:.0f} L/min, or about {multiplier:.1f}x the maximum "
      f"possible rate. This is strong evidence of tampering."
    )

  if jump:
    return (
      f"Meter jumped from {jump['from_value']:.2f}L to {jump['to_value']:.2f}L at "
      f"{jump['timestamp']}. The detected jump of {jump['delta']:.2f}L is inconsistent "
      f"with a steady fuel-fill progression and should be treated as suspicious."
    )

  if start:
    return (
      f"The first readable frame already showed {start['to_value']:.2f}L at "
      f"{start['timestamp']} instead of 0.00L. That means the meter may not have "
      f"started from zero."
    )

  return (
    "Potential anomaly detected. Review the evidence timeline and readable frames "
    "before relying on the result."
  )


def localize_summary(summary: str, findings: List[dict], metrics: dict, language: str):
  if language == "hi":
    jump = next((f for f in findings if f["type"] == "sudden_jump"), None)
    flow = next((f for f in findings if f["type"] == "flow_rate_violation"), None)
    if jump and flow:
      return (
        f"मीटर {jump['timestamp']} पर {jump['from_value']:.2f}L से "
        f"{jump['to_value']:.2f}L तक अचानक पहुंच गया. यह "
        f"{flow['detected_rate_lpm']:.0f} L/min की दर दिखाता है, जबकि भौतिक सीमा "
        f"{flow['max_physical_lpm']:.0f} L/min है. यह छेड़छाड़ का मजबूत संकेत है."
      )
    if any(f["type"] == "meter_not_zero" for f in findings):
      return "पहले स्पष्ट फ्रेम में मीटर शून्य से शुरू नहीं हुआ. कृपया इस पंप की जांच करें."
    if not findings:
      return "पढ़े जा सकने वाले फ्रेम में कोई बड़ी गड़बड़ी नहीं मिली."
  return summary


def infer_audio_anomalies(readings: List[dict]):
  if len(readings) < 3:
    return []

  flags = []
  for i in range(1, len(readings)):
    prev = readings[i - 1]
    curr = readings[i]
    gap_seconds = curr["seconds"] - prev["seconds"]
    if gap_seconds >= 4:
      flags.append(
        {
          "type": "silence_gap",
          "timestamp": curr["timestamp"],
          "duration_ms": gap_seconds * 1000,
          "source": "timing_proxy",
        }
      )

  return flags[:3]


def compute_physical_inspection_score(
  readings: List[dict], findings: List[dict], low_confidence_frames: List[dict]
):
  score = 92
  for finding in findings:
    if finding["type"] == "flow_rate_violation":
      score -= 30
    elif finding["type"] == "sudden_jump":
      score -= 24
    elif finding["type"] == "meter_not_zero":
      score -= 14

  score -= min(18, len(low_confidence_frames) * 2)
  if len(readings) < 4:
    score -= 10

  return max(18, min(96, int(score)))


def classify_meter_sample(frame: np.ndarray, brightness: float):
  std_dev = float(np.std(frame))
  white_ratio = float(np.mean(frame > 200))
  if brightness > 150 and white_ratio > 0.45:
    label = "led_backlit"
  elif std_dev < 30:
    label = "lcd"
  elif white_ratio < 0.15:
    label = "analog_dial"
  else:
    label = "digital_7seg"
  return {
    "label": label,
    "brightness": round(brightness, 2),
    "contrast": round(std_dev, 2),
  }


def infer_meter_type(samples: List[dict]):
  if not samples:
    return "digital_7seg"

  counts = {}
  for sample in samples:
    label = sample["label"]
    counts[label] = counts.get(label, 0) + 1

  return max(counts.items(), key=lambda item: item[1])[0]


def format_timestamp(seconds: int):
  minutes = seconds // 60
  remainder = seconds % 60
  return f"{minutes:02d}:{remainder:02d}"
