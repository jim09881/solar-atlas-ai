from flask import Flask, render_template, request, jsonify, send_from_directory
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import math
import warnings
import os
import requests
from pathlib import Path
import base64
import io

warnings.filterwarnings("ignore")

# Try to import YOLO for image prediction
try:
    from ultralytics import YOLO
    import cv2
    YOLO_AVAILABLE = True
    CV2_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    CV2_AVAILABLE = False

# Try to import imageio and matplotlib for GIF creation
try:
    import imageio
    import matplotlib.pyplot as plt
    IMAGEIO_AVAILABLE = True
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    IMAGEIO_AVAILABLE = False
    MATPLOTLIB_AVAILABLE = False

try:
    from pvlib import location, irradiance, solarposition
    PVLIB_AVAILABLE = True
except ImportError:
    PVLIB_AVAILABLE = False

app = Flask(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Paths for model and image - ตรวจสอบหลายตำแหน่ง
BASE_DIR = Path(__file__).parent.parent

# ── Auto-download best.pt from Google Drive if not found ──────────────
GDRIVE_FILE_ID = os.environ.get("MODEL_GDRIVE_ID", "")  # ใส่ใน Render env vars

def download_model_from_gdrive(file_id: str, dest: Path) -> bool:
    """ดาวน์โหลด best.pt จาก Google Drive ด้วย gdown"""
    if not file_id:
        return False
    # ตัด /view?usp=sharing ออกถ้าติดมา
    file_id = file_id.split("/")[0].split("?")[0].strip()
    try:
        import gdown
        print(f"⬇️  กำลังดาวน์โหลดโมเดลจาก Google Drive (id={file_id})...")
        dest.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://drive.google.com/uc?id={file_id}"
        gdown.download(url, str(dest), quiet=False)
        if dest.exists() and dest.stat().st_size > 1024 * 1024:  # > 1MB
            size_mb = dest.stat().st_size / 1024 / 1024
            print(f"✅ ดาวน์โหลดสำเร็จ: {dest} ({size_mb:.1f} MB)")
            return True
        else:
            print(f"❌ ไฟล์ที่ดาวน์โหลดมีขนาดเล็กเกินไป")
            if dest.exists():
                dest.unlink()
            return False
    except Exception as e:
        print(f"❌ ดาวน์โหลดไม่สำเร็จ: {e}")
        return False

# ลองหาไฟล์ในหลายตำแหน่ง
possible_model_paths = [
    Path(__file__).parent / "best.pt",   # solar_roi_app/best.pt
    BASE_DIR / "best.pt",                # root/best.pt
    BASE_DIR / "ิbest.pt",
    Path("C:/Users/User/Downloads/stp-solar-roi-backup/best.pt"),
    Path.home() / "Downloads" / "stp-solar-roi-backup" / "best.pt",
]
possible_image_paths = [
    BASE_DIR / "SSTP.jpg",
    Path("C:/Users/User/Downloads/stp-solar-roi-backup/SSTP.jpg"),
    Path.home() / "Downloads" / "stp-solar-roi-backup" / "SSTP.jpg"
]

# หา path ที่มีไฟล์จริง — ถ้าไม่พบให้ลอง download จาก GDrive
MODEL_PATH = None
for path in possible_model_paths:
    if path.exists():
        MODEL_PATH = path
        break

if MODEL_PATH is None and GDRIVE_FILE_ID:
    gdrive_dest = Path(__file__).parent / "best.pt"
    if download_model_from_gdrive(GDRIVE_FILE_ID, gdrive_dest):
        MODEL_PATH = gdrive_dest

IMAGE_PATH = None
for path in possible_image_paths:
    if path.exists():
        IMAGE_PATH = path
        break

# Load YOLO model if available
yolo_model = None
if YOLO_AVAILABLE and MODEL_PATH and MODEL_PATH.exists():
    try:
        yolo_model = YOLO(str(MODEL_PATH))
        print(f"✅ โหลดโมเดล YOLO สำเร็จ: {MODEL_PATH}")
    except Exception as e:
        print(f"⚠️ ไม่สามารถโหลดโมเดล YOLO: {e}")
        yolo_model = None
elif not YOLO_AVAILABLE:
    print("⚠️ ultralytics ไม่ได้ติดตั้ง (pip install ultralytics)")
elif not MODEL_PATH or not MODEL_PATH.exists():
    print(f"⚠️ ไม่พบไฟล์โมเดล best.pt ในตำแหน่งที่ตรวจสอบ")
    print(f"   ตรวจสอบตำแหน่ง: {[str(p) for p in possible_model_paths]}")

# ค่าคงที่สำหรับการคำนวณ
SOLAR_PANEL_COST_PER_KW = 30000  # บาท (ราคาติดตั้งต่อ kW)
INSTALLATION_COST_MULTIPLIER = 0.5  # เพิ่มเติมสำหรับการติดตั้ง
PANEL_EFFICIENCY = 0.85  # ประสิทธิภาพของระบบ
INFLATION_RATE = 0.03  # อัตราเงินเฟ้อ
MAINTENANCE_COST_RATE = 0.005  # ค่าบำรุงรักษา 0.5% ต่อปี
PANEL_DEGRADATION_RATE = 0.007  # อัตราเสื่อมสภาพ 0.7% ต่อปี


def _require_pvlib():
    """
    ถ้าไม่มี pvlib ให้ raise error ชัดเจน (บังคับใช้ pvlib เป็นหลัก)
    """
    if not PVLIB_AVAILABLE:
        raise RuntimeError(
            "ต้องติดตั้ง pvlib ก่อนใช้งานการคำนวณ (pip install pvlib หรือ pip install -r requirements.txt)"
        )


def _require_gemini():
    """
    ตรวจสอบว่ามีการตั้งค่า GEMINI_API_KEY แล้ว
    """
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน environment ไม่สามารถเรียกผู้ช่วยครูบอลได้"
        )


