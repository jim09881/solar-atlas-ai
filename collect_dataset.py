"""
collect_dataset.py
==================
Script เก็บภาพดาวเทียมจาก ArcGIS World Imagery
ใช้ logic เดียวกับ fetch_satellite_image() ใน app.py ทุกขั้นตอน

ขนาดภาพ output: 640x640 px  ← เหมือนกับที่โมเดลใช้บนเว็บ
Pipeline:
  ArcGIS tile (256px) → ดึง 2x2 grid → 512x512 → crop 256x256 → resize 640x640

การใช้งาน:
  python collect_dataset.py

โครงสร้าง output:
  dataset/
    images/
      train/   ← 80%
      val/     ← 20%
    labels/
      train/
      val/
    raw/       ← ภาพ raw ก่อน label (เปิดใน label studio / roboflow)
"""

import os
import math
import time
import json
import random
import requests
import numpy as np
import cv2
from pathlib import Path
from datetime import datetime

# ─────────────────────────────────────────────
# CONFIG — ปรับได้ตามต้องการ
# ─────────────────────────────────────────────

OUTPUT_DIR   = Path("dataset")
RAW_DIR      = OUTPUT_DIR / "raw"
IMAGES_TRAIN = OUTPUT_DIR / "images" / "train"
IMAGES_VAL   = OUTPUT_DIR / "images" / "val"
LABELS_TRAIN = OUTPUT_DIR / "labels" / "train"
LABELS_VAL   = OUTPUT_DIR / "labels" / "val"

# ขนาดภาพ — ต้องตรงกับ app.py และ YOLO training
FINAL_SIZE   = 640   # px  ← เหมือนบนเว็บ 100%
CROP_SIZE    = 256   # px  crop ก่อน resize (เหมือน app.py)
TILE_SIZE    = 256   # px  ArcGIS tile size

# Zoom levels — เหมือนกับที่ app.py ทดสอบ
ZOOM_LEVELS  = [17, 18, 19, 20]
DEFAULT_ZOOM = 19    # zoom หลักที่ใช้บนเว็บ

# จำนวนภาพต่อพิกัด (multi-zoom)
ZOOM_PER_COORD = 2   # ดึง zoom 18 และ 19 ต่อ 1 จุด

# Train/Val split
VAL_RATIO    = 0.2   # 20% val

# Delay ระหว่าง request (กัน rate limit)
REQUEST_DELAY = 0.3  # วินาที

# ─────────────────────────────────────────────
# พิกัดเป้าหมาย — หลังคาในประเทศไทย
# เพิ่มพิกัดที่มีหลังคาชัดเจน zoom 18-20
# ─────────────────────────────────────────────

