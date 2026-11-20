# รายงานผลการ Refactor (Refactor Execution Report) — MoneyFlow

> **วันที่ดำเนินการ:** 2026-11-20  
> **Branch:** `refactor/split-ui-components`  
> **อ้างอิงแผนงาน:** [REFACTOR_PLAN.md](./REFACTOR_PLAN.md)

---

## Phase 1: แตก `manage-view.tsx` — สถานะ: สำเร็จครบตามแผน ✅

### 1. สรุปการเปลี่ยนแปลงขนาดไฟล์

| ไฟล์ | ก่อน Refactor | หลัง Refactor | หน้าที่หลัก |
| :--- | :---: | :---: | :--- |
| [src/components/finance/manage-view.tsx](./src/components/finance/manage-view.tsx) | `1,675` บรรทัด | **`209` บรรทัด** (-87.5%) | Container คุม `showArchived`, `globalNotice` และประกอบ Section ทั้ง 5 |
| [src/components/finance/manage/manage-wallets-section.tsx](./src/components/finance/manage/manage-wallets-section.tsx) | *(สร้างใหม่)* | `626` บรรทัด | การ์ดกระเป๋าเงิน + Modal เพิ่ม/แก้ไขกระเป๋า (พร้อมเทมเพลต) + Modal ปรับยอดคงเหลือ |
| [src/components/finance/manage/manage-categories-section.tsx](./src/components/finance/manage/manage-categories-section.tsx) | *(สร้างใหม่)* | `447` บรรทัด | การ์ดหมวดหมู่รายรับ-รายจ่าย (แท็บสไลด์) + Modal เพิ่ม/แก้ไขหมวดหมู่ |
| [src/components/finance/manage/manage-salary-card.tsx](./src/components/finance/manage/manage-salary-card.tsx) | *(สร้างใหม่)* | `209` บรรทัด | การ์ดตั้งค่าเงินเดือนคงที่, รายได้เสริม & วันเงินออก (`1–31`) |
| [src/components/finance/manage/manage-backup-card.tsx](./src/components/finance/manage/manage-backup-card.tsx) | *(สร้างใหม่)* | `294` บรรทัด | การ์ดสำรอง/กู้คืน `.json` + Modal ยืนยันการกู้คืน |
| [src/components/finance/manage/manage-account-cards.tsx](./src/components/finance/manage/manage-account-cards.tsx) | *(สร้างใหม่)* | `204` บรรทัด | การ์ดแก้ไขชื่อโปรไฟล์ & เปลี่ยนรหัสผ่าน |

---

### 2. ตารางตรวจเช็กเทียบกับ [REFACTOR_PLAN.md](./REFACTOR_PLAN.md) (Plan vs Actual Audit)

| ข้อในแผน | รายการที่กำหนดในแผน | สถานะ | ผลการตรวจสอบ |
| :---: | :--- | :---: | :--- |
| **1.1** | สร้าง `manage-wallets-section.tsx` (การ์ดกระเป๋า + 2 Modals + เทมเพลต) | ✅ ครบ | ย้ายครบทั้งหมดรวมเทมเพลต `พอร์ตหุ้น / DCA`, `กระเป๋าซื้อของให้แฟน`, `กระเป๋าของที่อยากได้`, `บัญชีเงินเย็นสำรอง` |
| **1.2** | สร้าง `manage-categories-section.tsx` (การ์ดหมวดหมู่ + แท็บ + Modal) | ✅ ครบ | ย้ายครบทั้งหมดพร้อม Animation สไลด์แท็บและ Modal แก้ไขงบประมาณรายเดือน |
| **1.3** | สร้าง `manage-salary-card.tsx` (เงินเดือน, รายได้เสริม, วันเงินออก) | ✅ ครบ | ย้ายครบพร้อมปุ่มลัดเลือกวันเงินออก `1, 5, 15, 25, 31` และ Dropdown กระเป๋ารับเงิน |
| **1.4** | สร้าง `manage-backup-card.tsx` (สำรอง/กู้คืน `.json` + Modal ยืนยัน) | ✅ ครบ | ย้ายครบพร้อมปุ่มดาวน์โหลด, File Picker, Validation และ Modal ยืนยันจำนวนรายการ |
| **1.5** | สร้าง `manage-account-cards.tsx` (โปรไฟล์ & เปลี่ยนรหัสผ่าน) | ✅ ครบ | ย้ายครบทั้ง 2 การ์ดและฟอร์มจัดการรหัสผ่าน |
| **1.6** | ปรับ `manage-view.tsx` เป็น Container และคง Props เดิม 100% | ✅ ครบ | ลดเหลือ `209` บรรทัด โดย `db-manage-client.tsx` และ `demo-workspace.tsx` ไม่ต้องแก้โค้ดเลย |
| **กฎความปลอดภัย** | ห้ามแก้ Business Logic / Server Actions / Database | ✅ ผ่าน | ไม่มีการแก้ไฟล์ใน `src/actions/`, `src/db/`, หรือ `src/lib/` |
| **1.7** | ตรวจสอบ `typecheck`, `lint`, `test` | ✅ ผ่าน | ผ่านทุกคำสั่งด้วย exit code `0` (ดูรายละเอียดด้านล่าง) |

