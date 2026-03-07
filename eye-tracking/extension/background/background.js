(function startBackground(global) {
  "use strict";

  var namespace = global.EyeGazeCapture = global.EyeGazeCapture || {};
  var browserApi = namespace.browser;
  var messages = namespace.messages.MESSAGE_TYPES;
  var config = namespace.config;
  var storage = namespace.storage;
  var capturePipeline = namespace.background.capturePipeline;

  var state = {
    settings: storage.clone(config.DEFAULT_SETTINGS),
    calibration: storage.clone(config.DEFAULT_CALIBRATION_STATE),
    trackerStatus: config.TRACKER_STATUSES.IDLE,
    trackingActive: false,
    lastError: null,
    activeTabId: null,
    activeWindowId: null,
    pageContexts: {}
  };

  function getSnapshot() {
    return {
      settings: storage.clone(state.settings),
      calibration: storage.clone(state.calibration),
      trackerStatus: state.trackerStatus,
      trackingActive: state.trackingActive,
      lastError: state.lastError
    };
  }

  async function sendRuntimeMessage(message) {
    try {
      await browserApi.runtime.sendMessage(message);
    } catch (error) {
      if (error && error.message && error.message.indexOf("Receiving end does not exist") >= 0) {
        return;
      }
      console.debug("runtime.sendMessage skipped", error);
    }
  }

  async function sendToTab(tabId, message) {
    if (!tabId) {
      return false;
    }

    try {
      await browserApi.tabs.sendMessage(tabId, message);
      return true;
    } catch (error) {
      console.debug("tabs.sendMessage skipped", tabId, error);
      return false;
    }
  }

  async function broadcastSessionState() {
    var snapshot = getSnapshot();
    await sendRuntimeMessage({
      type: messages.SESSION_STATE_UPDATED,
      payload: snapshot
    });
    await sendToTab(state.activeTabId, {
      type: messages.SESSION_STATE_UPDATED,
      payload: snapshot
    });
  }

  async function refreshActiveTab() {
    var tabs = await browserApi.tabs.query({
      active: true,
      lastFocusedWindow: true
    });

    if (tabs && tabs.length > 0) {
      state.activeTabId = tabs[0].id;
      state.activeWindowId = tabs[0].windowId;
      state.trackerStatus = config.TRACKER_STATUSES.READY;
    }
  }

  async function handleSettingsUpdate(partialSettings) {
    state.settings = await storage.saveSettings(Object.assign({}, state.settings, partialSettings || {}));

    if (!state.settings.trackingEnabled) {
      state.trackingActive = false;
    }

    await broadcastSessionState();
    return getSnapshot();
  }

  async function handleCalibrationRequest() {
    var ok;

    if (!state.activeTabId) {
      await refreshActiveTab();
    }

    if (!state.activeTabId) {
      state.lastError = "No active tab available for calibration.";
      await broadcastSessionState();
      return {
        ok: false,
        snapshot: getSnapshot()
      };
    }

    state.calibration = await storage.saveCalibrationState({
      status: config.CALIBRATION_STATUSES.RUNNING,
      mode: "eyegestures_lite",
      lastCompletedAt: state.calibration.lastCompletedAt,
      sampleCount: null
    });
    state.lastError = null;
    await broadcastSessionState();

    ok = await sendToTab(state.activeTabId, {
      type: messages.START_CALIBRATION,
      payload: {
        cameraIndex: state.settings.cameraIndex,
        calibrationPoints: state.settings.calibrationPoints
      }
    });

    if (!ok) {
      state.calibration = await storage.saveCalibrationState({
        status: config.CALIBRATION_STATUSES.ERROR,
        mode: "eyegestures_lite",
        lastCompletedAt: state.calibration.lastCompletedAt,
        sampleCount: null
      });
      state.lastError = "Calibration request could not reach the active tab.";
      await broadcastSessionState();
      return {
        ok: false,
        snapshot: getSnapshot()
      };
    }

    return {
      ok: true,
      snapshot: getSnapshot()
    };
  }

  async function handleCalibrationEvent(payload) {
    var status = payload && payload.status;
    var lastCompletedAt = state.calibration.lastCompletedAt;
    var nextStatus = config.CALIBRATION_STATUSES.REQUIRED;

    if (status === "running") {
      nextStatus = config.CALIBRATION_STATUSES.RUNNING;
      state.lastError = null;
    } else if (status === "ready") {
      nextStatus = config.CALIBRATION_STATUSES.READY;
      lastCompletedAt = new Date().toISOString();
      state.lastError = null;
    } else if (status === "error") {
      nextStatus = config.CALIBRATION_STATUSES.ERROR;
      state.lastError = payload && payload.message ? payload.message : "Calibration failed.";
    }

    state.calibration = await storage.saveCalibrationState({
      status: nextStatus,
      mode: "eyegestures_lite",
      lastCompletedAt: lastCompletedAt,
      sampleCount: payload && payload.sampleCount != null ? payload.sampleCount : state.calibration.sampleCount
    });

    await broadcastSessionState();
    return {
      ok: true
    };
  }

  async function handleTrackingEvent(payload) {
    state.trackingActive = Boolean(payload && payload.active);
    if (payload && payload.error) {
      state.lastError = payload.error;
      state.trackerStatus = config.TRACKER_STATUSES.ERROR;
    } else {
      if (state.trackingActive) {
        state.lastError = null;
      }
      state.trackerStatus = config.TRACKER_STATUSES.READY;
    }
    await broadcastSessionState();
    return {
      ok: true
    };
  }

  async function handleTrackerError(payload) {
    state.lastError = payload && payload.message ? payload.message : "Tracker error";
    state.trackerStatus = config.TRACKER_STATUSES.ERROR;
    state.trackingActive = false;
    await broadcastSessionState();
    return {
      ok: true
    };
  }

  async function handleDwellTrigger(payload, sender) {
    if (!sender.tab) {
      return {
        ok: false,
        error: "No tab context was available for capture."
      };
    }

    try {
      var result = await capturePipeline.captureAndSave({
        timestamp: payload.timestamp,
        pageUrl: payload.pageUrl || sender.tab.url,
        pageTitle: payload.pageTitle || sender.tab.title || "",
        roi: payload.roi,
        dwellDurationMs: payload.dwellDurationMs,
        filterMode: "eyegestures_lite",
        overlayEnabled: payload.overlayEnabled,
        trackingEnabled: payload.trackingEnabled,
        viewport: payload.viewport
      }, state.settings, {
        windowId: sender.tab.windowId,
        tabId: sender.tab.id
      });

      await sendToTab(sender.tab.id, {
        type: messages.CAPTURE_COMPLETED,
        payload: result
      });

      return {
        ok: true,
        result: result
      };
    } catch (error) {
      await sendToTab(sender.tab.id, {
        type: messages.CAPTURE_FAILED,
        payload: {
          message: error.message
        }
      });

      return {
        ok: false,
        error: error.message
      };
    }
  }

  function handleRuntimeMessage(message, sender) {
    if (!message || !message.type) {
      return undefined;
    }

    switch (message.type) {
      case messages.GET_SESSION_STATE:
        return Promise.resolve(getSnapshot());
      case messages.UPDATE_SETTINGS:
        return handleSettingsUpdate(message.payload);
      case messages.START_CALIBRATION:
        return handleCalibrationRequest();
      case messages.CONTENT_READY:
        if (sender.tab && sender.tab.id) {
          state.pageContexts[sender.tab.id] = message.payload || {};
          state.activeTabId = sender.tab.id;
          state.activeWindowId = sender.tab.windowId;
          state.trackerStatus = config.TRACKER_STATUSES.READY;
        }
        return Promise.resolve(getSnapshot());
      case messages.CALIBRATION_EVENT:
        return handleCalibrationEvent(message.payload || {});
      case messages.TRACKING_EVENT:
        return handleTrackingEvent(message.payload || {});
      case messages.TRACKER_ERROR:
        return handleTrackerError(message.payload || {});
      case messages.DWELL_TRIGGER:
        return handleDwellTrigger(message.payload || {}, sender);
      default:
        return undefined;
    }
  }

  function registerListeners() {
    browserApi.runtime.onMessage.addListener(handleRuntimeMessage);

    browserApi.tabs.onActivated.addListener(function (activeInfo) {
      state.activeTabId = activeInfo.tabId;
      state.activeWindowId = activeInfo.windowId;
      state.trackerStatus = config.TRACKER_STATUSES.READY;
      broadcastSessionState().catch(function (error) {
        console.debug("broadcastSessionState failed after tab activation", error);
      });
    });

    browserApi.tabs.onRemoved.addListener(function (tabId) {
      delete state.pageContexts[tabId];
      if (state.activeTabId === tabId) {
        state.activeTabId = null;
        state.trackingActive = false;
        state.trackerStatus = config.TRACKER_STATUSES.IDLE;
      }
    });

    browserApi.windows.onFocusChanged.addListener(function () {
      refreshActiveTab().then(broadcastSessionState).catch(function (error) {
        console.debug("Failed to refresh active tab after focus change", error);
      });
    });
  }

  async function initialize() {
    state.settings = await storage.loadSettings();
    state.calibration = await storage.loadCalibrationState();
    await refreshActiveTab();
    registerListeners();
    await broadcastSessionState();
  }

  initialize().catch(function (error) {
    state.lastError = error.message;
    state.trackerStatus = config.TRACKER_STATUSES.ERROR;
    console.error("Background initialization failed", error);
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
