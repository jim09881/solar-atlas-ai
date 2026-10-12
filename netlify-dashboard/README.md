# 🌞 Solar Analytics Dashboard

ระบบ Dashboard วิเคราะห์พลังงานแสงอาทิตย์แบบมืออาชีพ พัฒนาโดยโรงเรียนสุรธรรมพิทักษ์

## 🚀 Deploy บน Netlify

### วิธีที่ 1: Deploy ผ่าน Netlify Drop (ง่ายที่สุด)

1. ไปที่ [Netlify Drop](https://app.netlify.com/drop)
2. ลากโฟลเดอร์ `netlify-dashboard` ไปวางบนหน้าเว็บ
3. รอสักครู่ เว็บไซต์จะพร้อมใช้งาน!

### วิธีที่ 2: Deploy ผ่าน GitHub

1. Push โค้ดไปยัง GitHub repository
2. ไปที่ [Netlify](https://app.netlify.com)
3. คลิก "Add new site" > "Import an existing project"
4. เลือก GitHub repository
5. ตั้งค่า:
   - **Base directory**: `netlify-dashboard`
   - **Publish directory**: `.`
   - **Build command**: (เว้นว่าง)
6. คลิก "Deploy site"

### วิธีที่ 3: Deploy ผ่าน Netlify CLI

```bash
# ติดตั้ง Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
cd netlify-dashboard
netlify deploy --prod
```

## ✨ ฟีเจอร์

- 📊 **Real-time Dashboard** - แสดงข้อมูลการผลิตไฟฟ้าแบบ real-time
- 📈 **Interactive Charts** - กราฟแบบ interactive ด้วย Recharts
- 🧮 **ROI Calculator** - คำนวณผลตอบแทนการลงทุน
- 🌤️ **Weather Widget** - แสดงสภาพอากาศ
- 📱 **Responsive Design** - รองรับทุกขนาดหน้าจอ
- ⚡ **Fast Loading** - โหลดเร็วด้วย CDN

## 🛠️ Tech Stack

- **React 18** - UI Library
- **Tailwind CSS** - Styling
- **Recharts** - Charts & Visualizations
- **Lucide Icons** - SVG Icons (custom implementation)

## 📁 โครงสร้างไฟล์

```
netlify-dashboard/
├── index.html      # Main HTML file (React app)
├── netlify.toml    # Netlify configuration
└── README.md       # Documentation
```

## 🎨 การปรับแต่ง

### เปลี่ยนข้อมูล

แก้ไขข้อมูลใน `index.html`:

```javascript
// ข้อมูลการผลิตรายเดือน
const monthlyProductionData = [
    { month: 'ม.ค.', production: 420, target: 400, savings: 2100 },
    // ...
];

// ข้อมูลการผลิตรายชั่วโมง
const hourlyData = [
    { hour: '06:00', power: 0.2, irradiance: 50 },
    // ...
];
```

### เปลี่ยนสี

แก้ไข Tailwind config ใน `<script>`:

```javascript
tailwind.config = {
    theme: {
        extend: {
            colors: {
                solar: {
                    400: '#fbbf24',
                    500: '#f59e0b',
                    // ...
                }
            }
        }
    }
}
```

## 📞 ติดต่อ

- **โรงเรียน**: โรงเรียนสุรธรรมพิทักษ์
- **จังหวัด**: นครราชสีมา
- **Email**: info@stp-solar.edu

## 📄 License

MIT License - สามารถนำไปใช้และปรับแต่งได้อย่างอิสระ

---

Made with ☀️ by โรงเรียนสุรธรรมพิทักษ์
