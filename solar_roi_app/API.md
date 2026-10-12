# 📡 Solar ROI Calculator - API Documentation

## API Overview

Solar ROI Calculator มี API endpoint เดียวสำหรับการคำนวณ

---

## 🔗 Endpoints

### POST /api/calculate

ใช้สำหรับการคำนวณ ROI โซล่าเซลล์

**URL:**
```
POST http://127.0.0.1:5000/api/calculate
```

---

## 📤 Request Body

```json
{
    "latitude": 13.7563,
    "longitude": 100.4925,
    "electricity_price": 5.50,
    "system_size": 5
}
```

### Parameter Details

| Parameter | Type | Required | Range | Example |
|-----------|------|----------|-------|---------|
| `latitude` | float | ✅ Yes | -90 to 90 | 13.7563 |
| `longitude` | float | ✅ Yes | -180 to 180 | 100.4925 |
| `electricity_price` | float | ✅ Yes | > 0 | 5.50 |
| `system_size` | float | ✅ Yes | > 0 | 5 |

**หมายเหตุ:**
- `latitude`: ละติจูด (degrees) - บวกคือเหนือ, ลบคือใต้
- `longitude`: ลองติจูด (degrees) - บวกคือตะวันออก, ลบคือตะวันตก
- `electricity_price`: ราคาไฟฟ้า (บาท/kWh)
- `system_size`: ขนาดระบบ (kW)

---

## 📥 Response (Success)

**HTTP Status:** 200 OK

```json
{
    "system_size_kw": 5,
    "capital_cost": 600000,
    "annual_production": 6250,
    "annual_revenue": 34375,
    "payback_period": 8,
    "roi_25_years": 1435.42,
    "total_savings_25_years": 8612500,
    "annual_ghi": 1825,
    "ghi": 5,
    "yearly_data": [
        {
            "year": 1,
            "production": 6250,
            "revenue": 34375,
            "maintenance": 3000,
            "profit": 31375,
            "cumulative": 31375
        },
        {
            "year": 2,
            "production": 6209.38,
            "revenue": 34151.59,
            "maintenance": 3090,
            "profit": 31061.59,
            "cumulative": 62436.59
        }
        // ... (years 3-25)
    ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `system_size_kw` | float | ขนาดระบบที่ร้องขอ (kW) |
| `capital_cost` | float | ต้นทุนเงินทุนรวม (บาท) |
| `annual_production` | float | การผลิตต่อปี (kWh) |
| `annual_revenue` | float | รายได้ต่อปี (บาท) |
| `payback_period` | int/null | ระยะเวลา payback (ปี) |
| `roi_25_years` | float | ROI ใน 25 ปี (%) |
| `total_savings_25_years` | float | เงินออมรวม (บาท) |
| `annual_ghi` | float | GHI ต่อปี (kWh/m²) |
| `ghi` | float | GHI ต่อวัน (kWh/m²) |
| `yearly_data` | array | ข้อมูลปีต่อปี |

### Yearly Data Fields

| Field | Description |
|-------|-------------|
| `year` | ปีที่ (1-25) |
| `production` | การผลิดพลังงาน (kWh) |
| `revenue` | รายได้จริง (บาท) |
| `maintenance` | ค่าบำรุงรักษา (บาท) |
| `profit` | กำไรสุทธิ (บาท) |
| `cumulative` | กำไรสะสม (บาท) |

---

## 📥 Response (Error)

### Invalid Input

**HTTP Status:** 400 Bad Request

```json
{
    "error": "ละติจูดหรือลองติจูดไม่ถูกต้อง"
}
```

หรือ

```json
{
    "error": "ราคาไฟฟ้าและขนาดระบบต้องมากกว่า 0"
}
```

### Server Error

**HTTP Status:** 500 Internal Server Error

```json
{
    "error": "เกิดข้อผิดพลาด: [error message]"
}
```

---

## 💡 Example Usage

### Using JavaScript (Fetch API)

```javascript
const data = {
    latitude: 13.7563,
    longitude: 100.4925,
    electricity_price: 5.50,
    system_size: 5
};

