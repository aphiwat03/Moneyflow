# MoneyFlow — ระบบบันทึกรายรับ-รายจ่ายส่วนบุคคล (Mobile-First PWA & PC Dashboard)

เว็บแอปพลิเคชันสำหรับบันทึกรายรับ รายจ่าย และการโอนย้ายระหว่างบัญชี (**Transfer**) ที่ออกแบบมาให้ใช้งานได้ลื่นไหลทั้งบน **โทรศัพท์มือถือ (Installable PWA)** และ **คอมพิวเตอร์ (Desktop Dashboard)** เก็บข้อมูลลงฐานข้อมูล **PostgreSQL** จริง พร้อมระบบตั้งงบประมาณรายเดือน นำเข้าไฟล์ `.csv` และส่งออกรายงาน Excel (`.xlsx`)

---

## ฟีเจอร์หลัก (Key Features)

1. **รองรับ 3 ประเภทรายการ (`income`, `expense`, `transfer`)**
   - รายการโอนย้ายระหว่างกระเป๋า (เช่น กดเงินสด, จ่ายบิลบัตรเครดิต) จะไม่ถูกนำไปปนกับยอดรายรับ-รายจ่ายรวมของเดือน
2. **จัดการกระเป๋าเงิน 4 ประเภท (`cash`, `bank`, `ewallet`, `credit_card`)**
   - แยกแสดง **เงินสดและเงินฝากสุทธิ** ออกจาก **ยอดหนี้ค้างชำระบัตรเครดิต** และคำนวณ **มูลค่าสุทธิรวม (Net Worth)** อัตโนมัติ
   - มีปุ่ม **ปรับยอดคงเหลือปัจจุบัน (Balance Reconciliation)** ให้ตรงกับเงินจริงได้ทันที
   - รองรับทั้งการซ่อน (**Archive**) และการลบถาวร (เมื่อยังไม่มีรายการผูกอยู่)
3. **ความแม่นยำทางการเงิน & Timezone มาตรฐานไทย**
   - เก็บข้อมูลด้วย `NUMERIC(12, 2)` และคำนวณด้วย `decimal.js` 100% ป้องกันปัญหา Floating-point
   - อ้างอิงเวลา `Asia/Bangkok` (`UTC+7`) ทุกจุด (ไม่เพี้ยนแม้รันบน Cloud Server ที่ใช้เวลา UTC)
4. **งบประมาณรายเดือน (Monthly Budgets)**
   - ตั้งเพดานงบประมาณรายเดือนแยกตามหมวดหมู่รายจ่าย พร้อมแถบ Progress แจ้งเตือนเมื่อใช้จ่ายเกิน 80% หรือเกินงบ
5. **เทมเพลตจดด่วน (Quick Templates)**
   - ปุ่มลัดสำหรับรายการที่ใช้บ่อยในหน้าบันทึกข้อมูล ช่วยให้จดบนมือถือได้ในไม่กี่วินาที
6. **แผนเงินเดือน & เป้าหมายการออม (`/plan`) + มุมมองรายวัน**
   - ตั้งค่า **เงินเดือนคงที่** และ **วันที่เงินเดือนออก** (ค่าเริ่มต้นวันที่ 1) เพื่อแบ่งก้อน **เงินเย็น**, **ลงทุน DCA**, และ **ของที่อยากได้** (คำนวณยอดออมต่อเดือนจากราคาเป้าหมายและจำนวนเดือนได้) ทั้งแบบบาทคงที่และเปอร์เซ็นต์
   - มีตัวช่วยแนะนำสัดส่วนที่เหมาะสมตามเงินเดือน และปุ่ม **"โอนตามแผนเข้ากระเป๋า"** แบบคลิกเดียว
   - คำนวณ **เงินคงเหลือใช้จ่ายจริง** และ **งบใช้ได้เฉลี่ยต่อวัน** พร้อมแสดง **"วันนี้ใช้ไปแล้ว"** บนหน้าภาพรวม และโหมด **จัดกลุ่มรายวัน** ในหน้า `/transactions`
