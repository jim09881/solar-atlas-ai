"""
Solar ROI Calculator Configuration
===================================

ไฟล์นี้ประกอบด้วยค่าตั้งค่าต่างๆ ของ Solar ROI Calculator
สามารถปรับเปลี่ยนค่าได้ตามความเหมาะสม
"""

# ====== ต้นทุนและราคา ======
SOLAR_PANEL_COST_PER_KW = 30000  # บาท ต้นทุนติดตั้งต่อ kW
INSTALLATION_COST_MULTIPLIER = 1.2  # ตัวคูณค่าติดตั้งเพิ่มเติม (20% เพิ่มเติม)

# ====== ประสิทธิภาพ ======
PANEL_EFFICIENCY = 0.85  # 85% ประสิทธิภาพของแผงโซลาร์
SYSTEM_INVERTER_EFFICIENCY = 0.85  # 85% ประสิทธิภาพของ Inverter

# ====== ค่าใช้จ่ายรายปี ======
MAINTENANCE_COST_RATE = 1  # 0.5% ค่าบำรุงรักษาต่อปี
INFLATION_RATE = 1  # 3% อัตราเงินเฟ้อต่อปี
PANEL_DEGRADATION_RATE = 1  # 0.7% อัตราเสื่อมสภาพต่อปี

# ====== ช่วงเวลา ======
ANALYSIS_PERIOD = 25  # จำนวนปีที่วิเคราะห์ (โดยทั่วไป 25 ปี)
DISCOUNT_RATE = 0.05  # 5% อัตราส่วนลด (Discount Rate)

# ====== ข้อมูลสภาพอากาศ ======
BASE_GHI_THAILAND = 5.0  # kWh/m²/วัน ค่าเฉลี่ย GHI สำหรับไทย
LATITUDE_REFERENCE = 13  # ละติจูดอ้างอิง (13°N - ประมาณจังหวัดกลาง)

# ====== ค่าเริ่มต้น ======
DEFAULT_LATITUDE = 13.7563  # ละติจูดเริ่มต้น (กรุงเทพ)
DEFAULT_LONGITUDE = 100.4925  # ลองติจูดเริ่มต้น (กรุงเทพ)
DEFAULT_SYSTEM_SIZE = 5  # kW ขนาดระบบเริ่มต้น
DEFAULT_ELECTRICITY_PRICE = 5.50  # บาท/kWh ราคาไฟฟ้าเริ่มต้น

# ====== ตำแหน่งเพิ่มเติม ======
QUICK_LOCATIONS = {
    'กรุงเทพ': {'latitude': 13.7563, 'longitude': 100.4925},
    'เชียงใหม่': {'latitude': 18.7883, 'longitude': 98.9853},
    'ปัตตานี': {'latitude': 12.5692, 'longitude': 101.0901},
    'ขอนแก่น': {'latitude': 14.8822, 'longitude': 104.8242},
    'เพชรบูรณ์': {'latitude': 15.8057, 'longitude': 101.1458},
    'ศรีสะเกษ': {'latitude': 15.1156, 'longitude': 104.3114},
    'ร้อยเอ็ด': {'latitude': 16.2425, 'longitude': 104.6486},
    'มหาสารคาม': {'latitude': 16.7871, 'longitude': 103.3065},
    'หนองคาย': {'latitude': 17.8731, 'longitude': 104.7721},
    'อุบลราชธานี': {'latitude': 15.2441, 'longitude': 104.8633},
}

# ====== การตั้งค่า Google Maps ======
GOOGLE_MAPS_ZOOM_LEVEL = 15  # ระดับ Zoom เริ่มต้น
GOOGLE_MAPS_CENTER = {'latitude': DEFAULT_LATITUDE, 'longitude': DEFAULT_LONGITUDE}

# ====== UI Configuration ======
CURRENCY_FORMAT = 'th-TH'  # รูปแบบสกุลเงิน (th-TH = ไทย)
NUMBER_DECIMAL_PLACES = 2  # จำนวนทศนิยม

# ====== NASA API ======
NASA_API_KEY = "DEMO_KEY"  # ใส่ key จริงที่ได้จาก https://api.nasa.gov
NASA_POWER_BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
NASA_EARTH_BASE_URL = "https://api.nasa.gov/planetary/earth/imagery"
NASA_DONKI_BASE_URL = "https://api.nasa.gov/DONKI"


FLASK_DEBUG = True  # Debug mode (ปิดในการใช้งานจริง)
FLASK_HOST = '127.0.0.1'  # Host ที่ใช้
FLASK_PORT = 5000  # Port ที่ใช้
