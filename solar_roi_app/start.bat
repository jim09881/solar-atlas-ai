@echo off
REM Solar ROI Calculator - Startup Script
REM Author: Solar ROI Team

echo.
echo ============================================
echo   Solar ROI Calculator - Start
echo ============================================
echo.

REM ตรวจสอบว่า Python ติดตั้งแล้วหรือไม่
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Python ไม่ได้ติดตั้ง
    echo กรุณาติดตั้ง Python จาก https://www.python.org
    echo.
    pause
    exit /b 1
)

REM เข้าไปในโฟลเดอร์
cd /d "%~dp0"

REM ตรวจสอบว่า venv ถูกสร้างแล้วหรือไม่
if not exist ".venv" (
    echo.
    echo สร้าง Virtual Environment...
    python -m venv .venv
    echo.
)

REM เปิดใช้ venv
call .venv\Scripts\activate.bat

REM ติดตั้ง dependencies
echo.
echo ติดตั้ง packages...
pip install -r requirements.txt >nul 2>&1

REM เริ่มแอปพลิเคชัน
echo.
echo ============================================
echo   Launching Solar ROI Calculator...
echo ============================================
echo.
echo เว็บไซด์เปิดที่: http://127.0.0.1:5000
echo กด Ctrl+C เพื่อปิดแอป
echo.

python app.py

pause
