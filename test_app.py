#!/usr/bin/env python
import sys
sys.path.insert(0, r'C:\Users\User\Downloads\STP Solar\solar_roi_app')

try:
    from app import app, calculate_solar_potential, calculate_roi
    print("✓ App loaded successfully")
    
    # Test solar potential calculation
    result = calculate_solar_potential(13.7563, 100.4925, 5)
    print(f"✓ Solar potential calculated: {result}")
    
    # Test ROI calculation
    roi = calculate_roi(5, 13.7563, 100.4925, 5)
    print(f"✓ ROI calculated - Payback period: {roi['payback_period']} years")
    
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