---

### 3. ผลการตรวจสอบอัตโนมัติหลังแก้ไขโค้ด Phase 1

| การตรวจสอบ | คำสั่ง | ผลลัพธ์ |
| :--- | :--- | :--- |
| TypeScript & Next Route Types | `npm run typecheck` | ✅ ผ่าน (`exit code 0`) |
| ESLint | `npm run lint` | ✅ ผ่าน ไม่มี Error/Warning (`exit code 0`) |
| Unit Tests (Vitest) | `npm test` | ✅ ผ่าน **14 ไฟล์ / 61 tests** (`exit code 0`) |

---

### 4. ขั้นตอนถัดไป (หลัง Phase 1)
- ดำเนินการต่อที่ **Phase 2 (`transactions-view.tsx`)** ✅ *(เสร็จสิ้นด้านล่าง)*

---

## Phase 2: แตก `transactions-view.tsx` — สถานะ: สำเร็จครบตามแผน ✅

### 1. สรุปการเปลี่ยนแปลงขนาดไฟล์

| ไฟล์ | ก่อน Refactor | หลัง Refactor | หน้าที่หลัก |
| :--- | :---: | :---: | :--- |
| [src/components/finance/transactions-view.tsx](./src/components/finance/transactions-view.tsx) | `1,095` บรรทัด | **`309` บรรทัด** (-71.8%) | Container คุม Filter State, Sorting/Pagination, Export Excel, Delete Dialog และประกอบ Section ทั้ง 3 |
| [src/components/finance/transactions/transactions-filter-bar.tsx](./src/components/finance/transactions/transactions-filter-bar.tsx) | *(สร้างใหม่)* | `190` บรรทัด | แถบค้นหา, Dropdown กรองประเภท/กระเป๋า/หมวดหมู่, ช่วงวันที่, ปุ่มสลับมุมมอง, Export Excel และ Import CSV |
| [src/components/finance/transactions/transactions-list-section.tsx](./src/components/finance/transactions/transactions-list-section.tsx) | *(สร้างใหม่)* | `504` บรรทัด | มุมมองจัดกลุ่มรายวัน (Daily View), การ์ด Mobile, ตาราง Desktop, Empty State และ Pagination Footer |
| [src/components/finance/transactions/csv-import-dialog.tsx](./src/components/finance/transactions/csv-import-dialog.tsx) | *(สร้างใหม่)* | `240` บรรทัด | Modal นำเข้า `.csv`, ปุ่มดาวน์โหลดตัวอย่าง CSV, พรีวิวรายการก่อนบันทึก และปุ่มยืนยันการนำเข้า |

---

### 2. ตารางตรวจเช็กเทียบกับ [REFACTOR_PLAN.md](./REFACTOR_PLAN.md) (Plan vs Actual Audit)

| ข้อในแผน | รายการที่กำหนดในแผน | สถานะ | ผลการตรวจสอบ |
| :---: | :--- | :---: | :--- |
| **2.1** | สร้าง `transactions-filter-bar.tsx` (ค้นหา, กรอง, ช่วงวันที่, Export/Import) | ✅ ครบ | ย้ายครบทั้งหมดรวมปุ่มล้างตัวกรอง, ปุ่มสลับมุมมองรายวัน/ตาราง, ปุ่ม Export Excel และเปิด Import CSV |
| **2.2** | สร้าง `transactions-list-section.tsx` (Daily View, Desktop Table, Mobile Cards, Pagination) | ✅ ครบ | ย้ายครบทั้ง 3 มุมมอง (Daily Grouped, Mobile Card List, Desktop Table), Empty State และ Pagination Footer |
| **2.3** | สร้าง `csv-import-dialog.tsx` (Modal นำเข้า `.csv` + พรีวิว + ดาวน์โหลดตัวอย่าง) | ✅ ครบ | ย้ายครบทั้งหมดรวมการเลือกไฟล์, validation/preview, ดาวน์โหลดไฟล์ตัวอย่าง และการส่งข้อมูลนำเข้า |
| **Container & Props** | คง `TransactionsViewProps` เดิม 100% และลดขนาดไฟล์หลัก | ✅ ครบ | ลด `transactions-view.tsx` จาก `1,095` เหลือ `309` บรรทัด โดย `db-transactions-client.tsx` และ `demo-workspace.tsx` ไม่ต้องแก้โค้ดเลย |
| **กฎความปลอดภัย** | ห้ามแก้ Business Logic / Server Actions / Database | ✅ ผ่าน | ไม่มีการแก้ไฟล์ใน `src/actions/`, `src/db/`, หรือ `src/lib/` |
| **2.4** | ตรวจสอบ `typecheck`, `lint`, `test` | ✅ ผ่าน | ผ่านทุกคำสั่งด้วย exit code `0` (ดูรายละเอียดด้านล่าง) |

