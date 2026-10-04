$ErrorActionPreference = 'Stop'
# Run from auto-video-editor source directory on the target Windows computer.
node --version
python --version
ffmpeg -version
ffprobe -version
npm ci
python -m pip install faster-whisper==1.2.1
python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"
$editorBrowser = (node scripts/setup-browser.mjs | Select-Object -Last 1).Trim()
[Environment]::SetEnvironmentVariable('DAU_ANH_BROWSER', $editorBrowser, 'User')
$env:DAU_ANH_BROWSER = $editorBrowser
$editorPython = (python -c "import sys; print(sys.executable)").Trim()
[Environment]::SetEnvironmentVariable('DAU_ANH_PYTHON', $editorPython, 'User')
$env:DAU_ANH_PYTHON = $editorPython
npm run build
Write-Host 'Runtime ready. Run npm run dev, or build the installer with npm run package:win.'
