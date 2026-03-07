# Firefox MV2 Prototype Notes

## Goal

Implement gaze-triggered screenshot capture as a pure WebExtension:

- Eye tracking in JavaScript (no Python bridge)
- Explicit calibration before tracking
- Smoothed viewport gaze output
- 2-second anchored dwell trigger
- Capture + crop + local save pipeline

## EyeGesturesLite Mapping

- Eye landmarks and feature vector extraction: mirrored in `tracking/eyeGesturesLiteTracker.js`
- Calibrator model: `ML.MultivariateLinearRegression`
- Calibration matrix workflow: 25-point sequence
- Runtime prediction: point estimate + smoothing buffer
- Validity gating: invalid/no-face frames rejected from dwell progression

## Extension Responsibilities

- `contentScript.js`
  - tracker lifecycle
  - gaze sample ingestion
  - dwell engine updates
  - trigger dispatch to background
- `overlayManager.js`
  - transparent, click-through visualization (`pointer-events: none`)
  - reticle + debug anchor/pointer boxes
- `background.js` + `capturePipeline.js`
  - session state
  - capture/crop/download
  - metadata writing

## Dwell State Machine

- `IDLE`
- `TRACKING`
- `TRIGGERED`
- `COOLDOWN`

Defaults:

- anchor box: `200 x 200`
- pointer debug box: `10 x 10`
- dwell threshold: `2000 ms`
- cooldown: `3000 ms`

## Limits

- In-page overlay only
- Viewport capture only
- MV2 prototype constraints