> **หมายเหตุเทียบเป้าหมายบรรทัด:** แผนประเมินไว้ที่ ~`250` บรรทัด ส่วนผลจริงได้ **`309` บรรทัด** (ลดลง `71.8%`) เนื่องจากคง state ของตัวกรอง, `useMemo` สำหรับกรอง/จัดกลุ่มรายวัน/แบ่งหน้า, การ Export Excel และ Modal ยืนยันการลบไว้ที่ Container กลางเพื่อไม่ให้เกิด Prop Drilling ซ้ำซ้อน

---

### 3. ผลการตรวจสอบอัตโนมัติหลังแก้ไขโค้ด Phase 2

| การตรวจสอบ | คำสั่ง | ผลลัพธ์ |
| :--- | :--- | :--- |
| TypeScript & Next Route Types | `npm run typecheck` | ✅ ผ่าน (`exit code 0`) |
| ESLint | `npm run lint` | ✅ ผ่าน ไม่มี Error/Warning (`exit code 0`) |
| Unit Tests (Vitest) | `npm test` | ✅ ผ่าน **14 ไฟล์ / 61 tests** (`exit code 0`) |

---

### 4. ขั้นตอนถัดไป (หลัง Phase 2)
- ดำเนินการต่อที่ **Phase 3 (`dashboard-view.tsx`)** ✅ *(เสร็จสิ้นด้านล่าง)*

---

## Phase 3: แตก `dashboard-view.tsx` — สถานะ: สำเร็จครบตามแผน ✅

### 1. สรุปการเปลี่ยนแปลงขนาดไฟล์

| ไฟล์ | ก่อน Refactor | หลัง Refactor | หน้าที่หลัก |
| :--- | :---: | :---: | :--- |
| [src/components/finance/dashboard-view.tsx](./src/components/finance/dashboard-view.tsx) | `1,029` บรรทัด | **`292` บรรทัด** (-71.6%) | Container คุม Header/Month Switcher, จัดกลุ่มกระเป๋า, Charts Row, Form/Streak Widget และประกอบ Section ทั้ง 4 |
| [src/components/finance/dashboard/dashboard-kpi-cards.tsx](./src/components/finance/dashboard/dashboard-kpi-cards.tsx) | *(สร้างใหม่)* | `111` บรรทัด | การ์ด KPI 4 ช่องด้านบน (เงินใช้จ่ายทั่วไป, บัตรเครดิต, รายรับ, รายจ่าย + สุทธิเดือนนี้) |
| [src/components/finance/dashboard/dashboard-wallets-card.tsx](./src/components/finance/dashboard/dashboard-wallets-card.tsx) | *(สร้างใหม่)* | `346` บรรทัด | การ์ดยอดเงินจริงในแต่ละกระเป๋า (ใช้จ่ายทั่วไป / เป้าหมายพร้อมหลอด `%` / บัตรเครดิต) |
| [src/components/finance/dashboard/dashboard-salary-plan-card.tsx](./src/components/finance/dashboard/dashboard-salary-plan-card.tsx) | *(สร้างใหม่)* | `173` บรรทัด | การ์ดแผนเงินเดือน, ยอดใช้จ่ายวันนี้, งบเฉลี่ยรายวัน และป้ายเป้าหมายออม |
| [src/components/finance/dashboard/dashboard-budgets-recent.tsx](./src/components/finance/dashboard/dashboard-budgets-recent.tsx) | *(สร้างใหม่)* | `313` บรรทัด | การ์ดงบประมาณรายเดือน และการ์ดรายการเคลื่อนไหวล่าสุด (พร้อม Pagination ภายใน) |

---

### 2. ตารางตรวจเช็กเทียบกับ [REFACTOR_PLAN.md](./REFACTOR_PLAN.md) (Plan vs Actual Audit)