fetch('/api/calculate', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
})
.then(response => response.json())
.then(result => {
    console.log('Payback Period:', result.payback_period, 'years');
    console.log('ROI (25 years):', result.roi_25_years, '%');
    console.log('Total Savings:', result.total_savings_25_years, 'THB');
})
.catch(error => console.error('Error:', error));
```

### Using Python (Requests)

```python
import requests
import json

data = {
    'latitude': 13.7563,
    'longitude': 100.4925,
    'electricity_price': 5.50,
    'system_size': 5
}

response = requests.post(
    'http://127.0.0.1:5000/api/calculate',
    headers={'Content-Type': 'application/json'},
    json=data
)

if response.status_code == 200:
    result = response.json()
    print(f"Payback Period: {result['payback_period']} years")
    print(f"ROI (25 years): {result['roi_25_years']}%")
    print(f"Total Savings: {result['total_savings_25_years']} THB")
else:
    print(f"Error: {response.json()['error']}")
```

### Using cURL

```bash
curl -X POST http://127.0.0.1:5000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 13.7563,
    "longitude": 100.4925,
    "electricity_price": 5.50,
    "system_size": 5
  }'
```

---

## ✅ Validation Rules

### Latitude
- **Range:** -90 to 90
- **Type:** Float
- **Error:** "ละติจูดหรือลองติจูดไม่ถูกต้อง"

### Longitude
- **Range:** -180 to 180
- **Type:** Float
- **Error:** "ละติจูดหรือลองติจูดไม่ถูกต้อง"

### Electricity Price
- **Min:** 0 (exclusive)
- **Type:** Float
- **Error:** "ราคาไฟฟ้าและขนาดระบบต้องมากกว่า 0"

### System Size
- **Min:** 0 (exclusive)
- **Type:** Float
- **Error:** "ราคาไฟฟ้าและขนาดระบบต้องมากกว่า 0"

---

## 📊 Calculation Details

### Annual Production
```
Annual Production = Annual GHI × System Efficiency × System Loss
                  = GHI × 365 × 0.85 × 0.85
```

### Annual Revenue
```
Annual Revenue = Annual Production × Electricity Price
```

### Payback Period
```
เมื่อ Cumulative Profit >= Capital Cost
```

### ROI (25 years)
```
ROI = (Total Savings / Capital Cost) × 100
```

### Yearly Calculation
```
Degradation Factor = (1 - 0.007)^Year
Year Production = Annual Production × Degradation Factor
Year Revenue = Year Production × Electricity Price
Year Maintenance = Capital Cost × 0.005 × (1.03)^Year
Year Profit = Year Revenue - Year Maintenance
Cumulative = Σ(Year Profit / (1 + Discount Rate)^Year)
```

---

## ⚙️ Configuration

Default values (from config.py):

```python
SOLAR_PANEL_COST_PER_KW = 80000  # บาท/kW
INSTALLATION_COST_MULTIPLIER = 1.2
PANEL_EFFICIENCY = 0.85
MAINTENANCE_COST_RATE = 0.005  # 0.5%
PANEL_DEGRADATION_RATE = 0.007  # 0.7%
ANALYSIS_PERIOD = 25  # ปี
DISCOUNT_RATE = 0.05  # 5%
```

---

## 🔐 Security

- ✅ No data storage
- ✅ No authentication required
- ✅ POST-only for calculations
- ✅ CORS disabled (local only)

---

## 🚀 Performance

- Response Time: < 100ms
- No external API calls (except Google Maps for UI)
- All calculations on server

---

## 📝 Rate Limiting

Currently: **No rate limiting** (development mode)

For production: Implement rate limiting

---

## 🔄 Updates

**Version:** 1.0
**Last Updated:** 2025-12-02

---

## 🐛 Troubleshooting

### No Response
- Check if server is running: `python app.py`
- Check if port 5000 is available

### JSON Error
- Verify JSON format is valid
- Use online JSON validator: https://jsonlint.com

### 404 Error
- Check endpoint URL: `/api/calculate`
- Ensure POST method is used

### 500 Error
- Check server logs
- Verify input parameters

---

## 📞 Support

For issues or questions, refer to:
- README.md
- GUIDE_TH.md
- INSTALL.md
- This document

---

**Happy Calculating!** ☀️⚡