def calculate_solar_potential(latitude, longitude, cloud_factor):
    """
    คำนวณศักยภาพพลังงานแสงอาทิตย์โดยใช้ pvlib แบบเต็ม:
    - ใช้ clearsky model (Ineichen) หาค่า GHI/DNI/DHI รายชั่วโมง 1 ปี
    - ใช้ pvlib คำนวณตำแหน่งดวงอาทิตย์
    - ใช้ pvlib.irradiance.get_total_irradiance หา POA บนระนาบแผง
    - ปรับด้วย cloud_factor จากผู้ใช้ (สภาพเมฆ)
    """
    _require_pvlib()

    # สร้าง location object
    loc = location.Location(
        latitude=latitude,
        longitude=longitude,
        tz="Asia/Bangkok",
        name="Site",
    )

    # ช่วงเวลา 1 ปี รายชั่วโมง
    times = pd.date_range(
        "2024-01-01", "2024-12-31 23:00", freq="1H", tz="Asia/Bangkok"
    )

    # Clear-sky irradiance (GHI, DNI, DHI)
    cs = loc.get_clearsky(times, model="ineichen")

    # ตำแหน่งดวงอาทิตย์
    solpos = loc.get_solarposition(times)

    # กำหนดองศาเอียงและทิศทางแผง (สมมติแผงหันใต้และเอียงใกล้ละติจูด)
    surface_tilt = max(0, min(40, float(latitude)))  # 0–40°
    surface_azimuth = 180.0  # หันไปทิศใต้

    poa = irradiance.get_total_irradiance(
        surface_tilt=surface_tilt,
        surface_azimuth=surface_azimuth,
        dni=cs["dni"],
        ghi=cs["ghi"],
        dhi=cs["dhi"],
        solar_zenith=solpos["zenith"],
        solar_azimuth=solpos["azimuth"],
    )

    # รวมพลังงานทั้งปี (Wh/m² → kWh/m²)
    annual_ghi_clearsky = cs["ghi"].sum() / 1000.0
    daily_ghi_clearsky = annual_ghi_clearsky / 365.0

    annual_poa_clearsky = poa["poa_global"].sum() / 1000.0  # kWh/m²/year

    # ปรับด้วย cloud factor จากผู้ใช้ (clear/partly/cloudy)
    annual_ghi_actual = annual_ghi_clearsky * cloud_factor
    daily_ghi_actual = daily_ghi_clearsky * cloud_factor
    annual_poa_actual = annual_poa_clearsky * cloud_factor

    # ใช้ pvlib เป็นฐาน แล้วใช้ system_loss รวม inverter+สาย ฯลฯ
    system_loss_factor = 0.85  # 15% loss โดยรวม

    # สำหรับ 1 kW DC, energy ≈ POA_actual (kWh/m²) เมื่อ normalize ต่อ kW,
    # จากนั้นปรับด้วย system_loss_factor
    annual_energy_per_kw = annual_poa_actual * system_loss_factor

    return {
        "annual_ghi": float(annual_ghi_actual),  # kWh/m²/year
        "annual_energy_production": float(annual_energy_per_kw),  # kWh/year per kW
        "ghi": float(daily_ghi_actual),  # kWh/m²/day
        "clearsky_ghi": float(daily_ghi_clearsky),
        "surface_tilt": surface_tilt,
        "surface_azimuth": surface_azimuth,
    }

def calculate_sun_angles_by_time(latitude, longitude):
    """
    คำนวณมุมพระอาทิตย์ตามเวลา 6:00-18:00 
    วันที่ 21 มีนาคม (Vernal Equinox) declination = 0
    ใช้สูตรดาราศาสตร์พื้นฐาน
    """
    _require_pvlib()

    # วันที่คงที่ 21 มีนาคม ปี 2024 เวลา 06:00-18:00 น. ช่วงละ 1 ชั่วโมง
    times = pd.date_range(
        "2024-03-21 06:00", "2024-03-21 18:00", freq="1H", tz="Asia/Bangkok"
    )

    loc = location.Location(
        latitude=latitude,
        longitude=longitude,
        tz="Asia/Bangkok",
        name="Site",
    )

    solpos = loc.get_solarposition(times)

    hourly_data = []
    for t, row in solpos.iterrows():
        elevation = float(row["elevation"])
        azimuth = float(row["azimuth"])
        zenith = float(row["zenith"])

        hourly_data.append(
            {
                "hour": t.hour,
                "time_str": f"{t.hour:02d}:00",
                "zenith": round(max(0, zenith), 2),
                "azimuth": round(azimuth % 360, 2),
                "elevation": round(max(0, elevation), 2),
            }
        )

    return hourly_data



def calculate_roi(system_size_kw, latitude, longitude, electricity_price, cloud_factor=0.85, capital_cost=None,
                  panel_cost_per_kw=None, installation_multiplier=None, maintenance_rate=None,
                  inflation_rate=None, degradation_rate=None, analysis_period=None, discount_rate=None):
    """
    คำนวณ ROI และ Payback Period
    รองรับ custom settings สำหรับ rates และ periods
    """
    # ใช้ custom settings ถ้ามี ไม่เช่นนั้นใช้ค่า default
    panel_cost = panel_cost_per_kw if panel_cost_per_kw is not None else SOLAR_PANEL_COST_PER_KW
    install_mult = installation_multiplier if installation_multiplier is not None else INSTALLATION_COST_MULTIPLIER
    maint_rate = maintenance_rate if maintenance_rate is not None else MAINTENANCE_COST_RATE
    infl_rate = inflation_rate if inflation_rate is not None else INFLATION_RATE
    deg_rate = degradation_rate if degradation_rate is not None else PANEL_DEGRADATION_RATE
    period = analysis_period if analysis_period is not None else 5
    disc_rate = discount_rate if discount_rate is not None else 0.05
    
    # คำนวณศักยภาพพลังงาน (ทั้งหมดอิง pvlib)
    solar_data = calculate_solar_potential(latitude, longitude, cloud_factor)
    annual_production = solar_data["annual_energy_production"] * system_size_kw  # kWh/year
    
    # คำนวณมุมพระอาทิตย์ตามเวลา
    hourly_angles = calculate_sun_angles_by_time(latitude, longitude)
    
    # คำนวณต้นทุนเริ่มต้น
    if capital_cost is None:
        capital_cost = system_size_kw * panel_cost * install_mult
    
    # ค่าใช้จ่ายรายปี
    annual_revenue = annual_production * electricity_price  # บาท/ปี
    annual_maintenance = capital_cost * maint_rate
    results = {
        'system_size_kw': system_size_kw,
        'capital_cost': capital_cost,
        'annual_production': annual_production,
        'annual_revenue': annual_revenue,
        'payback_period': None,
        'roi_5_years': None,
        'total_savings_5_years': None,
        'yearly_data': [],
        'annual_ghi': solar_data['annual_ghi'],
        'ghi': solar_data['ghi'],
        'hourly_angles': hourly_angles
    }
    
    cumulative_savings = 0
    cumulative_undiscounted = 0
    payback_found = False
    
    for year in range(1, period + 1):
        # ประสิทธิภาพเสื่อมสภาพ (ปีแรกมี 100% efficiency, เสื่อมสภาพตั้งแต่ปีที่ 2 เป็นต้นไป)
        degradation = (1 - deg_rate) ** (year - 1)
        
        # รายได้ปีนี้ (หลังจากเสื่อมสภาพ)
        year_revenue = annual_revenue * degradation
        
        # ค่าบำรุงรักษา (เพิ่มขึ้นตามเงินเฟ้อ)
        year_maintenance = annual_maintenance * (1 + infl_rate) ** year
        
        # กำไรสุทธิปีนี้
        year_profit = year_revenue - year_maintenance
        
        # ปรับด้วยอัตราคิดลด
        discounted_profit = year_profit / ((1 + disc_rate) ** year)
        
        cumulative_savings += discounted_profit
        cumulative_undiscounted += year_profit
        
        # ค้นหา Payback Period (เมื่อสะสมมากกว่า capital cost)
        if not payback_found and cumulative_undiscounted >= capital_cost:
            results['payback_period'] = year
            payback_found = True
        
        results["yearly_data"].append(
            {
                "year": year,
                "production": annual_production * degradation,
                "revenue": year_revenue,
                "maintenance": year_maintenance,
                "profit": year_profit,
                "cumulative": cumulative_savings,
                "cumulative_actual": cumulative_undiscounted,
            }
        )
    
    # คำนวณ ROI
    # ROI ควรคำนวณจาก cumulative_undiscounted (เงินจริงที่ได้) ไม่ใช่ discounted
    # เพราะ ROI คือ % ของเงินที่ได้คืนมาเทียบกับเงินลงทุน
    if capital_cost > 0:
        # ใช้ cumulative_actual (undiscounted) สำหรับ ROI calculation
        total_savings_actual = results["yearly_data"][-1]["cumulative_actual"]
        total_savings_discounted = results["yearly_data"][-1]["cumulative"]
        
        results["total_savings_5_years"] = total_savings_discounted  # สำหรับแสดงผล (discounted)
        results["total_savings_5_years_actual"] = total_savings_actual  # เงินจริงที่ได้ (undiscounted)
        
        # ROI = (กำไรสุทธิ / เงินลงทุน) * 100
        # total_savings_actual คือ profit ที่สะสม (รายได้ - ค่าบำรุง) ไม่รวมต้นทุน
        # ดังนั้น ROI = (total_savings_actual / capital_cost) * 100
        # แต่ถ้าต้องการ ROI ที่เป็น % ของเงินที่ได้คืนมาเทียบกับเงินลงทุน
        # ROI = ((total_savings_actual - capital_cost) / capital_cost) * 100
        # หรือ ROI = (total_savings_actual / capital_cost) * 100 - 100
        # ใช้แบบแรก: ROI = profit / capital_cost * 100 (แสดง % ของกำไรเทียบกับเงินลงทุน)
        results["roi_5_years"] = (total_savings_actual / capital_cost) * 100

    # ถ้ายังไม่ถึง payback ใน period ปี ให้คำนวณต่อจนกว่าจะถึง
    if not payback_found:
        max_years = 30  # สูงสุด 30 ปี
        for year in range(period + 1, max_years + 1):
            # ประสิทธิภาพเสื่อมสภาพ (ปีแรกมี 100% efficiency, เสื่อมสภาพตั้งแต่ปีที่ 2 เป็นต้นไป)
            degradation = (1 - deg_rate) ** (year - 1)
            
            # รายได้ปีนี้ (หลังจากเสื่อมสภาพ)
            year_revenue = annual_revenue * degradation
            
            # ค่าบำรุงรักษา (เพิ่มขึ้นตามเงินเฟ้อ)
            year_maintenance = annual_maintenance * (1 + infl_rate) ** year
            
            # กำไรสุทธิปีนี้
            year_profit = year_revenue - year_maintenance
            
            cumulative_undiscounted += year_profit
            
            # ค้นหา Payback Period (เมื่อสะสมมากกว่า capital cost)
            if cumulative_undiscounted >= capital_cost:
                results['payback_period'] = year
                payback_found = True
                break
        
        # ถ้ายังไม่ถึง payback ใน 30 ปี ให้เป็น None
        if not payback_found:
            results["payback_period"] = None

    # แนบข้อมูล solar เพิ่มเติมลงในผลลัพธ์
    results["annual_ghi"] = solar_data["annual_ghi"]
    results["ghi"] = solar_data["ghi"]

    return results