| ข้อในแผน | รายการที่กำหนดในแผน | สถานะ | ผลการตรวจสอบ |
| :---: | :--- | :---: | :--- |
| **3.1** | สร้าง `dashboard-kpi-cards.tsx` (การ์ด KPI 4 ช่อง) | ✅ ครบ | ย้ายครบทั้ง 4 การ์ดพร้อมการคำนวณสีและเครื่องหมายของกระแสเงินสดสุทธิเดือนนี้ |
| **3.2** | สร้าง `dashboard-wallets-card.tsx` (ยอดเงินจริงแต่ละกระเป๋า + หลอด `%` เป้าหมาย) | ✅ ครบ | ย้ายครบทั้ง 3 กลุ่ม (ใช้จ่ายทั่วไป, เป้าหมาย/ลงทุนพร้อม progress bar, บัตรเครดิต) |
| **3.3** | สร้าง `dashboard-salary-plan-card.tsx` (แผนเงินเดือน & ยอดใช้จ่ายวันนี้) | ✅ ครบ | ย้ายครบทั้งโหมดที่ตั้งแผนแล้วและโหมดยังไม่ตั้งแผน รวมถึงป้าย allocation ที่เปิดใช้งาน |
| **3.4** | สร้าง `dashboard-budgets-recent.tsx` (งบประมาณรายเดือน & รายการล่าสุด) | ✅ ครบ | ย้ายครบทั้ง 2 การ์ดพร้อมแยก `recentPageState` (Pagination) เข้าไปอยู่ในไฟล์ย่อย |
| **Container & Props** | คง `DashboardViewProps` เดิม 100% และลดขนาดไฟล์หลัก | ✅ ครบ | ลด `dashboard-view.tsx` จาก `1,029` เหลือ `292` บรรทัด โดย `db-dashboard-client.tsx` และ `demo-workspace.tsx` ไม่ต้องแก้โค้ดเลย |
| **กฎความปลอดภัย** | ห้ามแก้ Business Logic / Server Actions / Database | ✅ ผ่าน | ไม่มีการแก้ไฟล์ใน `src/actions/`, `src/db/`, หรือ `src/lib/` |
| **3.5** | ตรวจสอบ `typecheck`, `lint`, `test` | ✅ ผ่าน | ผ่านทุกคำสั่งด้วย exit code `0` (ดูรายละเอียดด้านล่าง) |

> **หมายเหตุเทียบเป้าหมายบรรทัด:** แผนประเมินไว้ที่ ~`200` บรรทัด ส่วนผลจริงได้ **`292` บรรทัด** (ลดลง `71.6%`) เนื่องจากคง Dynamic imports ของกราฟ 2 ตัว, การ์ด Charts Row, Header + Month Switcher และการจัดกลุ่มกระเป๋าไว้ที่ Container กลางเพื่อให้ส่ง props ลงการ์ด KPI และการ์ดกระเป๋าได้พร้อมกัน

---

### 3. ผลการตรวจสอบอัตโนมัติหลังแก้ไขโค้ด Phase 3

| การตรวจสอบ | คำสั่ง | ผลลัพธ์ |
| :--- | :--- | :--- |
| TypeScript & Next Route Types | `npm run typecheck` | ✅ ผ่าน (`exit code 0`) |
| ESLint | `npm run lint` | ✅ ผ่าน ไม่มี Error/Warning (`exit code 0`) |
| Unit Tests (Vitest) | `npm test` | ✅ ผ่าน **14 ไฟล์ / 61 tests** (`exit code 0`) |

---

### 4. ขั้นตอนถัดไป (หลัง Phase 3)
- ดำเนินการต่อที่ **Phase 4 (`plan-view.tsx`)** ✅ *(เสร็จสิ้นด้านล่าง)*

---

## Phase 4: แตก `plan-view.tsx` — สถานะ: สำเร็จครบตามแผน ✅

### 1. สรุปการเปลี่ยนแปลงขนาดไฟล์

| ไฟล์ | ก่อน Refactor | หลัง Refactor | หน้าที่หลัก |
| :--- | :---: | :---: | :--- |
| [src/components/finance/plan-view.tsx](./src/components/finance/plan-view.tsx) | `1,472` บรรทัด | **`576` บรรทัด** (-60.9%) | Container คุม Header/Month Switcher, Notice, Waterfall KPI 4 การ์ด, แถบสัดส่วนรายได้ และประกอบ Section ทั้ง 3 |
| [src/components/finance/plan/plan-settings-card.tsx](./src/components/finance/plan/plan-settings-card.tsx) | *(สร้างใหม่)* | `299` บรรทัด | การ์ดตั้งค่าเงินเดือนคงที่, รายได้เสริม (พร้อมปุ่มดึงยอดที่จด), วันเงินออก (`1–31`) และกระเป๋ารับเงิน |
| [src/components/finance/plan/plan-allocations-list.tsx](./src/components/finance/plan/plan-allocations-list.tsx) | *(สร้างใหม่)* | `437` บรรทัด | แบนเนอร์โอนตามแผน, ตัวช่วยคำนวณสัดส่วนแนะนำ (3 กลยุทธ์) และรายการก้อนเป้าหมายทั้งหมด |
| [src/components/finance/plan/plan-allocation-dialog.tsx](./src/components/finance/plan/plan-allocation-dialog.tsx) | *(สร้างใหม่)* | `439` บรรทัด | Modal เพิ่ม/แก้ไขก้อนเป้าหมาย (พร้อมตัวช่วยคำนวณผ่อนเก็บ Wishlist) และ Modal ยืนยันการโอนตามแผน |

