(function startContentScript(global) {
  "use strict";

  var namespace = global.EyeGazeCapture = global.EyeGazeCapture || {};
  var browserApi = namespace.browser;
  var messages = namespace.messages.MESSAGE_TYPES;
  var config = namespace.config;

  var overlay = new namespace.content.OverlayManager();
  var dwellEngine = new namespace.content.DwellEngine({
    dwellThresholdMs: config.DEFAULT_SETTINGS.dwellThresholdMs,
    cooldownMs: config.DEFAULT_SETTINGS.cooldownMs,
    minimumConfidence: config.DEFAULT_SETTINGS.minimumConfidence,
    anchorBoxSize: config.ANCHOR_BOX_SIZE
  });
  var tracker = null;
  var trackerSyncPromise = Promise.resolve();
  var lastSample = null;
  var trackerMode = "stopped";
  var lastCalibrationStatusReported = null;
  var lastTrackingActiveReported = null;
  var lastTrackerErrorReported = null;
  var session = {
    settings: Object.assign({}, config.DEFAULT_SETTINGS),
    calibration: Object.assign({}, config.DEFAULT_CALIBRATION_STATE),
    trackerStatus: config.TRACKER_STATUSES.IDLE,
    trackingActive: false,
    lastError: null
  };

  function getViewportMetrics() {
    return {
      width: global.innerWidth,
      height: global.innerHeight,
      devicePixelRatio: global.devicePixelRatio || 1,
      innerScreenX: typeof global.mozInnerScreenX === "number" ? global.mozInnerScreenX : (global.screenX || 0),
      innerScreenY: typeof global.mozInnerScreenY === "number" ? global.mozInnerScreenY : (global.screenY || 0)
    };
  }

  function clampPointToViewport(point) {
    if (!point) {
      return null;
    }

    return {
      x: Math.max(0, Math.min(global.innerWidth, Math.round(point.x))),
      y: Math.max(0, Math.min(global.innerHeight, Math.round(point.y)))
    };
  }

  function buildPointerBounds(point) {
    var half = config.POINTER_BOX_SIZE / 2;
    return {
      x: Math.round(point.x - half),
      y: Math.round(point.y - half),
      width: config.POINTER_BOX_SIZE,
      height: config.POINTER_BOX_SIZE
    };
  }

  function isValidViewportPoint(point, sample) {
    return Boolean(
      sample &&
      sample.valid &&
      point &&
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= global.innerWidth &&
      point.y <= global.innerHeight
    );
  }

  function buildStatusText(point, sample, dwellSnapshot) {
    var lines = [];
    lines.push("Tracker: " + session.trackerStatus);
    lines.push("Calibration: " + session.calibration.status);
    lines.push("Tracking: " + (session.trackingActive ? "running" : "stopped"));
    lines.push("Dwell state: " + dwellSnapshot.state);
    lines.push("Dwell: " + Math.round((dwellSnapshot.progress || 0) * 100) + "%");
    if (point && sample && sample.valid) {
      lines.push("Viewport gaze: " + point.x + ", " + point.y);
      lines.push("Confidence: " + Number(sample.confidence || 0).toFixed(2));
      lines.push("Calibrating: " + (sample.calibrating ? "yes" : "no"));
    } else {
      lines.push("Viewport gaze: invalid");
    }
    if (dwellSnapshot.anchorBounds) {
      lines.push(
        "Anchor box: " +
        dwellSnapshot.anchorBounds.x + ", " +
        dwellSnapshot.anchorBounds.y + ", " +
        dwellSnapshot.anchorBounds.width + "x" +
        dwellSnapshot.anchorBounds.height
      );
    }
    if (session.lastError) {
      lines.push("Error: " + session.lastError);
    }
    return lines.join("\n");
  }

  function renderOverlay(sample) {
    var point = sample ? {
      x: Math.round(sample.x),
      y: Math.round(sample.y)
    } : null;
    var valid = point ? isValidViewportPoint(point, sample) : false;
    var clampedPoint = point ? clampPointToViewport(point) : null;
    var dwellSnapshot = dwellEngine.getSnapshot();

    overlay.render({
      trackingEnabled: session.settings.trackingEnabled || session.calibration.status === config.CALIBRATION_STATUSES.RUNNING,
      overlayEnabled: session.settings.overlayEnabled,
      debugEnabled: session.settings.debugEnabled,
      point: clampedPoint,
      valid: Boolean(valid && clampedPoint),
      pointerBounds: clampedPoint ? buildPointerBounds(clampedPoint) : null,
      anchorBounds: dwellSnapshot.anchorBounds,
      dwellState: dwellSnapshot.state,
      dwellProgress: dwellSnapshot.progress,
      statusText: buildStatusText(point, sample, dwellSnapshot)
    });
  }

  async function reportCalibration(status, message) {
    if (lastCalibrationStatusReported === status && !message) {
      return;
    }
    lastCalibrationStatusReported = status;
    await browserApi.runtime.sendMessage({
      type: messages.CALIBRATION_EVENT,
      payload: {
        status: status,
        message: message || null
      }
    });
  }

  async function reportTracking(active, errorMessage) {
    if (lastTrackingActiveReported === Boolean(active) && !errorMessage) {
      return;
    }
    lastTrackingActiveReported = Boolean(active);
    await browserApi.runtime.sendMessage({
      type: messages.TRACKING_EVENT,
      payload: {
        active: Boolean(active),
        error: errorMessage || null
      }
    });
  }

  function toErrorText(errorLike) {
    if (!errorLike) {
      return "Unknown tracker error";
    }
    if (typeof errorLike === "string") {
      return errorLike;
    }
    if (errorLike && typeof errorLike === "object") {
      var hasMessage = Boolean(errorLike.message);
      var hasStack = Boolean(errorLike.stack);
      if (hasMessage && hasStack) {
        if (String(errorLike.stack).indexOf(String(errorLike.message)) === 0) {
          return String(errorLike.stack);
        }
        return String(errorLike.message) + "\n" + String(errorLike.stack);
      }
      if (hasMessage) {
        return String(errorLike.message);
      }
      if (hasStack) {
        return String(errorLike.stack);
      }
    }
    return String(errorLike);
  }

  async function reportTrackerError(errorLike) {
    var message = toErrorText(errorLike);
    if (lastTrackerErrorReported === message) {
      return;
    }
    lastTrackerErrorReported = message;
    await browserApi.runtime.sendMessage({
      type: messages.TRACKER_ERROR,
      payload: {
        message: message
      }
    });
  }

  async function triggerCapture(result, sample) {
    try {
      await browserApi.runtime.sendMessage({
        type: messages.DWELL_TRIGGER,
        payload: {
          timestamp: sample.timestamp || Date.now(),
          pageUrl: global.location.href,
          pageTitle: global.document.title || "",
          roi: result.roi,
          dwellDurationMs: result.dwellDurationMs,
          overlayEnabled: session.settings.overlayEnabled,
          trackingEnabled: session.settings.trackingEnabled,
          viewport: getViewportMetrics()
        }
      });
    } catch (error) {
      console.warn("Dwell trigger failed", error);
    }
  }

  async function handleGazeSample(sample) {
    var point;
    var valid;
    var result;

    lastSample = sample;
    point = {
      x: sample.x,
      y: sample.y
    };
    valid = isValidViewportPoint(point, sample) &&
      (sample.confidence == null || sample.confidence >= session.settings.minimumConfidence);

    if (!session.settings.trackingEnabled || sample.calibrating || session.calibration.status !== config.CALIBRATION_STATUSES.READY) {
      dwellEngine.reset();
      renderOverlay(sample);
      return;
    }

    result = dwellEngine.update({
      point: point,
      valid: valid,
      confidence: sample.confidence,
      timestamp: sample.timestamp
    });

    renderOverlay(sample);

    if (result.triggered) {
      await triggerCapture(result, sample);
    }
  }

  async function startCalibrationFlow(payload) {
    if (!tracker) {
      return;
    }

    try {
      trackerMode = "calibrating";
      lastCalibrationStatusReported = null;
      await tracker.startCalibration({
        cameraIndex: payload && Number.isFinite(payload.cameraIndex) ? payload.cameraIndex : session.settings.cameraIndex
      });
      await reportCalibration("running");
      await reportTracking(false);
    } catch (error) {
      trackerMode = "stopped";
      await reportCalibration("error", error.message);
      await reportTrackerError(error);
    }
  }

  async function ensureTrackerMode() {
    if (!tracker) {
      return;
    }

    if (session.calibration.status === config.CALIBRATION_STATUSES.RUNNING) {
      if (trackerMode !== "calibrating") {
        await startCalibrationFlow({
          cameraIndex: session.settings.cameraIndex
        });
      }
      return;
    }

    if (session.settings.trackingEnabled && session.calibration.status === config.CALIBRATION_STATUSES.READY) {
      if (trackerMode !== "tracking") {
        trackerMode = "tracking";
        await tracker.startTracking({
          cameraIndex: session.settings.cameraIndex
        });
        await reportTracking(true);
      }
      return;
    }

    if (trackerMode !== "stopped") {
      tracker.stop();
      trackerMode = "stopped";
      lastCalibrationStatusReported = null;
      await reportTracking(false);
    }
  }

  function scheduleTrackerSync() {
    trackerSyncPromise = trackerSyncPromise.then(function () {
      return ensureTrackerMode();
    }).catch(async function (error) {
      await reportTrackerError(error);
    });
  }

  function syncSession(snapshot) {
    if (!snapshot) {
      return;
    }

    session = {
      settings: Object.assign({}, session.settings, snapshot.settings || {}),
      calibration: Object.assign({}, session.calibration, snapshot.calibration || {}),
      trackerStatus: snapshot.trackerStatus || session.trackerStatus,
      trackingActive: Boolean(snapshot.trackingActive),
      lastError: snapshot.lastError || null
    };

    dwellEngine.updateConfig(
      session.settings.dwellThresholdMs,
      session.settings.cooldownMs,
      session.settings.minimumConfidence
    );

    scheduleTrackerSync();
    renderOverlay(lastSample);
  }

  function handleMessage(message) {
    if (!message || !message.type) {
      return undefined;
    }

    switch (message.type) {
      case messages.SESSION_STATE_UPDATED:
        syncSession(message.payload);
        return Promise.resolve();
      case messages.START_CALIBRATION:
        return startCalibrationFlow(message.payload || {});
      case messages.CAPTURE_COMPLETED:
        overlay.flashCapture("Saved " + message.payload.baseName, false);
        return Promise.resolve();
      case messages.CAPTURE_FAILED:
        overlay.flashCapture("Capture failed: " + message.payload.message, true);
        return Promise.resolve();
      default:
        return undefined;
    }
  }

  function createTracker() {
    tracker = new namespace.tracking.EyeGesturesLiteTracker({
      cameraIndex: session.settings.cameraIndex,
      onSample: function (sample) {
        handleGazeSample(sample).catch(function (error) {
          console.error("handleGazeSample failed", error);
        });
      },
      onCalibration: function (payload) {
        if (!payload || !payload.status) {
          return;
        }
        reportCalibration(payload.status).catch(function (error) {
          console.error("reportCalibration failed", error);
        });
        if (payload.status === "ready") {
          trackerMode = "calibrating";
          scheduleTrackerSync();
        }
      },
      onError: function (message) {
        reportTrackerError(message).catch(function (error) {
          console.error("reportTrackerError failed", error);
        });
      }
    });
  }

  async function initialize() {
    overlay.mount();
    renderOverlay(null);
    createTracker();

    global.addEventListener("resize", function () {
      renderOverlay(lastSample);
    });

    global.addEventListener("scroll", function () {
      renderOverlay(lastSample);
    }, {
      passive: true
    });

    global.document.addEventListener("visibilitychange", function () {
      if (global.document.hidden) {
        dwellEngine.reset();
        if (tracker && trackerMode !== "stopped") {
          tracker.stop();
          trackerMode = "stopped";
          reportTracking(false).catch(function () {});
        }
      }
      renderOverlay(lastSample);
    });

    global.addEventListener("error", function (event) {
      if (event && event.error) {
        reportTrackerError(event.error).catch(function () {});
      } else if (event && event.message) {
        reportTrackerError(event.message).catch(function () {});
      }
    });

    global.addEventListener("unhandledrejection", function (event) {
      reportTrackerError(event ? event.reason : "Unhandled promise rejection").catch(function () {});
    });

    browserApi.runtime.onMessage.addListener(handleMessage);

    try {
      var snapshot = await browserApi.runtime.sendMessage({
        type: messages.CONTENT_READY,
        payload: {
          url: global.location.href,
          title: global.document.title,
          viewport: getViewportMetrics()
        }
      });
      syncSession(snapshot);
    } catch (error) {
      console.warn("Content script could not reach background script", error);
    }
  }

  initialize().catch(function (error) {
    console.error("Content script initialization failed", error);
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
