@echo off
cd /d "%~dp0"
python -c "import PIL, tkinterdnd2" >nul 2>&1 || python -m pip install -r requirements.txt
python gcg_tools.py
if errorlevel 1 pause