---

### 2. ตารางตรวจเช็กเทียบกับ [REFACTOR_PLAN.md](./REFACTOR_PLAN.md) (Plan vs Actual Audit)

| ข้อในแผน | รายการที่กำหนดในแผน | สถานะ | ผลการตรวจสอบ |
| :---: | :--- | :---: | :--- |
| **4.1** | สร้าง `plan-settings-card.tsx` (เงินเดือนคงที่, รายได้เสริม, วันเงินออก, กระเป๋ารับเงิน) | ✅ ครบ | ย้ายครบพร้อม `SmoothExpand`, ปุ่มลัดวันเงินออก `1, 5, 15, 25, 31` และแจ้งเตือนภาษี (`extractTaxAlertFromResult`) |
| **4.2** | สร้าง `plan-allocations-list.tsx` (รายการเป้าหมาย + แบนเนอร์โอน + แนะนำสัดส่วน) | ✅ ครบ | ย้ายครบทั้ง 3 ส่วน พร้อม live preview จาก `draftTotalIncome` เมื่อพิมพ์รายได้ใน `PlanSettingsCard` |
| **4.3** | สร้าง `plan-allocation-dialog.tsx` (Modal เพิ่ม/แก้ไขเป้าหมาย + Modal ยืนยันโอน) | ✅ ครบ | ย้ายครบทั้ง `PlanAllocationDialog` (ใช้ `formKey` รีเซ็ตฟอร์มสะอาดโดยไม่เกิดอาการกระพริบตอนปิด) และ `PlanTransferConfirmDialog` |
| **Container & Props** | คง `PlanViewProps` เดิม 100% และลดขนาดไฟล์หลัก | ✅ ครบ | ลด `plan-view.tsx` จาก `1,472` เหลือ `576` บรรทัด โดย `db-plan-client.tsx` และ `demo-workspace.tsx` ไม่ต้องแก้โค้ดเลย |
| **กฎความปลอดภัย** | ห้ามแก้ Business Logic / Server Actions / Database | ✅ ผ่าน | ไม่มีการแก้ไฟล์ใน `src/actions/`, `src/db/`, หรือ `src/lib/` |
| **4.4** | ตรวจสอบ `typecheck`, `lint`, `test` | ✅ ผ่าน | ผ่านทุกคำสั่งด้วย exit code `0` (ดูรายละเอียดด้านล่าง) |

> **หมายเหตุเทียบเป้าหมายบรรทัด:** แผนประเมินไว้ที่ ~`300` บรรทัด ส่วนผลจริงได้ **`576` บรรทัด** (ลดลง `60.9%`) เนื่องจากในแผนกำหนดให้แตกเป็น 3 ไฟล์ย่อยตามหัวข้อ `4.1–4.3` และคงส่วนแสดงสรุป Waterfall KPI 4 การ์ด + แถบสัดส่วนรายได้ (~220 บรรทัด) ไว้ใน `plan-view.tsx`

---

### 3. ผลการตรวจสอบอัตโนมัติหลังแก้ไขโค้ด Phase 4

| การตรวจสอบ | คำสั่ง | ผลลัพธ์ |
| :--- | :--- | :--- |
| TypeScript & Next Route Types | `npm run typecheck` | ✅ ผ่าน (`exit code 0`) |
| ESLint | `npm run lint` | ✅ ผ่าน ไม่มี Error/Warning (`exit code 0`) |
| Unit Tests (Vitest) | `npm test` | ✅ ผ่าน **14 ไฟล์ / 61 tests** (`exit code 0`) |

---

### 4. ขั้นตอนถัดไป (หลัง Phase 4)
- ดำเนินการต่อที่ **Phase 5 (`investments-view.tsx`)** ✅ *(เสร็จสิ้นด้านล่าง)*

---

## Phase 5: แตก `investments-view.tsx` — สถานะ: สำเร็จครบตามแผน ✅

### 1. สรุปการเปลี่ยนแปลงขนาดไฟล์

