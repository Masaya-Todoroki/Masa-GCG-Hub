@echo off
cd /d "%~dp0"
python -c "import PIL" >nul 2>&1 || python -m pip install pillow
python explorer_menu.py install
pause