@app.route("/")
def index_redirect():
    """Redirect หน้าแรกไปยัง landing page"""
    from flask import redirect
    return redirect("/landing")


@app.route("/landing")
def landing():
    """หน้า Landing Page - AnimatedMarqueeHero"""
    return render_template("landing.html")


@app.route("/calculator")
def index():
    """หน้าคำนวณ ROI โซลาร์เซลล์"""
    return render_template("index.html")


@app.route("/dashboard")
def dashboard():
    """หน้า Dashboard แบบ React - Professional Solar Analytics"""
    return render_template("dashboard.html")

@app.route("/logo.jpg")
def serve_logo():
    """เสิร์ฟไฟล์โลโก้จากโฟลเดอร์ parent"""
    return send_from_directory(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logo.jpg"
    )


@app.route("/ball.png")
def serve_ball():
    """เสิร์ฟรูปครูบอล (อยู่โฟลเดอร์รากโปรเจกต์)"""
    return send_from_directory(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ball.png"
    )


# ========= Colors for Segmentation Classes =========
# ลำดับตาม Roboflow (เรียงตามตัวอักษร): E, FLAT, N, S, W
COLORS = {
    0: (0, 255, 255),    # E (East) - ฟ้า (cyan)
    1: (128, 128, 128),  # FLAT - เทา
    2: (255, 0, 255),    # N (North) - ม่วง
    3: (255, 255, 0),    # S (South) - เหลือง
    4: (255, 0, 0)       # W (West) - แดง
}

CLASS_NAMES = {
    0: "East",
    1: "Flat",
    2: "North", 
    3: "South",
    4: "West"
}


def multi_scale_segmentation(model, img, scales=[1.0], conf=0.1, iou=0.45):
    """
    Segmentation แบบตรงๆ ไม่มี augmentation เพื่อให้ตรงกับ Roboflow
    - ใช้ scale 1.0 เท่านั้น
    - conf=0.25 (default ของ YOLO)
    - iou=0.45 (default ของ YOLO)
    - รองรับ 5 classes: East, North, South, West, Flat
    """
    H, W = img.shape[:2]
    num_classes = 5  # East, North, South, West, Flat
    fused_mask = np.zeros((H, W, num_classes), dtype=np.float32)
    class_counts = [0] * num_classes

    # Resize ภาพเป็น 640x640 ตรงๆ (เหมือน Roboflow)
    img_resized = cv2.resize(img, (640, 640))
    
    # Predict แบบตรงๆ ไม่มี augmentation
    results = model.predict(img_resized, conf=conf, iou=iou, verbose=False)
    r = results[0]

    if r.masks is not None:
        for idx, mask in enumerate(r.masks.data):
            cls = int(r.boxes.cls[idx])
            
            if cls < 0 or cls >= num_classes:
                continue
                
            m = mask.cpu().numpy()
            m = cv2.resize(m, (W, H))
            
            conf_score = float(r.boxes.conf[idx])
            fused_mask[:, :, cls] += m * conf_score
            class_counts[cls] += 1

    # Normalize แต่ละ class แยกกัน
    for cls in range(num_classes):
        if fused_mask[:, :, cls].max() > 0:
            fused_mask[:, :, cls] = fused_mask[:, :, cls] / fused_mask[:, :, cls].max()
    
    print(f"Detection counts per class: E={class_counts[0]}, FLAT={class_counts[1]}, N={class_counts[2]}, S={class_counts[3]}, W={class_counts[4]}")

    return fused_mask


