(function initMessages(global) {
  "use strict";

  var namespace = global.EyeGazeCapture = global.EyeGazeCapture || {};

  namespace.messages = {
    MESSAGE_TYPES: {
      GET_SESSION_STATE: "GET_SESSION_STATE",
      SESSION_STATE_UPDATED: "SESSION_STATE_UPDATED",
      UPDATE_SETTINGS: "UPDATE_SETTINGS",
      START_CALIBRATION: "START_CALIBRATION",
      CONTENT_READY: "CONTENT_READY",
      DWELL_TRIGGER: "DWELL_TRIGGER",
      CAPTURE_COMPLETED: "CAPTURE_COMPLETED",
      CAPTURE_FAILED: "CAPTURE_FAILED",
      CALIBRATION_EVENT: "CALIBRATION_EVENT",
      TRACKING_EVENT: "TRACKING_EVENT",
      TRACKER_ERROR: "TRACKER_ERROR"
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
