# Setup (JS-Only WebExtension)

This reimplementation is fully JavaScript-based.  
You do not need Python, a virtual environment, or a local companion service.

## Windows (PowerShell) - One Copy/Paste Block

```powershell
cd D:\Repositories\Hackathons\Hack-Canada\eye-tracking

# Optional sanity checks (safe to skip)
node --version
Get-ChildItem extension -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
node tests\dwellEngine.test.js

# In Firefox address bar, open:
# about:debugging#/runtime/this-firefox
#
# Then click:
# Load Temporary Add-on
#
# Select this exact file:
# D:\Repositories\Hackathons\Hack-Canada\eye-tracking\extension\manifest.json
#
# After loading:
# 1) Open a normal website tab (not about:* pages)
# 2) Open extension popup
# 3) Click Run Calibration
# 4) Enable Tracking Enabled
# 5) Keep Show Visual Overlay ON to see pointer/overlay
# 6) Enable Debug Overlay to see 10x10 pointer box + 200x200 anchor box
```

## macOS (zsh/bash) - One Copy/Paste Block

```bash
cd /path/to/Hack-Canada/eye-tracking

# Optional sanity checks (safe to skip)
node --version
find extension -name "*.js" -print0 | xargs -0 -I{} node --check "{}"
node tests/dwellEngine.test.js

# In Firefox address bar, open:
# about:debugging#/runtime/this-firefox
#
# Then click:
# Load Temporary Add-on
#
# Select this exact file:
# /path/to/Hack-Canada/eye-tracking/extension/manifest.json
#
# After loading:
# 1) Open a normal website tab (not about:* pages)
# 2) Open extension popup
# 3) Click Run Calibration
# 4) Enable Tracking Enabled
# 5) Keep Show Visual Overlay ON to see pointer/overlay
# 6) Enable Debug Overlay to see 10x10 pointer box + 200x200 anchor box
```

## Where `manifest.json` Goes

`manifest.json` already exists in the repo.  
Do not move it. Load it directly from:

- `eye-tracking/extension/manifest.json`

## Notes

- If the overlay is enabled but you still do not see the pointer, finish calibration first.
- Test on regular `https://` pages, not Firefox internal pages.
- Camera permission must be allowed when Firefox prompts.
