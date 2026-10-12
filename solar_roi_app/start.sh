#!/bin/bash
# Solar ROI Calculator - Startup Script (macOS/Linux)

echo ""
echo "============================================"
echo "  Solar ROI Calculator - Start"
echo "============================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python from https://www.python.org"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Show Python version
echo "Python version:"
python3 --version
echo ""

# Enter the app directory
cd "$(dirname "$0")/solar_roi_app"

# Check if venv exists
if [ ! -d ".venv" ]; then
    echo "Creating Virtual Environment..."
    python3 -m venv .venv
    echo ""
fi

# Activate venv
source .venv/bin/activate

# Install dependencies
echo "Installing packages..."
pip install -r requirements.txt > /dev/null 2>&1

# Start the application
echo ""
echo "============================================"
echo "  Launching Solar ROI Calculator..."
echo "============================================"
echo ""
echo "Website is running at: http://127.0.0.1:5000"
echo "Press Ctrl+C to close the app"
echo ""

python3 app.py

read -p "Press Enter to exit..."
