# 🌞 Solar ROI Calculator - Workspace Index

**สวัสดี! ยินดีต้อนรับสู่ Solar ROI Calculator**

เว็บแอปพลิเคชันสำหรับคำนวณความคุ้มทุนการติดโซล่าเซล

---

## 📂 โครงสร้าง Project

```
solar_roi_app/
│
├── 📄 app.py                    # Flask backend - เซิร์ฟเวอร์หลัก
├── 📄 config.py                 # ไฟล์ตั้งค่า - ปรับค่าต่างๆ ได้
├── 📄 requirements.txt           # Dependencies - ไลบรารี่ที่ต้องใช้
├── 📄 start.bat                 # ไฟล์เริ่มต้น - ดับเบิลคลิกเพื่อเริ่ม
│
├── 📁 templates/
│   └── 📄 index.html           # หน้า HTML หลัก - User Interface
│
├── 📁 static/
│   ├── 📁 css/
│   │   └── 📄 style.css        # CSS ธีมสีฟ้า - สไตล์เว็บไซด์
│   ├── 📁 js/
│   │   ├── 📄 main.js          # JavaScript หลัก - ฟังก์ชันการคำนวณ
│   │   └── 📄 map.js           # Google Maps - แผนที่
│   └── 📄 favicon.svg          # Icon เว็บไซด์
│
├── 📖 README.md                 # อ่านกันก่อน
├── 📖 GUIDE_TH.md              # คู่มือภาษาไทย
└── 📖 INSTALL.md               # วิธีติดตั้งและใช้งาน
```

---

## 🚀 เริ่มต้นอย่างรวดเร็ว

### วิธีที่ 1: ใช้ BAT (ง่ายที่สุด)
```
ดับเบิลคลิก start.bat
→ เบราว์เซอร์จะเปิดโดยอัตโนมัติ
→ ไปที่ http://127.0.0.1:5000
```

### วิธีที่ 2: ใช้ Command Line
```
cd "c:\Users\User\Downloads\STP Solar\solar_roi_app"
python app.py
→ ไปที่ http://127.0.0.1:5000
```

---

## 📋 ไฟล์ที่ต้องรู้จัก

| ไฟล์ | วัตถุประสงค์ | ความสำคัญ |
|-----|-----------|---------|
| `app.py` | Backend Flask | ⭐⭐⭐ จำเป็น |
| `index.html` | User Interface | ⭐⭐⭐ จำเป็น |
| `style.css` | ธีมสี | ⭐⭐ สำคัญ |
| `main.js` | ฟังก์ชัน JavaScript | ⭐⭐⭐ จำเป็น |
| `map.js` | Google Maps | ⭐⭐ สำคัญ |
| `config.py` | ตั้งค่า | ⭐ ปรับเปลี่ยนได้ |

---

## 💾 ฟีเจอร์หลัก

### ✅ Input (รับข้อมูล)
- กรอก **ราคาไฟฟ้า** (บาท/kWh)
- กรอก **ละติจูด** (Latitude)
- กรอก **ลองติจูด** (Longitude)
- เลือก **ขนาดระบบ** (kW)

### ✅ Processing (ประมวลผล)
- คำนวณศักยภาพพลังงานแสงอาทิตย์
- วิเคราะห์ ROI (Return on Investment)
- คำนวณ Payback Period
- ประมาณการ 25 ปี

### ✅ Output (ผลลัพธ์)
- แสดงผลบนแผนที่ Google Maps
- ตารางผลลัพธ์ 6 ค่า
- ข้อมูลรังสีอาทิตย์ (GHI)
- กราฟแสดงกำไรสะสม

### ✅ Design (ดีไซน์)
- ธีมสีฟ้า-ฟ้า-ขาว
- UI/UX ใช้งานง่าย
- Responsive (มือถือ/เดสก์ท็อป)

---

## 🔧 Technology Stack

```
Frontend:
├── HTML5
├── CSS3 (Responsive)
├── JavaScript (Vanilla)
├── Chart.js (กราฟ)
└── Google Maps API

Backend:
├── Python 3.9+
├── Flask 3.0
├── Pandas
└── NumPy

Hosting:
└── Local (127.0.0.1:5000)
```

---

## 📊 ค่าคำนวณ

| ค่า | ค่าตั้งต้น |
|-----|-----------|
| ต้นทุนติดตั้ง | 80,000 บาท/kW |
| ประสิทธิภาพ | 85% |
| ค่าบำรุงรักษา | 0.5%/ปี |
| เสื่อมสภาพ | 0.7%/ปี |
| ระยะวิเคราะห์ | 25 ปี |
| อัตราเงินเฟ้อ | 3%/ปี |

---

## 🌍 ตัวอย่างตำแหน่ง

| เมือง | ละติจูด | ลองติจูด |
|------|---------|---------|
| กรุงเทพ | 13.7563 | 100.4925 |
| เชียงใหม่ | 18.7883 | 98.9853 |
| ปัตตานี | 12.5692 | 101.0901 |
| ขอนแก่น | 14.8822 | 104.8242 |

---

## ⚙️ การติดตั้ง

### ขั้นตอนที่ 1: ตรวจสอบ Python
```
python --version
→ Python 3.9.x ขึ้นไป
```

### ขั้นตอนที่ 2: ติดตั้ง Dependencies
```
pip install -r requirements.txt
```

### ขั้นตอนที่ 3: เรียกใช้
```
python app.py
```

### ขั้นตอนที่ 4: เปิดเบราว์เซอร์
```
http://127.0.0.1:5000
```

---

## 📖 เอกสารอ้างอิง

1. **README.md** - ข้อมูลทั่วไป
2. **GUIDE_TH.md** - คู่มือภาษาไทยโดยละเอียด
3. **INSTALL.md** - วิธีติดตั้งและแก้ไขปัญหา
4. **config.py** - ตั้งค่าต่างๆ
5. **app.py** - โค้ด Backend

---

## 🐛 ถ้ามีปัญหา

1. ✔️ ตรวจสอบ Python: `python --version`
2. ✔️ ติดตั้ง packages: `pip install -r requirements.txt`
3. ✔️ รีสตาร์ทเบราว์เซอร์
4. ✔️ ตรวจสอบ Internet
5. ✔️ ดู INSTALL.md

---

## 🎨 ธีมสี

```
Primary:     #0066cc (Blue)
Light:       #87ceeb (Sky Blue)
Background:  #e6f2ff (Light Blue)
White:       #ffffff
```

---

## ✨ Features ที่ดี

✅ ไม่ต้องสมัครสมาชิก  
✅ ไม่มีฐานข้อมูล  
✅ ข้อมูลไม่ถูกเก็บ  
✅ ใช้งานง่าย  
✅ รวดเร็ว  
✅ ตัดสินใจได้ง่ายกว่า  

---

## 📱 Responsive

✅ Desktop (1920x1080+)  
✅ Laptop (1024x768+)  
✅ Tablet (768x1024)  
✅ Mobile (375x667+)  

---

## 🚀 Ready to Go!

**เซิร์ฟเวอร์ตัวอย่างกำลังทำงาน:**
```
http://127.0.0.1:5000
```

**ดั้งดันใจแล้ว? ไปเริ่มกันเลย!**

---

## 📞 Support

หากมีคำถาม:
- 📖 อ่าน INSTALL.md
- 📖 อ่าน GUIDE_TH.md
- 💬 ตรวจสอบ README.md

---

**© 2025 Solar ROI Calculator | Made with ☀️ for Thailand**

ขอให้ประสบความสำเร็จ! 🌞⚡💡
