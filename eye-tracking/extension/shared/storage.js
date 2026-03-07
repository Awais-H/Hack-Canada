(function initStorage(global) {
  "use strict";

  var namespace = global.EyeGazeCapture = global.EyeGazeCapture || {};
  var browserApi = namespace.browser;
  var config = namespace.config;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clampNumber(value, min, max, fallback) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
  }

  function normalizeSettings(settings) {
    var source = Object.assign({}, config.DEFAULT_SETTINGS, settings || {});

    return {
      trackingEnabled: Boolean(source.trackingEnabled),
      overlayEnabled: Boolean(source.overlayEnabled),
      debugEnabled: Boolean(source.debugEnabled),
      saveFullScreenshot: Boolean(source.saveFullScreenshot),
      saveMetadata: Boolean(source.saveMetadata),
      dwellThresholdMs: Math.round(clampNumber(source.dwellThresholdMs, 250, 10000, config.DEFAULT_SETTINGS.dwellThresholdMs)),
      cooldownMs: Math.round(clampNumber(source.cooldownMs, 250, 30000, config.DEFAULT_SETTINGS.cooldownMs)),
      minimumConfidence: clampNumber(source.minimumConfidence, 0, 1, config.DEFAULT_SETTINGS.minimumConfidence),
      cameraIndex: Math.round(clampNumber(source.cameraIndex, 0, 10, config.DEFAULT_SETTINGS.cameraIndex)),
      calibrationPoints: Math.round(clampNumber(source.calibrationPoints, 25, 25, config.DEFAULT_SETTINGS.calibrationPoints))
    };
  }

  async function loadSettings() {
    var stored = await browserApi.storage.local.get(config.STORAGE_KEYS.SETTINGS);
    return normalizeSettings(stored[config.STORAGE_KEYS.SETTINGS]);
  }

  async function saveSettings(settings) {
    var normalized = normalizeSettings(settings);
    await browserApi.storage.local.set((function () {
      var payload = {};
      payload[config.STORAGE_KEYS.SETTINGS] = normalized;
      return payload;
    })());
    return normalized;
  }

  async function loadCalibrationState() {
    var stored = await browserApi.storage.local.get(config.STORAGE_KEYS.CALIBRATION);
    return Object.assign({}, config.DEFAULT_CALIBRATION_STATE, stored[config.STORAGE_KEYS.CALIBRATION] || {});
  }

  async function saveCalibrationState(state) {
    var normalized = Object.assign({}, config.DEFAULT_CALIBRATION_STATE, state || {});
    await browserApi.storage.local.set((function () {
      var payload = {};
      payload[config.STORAGE_KEYS.CALIBRATION] = normalized;
      return payload;
    })());
    return normalized;
  }

  namespace.storage = {
    clone: clone,
    normalizeSettings: normalizeSettings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    loadCalibrationState: loadCalibrationState,
    saveCalibrationState: saveCalibrationState
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