def visualize_fused_mask(img, fused_mask, threshold=0.1):
    """
    สร้าง overlay สีตาม class
    - ลด threshold เหลือ 0.1 เพื่อให้แสดง mask ที่มีค่าต่ำได้
    - รองรับ 5 classes: East, North, South, West, Flat
    """
    out = img.copy()
    num_classes = fused_mask.shape[2] if len(fused_mask.shape) > 2 else 5

    for cls in range(num_classes):
        mask = fused_mask[:, :, cls]
        mask_bin = (mask > threshold).astype(np.uint8)

        if mask_bin.sum() == 0:
            print(f"Class {CLASS_NAMES.get(cls, cls)}: No pixels above threshold {threshold}")
            continue

        color = COLORS.get(cls, (255, 255, 255))
        print(f"Class {CLASS_NAMES.get(cls, cls)}: {mask_bin.sum()} pixels detected")

        colored = np.zeros_like(img)
        colored[:] = color
        blended = cv2.addWeighted(colored, 0.5, img, 0.5, 0)

        out[mask_bin == 1] = blended[mask_bin == 1]

    return out


def image_to_base64(img):
    """แปลงรูปภาพเป็น base64 string"""
    _, buffer = cv2.imencode('.jpg', img)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    return img_base64


def create_solar_simulation_gif(img, fused_mask, latitude, longitude, date_str='2024-06-21', roof_tilt=30):
    """
    สร้าง GIF animation แสดงการเปลี่ยนแปลงแสงอาทิตย์บนหลังคาตามเวลา
    """
    if not IMAGEIO_AVAILABLE or not MATPLOTLIB_AVAILABLE:
        raise RuntimeError("ต้องติดตั้ง imageio และ matplotlib สำหรับสร้าง GIF")
    
    if not PVLIB_AVAILABLE:
        raise RuntimeError("ต้องติดตั้ง pvlib สำหรับคำนวณแสงอาทิตย์")
    
    H, W = img.shape[:2]
    
    # สร้าง location object
    tz = 'Asia/Bangkok'
    site = location.Location(latitude, longitude, tz=tz)
    
    # สร้างช่วงเวลา 1 วัน (6:00 - 18:00 ทุก 30 นาที)
    start_time = pd.Timestamp(f'{date_str} 06:00', tz=tz)
    end_time = pd.Timestamp(f'{date_str} 18:00', tz=tz)
    times = pd.date_range(start_time, end_time, freq='30min', tz=tz)
    
    # คำนวณ solar position และ clearsky
    solpos = site.get_solarposition(times)
    clearsky = site.get_clearsky(times)
    
    # Map class ไปยัง azimuth และ tilt
    # ลำดับตาม Roboflow: E, FLAT, N, S, W
    ROOF_CONFIG = {
        0: {"azimuth": 90, "tilt": roof_tilt},    # E (East)
        1: {"azimuth": 180, "tilt": 0},           # FLAT (หลังคาแบน - tilt = 0)
        2: {"azimuth": 0, "tilt": roof_tilt},     # N (North)
        3: {"azimuth": 180, "tilt": roof_tilt},   # S (South)
        4: {"azimuth": 270, "tilt": roof_tilt}    # W (West)
    }
    
    # สร้าง colormap
    cmap = plt.get_cmap('inferno')
    
    frames = []
    num_classes = fused_mask.shape[2] if len(fused_mask.shape) > 2 else 5
    
    for i, time in enumerate(times):
        frame_base = img.copy()
        heatmap_layer = np.zeros_like(img, dtype=np.float32)
        mask_accumulator = np.zeros((H, W), dtype=bool)
        
        current_solpos = solpos.iloc[i]
        current_clearsky = clearsky.iloc[i]
        
        for cls in range(num_classes):
            if cls not in ROOF_CONFIG:
                continue
            
            config = ROOF_CONFIG[cls]
            surface_azimuth = config["azimuth"]
            surface_tilt = config["tilt"]
                
            mask = fused_mask[:, :, cls]
            mask_bin = (mask > 0.1)  # ลด threshold เหลือ 0.1 เพื่อให้แสดงทิศได้มากขึ้น
            
            if mask_bin.sum() == 0:
                continue
            
            # คำนวณ POA (Plane of Array) irradiance
            poa = irradiance.get_total_irradiance(
                surface_tilt=surface_tilt,
                surface_azimuth=surface_azimuth,
                dni=current_clearsky['dni'],
                ghi=current_clearsky['ghi'],
                dhi=current_clearsky['dhi'],
                solar_zenith=current_solpos['apparent_zenith'],
                solar_azimuth=current_solpos['azimuth']
            )
            
            intensity = poa['poa_global']
            norm_intensity = min(intensity / 1000.0, 1.0)
            
            # แปลงเป็นสีจาก colormap
            color = np.array(cmap(norm_intensity)[:3]) * 255
            color = color[::-1]  # BGR format
            
            heatmap_layer[mask_bin] = color
            mask_accumulator = mask_accumulator | mask_bin
        
        # Blend heatmap กับรูปภาพ
        heatmap_uint8 = heatmap_layer.astype(np.uint8)
        blended = frame_base.copy()
        
        if mask_accumulator.sum() > 0:
            blended[mask_accumulator] = cv2.addWeighted(
                frame_base[mask_accumulator], 0.3,
                heatmap_uint8[mask_accumulator], 0.7, 0
            )
        
        # เพิ่มข้อความเวลา
        time_str = time.strftime("%H:%M")
        cv2.putText(
            blended, f"Time: {time_str}",
            (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1,
            (255, 255, 255), 2, cv2.LINE_AA
        )
        
        # แปลงเป็น RGB สำหรับ GIF
        frames.append(cv2.cvtColor(blended, cv2.COLOR_BGR2RGB))
    
    # สร้าง GIF พร้อม loop
    gif_buffer = io.BytesIO()
    
    try:
        # ใช้ imageio เพื่อสร้าง GIF พร้อม loop
        # loop=0 = infinite loop
        # subrectangles=True เพื่อลดขนาดไฟล์
        imageio.mimsave(
            gif_buffer,
            frames,
            fps=5,
            format='GIF',
            loop=0,  # 0 = infinite loop
            subrectangles=True  # ลดขนาดไฟล์
        )
        
        gif_buffer.seek(0)
        
        # ตรวจสอบว่า buffer มีข้อมูล
        buffer_size = len(gif_buffer.getvalue())
        if buffer_size == 0:
            raise ValueError("GIF buffer is empty after creation")
        
        print(f"GIF created successfully, size: {buffer_size} bytes, frames: {len(frames)}")
        return gif_buffer
        
    except Exception as e:
        print(f"Error creating GIF: {e}")
        import traceback
        traceback.print_exc()
        raise


def fetch_satellite_image(lat, lon, zoom=19, size="640x640"):
    """
    ดึงภาพดาวเทียมจาก ArcGIS World Imagery โดยให้พิกัดอยู่ตรงกลางภาพ
    ดึง 4 tiles (2x2) แล้ว crop ให้พิกัดอยู่ตรงกลาง
    """
    import requests
    import math
    
    n = 2 ** zoom
    
    # คำนวณ tile coordinates แบบ float เพื่อหา offset
    x_float = (lon + 180) / 360 * n
    y_float = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    
    x_tile = int(x_float)
    y_tile = int(y_float)
    
    # คำนวณ offset ภายใน tile (0-1)
    x_offset = x_float - x_tile
    y_offset = y_float - y_tile
    
    # ดึง 4 tiles (2x2 grid)
    tiles = []
    tile_size = 256
    
    for dy in range(2):
        row = []
        for dx in range(2):
            url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zoom}/{y_tile + dy}/{x_tile + dx}"
            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    img_array = np.frombuffer(response.content, np.uint8)
                    tile_img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                    if tile_img is not None:
                        row.append(tile_img)
                    else:
                        row.append(np.zeros((tile_size, tile_size, 3), dtype=np.uint8))
                else:
                    row.append(np.zeros((tile_size, tile_size, 3), dtype=np.uint8))
            except Exception as e:
                print(f"Error fetching tile: {e}")
                row.append(np.zeros((tile_size, tile_size, 3), dtype=np.uint8))
        tiles.append(row)
    
    # รวม 4 tiles เป็นภาพใหญ่ (512x512)
    top_row = np.hstack([tiles[0][0], tiles[0][1]])
    bottom_row = np.hstack([tiles[1][0], tiles[1][1]])
    combined = np.vstack([top_row, bottom_row])
    
    # คำนวณตำแหน่ง pixel ของพิกัดในภาพรวม
    center_x = int(x_offset * tile_size)
    center_y = int(y_offset * tile_size)
    
    # Crop 256x256 โดยให้พิกัดอยู่ตรงกลาง
    crop_size = 256
    half = crop_size // 2
    
    # ปรับให้ไม่เกินขอบ
    start_x = max(0, min(center_x - half, combined.shape[1] - crop_size))
    start_y = max(0, min(center_y - half, combined.shape[0] - crop_size))
    
    cropped = combined[start_y:start_y + crop_size, start_x:start_x + crop_size]
    
    # Resize to 640x640
    img = cv2.resize(cropped, (640, 640))
    
    return img