LOCATIONS = [
    # ─── นครราชสีมา (รอบโรงเรียนสุรธรรมพิทักษ์) ───
    {"name": "STP_school",     "lat": 14.9100, "lon": 102.0714},
    {"name": "STP_nearby_1",   "lat": 14.9112, "lon": 102.0720},
    {"name": "STP_nearby_2",   "lat": 14.9095, "lon": 102.0700},
    {"name": "STP_nearby_3",   "lat": 14.9085, "lon": 102.0730},
    {"name": "STP_nearby_4",   "lat": 14.9120, "lon": 102.0695},
    {"name": "STP_nearby_5",   "lat": 14.9075, "lon": 102.0745},

    # ─── กรุงเทพ ─── ย่านที่อยู่อาศัย
    {"name": "bkk_ladprao",    "lat": 13.8100, "lon": 100.5700},
    {"name": "bkk_bangkapi",   "lat": 13.7700, "lon": 100.6400},
    {"name": "bkk_minburi",    "lat": 13.8050, "lon": 100.7500},
    {"name": "bkk_bangna",     "lat": 13.6700, "lon": 100.6000},
    {"name": "bkk_ramkhamhaeng","lat": 13.7600, "lon": 100.6600},
    {"name": "bkk_thonburi",   "lat": 13.7200, "lon": 100.4800},
    {"name": "bkk_nonthaburi", "lat": 13.8600, "lon": 100.5200},
    {"name": "bkk_samutprakan","lat": 13.5990, "lon": 100.5990},

    # ─── เชียงใหม่ ───
    {"name": "cnx_muang",      "lat": 18.7950, "lon": 98.9750},
    {"name": "cnx_hangdong",   "lat": 18.6800, "lon": 98.9200},
    {"name": "cnx_saraphi",    "lat": 18.7000, "lon": 99.0300},
    {"name": "cnx_sansai",     "lat": 18.9000, "lon": 99.0500},

    # ─── ขอนแก่น ───
    {"name": "kkn_muang",      "lat": 16.4410, "lon": 102.8360},
    {"name": "kkn_nongwang",   "lat": 16.4600, "lon": 102.8600},
    {"name": "kkn_mueang2",    "lat": 16.4200, "lon": 102.8200},

    # ─── ชลบุรี / พัทยา ───
    {"name": "chon_si_racha",  "lat": 13.1740, "lon": 100.9320},
    {"name": "chon_pattaya",   "lat": 12.9340, "lon": 100.8830},
    {"name": "chon_laemchabang","lat": 13.0810, "lon": 100.8780},

    # ─── สุราษฎร์ธานี / ใต้ ───
    {"name": "surat_muang",    "lat": 9.1390,  "lon": 99.3260},
    {"name": "hat_yai",        "lat": 7.0080,  "lon": 100.4760},
    {"name": "phuket_rawai",   "lat": 7.7830,  "lon": 98.3180},

    # ─── อุดรธานี / อีสาน ───
    {"name": "udon_muang",     "lat": 17.4150, "lon": 102.7870},
    {"name": "udon_nong_bua",  "lat": 17.3900, "lon": 102.8200},

    # ─── อยุธยา / ภาคกลาง ───
    {"name": "ayutthaya_muang","lat": 14.3600, "lon": 100.5700},
    {"name": "saraburi_muang", "lat": 14.5300, "lon": 100.9100},
    {"name": "nakhon_sawan",   "lat": 15.6950, "lon": 100.1200},

    # ─── ระยอง / อีสเทิร์น ───
    {"name": "rayong_muang",   "lat": 12.6820, "lon": 101.2580},
    {"name": "chachoengsao",   "lat": 13.6880, "lon": 101.0690},
]


# ─────────────────────────────────────────────
# CORE: เหมือน fetch_satellite_image() ใน app.py
# ─────────────────────────────────────────────

def fetch_tile(zoom: int, x: int, y: int) -> np.ndarray | None:
    """ดึง 1 tile จาก ArcGIS World Imagery"""
    url = (
        f"https://server.arcgisonline.com/ArcGIS/rest/services/"
        f"World_Imagery/MapServer/tile/{zoom}/{y}/{x}"
    )
    try:
        resp = requests.get(url, timeout=15,
                            headers={"User-Agent": "DatasetCollector/1.0"})
        if resp.status_code == 200:
            arr = np.frombuffer(resp.content, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return img
    except Exception as e:
        print(f"  ⚠️  tile error ({zoom}/{y}/{x}): {e}")
    return None


def fetch_satellite_image_exact(lat: float, lon: float, zoom: int) -> np.ndarray | None:
    """
    ดึงภาพ ArcGIS แบบ IDENTICAL กับ app.py:
      1) คำนวณ tile + sub-pixel offset
      2) ดึง 2x2 tiles → 512x512
      3) crop 256x256 ให้พิกัดอยู่กลาง
      4) resize → 640x640
    """
    n = 2 ** zoom
    x_float = (lon + 180) / 360 * n
    y_float = (
        (1 - math.log(math.tan(math.radians(lat)) +
                      1 / math.cos(math.radians(lat))) / math.pi)
        / 2 * n
    )

    x_tile = int(x_float)
    y_tile = int(y_float)
    x_off  = x_float - x_tile   # 0-1 offset ภายใน tile
    y_off  = y_float - y_tile

    # ดึง 2×2 tiles
    grid = []
    for dy in range(2):
        row = []
        for dx in range(2):
            t = fetch_tile(zoom, x_tile + dx, y_tile + dy)
            if t is None:
                t = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.uint8)
            row.append(t)
            time.sleep(REQUEST_DELAY)
        grid.append(row)

    # รวม → 512×512
    combined = np.vstack([
        np.hstack([grid[0][0], grid[0][1]]),
        np.hstack([grid[1][0], grid[1][1]]),
    ])

    # จุดกึ่งกลางพิกัดในภาพรวม
    cx = int(x_off * TILE_SIZE)
    cy = int(y_off * TILE_SIZE)

    half  = CROP_SIZE // 2
    sx    = max(0, min(cx - half, combined.shape[1] - CROP_SIZE))
    sy    = max(0, min(cy - half, combined.shape[0] - CROP_SIZE))

    cropped = combined[sy:sy + CROP_SIZE, sx:sx + CROP_SIZE]

    # Resize → 640×640  (เหมือน app.py บรรทัดสุดท้าย)
    final = cv2.resize(cropped, (FINAL_SIZE, FINAL_SIZE),
                       interpolation=cv2.INTER_LINEAR)
    return final


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def make_dirs():
    for d in [RAW_DIR, IMAGES_TRAIN, IMAGES_VAL, LABELS_TRAIN, LABELS_VAL]:
        d.mkdir(parents=True, exist_ok=True)