| ไฟล์ | ก่อน Refactor | หลัง Refactor | หน้าที่หลัก |
| :--- | :---: | :---: | :--- |
| [src/components/finance/investments-view.tsx](./src/components/finance/investments-view.tsx) | `3,136` บรรทัด | **`1,250` บรรทัด** (-60.1%) | Container คุม Dual-mode State (PostgreSQL/localStorage), Mutation Handlers, Header, KPI 4 การ์ด และประกอบ Section ทั้ง 3 |
| [src/components/finance/investments/investment-dialogs.tsx](./src/components/finance/investments/investment-dialogs.tsx) | *(สร้างใหม่)* | `1,215` บรรทัด | Modal ทั้ง 4 ตัว (Add/Edit Holding, Monthly Snapshot, Record DCA, Record Dividend) พร้อม Form State และ Validation ภายใน |
| [src/components/finance/investments/investment-simulator-card.tsx](./src/components/finance/investments/investment-simulator-card.tsx) | *(สร้างใหม่)* | `485` บรรทัด | แผงตั้งค่าตัวจำลอง DCA ระยะยาว (Preset Chips, 6 Inputs, Insight Box) + แถวกราฟทบต้นและ Donut Chart |
| [src/components/finance/investments/investment-holdings-section.tsx](./src/components/finance/investments/investment-holdings-section.tsx) | *(สร้างใหม่)* | `770` บรรทัด | เช็กลิสต์ DCA รายเดือน + ประวัติซื้อ DCA, การ์ดสินทรัพย์ในพอร์ต + ตัวเลือกยอดนิยม และสมุดบันทึกยอดพอร์ตรายเดือน (Mobile/Desktop) |

---

### 2. ตารางตรวจเช็กเทียบกับ [REFACTOR_PLAN.md](./REFACTOR_PLAN.md) (Plan vs Actual Audit)

| ข้อในแผน | รายการที่กำหนดในแผน | สถานะ | ผลการตรวจสอบ |
| :---: | :--- | :---: | :--- |
| **5.1** | สร้าง `investment-dialogs.tsx` (Modal ทั้ง 4 ตัว: Holding, Snapshot, DCA, Dividend) | ✅ ครบ | ย้ายครบทั้ง 4 Modal พร้อมแยก Form State + Validation ออกจาก `investments-view.tsx` และใช้ `formKey` รีเซ็ตฟอร์มสะอาดโดยไม่กระพริบ |
| **5.2** | สร้าง `investment-simulator-card.tsx` (ตั้งค่า & กราฟจำลอง DCA ระยะยาว) | ✅ ครบ | ย้ายครบทั้งแผงตั้งค่า `SmoothExpand`, ปุ่ม Preset, Insight Box และ Dynamic Imports ของกราฟทั้ง 2 ตัว |
| **5.3** | สร้าง `investment-holdings-section.tsx` (การ์ดสินทรัพย์, ประวัติ DCA/ปันผล, ยอดพอร์ตรายเดือน) | ✅ ครบ | ย้ายครบทั้งเช็กลิสต์ DCA รายเดือน, ประวัติซื้อ DCA, การ์ดพอร์ตหุ้น/กองทุน และตาราง/การ์ด Monthly Snapshot |
| **Container & Props** | คง `InvestmentsViewProps` และ `InvestmentsViewDbHandlers` เดิม 100% | ✅ ครบ | ลด `investments-view.tsx` จาก `3,136` เหลือ `1,250` บรรทัด โดย `db-investments-client.tsx` และ `demo-workspace.tsx` ไม่ต้องแก้โค้ดเลย |
| **กฎความปลอดภัย** | ห้ามแก้ Business Logic / Server Actions / Database | ✅ ผ่าน | ไม่มีการแก้ไฟล์ใน `src/actions/`, `src/db/`, หรือ `src/lib/` |
| **5.4** | ตรวจสอบเต็มรูปแบบ (`typecheck`, `lint`, `test`, `build`) | ✅ ผ่าน | ผ่านครบทุกคำสั่งรวม Production Build (`exit code 0`) |

> **หมายเหตุเทียบเป้าหมายบรรทัด:** แผนประเมินไว้ที่ ~`700` บรรทัด ส่วนผลจริงได้ **`1,250` บรรทัด** (ลดลง `60.1%`) เนื่องจาก `investments-view.tsx` คุม State และ Mutation Handlers แบบ 2 โหมดพร้อมกัน (Database Mode + Local/Demo Mode พร้อม Auto-save, Local Migration และ Refresh Prices API ประมาณ ~750 บรรทัด) เพื่อไม่ให้แตก Business/Persistence Logic ออกไปเกินขอบเขตของ Refactor รอบนี้

---

### 3. ผลการตรวจสอบอัตโนมัติเต็มรูปแบบหลังแก้ไขโค้ด Phase 5

| การตรวจสอบ | คำสั่ง | ผลลัพธ์ |
| :--- | :--- | :--- |
| TypeScript & Next Route Types | `npm run typecheck` | ✅ ผ่าน (`exit code 0`) |
| ESLint | `npm run lint` | ✅ ผ่าน ไม่มี Error/Warning (`exit code 0`) |
| Unit Tests (Vitest) | `npm test` | ✅ ผ่าน **14 ไฟล์ / 61 tests** (`exit code 0`) |
| Production Build (Next.js 16) | `npm run build` | ✅ ผ่าน (`Compiled in 5.0s`, `TypeScript in 10.6s`, `18/18` routes, `exit code 0`) |

---

## สรุปภาพรวมทั้งหมด (Phase 1 – Phase 5) 🎉

