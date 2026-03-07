(function initConfig(global) {
  "use strict";

  var namespace = global.EyeGazeCapture = global.EyeGazeCapture || {};

  namespace.config = {
    STORAGE_KEYS: {
      SETTINGS: "eyeGesturesLitePrototype.settings",
      CALIBRATION: "eyeGesturesLitePrototype.calibration"
    },
    TRACKER_STATUSES: {
      IDLE: "idle",
      READY: "ready",
      ERROR: "error"
    },
    CALIBRATION_STATUSES: {
      REQUIRED: "required",
      RUNNING: "running",
      READY: "ready",
      ERROR: "error"
    },
    DWELL_STATES: {
      IDLE: "IDLE",
      TRACKING: "TRACKING",
      TRIGGERED: "TRIGGERED",
      COOLDOWN: "COOLDOWN"
    },
    DEFAULT_SETTINGS: {
      trackingEnabled: false,
      overlayEnabled: true,
      debugEnabled: false,
      saveFullScreenshot: false,
      saveMetadata: true,
      dwellThresholdMs: 2000,
      cooldownMs: 3000,
      minimumConfidence: 0.35,
      cameraIndex: 0,
      calibrationPoints: 25
    },
    DEFAULT_CALIBRATION_STATE: {
      status: "required",
      mode: "eyegestures_lite",
      lastCompletedAt: null,
      sampleCount: null
    },
    ANCHOR_BOX_SIZE: 200,
    POINTER_BOX_SIZE: 10,
    DYNAMIC_CAPTURE_ID: "gaze_anchor",
    OVERLAY_Z_INDEX: 2147483646,
    CAPTURE_PREFIX: "output",
    DOWNLOAD_DIR: "EyeGesturesLiteCaptures"
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
