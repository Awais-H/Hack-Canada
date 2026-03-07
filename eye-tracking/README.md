# EyeGesturesLite Firefox MV2 Dwell Capture

Pure JavaScript Firefox Manifest V2 prototype for gaze-triggered screenshot capture.

- No local Python process
- No WebSocket bridge
- Eye tracking runs directly in the extension content script using EyeGesturesLite-style calibration and prediction flow

## What This Reimplementation Uses

This implementation is anchored to the EyeGesturesLite approach from:

- https://github.com/NativeSensors/EyeGesturesLite

Core pieces mirrored in-browser:

- FaceMesh landmark extraction from webcam frames
- Eye keypoint feature vector construction
- linear regression calibrator (`ML.MultivariateLinearRegression`)
- explicit multi-point calibration workflow (25 calibration points)
- smoothed gaze output for viewport coordinates

## Runtime Architecture

```text
extension/
  manifest.json
  background/
    background.js            # session state + message routing + capture trigger
    capturePipeline.js       # captureVisibleTab + crop + download files
  content/
    contentScript.js         # tracker lifecycle + dwell updates + trigger send
    dwellEngine.js           # IDLE/TRACKING/TRIGGERED/COOLDOWN anchor state machine
    overlayManager.js        # pointer/anchor/debug overlay (click-through)
  tracking/
    eyeGesturesLiteTracker.js
    vendor/
      face_mesh.js
      ml.min.js
  shared/
    browserAdapter.js
    config.js
    messages.js
    storage.js
  ui/
    popup.html
    popup.css
    popup.js
tests/
  dwellEngine.test.js
```

## Gaze + Dwell Behavior

- Pointer is always rendered when tracking output is valid and overlay is enabled.
- Debug mode shows:
  - 10x10 pointer box
  - 200x200 anchor box
  - dwell progress bar and tracker status text
- Anchor logic:
  - anchor box is centered on current gaze when tracking starts or when gaze exits current anchor
  - if gaze remains inside that 200x200 box for the dwell threshold (default `2000 ms`), a capture triggers
  - cooldown prevents immediate retriggers

## Capture Outputs

On trigger:

1. `tabs.captureVisibleTab` captures the active viewport
2. image is cropped to the anchor bounds
3. downloads are saved under `EyeGesturesLiteCaptures/` with deterministic names:
   - `output_<timestamp>_gaze_anchor_crop.png`
   - `output_<timestamp>_gaze_anchor_full.png` (optional)
   - `output_<timestamp>_gaze_anchor_meta.json` (optional)

## Setup + Run

See [setup.md](./setup.md) for Windows/macOS copy-paste blocks and Firefox loading steps.

## Calibration Flow

1. Load extension in Firefox (`about:debugging#/runtime/this-firefox`)
2. Open a normal webpage (not Firefox internal pages)
3. Open popup
4. Click `Run Calibration`
5. Wait for calibration to complete
6. Toggle `Tracking Enabled` on
7. Enable `Show Visual Overlay` and optionally `Debug Overlay`

## Development Checks

```powershell
cd D:\Repositories\Hackathons\Hack-Canada\eye-tracking
node tests\dwellEngine.test.js
Get-ChildItem extension -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Known Limitations

- This is a Firefox MV2 prototype, not production packaging.
- Overlay is in-page only (not OS-wide).
- Capture is viewport-only.
- The model is calibrated per session and not persisted to external native storage.
- FaceMesh runtime assets are vendored under `extension/tracking/vendor/` to avoid runtime CDN fetch failures.
- Performance/accuracy depend on camera quality, lighting, and head motion.