| Phase | ไฟล์หลัก | ก่อน Refactor | เป้าหมายในแผน | หลัง Refactor (จริง) | ลดลง | ไฟล์ย่อยที่สร้าง | สถานะ |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | [manage-view.tsx](./src/components/finance/manage-view.tsx) | `1,675` | ~`180` | **`209`** | -87.5% | 5 ไฟล์ (`manage/`) | ✅ |
| **2** | [transactions-view.tsx](./src/components/finance/transactions-view.tsx) | `1,095` | ~`250` | **`309`** | -71.8% | 3 ไฟล์ (`transactions/`) | ✅ |
| **3** | [dashboard-view.tsx](./src/components/finance/dashboard-view.tsx) | `1,029` | ~`200` | **`292`** | -71.6% | 4 ไฟล์ (`dashboard/`) | ✅ |
| **4** | [plan-view.tsx](./src/components/finance/plan-view.tsx) | `1,472` | ~`300` | **`576`** | -60.9% | 3 ไฟล์ (`plan/`) | ✅ |
| **5** | [investments-view.tsx](./src/components/finance/investments-view.tsx) | `3,136` | ~`700` | **`1,250`** | -60.1% | 3 ไฟล์ (`investments/`) | ✅ |
| **รวม** | **5 ไฟล์หลัก** | **`8,407` บรรทัด** | — | **`2,636` บรรทัด** | **-68.6%** | **18 ไฟล์ย่อย** | **ครบ 100%** |

### ขั้นตอนถัดไปสำหรับผู้พัฒนา
1. ทดสอบเปิดหน้าเว็บจริงทุกหน้า (`/`, `/transactions`, `/plan`, `/investments`, `/manage`, `/demo`) *(ผ่านการทดสอบ Interactive UI Test Suite บน `/demo` ครบทั้ง 5 Phase แล้วด้านล่าง)*
2. หากเรียบร้อยดี ให้ Commit งานบน Branch `refactor/split-ui-components` และ Merge กลับเข้า `main` *(หมายเหตุ: ใน working tree ยังมีไฟล์เดิมก่อนเริ่ม Refactor เช่น `thai-tax.ts` และ `transaction-form-dialog.tsx` แนะนำ `git add` เฉพาะไฟล์ที่เกี่ยวข้อง หรือแยก Commit ให้ชัดเจน)*

---

## ผลการทดสอบ Interactive UI Test Cases ทั้ง 5 Phase (End-to-End บนเบราว์เซอร์) ✅

> **สภาพแวดล้อมทดสอบ:** `http://localhost:3000/demo` (Desktop Viewport `1280×800`)  
> **ผลตรวจ Runtime:** **Console Errors = `0`** | **Uncaught Page Errors = `0`**  
> **ผลรวม:** **ผ่านครบ 17 / 17 Test Cases**

