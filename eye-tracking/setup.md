# Setup

This prototype uses a local Python virtual environment for the EyeTrax companion bridge.

## Windows

Use Python 3.11. On this machine, the most reliable path is `pymanager.exe`.

```powershell
cd D:\Repositories\Hackathons\Hack-Canada\eye-tracking
& "$env:LOCALAPPDATA\Microsoft\WindowsApps\pymanager.exe" exec -3.11 -m venv .venv
Set-ExecutionPolicy -Scope Process Bypass
. .\.venv\Scripts\Activate.ps1
python --version
python -m pip install --upgrade pip
python -m pip install -r companion\requirements.txt
cd companion
. ..\.venv\Scripts\Activate.ps1
python -m eyetrax_bridge.server --host 127.0.0.1 --port 8765
```

If `py` is available on your machine, this also works:

```powershell
cd D:\Repositories\Hackathons\Hack-Canada\eye-tracking
py -3.11 -m venv .venv
Set-ExecutionPolicy -Scope Process Bypass
. .\.venv\Scripts\Activate.ps1
python --version
python -m pip install --upgrade pip
python -m pip install -r companion\requirements.txt
cd companion
. ..\.venv\Scripts\Activate.ps1
python -m eyetrax_bridge.server --host 127.0.0.1 --port 8765
```

If neither `pymanager.exe` nor `py` is available, use a direct Python 3.11 path:

```powershell
cd D:\Repositories\Hackathons\Hack-Canada\eye-tracking
& "C:\Path\To\Python311\python.exe" -m venv .venv
Set-ExecutionPolicy -Scope Process Bypass
. .\.venv\Scripts\Activate.ps1
python --version
python -m pip install --upgrade pip
python -m pip install -r companion\requirements.txt
cd companion
. ..\.venv\Scripts\Activate.ps1
python -m eyetrax_bridge.server --host 127.0.0.1 --port 8765
```

Activate the venv later:

```powershell
cd D:\Repositories\Hackathons\Hack-Canada\eye-tracking
. .\.venv\Scripts\Activate.ps1
```

## macOS

Use Python 3.11 if possible.

```bash
cd /path/to/Hack-Canada/eye-tracking
python3.11 -m venv .venv
source .venv/bin/activate
python --version
python -m pip install --upgrade pip
python -m pip install -r companion/requirements.txt
cd companion
source ../.venv/bin/activate
python -m eyetrax_bridge.server --host 127.0.0.1 --port 8765
```

If `python3.11` is not on your PATH but `python3` points to 3.11:

```bash
cd /path/to/Hack-Canada/eye-tracking
python3 -m venv .venv
source .venv/bin/activate
python --version
python -m pip install --upgrade pip
python -m pip install -r companion/requirements.txt
cd companion
source ../.venv/bin/activate
python -m eyetrax_bridge.server --host 127.0.0.1 --port 8765
```

Activate the venv later:

```bash
cd /path/to/Hack-Canada/eye-tracking
source .venv/bin/activate
```

## Firefox Extension Setup

After the companion bridge is running, load the Firefox extension manually.

### What to type into Firefox

In the Firefox address bar, open:

```text
about:debugging#/runtime/this-firefox
```

### What to select

1. Click `Load Temporary Add-on`
2. Browse to the `eye-tracking/extension/` folder
3. Select this file:

```text
eye-tracking/extension/manifest.json
```

On this machine, the full path is:

```text
D:\Repositories\Hackathons\Hack-Canada\eye-tracking\extension\manifest.json
```

### After loading the extension

1. Open a normal webpage, not a Firefox internal page
2. Click the extension icon to open the popup
3. Click `Reconnect Bridge`
4. Click `Run Calibration`
5. Finish the EyeTrax calibration flow
6. Turn on `Tracking Enabled`
7. If you want to see the gaze pointer and anchor box, turn on `Debug Overlay`