7. **Import CSV & Server-side Export Excel (`.xlsx`)**
   - ส่งออกรายงาน Excel 2 Sheets (`Summary` และ `Transactions`) ด้วย `ExcelJS` พร้อมระบบป้องกัน Formula Injection
   - นำเข้ารายการย้อนหลังจากไฟล์ `.csv` พร้อมหน้าตรวจสอบข้อมูลก่อนบันทึก
8. **รองรับทั้ง iPhone, iPad และ PC (Responsive PWA)**
   - ปรับจุดตัด Layout สำหรับ iPad แนวตั้ง/แนวนอน, เปิด `viewportFit: "cover"` สำหรับรอยบาก/Home Indicator, ป้องกัน iOS Safari Auto-Zoom บนฟอร์ม และรองรับการติดตั้งลงหน้าจอโฮม
9. **พร้อมใช้งานทั้ง Local Docker PostgreSQL และระบบสำรองข้อมูลย้ายเครื่อง (`.json` / `pg_dump`)**
   - มีไฟล์ [docker-compose.yml](./docker-compose.yml) (`postgres:16-alpine`, พอร์ต `5433:5432`) พร้อมสคริปต์ `npm run db:up`, `npm run db:backup`, `npm run db:restore` และปุ่มส่งออก/กู้คืนไฟล์ `.json` ทั้งใน `/manage` และ `/demo` เพื่อย้ายเครื่องหรือย้ายจาก `/demo` เข้า PostgreSQL ได้ทันที
10. **โหมดทดลองใช้งานทันที (`/demo`)**
   - ทดลองใช้งานทุกฟีเจอร์ผ่านเบราว์เซอร์ได้ทันทีโดยไม่ต้องตั้งค่าฐานข้อมูล (บันทึกสถานะไว้ใน `localStorage`)

---

## การเริ่มต้นใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. เปิดฐานข้อมูล PostgreSQL ด้วย Docker (แนะนำสำหรับใช้งานยาวๆ ในเครื่อง)

1. เปิด **Docker Desktop** บนเครื่องให้พร้อมทำงาน
2. สร้างไฟล์ `.env.local` (คัดลอกจาก `.env.example`) โดยค่าเชื่อมต่อสำหรับ Docker Local คือ:

```env
DATABASE_URL="postgresql://moneyflow:moneyflow_local_pw@localhost:5433/moneyflow"
AUTH_SECRET="สร้างด้วยคำสั่ง npx auth secret"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

3. เปิด Container PostgreSQL (`moneyflow-postgres`) แล้วรัน Database Migration:

```bash
npm run db:up
npm run db:migrate
```

> หากใช้ฐานข้อมูลอื่น (เช่น Neon หรือ Postgres ที่ติดตั้งเอง) สามารถข้าม `npm run db:up` และกำหนด `DATABASE_URL` ใน `.env.local` แล้วรัน `npm run db:migrate` ได้เลย

### 3. เปิดเซิร์ฟเวอร์พัฒนา (Development Server)

```bash
npm run dev
```

- เข้าใช้งานระบบจริง: `http://localhost:3000`
- เข้าใช้งานโหมดตัวอย่าง (ไม่ต้องต่อ DB): `http://localhost:3000/demo`

---

## การสำรองข้อมูลและย้ายเครื่องคอมพิวเตอร์ (PC Migration)

1. **วิธีที่ 1 — สำรอง/กู้คืนผ่านหน้าเว็บ (`.json`):**
   - เข้าหน้า `/manage` (หรือแท็บ **จัดการ** ใน `/demo`) -> **"ย้ายเครื่อง / สำรองและกู้คืนข้อมูลทั้งหมด (.json)"** -> กดดาวน์โหลด `MoneyFlow_Backup_YYYY-MM-DD.json` จากเครื่องเก่า แล้วนำไปกดนำเข้าบนเครื่องใหม่ (ใช้ได้ข้ามทั้ง `/demo` และ PostgreSQL)