| Phase | TC ID | ไฟล์ย่อยที่ทดสอบ | รายละเอียดการทดสอบ | ผลลัพธ์ |
| :---: | :---: | :--- | :--- | :---: |
| **1** | **TC-1.1** | `manage-wallets-section.tsx` | แสดง 6 กระเป๋า, เปิด `+ เพิ่มกระเป๋า` เห็นเทมเพลต 4 แบบ (`พอร์ตหุ้น/DCA`, `ซื้อของให้แฟน`, `ของที่อยากได้`, `เงินเย็น`), สร้างและลบ `ทดสอบกระเป๋า P1`, เปิด-ปิด Modal `ปรับยอดคงเหลือปัจจุบัน` | ✅ PASS |
| **1** | **TC-1.2** | `manage-categories-section.tsx` | สลับแท็บ `หมวดหมู่รายจ่าย` / `หมวดหมู่รายรับ`, เปิด-ปิด Modal `+ เพิ่มหมวดหมู่` (เห็นช่องชื่อ, ประเภท, งบรายเดือน, สี 9 สี) | ✅ PASS |
| **1** | **TC-1.3** | `manage-salary-card.tsx` | การ์ดตั้งค่าเงินเดือน & วันเงินออกแสดงครบ พร้อมปุ่มลัด `1, 5, 15, 25, 31` และ Dropdown | ✅ PASS |
| **1** | **TC-1.4** | `manage-backup-card.tsx` | การ์ดสำรอง/กู้คืน `.json` แสดงปุ่มดาวน์โหลดและนำเข้าไฟล์ครบ | ✅ PASS |
| **1** | **TC-1.5** | `manage-account-cards.tsx` | ตรวจเงื่อนไขการซ่อนในโหมด `/demo` (ไม่แสดงเมื่อไม่มี `userProfile` ตามออกแบบ; ผ่าน Typecheck/Build สำหรับหน้า `/manage` จริงแล้ว) | ✅ PASS |
| **2** | **TC-2.1** | `transactions-filter-bar.tsx` | แสดงแถบค้นหา, Dropdown 3 ตัว, ช่วงวันที่, `นำเข้า CSV`, `Export .xlsx` — ทดสอบพิมพ์ค้นหากรองจาก `19` เหลือ `1` รายการ และล้างตัวกรองกลับเป็น `19` รายการ | ✅ PASS |
| **2** | **TC-2.2** | `transactions-list-section.tsx` | ทดสอบมุมมองจัดกลุ่มรายวัน (`รายวัน`) ➔ สลับเป็นตาราง (`ตาราง` แสดงครบ 7 คอลัมน์ 19 แถว) ➔ สลับกลับเป็น `รายวัน` | ✅ PASS |
| **2** | **TC-2.3** | `csv-import-dialog.tsx` | กด `นำเข้า CSV` เปิด Modal เห็นปุ่มดาวน์โหลดตัวอย่าง, เลือกไฟล์, วางข้อมูลทดสอบ และปิด Modal ได้สมบูรณ์ | ✅ PASS |
| **3** | **TC-3.1** | `dashboard-kpi-cards.tsx` | การ์ด KPI ทั้ง 4 ช่องแสดงตัวเลขเงินบาทถูกต้อง (ไม่พบ `NaN`/`undefined`) | ✅ PASS |
| **3** | **TC-3.2** | `dashboard-wallets-card.tsx` | แสดงครบ 3 กลุ่ม: กระเป๋าใช้จ่ายทั่วไป, กระเป๋าเป้าหมาย/ลงทุนพร้อมหลอดความคืบหน้า `%` และบัตรเครดิต | ✅ PASS |
| **3** | **TC-3.3** | `dashboard-salary-plan-card.tsx` | แสดงแผนเงินเดือน, คงเหลือใช้จ่ายได้จริง, ยอดใช้จ่ายวันนี้ และเฉลี่ยต่อวัน | ✅ PASS |
| **3** | **TC-3.4** | `dashboard-budgets-recent.tsx` | แสดงงบประมาณรายเดือน (5 หมวด) และรายการล่าสุด — คลิกแถวรายการเพื่อเปิด `TransactionFormDialog` (พรีฟิลข้อมูลครบ) และปิดได้สมบูรณ์ | ✅ PASS |
| **3** | **TC-3.5** | `dashboard-view.tsx` (Charts & Streak) | กราฟ 2 ตัว (แนวโน้ม 6 เดือน + สัดส่วนหมวดหมู่) และป้ายไฟ `StreakFlameWidget` แสดงผลครบโดยไม่มี Error | ✅ PASS |
| **4** | **TC-4.1** | `plan-settings-card.tsx` | กดขยายแผงตั้งค่ารายได้/วันเงินออก เห็นปุ่มลัด 5 วัน, กรอกและกดบันทึกแสดงแถบแจ้งเตือนสำเร็จ | ✅ PASS |
| **4** | **TC-4.2** | `plan-allocations-list.tsx` | แสดง Waterfall KPI 4 การ์ด, แถบสัดส่วนรายได้, กด `ดูสัดส่วนแนะนำ` ขยายการ์ดกลยุทธ์ทั้ง 3 แบบ และแสดงรายการเป้าหมายครบ | ✅ PASS |
| **4** | **TC-4.3** | `plan-allocation-dialog.tsx` | เพิ่มเป้าหมาย `ทดสอบเป้าหมาย P4` (`500` บาท) แสดงในรายการแล้วลบออกได้, และเปิด-ปิด Modal `โอนตามแผนเข้ากระเป๋าเลย` (`PlanTransferConfirmDialog`) ได้สมบูรณ์ | ✅ PASS |
| **5** | **TC-5.1** | `investment-simulator-card.tsx` | กด Preset `5 ล้าน` และ `10% เติบโตสูง` ตัวเลขจำลอง 15 ปีและ KPI อัปเดตทันที, พับ/ขยายแผงตั้งค่า และแสดงกราฟครบ 2 ตัว | ✅ PASS |
| **5** | **TC-5.2** | `investment-holdings-section.tsx` | แสดงเช็กลิสต์ DCA รายเดือน, ตัวเลือกยอดนิยม, การ์ดสินทรัพย์ (`VOO`, `SCHD`, `GOLD`) และสมุดบันทึกยอดพอร์ตรายเดือน | ✅ PASS |
| **5** | **TC-5.3** | `investment-dialogs.tsx` (ทั้ง 4 Modal) | ทดสอบครบทั้ง 4 Modal แบบ End-to-End: 1) เพิ่มสินทรัพย์ `TESTP5` 2) ซื้อ DCA `500` บาท + ขยายดูประวัติ DCA 3) บันทึกปันผล `+50` บาท 4) บันทึก Snapshot เดือนนี้ (`500` ➔ `550`, `+10%`) แล้วลบข้อมูลทดสอบออกสะอาด | ✅ PASS |