@app.route("/api/predict-image", methods=["POST"])
def predict_image():
    """
    API endpoint สำหรับตรวจจับทิศหลังคาด้วยโมเดล YOLO (best.pt)
    Multi-scale segmentation พร้อมแสดงผล overlay
    รับพิกัดจากผู้ใช้เพื่อดึงภาพดาวเทียม
    """
    try:
        # ตรวจสอบว่าโมเดลพร้อมใช้งาน
        if not YOLO_AVAILABLE or not CV2_AVAILABLE:
            return jsonify({
                "error": "โมเดล YOLO หรือ OpenCV ไม่พร้อมใช้งาน กรุณาติดตั้ง ultralytics และ opencv-python",
                "predictions": []
            }), 500

        if yolo_model is None:
            return jsonify({
                "error": f"ไม่พบไฟล์โมเดล best.pt ในตำแหน่งที่ตรวจสอบ",
                "predictions": [],
                "checked_paths": [str(p) for p in possible_model_paths]
            }), 404

        # รับพิกัดจาก request
        data = request.json or {}
        lat = data.get("latitude")
        lon = data.get("longitude")
        
        img = None
        image_source = "default"
        best_zoom = 18
        
        # ถ้ามีพิกัด ให้ลอง multi-zoom แล้วเลือกผลที่ดีที่สุด
        if lat is not None and lon is not None:
            try:
                lat = float(lat)
                lon = float(lon)
                
                # ลองหลาย zoom levels
                zoom_levels = [17, 18, 19, 20]
                best_detection_count = 0
                best_img = None
                
                for zoom in zoom_levels:
                    test_img = fetch_satellite_image(lat, lon, zoom=zoom)
                    if test_img is not None:
                        # ทดสอบ predict
                        test_resized = cv2.resize(test_img, (640, 640))
                        test_results = yolo_model.predict(test_resized, conf=0.25, verbose=False)
                        
                        # นับจำนวน detection
                        detection_count = 0
                        if test_results[0].masks is not None:
                            detection_count = len(test_results[0].masks.data)
                        
                        print(f"Zoom {zoom}: {detection_count} detections")
                        
                        if detection_count > best_detection_count:
                            best_detection_count = detection_count
                            best_img = test_img
                            best_zoom = zoom
                
                if best_img is not None:
                    img = best_img
                    image_source = f"satellite ({lat:.4f}, {lon:.4f}) zoom={best_zoom}"
                    print(f"Selected zoom={best_zoom} with {best_detection_count} detections")
                    
            except (ValueError, TypeError):
                pass
        
        # ถ้าดึงภาพดาวเทียมไม่ได้ ใช้รูปภาพคงที่
        if img is None:
            if not IMAGE_PATH or not IMAGE_PATH.exists():
                return jsonify({
                    "error": f"ไม่พบไฟล์รูปภาพ กรุณาเลือกตำแหน่งบนแผนที่ก่อน",
                    "predictions": []
                }), 404
            img = cv2.imread(str(IMAGE_PATH))
            image_source = "SSTP.jpg"
        
        if img is None:
            return jsonify({
                "error": "ไม่สามารถโหลดรูปภาพได้",
                "predictions": []
            }), 400

        H, W = img.shape[:2]

        # ทำ Multi-scale segmentation
        fused_mask = multi_scale_segmentation(yolo_model, img)

        # สร้าง overlay
        overlay = visualize_fused_mask(img, fused_mask)

        # แปลงรูปภาพเป็น base64
        original_base64 = image_to_base64(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        overlay_base64 = image_to_base64(cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB))

        # นับจำนวน pixels ของแต่ละ class (5 classes: East, North, South, West, Flat)
        class_stats = []
        threshold = 0.1  # ลด threshold เหลือ 0.1 เพื่อให้ตรวจจับได้มากขึ้น
        num_classes = fused_mask.shape[2] if len(fused_mask.shape) > 2 else 5
        for cls in range(num_classes):
            mask = fused_mask[:, :, cls]
            mask_bin = (mask > threshold).astype(np.uint8)
            pixel_count = int(mask_bin.sum())
            percentage = (pixel_count / (H * W)) * 100 if (H * W) > 0 else 0
            
            # แสดง max value ของ mask เพื่อ debug
            max_val = float(mask.max()) if mask.max() > 0 else 0
            print(f"Class {CLASS_NAMES.get(cls, cls)}: max_val={max_val:.3f}, pixels={pixel_count}")
            
            class_stats.append({
                "class": CLASS_NAMES.get(cls, f"Class {cls}"),
                "class_id": cls,
                "pixel_count": pixel_count,
                "percentage": round(percentage, 2),
                "color": COLORS.get(cls, (255, 255, 255)),
                "max_confidence": round(max_val, 3)
            })

        return jsonify({
            "success": True,
            "original_image": f"data:image/jpeg;base64,{original_base64}",
            "overlay_image": f"data:image/jpeg;base64,{overlay_base64}",
            "class_stats": class_stats,
            "message": f"ตรวจจับทิศหลังคาสำเร็จ พบ {len([s for s in class_stats if s['pixel_count'] > 0])} ทิศทาง",
            "image_path": str(IMAGE_PATH),
            "model_path": str(MODEL_PATH)
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": f"เกิดข้อผิดพลาดในการตรวจจับทิศหลังคา: {str(e)}",
            "predictions": []
        }), 500