def save_image(img: np.ndarray, path: Path) -> bool:
    return cv2.imwrite(str(path), img)


def save_metadata(records: list):
    meta_path = OUTPUT_DIR / "metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"📄 metadata → {meta_path}")


def create_yaml():
    """สร้าง dataset.yaml สำหรับ YOLO training"""
    yaml_content = f"""# Dataset config สำหรับ YOLO Segmentation
# สร้างโดย collect_dataset.py — {datetime.now().strftime('%Y-%m-%d')}
# ภาพจาก ArcGIS World Imagery (เหมือนกับที่ web app ใช้)

path: {OUTPUT_DIR.resolve()}
train: images/train
val:   images/val

# 5 classes — เหมือนกับ best.pt เดิม (เรียงตามตัวอักษร Roboflow)
nc: 5
names:
  0: East
  1: Flat
  2: North
  3: South
  4: West
"""
    yaml_path = OUTPUT_DIR / "dataset.yaml"
    yaml_path.write_text(yaml_content, encoding="utf-8")
    print(f"📄 dataset.yaml → {yaml_path}")


def create_label_instructions():
    """สร้างไฟล์คำแนะนำการ label"""
    txt = """
LABELING INSTRUCTIONS
======================
1. เปิด Roboflow (roboflow.com) หรือ Label Studio
2. Upload ภาพจากโฟลเดอร์  dataset/raw/
3. ใช้ Polygon Segmentation tool
4. Label แต่ละส่วนของหลังคาด้วย class ต่อไปนี้:
   - East  : หลังคาหันทิศตะวันออก
   - West  : หลังคาหันทิศตะวันตก
   - North : หลังคาหันทิศเหนือ
   - South : หลังคาหันทิศใต้
   - Flat  : หลังคาแบน (เอียงน้อยกว่า 5°)
5. Export เป็น YOLOv8 Segmentation format
6. วางไฟล์ .txt label ใน dataset/labels/train/ และ dataset/labels/val/

TIPS:
- ภาพ 640x640 px (เหมือน inference บนเว็บ)
- zoom 18 = ละเอียดพอดี, zoom 19 = ละเอียดมาก
- ถ้าหลังคาไม่ชัด ให้ skip ไฟล์นั้น
- ควรมีอย่างน้อย 50 ภาพต่อ class
"""
    (OUTPUT_DIR / "LABEL_INSTRUCTIONS.txt").write_text(txt, encoding="utf-8")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def collect():
    make_dirs()
    create_yaml()
    create_label_instructions()

    records   = []
    total_ok  = 0
    total_fail = 0
    start_time = time.time()

    print(f"\n{'='*60}")
    print(f"  ArcGIS Dataset Collector")
    print(f"  ภาพขนาด: {FINAL_SIZE}×{FINAL_SIZE} px  (เหมือน app.py)")
    print(f"  Pipeline: 2×2 tiles → 512 → crop 256 → resize 640")
    print(f"  จำนวนพิกัด: {len(LOCATIONS)}")
    print(f"  Zoom ที่ใช้: {ZOOM_LEVELS[:ZOOM_PER_COORD]}")
    print(f"  คาดว่าได้ภาพ: ~{len(LOCATIONS) * ZOOM_PER_COORD} ภาพ")
    print(f"{'='*60}\n")

    all_files = []

    for loc_idx, loc in enumerate(LOCATIONS):
        lat, lon = loc["lat"], loc["lon"]
        name     = loc["name"]

        print(f"[{loc_idx+1:02d}/{len(LOCATIONS)}] {name} ({lat:.4f}, {lon:.4f})")

        for zoom in ZOOM_LEVELS[:ZOOM_PER_COORD]:
            fname = f"{name}_z{zoom}.jpg"
            fpath = RAW_DIR / fname

            # ข้ามถ้ามีอยู่แล้ว
            if fpath.exists():
                print(f"  ✅ skip (มีอยู่แล้ว): {fname}")
                all_files.append(str(fpath))
                total_ok += 1
                continue

            img = fetch_satellite_image_exact(lat, lon, zoom)

            if img is None or img.shape[0] == 0:
                print(f"  ❌ ดึงไม่ได้: z{zoom}")
                total_fail += 1
                continue

            # ตรวจสอบว่าภาพไม่ดำล้วน
            if img.mean() < 5:
                print(f"  ⚠️  ภาพดำ skip: z{zoom}")
                total_fail += 1
                continue

            if save_image(img, fpath):
                print(f"  ✅ z{zoom} → {fname}  ({img.shape[1]}×{img.shape[0]})")
                all_files.append(str(fpath))
                total_ok += 1
                records.append({
                    "file": fname,
                    "lat": lat, "lon": lon,
                    "zoom": zoom,
                    "size": f"{img.shape[1]}x{img.shape[0]}",
                    "source": "ArcGIS_World_Imagery",
                    "pipeline": "2x2tiles→512→crop256→resize640",
                })
            else:
                print(f"  ❌ บันทึกไม่ได้: {fname}")
                total_fail += 1

    # ─── Train / Val split ───
    print(f"\n{'─'*60}")
    print(f"📦 แบ่ง Train/Val ({int((1-VAL_RATIO)*100)}/{int(VAL_RATIO*100)})...")

    random.seed(42)
    random.shuffle(all_files)
    n_val   = max(1, int(len(all_files) * VAL_RATIO))
    val_set = set(all_files[:n_val])

    copied_train = copied_val = 0
    for src in all_files:
        src_path = Path(src)
        if not src_path.exists():
            continue
        if src in val_set:
            dst = IMAGES_VAL / src_path.name
            copied_val += 1
        else:
            dst = IMAGES_TRAIN / src_path.name
            copied_train += 1

        # Copy (ใช้ shutil หรือ cv2 read/write)
        img = cv2.imread(str(src_path))
        if img is not None:
            cv2.imwrite(str(dst), img)

    elapsed = time.time() - start_time
    save_metadata(records)

    print(f"\n{'='*60}")
    print(f"  ✅ สำเร็จ:  {total_ok} ภาพ")
    print(f"  ❌ ล้มเหลว: {total_fail} ภาพ")
    print(f"  🚂 train:  {copied_train} ภาพ → {IMAGES_TRAIN}")
    print(f"  🔍 val:    {copied_val} ภาพ → {IMAGES_VAL}")
    print(f"  ⏱️  เวลา:   {elapsed:.1f} วินาที")
    print(f"\n  ขั้นตอนต่อไป:")
    print(f"  1. Label ภาพใน  dataset/raw/  ด้วย Roboflow/Label Studio")
    print(f"     (อ่าน LABEL_INSTRUCTIONS.txt)")
    print(f"  2. วาง .txt labels ใน dataset/labels/train/ และ val/")
    print(f"  3. เทรนโมเดล:")
    print(f"     yolo segment train data=dataset/dataset.yaml \\")
    print(f"       model=yolov8n-seg.pt epochs=100 imgsz=640 batch=16")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    collect()