2. **วิธีที่ 2 — โคลนฐานข้อมูล PostgreSQL ทั้งก้อนผ่าน Docker CLI:**
   - บนเครื่องเก่า: `npm run db:backup` (สร้างไฟล์ใน `backups/latest.sql` และ `backups/moneyflow_backup_<timestamp>.sql`)
   - นำไฟล์ SQL ไปที่เครื่องใหม่ เปิด Docker (`npm run db:up`) แล้วรัน `npm run db:restore`

ดูคู่มือฉบับเต็มได้ที่ [DATABASE_DESIGN.md](./DATABASE_DESIGN.md)

---

## คำสั่งตรวจสอบคุณภาพโค้ดและฐานข้อมูล (Scripts)

| คำสั่ง | รายละเอียด |
| :--- | :--- |
| `npm run dev` | รัน Next.js Development Server |
| `npm run build` | Build โปรเจกต์สำหรับ Production |
| `npm run typecheck` | ตรวจสอบ TypeScript Types (`next typegen && tsc --noEmit`) |
| `npm run lint` | ตรวจสอบมาตรฐานโค้ดด้วย ESLint |
| `npm test` | รัน Unit Tests ทั้งหมดด้วย Vitest |
| `npm run db:up` | เปิด PostgreSQL บน Docker (`docker compose up -d`) |
| `npm run db:down` | ปิด Container PostgreSQL (`docker compose down`) |
| `npm run db:migrate` | รัน SQL Migration (`drizzle/0000`–`0003`) ลงฐานข้อมูล |
| `npm run db:backup` | สำรองข้อมูล PostgreSQL จาก Docker เป็นไฟล์ `.sql` ใน `backups/` |
| `npm run db:restore` | กู้คืนไฟล์ `.sql` (`backups/latest.sql` หรือไฟล์ที่ระบุ) เข้า Docker PostgreSQL |
| `npm run db:generate` | สร้างไฟล์ SQL Migration ใหม่จาก Drizzle Schema |
| `npm run db:studio` | เปิด Drizzle Studio เพื่อดูข้อมูลในฐานข้อมูล |
| `npm run ocr:start` | เปิด Local OCR Worker (`OpenThai2.1-OCR v2.1.4`) บน Docker (`127.0.0.1:8001`) |
| `npm run ocr:stop` | ปิด Container Local OCR Worker (`moneyflow-ocr`) |
| `npm run ocr:logs` | ดู Log ของ Local OCR Worker |

---

## ระบบอ่านสลิปโอนเงินอัตโนมัติ (e-Slip OCR & Cloudflare Tunnel)

1. **เปิด Local OCR Engine (ประมวลผลในเครื่องด้วย CPU 100%, ไม่บันทึกรูปลงดิสก์):**
   ```bash
   npm run ocr:start
   ```
   ใช้โมเดล `iapp/OpenThai2.1-OCR-Text-20261118` (`v2.1.4`) รันภายใน Docker Container `moneyflow-ocr` และเปิดพอร์ตเฉพาะ `127.0.0.1:8001` เท่านั้น
2. **สลับโหมด `Local` / `Gemini` บนฟอร์ม:**
   - **Local:** เรียก OpenThai2.1 OCR ในเครื่องผ่าน `/api/slip-ocr` (ต้องเข้าสู่ระบบก่อนใช้งาน)
   - **Gemini:** โหมดจำลอง (`Gemini Mock`) สำหรับทดสอบ Flow ระหว่างรอตั้งค่า `GEMINI_API_KEY` จริงในอนาคต
3. **ใช้งานจากมือถือนอกบ้านผ่าน Cloudflare Tunnel:**
   - ตั้ง `AUTH_TRUST_HOST="true"` ใน `.env.local`
   - ชี้ Tunnel มาที่ Next.js พอร์ต `3000` เท่านั้น (`cloudflared tunnel --url http://localhost:3000`) — **ห้ามเปิดพอร์ต `8001` ออกอินเทอร์เน็ต**

---

## เอกสารสถาปัตยกรรมระบบ

ดูรายละเอียดการออกแบบฐานข้อมูลและขั้นตอนย้ายเครื่องเพิ่มเติมได้ในไฟล์ `DATABASE_DESIGN.md` (ไฟล์อ้างอิงภายในเครื่อง)