@app.route("/api/create-solar-gif", methods=["POST"])
def create_solar_gif():
    """
    API endpoint สำหรับสร้าง GIF animation แสดงการเปลี่ยนแปลงแสงอาทิตย์
    ใช้ภาพดาวเทียมจากพิกัดที่ผู้ใช้เลือก
    """
    try:
        data = request.json or {}
        
        # ตรวจสอบว่าโมเดลพร้อมใช้งาน
        if not YOLO_AVAILABLE or not CV2_AVAILABLE:
            return jsonify({
                "error": "โมเดล YOLO หรือ OpenCV ไม่พร้อมใช้งาน"
            }), 500

        if yolo_model is None:
            return jsonify({
                "error": f"ไม่พบไฟล์โมเดล best.pt"
            }), 404

        # ดึงพารามิเตอร์
        latitude = float(data.get('latitude', 14.909999243404515))
        longitude = float(data.get('longitude', 102.07143026893837))
        date_str = data.get('date', '2024-06-21')
        roof_tilt = float(data.get('roof_tilt', 30))

        # ดึงภาพดาวเทียมจากพิกัด
        img = fetch_satellite_image(latitude, longitude, zoom=18)
        image_source = f"satellite ({latitude:.4f}, {longitude:.4f})"
        
        # ถ้าดึงไม่ได้ ใช้รูปภาพคงที่
        if img is None:
            if IMAGE_PATH and IMAGE_PATH.exists():
                img = cv2.imread(str(IMAGE_PATH))
                image_source = "SSTP.jpg (fallback)"
            else:
                return jsonify({
                    "error": "ไม่สามารถดึงภาพดาวเทียมได้ กรุณาลองใหม่"
                }), 404
        
        if img is None:
            return jsonify({
                "error": "ไม่สามารถโหลดรูปภาพได้"
            }), 400
        
        print(f"Using image from: {image_source}")

        # ทำ segmentation
        print(f"Starting segmentation...")
        fused_mask = multi_scale_segmentation(yolo_model, img)
        print(f"Segmentation completed")
        
        print(f"Creating GIF for date: {date_str}, lat: {latitude}, lon: {longitude}, tilt: {roof_tilt}")

        # สร้าง GIF
        try:
            gif_buffer = create_solar_simulation_gif(
                img, fused_mask, latitude, longitude, date_str, roof_tilt
            )
            
            # ตรวจสอบว่า buffer มีข้อมูล
            gif_bytes = gif_buffer.getvalue()
            print(f"GIF buffer created, size: {len(gif_bytes)} bytes")
            
            if len(gif_bytes) == 0:
                return jsonify({
                    "error": "GIF buffer ว่างเปล่า",
                    "gif_data": None,
                    "success": False
                }), 500
            
            # แปลง GIF เป็น base64
            gif_base64 = base64.b64encode(gif_bytes).decode('utf-8')
            print(f"GIF base64 encoded, length: {len(gif_base64)}")
            
            # ตรวจสอบว่า base64 ไม่ว่าง
            if not gif_base64 or len(gif_base64) < 100:
                return jsonify({
                    "error": "GIF base64 encoding ล้มเหลว",
                    "gif_data": None,
                    "success": False
                }), 500
            
            return jsonify({
                "success": True,
                "gif_data": f"data:image/gif;base64,{gif_base64}",
                "message": f"สร้าง GIF animation สำเร็จ สำหรับวันที่ {date_str}",
                "gif_size": len(gif_bytes)
            })
            
        except Exception as gif_error:
            import traceback
            traceback.print_exc()
            return jsonify({
                "error": f"เกิดข้อผิดพลาดในการสร้าง GIF: {str(gif_error)}",
                "gif_data": None,
                "success": False
            }), 500

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": f"เกิดข้อผิดพลาดในการสร้าง GIF: {str(e)}",
            "gif_data": None
        }), 500


