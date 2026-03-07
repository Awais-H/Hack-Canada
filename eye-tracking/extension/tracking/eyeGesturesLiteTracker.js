(function initEyeGesturesLiteTracker(global) {
  "use strict";

  var namespace = global.EyeGazeCapture = global.EyeGazeCapture || {};

  var FACE_MESH_VERSION = "0.4.1633559619";
  var FACE_MESH_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@" + FACE_MESH_VERSION + "/";
  var FACE_MESH_LOCAL_BASE_PATH = "tracking/vendor/";
  var LEFT_EYE_KEYPOINTS = [
    33, 133, 160, 159, 158, 157, 173, 155, 154, 153, 144, 145, 153, 246, 468
  ];
  var RIGHT_EYE_KEYPOINTS = [
    362, 263, 387, 386, 385, 384, 398, 382, 381, 380, 374, 373, 374, 466, 473
  ];

  function euclideanDistance(pointA, pointB) {
    return Math.sqrt(
      pointA.reduce(function (sum, value, index) {
        return sum + Math.pow(value - pointB[index], 2);
      }, 0)
    );
  }

  function getFaceMeshAssetBase() {
    try {
      if (namespace.browser && namespace.browser.runtime && typeof namespace.browser.runtime.getURL === "function") {
        return namespace.browser.runtime.getURL(FACE_MESH_LOCAL_BASE_PATH);
      }
    } catch (error) {
      // fallback to CDN below
    }
    return FACE_MESH_BASE_URL;
  }

  function CalibrationMatrix() {
    this.iterator = 0;
    this.points = [
      [0.25, 0.25], [0.5, 0.75], [1, 0.5], [0.75, 0.5], [0, 0.75],
      [0.5, 0.5], [1.0, 0.25], [0.75, 0.0], [0.25, 0.5], [0.5, 0.0],
      [0, 0.5], [1.0, 1.0], [0.75, 1.0], [0.25, 0.0], [1.0, 0.0],
      [0, 1.0], [0.25, 1.0], [0.75, 0.75], [0.5, 0.25], [0, 0.25],
      [1.0, 0.5], [0.75, 0.25], [0.5, 1.0], [0.25, 0.75], [0.0, 0.0]
    ];
  }

  CalibrationMatrix.prototype.movePoint = function movePoint() {
    this.iterator = (this.iterator + 1) % this.points.length;
  };

  CalibrationMatrix.prototype.getCurrentPoint = function getCurrentPoint(width, height) {
    var current = this.points[this.iterator];
    return [current[0] * width, current[1] * height];
  };

  function Calibrator(calibrationRadius) {
    this.X = [];
    this.tmpX = [];
    this.yX = [];
    this.yY = [];
    this.tmpYX = [];
    this.tmpYY = [];
    this.regX = null;
    this.regY = null;
    this.fitted = false;
    this.acceptanceRadius = Math.floor((calibrationRadius || 1000) / 2);
    this.matrix = new CalibrationMatrix();
  }

  Calibrator.prototype.add = function add(features, point) {
    var flatFeatures = [].concat(features.flat());

    this.tmpX.push(flatFeatures);
    this.tmpYY.push([point[0]]);
    this.tmpYX.push([point[1]]);

    if (this.tmpYY.length > 40) {
      this.tmpYY.shift();
      this.tmpYX.shift();
      this.tmpX.shift();
    }

    if (!global.ML || !global.ML.MultivariateLinearRegression) {
      throw new Error("ML.MultivariateLinearRegression is unavailable.");
    }

    this.regX = new global.ML.MultivariateLinearRegression(
      [].concat(this.tmpX, this.X),
      [].concat(this.tmpYY, this.yY)
    );
    this.regY = new global.ML.MultivariateLinearRegression(
      [].concat(this.tmpX, this.X),
      [].concat(this.tmpYX, this.yX)
    );
    this.fitted = true;
  };

  Calibrator.prototype.predict = function predict(features) {
    var flatFeatures;

    if (!this.fitted || !this.regX || !this.regY) {
      return [0, 0];
    }

    flatFeatures = [].concat(features.flat());
    return [
      this.regX.predict(flatFeatures)[0],
      this.regY.predict(flatFeatures)[0]
    ];
  };

  Calibrator.prototype.movePoint = function movePoint() {
    this.matrix.movePoint();
    this.yY = this.yY.concat(this.tmpYY);
    this.yX = this.yX.concat(this.tmpYX);
    this.X = this.X.concat(this.tmpX);
    this.tmpX = [];
    this.tmpYY = [];
    this.tmpYX = [];
  };

  Calibrator.prototype.getCurrentPoint = function getCurrentPoint(width, height) {
    return this.matrix.getCurrentPoint(width, height);
  };

  Calibrator.prototype.unfit = function unfit() {
    this.fitted = false;
    this.yY = [];
    this.yX = [];
    this.X = [];
    this.tmpX = [];
    this.tmpYY = [];
    this.tmpYX = [];
    this.regX = null;
    this.regY = null;
    this.matrix = new CalibrationMatrix();
  };

  function EyeGesturesLiteTracker(options) {
    options = options || {};
    this.videoElementId = options.videoElementId || "eyegestures-video";
    this.cameraIndex = Number.isFinite(options.cameraIndex) ? options.cameraIndex : 0;
    this.onSample = typeof options.onSample === "function" ? options.onSample : function () {};
    this.onCalibration = typeof options.onCalibration === "function" ? options.onCalibration : function () {};
    this.onError = typeof options.onError === "function" ? options.onError : function () {};
    this.videoElement = null;
    this.stream = null;
    this.faceMesh = null;
    this.processing = false;
    this.processingFrame = false;
    this.trackingActive = false;
    this.calibrationActive = false;
    this.calibrator = new Calibrator();
    this.headStartingPos = [0, 0];
    this.startWidth = 0;
    this.startHeight = 0;
    this.prevCalibrationPoint = [0, 0];
    this.calibCounter = 0;
    this.calibMax = 25;
    this.calibrationHoldCounter = 0;
    this.smoothingBuffer = [];
    this.smoothingBufferMax = 20;
    this.lastPoint = [0, 0];
    this._calibrationReadyNotified = false;
  }

  EyeGesturesLiteTracker.prototype._emitError = function emitError(error) {
    var message = error && error.message ? error.message : String(error);
    this.onError(message);
  };

  EyeGesturesLiteTracker.prototype._ensureVideoElement = function ensureVideoElement() {
    var video = global.document.getElementById(this.videoElementId);

    if (!video) {
      video = global.document.createElement("video");
      video.id = this.videoElementId;
      video.width = 640;
      video.height = 480;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.style.position = "fixed";
      video.style.width = "1px";
      video.style.height = "1px";
      video.style.left = "-9999px";
      video.style.top = "-9999px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";
      global.document.documentElement.appendChild(video);
    }

    this.videoElement = video;
    return video;
  };

  EyeGesturesLiteTracker.prototype._buildCameraConstraint = async function buildCameraConstraint() {
    var devices = await global.navigator.mediaDevices.enumerateDevices();
    var cameras = devices.filter(function (device) {
      return device.kind === "videoinput";
    });
    var selected = cameras[this.cameraIndex];

    if (selected && selected.deviceId) {
      return {
        deviceId: {
          exact: selected.deviceId
        }
      };
    }

    return true;
  };

  EyeGesturesLiteTracker.prototype._buildFallbackConstraints = async function buildFallbackConstraints() {
    var constraints = [];
    var selectedConstraint = await this._buildCameraConstraint();

    constraints.push(selectedConstraint);

    if (selectedConstraint && selectedConstraint.deviceId && selectedConstraint.deviceId.exact) {
      constraints.push({
        deviceId: selectedConstraint.deviceId.exact
      });
    }

    constraints.push({
      facingMode: {
        ideal: "user"
      }
    });
    constraints.push(true);

    return constraints;
  };

  EyeGesturesLiteTracker.prototype._openCameraStream = async function openCameraStream() {
    var constraints = await this._buildFallbackConstraints();
    var uniqueKeys = {};
    var index;
    var current;
    var key;
    var lastError = null;

    for (index = 0; index < constraints.length; index += 1) {
      current = constraints[index];
      key = JSON.stringify(current);
      if (uniqueKeys[key]) {
        continue;
      }
      uniqueKeys[key] = true;

      try {
        return await global.navigator.mediaDevices.getUserMedia({
          video: current,
          audio: false
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Unable to access camera.");
  };

  EyeGesturesLiteTracker.prototype._ensureFaceMesh = async function ensureFaceMesh() {
    var self = this;
    var assetBase;

    if (this.faceMesh) {
      return;
    }

    if (typeof global.FaceMesh !== "function") {
      throw new Error("MediaPipe FaceMesh is unavailable in this extension context.");
    }

    assetBase = getFaceMeshAssetBase();
    this.faceMesh = new global.FaceMesh({
      locateFile: function (file) {
        return assetBase + file;
      }
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    try {
      await this.faceMesh.initialize();
    } catch (error) {
      throw new Error(
        "FaceMesh initialization failed. If this page has strict CSP, run calibration on https://example.com first. Details: " +
        (error && error.message ? error.message : String(error))
      );
    }
    this.faceMesh.onResults(function (results) {
      self._onFaceMeshResults(results);
    });
  };

  EyeGesturesLiteTracker.prototype._startProcessing = function startProcessing() {
    var self = this;

    if (this.processing) {
      return;
    }

    this.processing = true;

    function loop() {
      if (!self.processing) {
        return;
      }

      if (!self.processingFrame && self.videoElement && self.videoElement.readyState >= self.videoElement.HAVE_ENOUGH_DATA) {
        self.processingFrame = true;
        Promise.resolve(self.faceMesh.send({
          image: self.videoElement
        })).catch(function (error) {
          self._emitError(error);
        }).finally(function () {
          self.processingFrame = false;
        });
      }

      global.requestAnimationFrame(loop);
    }

    global.requestAnimationFrame(loop);
  };

  EyeGesturesLiteTracker.prototype._stopStream = function stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(function (track) {
        track.stop();
      });
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }
  };

  EyeGesturesLiteTracker.prototype.startEngine = async function startEngine() {
    var video;
    var stream;

    if (!global.isSecureContext) {
      throw new Error("Eye tracking requires a secure context (HTTPS or localhost).");
    }

    if (!global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera APIs are unavailable in this browser context.");
    }

    video = this._ensureVideoElement();
    await this._ensureFaceMesh();
    try {
      stream = await this._openCameraStream();
    } catch (error) {
      throw new Error("Camera access failed. Check camera permission and set Camera Index to 0.");
    }
    video.srcObject = stream;
    await video.play();
    this.stream = stream;
    this._startProcessing();
  };

  EyeGesturesLiteTracker.prototype.startTracking = async function startTracking(options) {
    options = options || {};
    if (Number.isFinite(options.cameraIndex)) {
      this.cameraIndex = Number(options.cameraIndex);
    }

    if (!this.processing) {
      await this.startEngine();
    }

    this.trackingActive = true;
    this.calibrationActive = false;
  };

  EyeGesturesLiteTracker.prototype.startCalibration = async function startCalibration(options) {
    options = options || {};
    if (Number.isFinite(options.cameraIndex)) {
      this.cameraIndex = Number(options.cameraIndex);
    }

    if (!this.processing) {
      await this.startEngine();
    }

    this.trackingActive = true;
    this.calibrationActive = true;
    this.calibCounter = 0;
    this.calibrationHoldCounter = 0;
    this.startWidth = 0;
    this.startHeight = 0;
    this.headStartingPos = [0, 0];
    this.prevCalibrationPoint = [0, 0];
    this.smoothingBuffer = [];
    this.calibrator.unfit();
    this._calibrationReadyNotified = false;

    this.onCalibration({
      status: "running",
      progress: 0
    });
  };

  EyeGesturesLiteTracker.prototype.stop = function stop() {
    this.processing = false;
    this.processingFrame = false;
    this.trackingActive = false;
    this.calibrationActive = false;
    this.smoothingBuffer = [];
    this._stopStream();
  };

  EyeGesturesLiteTracker.prototype.recalibrate = async function recalibrate(options) {
    await this.startCalibration(options);
  };

  EyeGesturesLiteTracker.prototype._onFaceMeshResults = function onFaceMeshResults(results) {
    var landmarks;
    var leftEyeCoordinates = [];
    var rightEyeCoordinates = [];
    var offsetX;
    var offsetY;
    var maxX;
    var maxY;
    var width;
    var height;
    var scaleX;
    var scaleY;
    var self = this;

    if (!this.trackingActive) {
      return;
    }

    if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      this.onSample({
        timestamp: Date.now(),
        x: this.lastPoint[0],
        y: this.lastPoint[1],
        valid: false,
        confidence: 0,
        calibrating: this.calibrationActive
      });
      return;
    }

    landmarks = results.multiFaceLandmarks[0];
    offsetX = landmarks[0].x;
    offsetY = landmarks[1].y;
    maxX = landmarks[0].x;
    maxY = landmarks[1].y;

    landmarks.forEach(function (landmark) {
      offsetX = Math.min(offsetX, landmark.x);
      offsetY = Math.min(offsetY, landmark.y);
      maxX = Math.max(maxX, landmark.x);
      maxY = Math.max(maxY, landmark.y);
    });

    width = Math.max(maxX - offsetX, 1e-6);
    height = Math.max(maxY - offsetY, 1e-6);

    if (this.startWidth * this.startHeight === 0) {
      this.startWidth = width;
      this.startHeight = height;
    }

    scaleX = width / this.startWidth;
    scaleY = height / this.startHeight;

    LEFT_EYE_KEYPOINTS.forEach(function (index) {
      var point = landmarks[index];
      leftEyeCoordinates.push([
        ((point.x - offsetX) / width) * scaleX,
        ((point.y - offsetY) / height) * scaleY
      ]);
    });

    RIGHT_EYE_KEYPOINTS.forEach(function (index) {
      var point = landmarks[index];
      rightEyeCoordinates.push([
        ((point.x - offsetX) / width) * scaleX,
        ((point.y - offsetY) / height) * scaleY
      ]);
    });

    self._processKeyPoints(
      leftEyeCoordinates,
      rightEyeCoordinates,
      offsetX * scaleX,
      offsetY * scaleY,
      scaleX,
      scaleY,
      width,
      height
    );
  };

  EyeGesturesLiteTracker.prototype._processKeyPoints = function processKeyPoints(
    leftEyeCoordinates,
    rightEyeCoordinates,
    offsetX,
    offsetY,
    scaleX,
    scaleY,
    width,
    height
  ) {
    var keypoints = leftEyeCoordinates.concat(rightEyeCoordinates);
    var calibrationPoint = [0, 0];
    var predicted;
    var averaged = [0, 0];
    var calibrating = this.calibrationActive && this.calibCounter < this.calibMax;
    var pointerX;
    var pointerY;
    var screenWidth = Math.max(global.document.documentElement.clientWidth || 0, global.innerWidth || 0);
    var screenHeight = Math.max(global.document.documentElement.clientHeight || 0, global.innerHeight || 0);

    keypoints = keypoints.concat([[scaleX, scaleY]]);
    keypoints = keypoints.concat([[width, height]]);

    if (this.headStartingPos[0] === 0 && this.headStartingPos[1] === 0) {
      this.headStartingPos[0] = offsetX;
      this.headStartingPos[1] = offsetY;
    }

    keypoints = keypoints.concat([[
      offsetX - this.headStartingPos[0],
      offsetY - this.headStartingPos[1]
    ]]);

    predicted = this.calibrator.predict(keypoints);
    this.smoothingBuffer.push(predicted);
    if (this.smoothingBuffer.length > this.smoothingBufferMax) {
      this.smoothingBuffer.shift();
    }

    if (this.smoothingBuffer.length > 0) {
      averaged = this.smoothingBuffer.reduce(function (sum, point) {
        return [sum[0] + point[0], sum[1] + point[1]];
      }, [0, 0]).map(function (value) {
        return value / Math.max(1, this.smoothingBuffer.length);
      }, this);
    }

    predicted = averaged;

    if (calibrating) {
      calibrationPoint = this.calibrator.getCurrentPoint(screenWidth, screenHeight);
      this.calibrator.add(keypoints, calibrationPoint);

      if (euclideanDistance(predicted, calibrationPoint) < 0.1 * screenWidth) {
        if (this.calibrationHoldCounter > 20) {
          this.calibrator.movePoint();
          this.calibrationHoldCounter = 0;
        } else {
          this.calibrationHoldCounter += 1;
        }
      } else {
        this.calibrationHoldCounter = 0;
      }

      if (this.prevCalibrationPoint[0] !== calibrationPoint[0] || this.prevCalibrationPoint[1] !== calibrationPoint[1]) {
        this.prevCalibrationPoint = calibrationPoint;
        this.calibCounter += 1;
        this.onCalibration({
          status: "running",
          progress: Math.max(0, Math.min(1, this.calibCounter / this.calibMax))
        });
      }

      if (this.calibCounter >= this.calibMax && !this._calibrationReadyNotified) {
        this.calibrationActive = false;
        this._calibrationReadyNotified = true;
        this.onCalibration({
          status: "ready",
          progress: 1
        });
      }
    }

    pointerX = Math.min(Math.max(predicted[0], 0), screenWidth);
    pointerY = Math.min(Math.max(predicted[1], 0), screenHeight);
    this.lastPoint = [pointerX, pointerY];

    this.onSample({
      timestamp: Date.now(),
      x: pointerX,
      y: pointerY,
      rawX: predicted[0],
      rawY: predicted[1],
      valid: true,
      confidence: calibrating ? 0.6 : 1,
      calibrating: calibrating
    });
  };

  namespace.tracking = namespace.tracking || {};
  namespace.tracking.EyeGesturesLiteTracker = EyeGesturesLiteTracker;
})(typeof globalThis !== "undefined" ? globalThis : this);