def call_gemini_kru_ball(message: str, context=None) -> str:
    """
    เรียก Gemini API ให้ตอบในบทบาท \"ครูบอล\" ผู้เชี่ยวชาญโซลาร์
    """
    _require_gemini()

    # ใช้ endpoint เวอร์ชัน v1 และโมเดลเดียวกับที่คุณทดลองใน google-generativeai
    api_url = (
        "https://generativelanguage.googleapis.com/v1/models/"
        "gemini-2.5-flash:generateContent"
    )

    # สร้าง prompt แบบย่อ ให้ตอบเป็นภาษาไทย กระชับ ใช้ได้จริง
    base_instruction = (
"คุณคือ 'ครูบอล' วิศวกรผู้เชี่ยวชาญด้านระบบโซล่าเซลล์ในประเทศไทยที่มีประสบการณ์หน้างานจริง "
    "บุคลิก: ใจดี พูดจาฉะฉาน เป็นกันเองเหมือนคุยกับที่ปรึกษา (ใช้คำแทนตัวว่า 'ผม' หรือ 'ครูบอล') "
    "สไตล์การตอบ: เน้นเนื้อหาที่ 'ทำจริงได้' (Practical) ไม่ขายฝัน อ้างอิงมาตรฐานการไฟฟ้าไทย (MEA/PEA) เสมอ "
    "ข้อกำหนดพิเศษ: "
    "1. ถ้าคำถามสั้นหรือต้องการคำตอบเร็ว ให้ตอบกระชับ เข้าประเด็นทันที ไม่ต้องเกริ่นนำยืดเยื้อ "
    "2. ถ้าเป็นการคำนวณ (เช่น ขนาดระบบ/จุดคุ้มทุน) ให้แสดงที่มาตัวเลขคร่าวๆ "
    "3. ต้องเตือนเรื่องความปลอดภัย (Safety) และกฎหมายทุกครั้งที่แนะนำการติดตั้งเอง "
    "4. ภาษาที่ใช้ต้องเข้าใจง่าย ชาวบ้านอ่านรู้เรื่อง เลี่ยงศัพท์เทคนิคยากๆ หรือถ้าต้องใช้ให้อธิบายกำกับ"
    )

    context_text = ""
    if context:
        parts = []
        if "latitude" in context and "longitude" in context:
            parts.append(
                f"พิกัดติดตั้ง: lat={context['latitude']}, lon={context['longitude']}"
            )
        if "system_size_kw" in context:
            parts.append(f"ขนาดระบบที่กำลังคำนวณ: {context['system_size_kw']} kW")
        if "electricity_price" in context:
            parts.append(f"ค่าไฟที่ใช้คำนวณ: {context['electricity_price']} บาท/หน่วย")
        if parts:
            context_text = "ข้อมูลจากแบบจำลองในเว็บ:\n- " + "\n- ".join(parts) + "\n\n"

    full_prompt = (
        base_instruction
        + context_text
        + "คำถามจากผู้ใช้:\n"
        + message.strip()
    )

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": full_prompt}],
            }
        ]
    }

    try:
        resp = requests.post(
            api_url,
            params={"key": GEMINI_API_KEY},
            json=payload,
            timeout=60,  # บางครั้งโมเดลตอบช้า เพิ่มเวลาเป็น 60 วินาที
        )
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        return "ครูบอลรอนานเกินไป ลองส่งคำถามอีกครั้งนะครับ (timeout)"
    data = resp.json()

    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        text = "ครูบอลตอบไม่ได้ในตอนนี้ ลองถามใหม่อีกครั้งหรือตรวจสอบการตั้งค่า API ครับ"
    return text


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    API สำหรับผู้ช่วยครูบอล
    """
    try:
        data = request.json or {}
        message = str(data.get("message", "")).strip()
        if not message:
            return jsonify({"error": "กรุณาพิมพ์คำถามก่อน"}), 400

        context = data.get("context") or {}

        answer = call_gemini_kru_ball(message, context=context)

        return jsonify({"reply": answer})
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        import traceback

        traceback.print_exc()
        return jsonify({"error": f"เกิดข้อผิดพลาดจากผู้ช่วยครูบอล: {str(e)}"}), 500


@app.route("/api/calculate", methods=["POST"])
def calculate():
    """API endpoint สำหรับคำนวณ ROI"""
    try:
        data = request.json
        
        # Validate input
        electricity_price = float(data.get('electricity_price', 0))
        latitude = float(data.get('latitude', 0))
        longitude = float(data.get('longitude', 0))
        system_size = float(data.get('system_size', 5))
        
        # Optional: cloud coverage adjustment
        cloud_coverage = data.get('cloud_coverage', 'partly')
        cloud_factors = {
            'clear': 1.0,
            'partly': 0.85,
            'cloudy': 0.65
        }
        cloud_factor = cloud_factors.get(cloud_coverage, 0.85)
        
        # Optional: financing options
        financing_enabled = data.get('financing_enable', False)
        loan_years = int(data.get('loan_years', 7)) if financing_enabled else None
        interest_rate = float(data.get('interest_rate', 3.5)) / 100 if financing_enabled else None
        
        # Optional: custom settings
        custom_panel_cost = data.get('custom_panel_cost')
        custom_installation_multiplier = data.get('custom_installation_multiplier')
        custom_maintenance_rate = data.get('custom_maintenance_rate')
        custom_inflation_rate = data.get('custom_inflation_rate')
        custom_degradation_rate = data.get('custom_degradation_rate')
        custom_analysis_period = data.get('custom_analysis_period')
        custom_discount_rate = data.get('custom_discount_rate')
        
        # Convert percentages to decimals if needed (ensure they are numbers, not dicts)
        try:
            if custom_maintenance_rate is not None:
                custom_maintenance_rate = float(custom_maintenance_rate) / 100
        except (TypeError, ValueError):
            custom_maintenance_rate = None
            
        try:
            if custom_inflation_rate is not None:
                custom_inflation_rate = float(custom_inflation_rate) / 100
        except (TypeError, ValueError):
            custom_inflation_rate = None
            
        try:
            if custom_degradation_rate is not None:
                custom_degradation_rate = float(custom_degradation_rate) / 100
        except (TypeError, ValueError):
            custom_degradation_rate = None
            
        try:
            if custom_discount_rate is not None:
                custom_discount_rate = float(custom_discount_rate) / 100
        except (TypeError, ValueError):
            custom_discount_rate = None
        
        # Convert other numeric values
        try:
            if custom_panel_cost is not None:
                custom_panel_cost = float(custom_panel_cost)
        except (TypeError, ValueError):
            custom_panel_cost = None
            
        try:
            if custom_installation_multiplier is not None:
                custom_installation_multiplier = float(custom_installation_multiplier)
        except (TypeError, ValueError):
            custom_installation_multiplier = None
            
        try:
            if custom_analysis_period is not None:
                custom_analysis_period = int(custom_analysis_period)
        except (TypeError, ValueError):
            custom_analysis_period = None
        
        # Optional: battery options (from request)
        battery_enabled = bool(data.get('battery_enable', False))
        try:
            battery_capacity = float(data.get('battery_capacity', 0)) if battery_enabled else 0.0
        except (TypeError, ValueError):
            battery_capacity = 0.0
        try:
            battery_cost_per_kwh = float(data.get('battery_cost', 10000)) if battery_enabled else 0.0
        except (TypeError, ValueError):
            battery_cost_per_kwh = 0.0
        try:
            battery_efficiency = float(data.get('battery_efficiency', 0.85)) if battery_enabled else 0.0
        except (TypeError, ValueError):
            battery_efficiency = 0.0
        try:
            battery_lifespan = int(data.get('battery_lifespan', 10)) if battery_enabled else 0
        except (TypeError, ValueError):
            battery_lifespan = 0
        
        if latitude < -90 or latitude > 90 or longitude < -180 or longitude > 180:
            return jsonify({
                'error': 'ละติจูดหรือลองติจูดไม่ถูกต้อง',
                'suggestion': 'ตรวจสอบว่าพิกัดอยู่ระหว่าง -90 ถึง 90 (ละติจูด) และ -180 ถึง 180 (ลองติจูด) หรือคลิกบนแผนที่เพื่อเลือกตำแหน่ง'
            }), 400
        
        if electricity_price <= 0 or system_size <= 0:
            return jsonify({
                'error': 'ราคาไฟฟ้าและขนาดระบบต้องมากกว่า 0',
                'suggestion': 'ตรวจสอบว่าค่าทั้งหมดมากกว่า 0 และถูกต้อง'
            }), 400
        
        if system_size > 300:
            return jsonify({
                'error': 'ขนาดระบบเกินกว่า 300 kW ไม่สนับสนุน',
                'suggestion': 'กรุณากรอกขนาดระบบ 1-300 kW (แนะนำ 3-10 kW สำหรับบ้าน, 10-300 kW สำหรับอาคาร)'
            }), 400
        
        # คำนวณ ROI (ใช้ pvlib เป็นหลัก)
        results = calculate_roi(
            system_size,
            latitude,
            longitude,
            electricity_price,
            cloud_factor,
            capital_cost=None,
            panel_cost_per_kw=custom_panel_cost,
            installation_multiplier=custom_installation_multiplier,
            maintenance_rate=custom_maintenance_rate,
            inflation_rate=custom_inflation_rate,
            degradation_rate=custom_degradation_rate,
            analysis_period=custom_analysis_period,
            discount_rate=custom_discount_rate
        )
        
        # Add financing calculation if enabled
        if financing_enabled and loan_years and interest_rate is not None:
            monthly_rate = interest_rate / 12
            num_payments = loan_years * 12
            loan_amount = results['capital_cost']
            
            # Monthly payment = P * [r(1+r)^n] / [(1+r)^n - 1]
            if monthly_rate > 0:
                monthly_payment = loan_amount * (monthly_rate * (1 + monthly_rate) ** num_payments) / ((1 + monthly_rate) ** num_payments - 1)
            else:
                monthly_payment = loan_amount / num_payments
            
            results['monthly_payment'] = monthly_payment
            results['loan_years'] = loan_years
            results['total_interest'] = (monthly_payment * num_payments) - loan_amount
        
        # เตรียมข้อมูลสำหรับ response
        response = {
            'system_size_kw': results.get('system_size_kw', 0),
            'capital_cost': round(results.get('capital_cost', 0), 2),
            'annual_production': round(results.get('annual_production', 0), 2),
            'annual_revenue': round(results.get('annual_revenue', 0), 2),
            'payback_period': results.get('payback_period'),
            'roi_5_years': round(results.get('roi_5_years', 0), 2) if results.get('roi_5_years') else None,
            'total_savings_5_years': round(results.get('total_savings_5_years', 0), 2) if results.get('total_savings_5_years') else None,
            'annual_ghi': round(results.get('annual_ghi', 0), 4),
            'ghi': round(results.get('ghi', 0), 4),
            'hourly_angles': results.get('hourly_angles', []),
            'yearly_data': [
                {
                    'year': item['year'],
                    'production': round(item['production'], 2),
                    'revenue': round(item['revenue'], 2),
                    'maintenance': round(item['maintenance'], 2),
                    'profit': round(item['profit'], 2),
                    'cumulative': round(item['cumulative'], 2),
                    'cumulative_actual': round(item.get('cumulative_actual', 0), 2)
                }
                for item in results['yearly_data']
            ],
            'cloud_coverage': cloud_coverage,
            'cloud_factor': cloud_factor
        }

        # Calculate battery cost and attach to response
        battery_total_cost = battery_capacity * battery_cost_per_kwh if battery_enabled else 0
        response['battery_cost'] = round(battery_total_cost, 2) if battery_enabled else 0
        response['battery_capacity'] = battery_capacity if battery_enabled else 0
        response['battery_efficiency'] = battery_efficiency if battery_enabled else 0
        response['battery_lifespan'] = battery_lifespan if battery_enabled else 0

        # Add financing info if available
        if 'monthly_payment' in results:
            response['monthly_payment'] = round(results['monthly_payment'], 2)
            response['loan_years'] = results['loan_years']
            response['total_interest'] = round(results['total_interest'], 2)
        
        return jsonify(response)
    except RuntimeError as e:
        # ใช้เมื่อ pvlib ไม่สามารถใช้งานได้
        return jsonify({"error": str(e)}), 500
    except ValueError as e:
        return jsonify({"error": f"ข้อมูลอินพุตไม่ถูกต้อง: {str(e)}"}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception details: {str(e)}")
        return jsonify({"error": f"เกิดข้อผิดพลาด: {str(e)}"}), 500


# ============================================================
# NASA API Endpoints
# ============================================================

NASA_API_KEY = "DEMO_KEY"  # เปลี่ยนเป็น key จริงใน config


@app.route("/api/nasa/solar-data", methods=["GET"])
def nasa_solar_data():
    """
    ดึงข้อมูล Solar Irradiance จาก NASA POWER API
    Parameters: lat, lon, start (YYYYMMDD), end (YYYYMMDD)
    """
    try:
        lat = float(request.args.get("lat", 14.91))
        lon = float(request.args.get("lon", 102.07))
        start = request.args.get("start", "20240101")
        end = request.args.get("end", "20241231")

        url = (
            f"https://power.larc.nasa.gov/api/temporal/daily/point"
            f"?parameters=ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN,T2M,CLOUD_AMT"
            f"&community=RE&longitude={lon}&latitude={lat}"
            f"&start={start}&end={end}&format=JSON"
        )

        resp = requests.get(url, timeout=20)
        data = resp.json()

        props = data.get("properties", {}).get("parameter", {})

        # สรุปข้อมูลรายปี
        ghi_vals = list(props.get("ALLSKY_SFC_SW_DWN", {}).values())
        clr_vals = list(props.get("CLRSKY_SFC_SW_DWN", {}).values())
        temp_vals = list(props.get("T2M", {}).values())
        cloud_vals = list(props.get("CLOUD_AMT", {}).values())

        def safe_avg(lst):
            clean = [v for v in lst if v is not None and v != -999]
            return round(sum(clean) / len(clean), 3) if clean else 0

        return jsonify({
            "success": True,
            "location": {"lat": lat, "lon": lon},
            "period": {"start": start, "end": end},
            "summary": {
                "avg_ghi_daily": safe_avg(ghi_vals),        # kWh/m²/day
                "avg_clearsky_ghi": safe_avg(clr_vals),     # kWh/m²/day (ท้องฟ้าใส)
                "avg_temp_c": safe_avg(temp_vals),          # °C
                "avg_cloud_pct": safe_avg(cloud_vals),      # %
                "annual_ghi": round(safe_avg(ghi_vals) * 365, 1),  # kWh/m²/year
            },
            "raw_days": len(ghi_vals),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/nasa/monthly-solar", methods=["GET"])
def nasa_monthly_solar():
    """
    ดึงข้อมูล GHI รายเดือนจาก NASA POWER
    Parameters: lat, lon, year
    """
    try:
        lat = float(request.args.get("lat", 14.91))
        lon = float(request.args.get("lon", 102.07))
        year = request.args.get("year", "2024")

        url = (
            f"https://power.larc.nasa.gov/api/temporal/monthly/point"
            f"?parameters=ALLSKY_SFC_SW_DWN,T2M,CLOUD_AMT"
            f"&community=RE&longitude={lon}&latitude={lat}"
            f"&start={year}&end={year}&format=JSON"
        )

        resp = requests.get(url, timeout=20)
        data = resp.json()
        props = data.get("properties", {}).get("parameter", {})

        ghi_monthly = props.get("ALLSKY_SFC_SW_DWN", {})
        temp_monthly = props.get("T2M", {})
        cloud_monthly = props.get("CLOUD_AMT", {})

        month_names = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                       "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

        monthly = []
        for i, key in enumerate(sorted(ghi_monthly.keys())):
            ghi = ghi_monthly.get(key, 0)
            temp = temp_monthly.get(key, 0)
            cloud = cloud_monthly.get(key, 0)
            if ghi == -999: ghi = 0
            if temp == -999: temp = 0
            if cloud == -999: cloud = 0
            monthly.append({
                "month": month_names[i] if i < 12 else key,
                "ghi": round(float(ghi), 2),
                "temp": round(float(temp), 1),
                "cloud_pct": round(float(cloud), 1),
                "production_est": round(float(ghi) * 30 * 0.85, 1),  # kWh/kW/month
            })

        return jsonify({
            "success": True,
            "location": {"lat": lat, "lon": lon},
            "year": year,
            "monthly": monthly,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/nasa/apod", methods=["GET"])
def nasa_apod():
    """NASA Astronomy Picture of the Day — แสดงในหน้า dashboard"""
    try:
        url = f"https://api.nasa.gov/planetary/apod?api_key={NASA_API_KEY}"
        resp = requests.get(url, timeout=10)
        data = resp.json()
        return jsonify({
            "success": True,
            "title": data.get("title"),
            "date": data.get("date"),
            "explanation": data.get("explanation", "")[:300] + "...",
            "url": data.get("url"),
            "media_type": data.get("media_type"),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") != "production"
    app.run(debug=debug, host='0.0.0.0', port=port, use_reloader=False)
