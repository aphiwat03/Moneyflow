# MoneyFlow — แผนการ Refactor แยกไฟล์ UI Components (Refactor Plan)

> **Branch สำหรับงานนี้:** `refactor/split-ui-components` (แยกจาก `main` ที่ commit `595f62c`)  
> **เป้าหมาย:** แตกไฟล์ UI ขนาดใหญ่ใน `src/components/finance/` ให้เล็กลง อ่านง่าย ดูแลรักษาง่าย โดย **ไม่เปลี่ยนพฤติกรรมหน้าเว็บ, Props, หรือ Database**  
> **เอกสารแยกจากแผนพัฒนาฟีเจอร์หลัก:** [PLAN.md](./PLAN.md)

---

## 0. กฎความปลอดภัย & วิธี Rollback (หากต้องการย้อนกลับ)

1. **ทำทีละ Phase แล้วตรวจผ่านทุกครั้ง** (`npm run typecheck`, `npm run lint`, `npm test`) ก่อนขึ้น Phase ถัดไป
2. **ห้ามแก้ Business Logic หรือ Server Actions** ระหว่างการแตกไฟล์ UI (ย้ายเฉพาะ JSX + UI state ที่ผูกกับส่วนนั้น)
3. **วิธี Rollback กลับไปก่อน Refactor:**
   - **กรณียังไม่ Commit ใน Phase ที่พัง:**
     ```bash
     git restore src/components/finance/
     ```
   - **กรณียกเลิกทั้ง Branch กลับไปใช้ `main` เหมือนเดิม:**
     ```bash
     git checkout main
     ```
   - *(หมายเหตุ: ก่อนสลับกลับ `main` หากมีการแก้ไขค้างไว้ให้ `git stash` หรือ `git commit` บน `refactor/split-ui-components` ก่อน เพื่อไม่ให้กระทบงานที่ทำค้างบน `main`)*

---

## สรุปขนาดไฟล์ปัจจุบันก่อนเริ่ม Refactor

| ลำดับทำ | ไฟล์ต้นทาง | ขนาดปัจจุบัน | เป้าหมายหลังแตก | ความเสี่ยง |
| :---: | :--- | :---: | :---: | :---: |
| Phase 1 | [src/components/finance/manage-view.tsx](./src/components/finance/manage-view.tsx) | `1,675` บรรทัด | ~`180` บรรทัด (+5 ไฟล์ย่อย) | ต่ำมาก ⭐ |
| Phase 2 | [src/components/finance/transactions-view.tsx](./src/components/finance/transactions-view.tsx) | `1,095` บรรทัด | ~`250` บรรทัด (+3 ไฟล์ย่อย) | ต่ำมาก |
| Phase 3 | [src/components/finance/dashboard-view.tsx](./src/components/finance/dashboard-view.tsx) | `1,029` บรรทัด | ~`200` บรรทัด (+4 ไฟล์ย่อย) | ต่ำ |
| Phase 4 | [src/components/finance/plan-view.tsx](./src/components/finance/plan-view.tsx) | `1,472` บรรทัด | ~`300` บรรทัด (+3 ไฟล์ย่อย) | ปานกลาง |
| Phase 5 | [src/components/finance/investments-view.tsx](./src/components/finance/investments-view.tsx) | `3,136` บรรทัด | ~`700` บรรทัด (+3 ไฟล์ย่อย) | ปานกลาง |

---

## Phase 1: แตก `manage-view.tsx` (`1,675` ➔ ~`180` บรรทัด)
> โฟลเดอร์ปลายทาง: `src/components/finance/manage/`

- [x] **1.1** สร้าง `src/components/finance/manage/manage-wallets-section.tsx`
  - ย้ายการ์ด **"กระเป๋าเงิน / บัญชี"** + Modal เพิ่ม/แก้ไขกระเป๋า (พร้อมเทมเพลต `พอร์ตหุ้น`, `ซื้อของให้แฟน`, `ของที่อยากได้`, `เงินเย็น`) + Modal ปรับยอดคงเหลือปัจจุบัน
- [x] **1.2** สร้าง `src/components/finance/manage/manage-categories-section.tsx`
  - ย้ายการ์ด **"หมวดหมู่รายรับ - รายจ่าย & งบประมาณรายเดือน"** (แท็บรายจ่าย/รายรับ + Animation) + Modal เพิ่ม/แก้ไขหมวดหมู่
- [x] **1.3** สร้าง `src/components/finance/manage/manage-salary-card.tsx`
  - ย้ายการ์ด **"ตั้งค่าเงินเดือน & วันที่เงินเดือนออก"** (รวมปุ่มเลือกวันด่วน `1, 5, 15, 25, 31`)
- [x] **1.4** สร้าง `src/components/finance/manage/manage-backup-card.tsx`
  - ย้ายการ์ด **"ย้ายเครื่อง / สำรองและกู้คืนข้อมูลทั้งหมด (.json)"** + Modal ยืนยันการกู้คืนข้อมูล
- [x] **1.5** สร้าง `src/components/finance/manage/manage-account-cards.tsx`
  - ย้ายการ์ด **"ข้อมูลบัญชีผู้ใช้"** และ **"เปลี่ยนรหัสผ่าน"**
- [x] **1.6** ปรับ `manage-view.tsx` ให้ทำหน้าที่เป็น Container คุม `showArchived`, `globalNotice` และประกอบ Section ทั้ง 5 เข้าด้วยกัน
- [x] **1.7 ตรวจสอบ:** รัน `npm run typecheck && npm run lint && npm test` ผ่านครบทั้งหมด *(พร้อมให้ตรวจสอบและ `git commit` บน Branch `refactor/split-ui-components`)*

---

## Phase 2: แตก `transactions-view.tsx` (`1,095` ➔ ~`250` บรรทัด)
> โฟลเดอร์ปลายทาง: `src/components/finance/transactions/`

- [x] **2.1** สร้าง `src/components/finance/transactions/transactions-filter-bar.tsx`
  - ย้ายแถบค้นหา, Dropdown กรองประเภท/กระเป๋า/หมวดหมู่, ช่วงวันที่, ปุ่ม Export Excel / Import CSV
- [x] **2.2** สร้าง `src/components/finance/transactions/transactions-list-section.tsx`
  - ย้ายมุมมองจัดกลุ่มรายวัน (Daily View), ตาราง Desktop, การ์ด Mobile, และ Pagination Footer
- [x] **2.3** สร้าง `src/components/finance/transactions/csv-import-dialog.tsx`
  - ย้าย Modal นำเข้า `.csv` + ตารางตรวจสอบรายการก่อนบันทึก + ปุ่มดาวน์โหลดตัวอย่าง CSV
- [x] **2.4 ตรวจสอบ:** รัน `npm run typecheck && npm run lint && npm test` ผ่านครบทั้งหมด *(พร้อมให้ตรวจสอบและ `git commit` บน Branch `refactor/split-ui-components`)*

---

## Phase 3: แตก `dashboard-view.tsx` (`1,029` ➔ ~`200` บรรทัด)
> โฟลเดอร์ปลายทาง: `src/components/finance/dashboard/`

- [x] **3.1** สร้าง `src/components/finance/dashboard/dashboard-kpi-cards.tsx`
  - ย้ายการ์ด KPI 4 ช่องด้านบน (เงินในกระเป๋าใช้จ่ายทั่วไป, บัตรเครดิต, รายรับ, รายจ่าย)
- [x] **3.2** สร้าง `src/components/finance/dashboard/dashboard-wallets-card.tsx`
  - ย้ายการ์ด **"ยอดเงินจริงในแต่ละกระเป๋า"** (แยกกระเป๋าใช้จ่ายทั่วไป / กระเป๋าเป้าหมายพร้อมหลอด `%` / บัตรเครดิต)
- [x] **3.3** สร้าง `src/components/finance/dashboard/dashboard-salary-plan-card.tsx`
  - ย้ายการ์ด **"แผนเงินเดือน & ยอดใช้จ่ายวันนี้"**
- [x] **3.4** สร้าง `src/components/finance/dashboard/dashboard-budgets-recent.tsx`
  - ย้ายการ์ด **"งบประมาณรายเดือน"** และ **"รายการเคลื่อนไหวล่าสุด"**
- [x] **3.5 ตรวจสอบ:** รัน `npm run typecheck && npm run lint && npm test` ผ่านครบทั้งหมด *(พร้อมให้ตรวจสอบและ `git commit` บน Branch `refactor/split-ui-components`)*

---

## Phase 4: แตก `plan-view.tsx` (`1,472` ➔ ~`300` บรรทัด)
> โฟลเดอร์ปลายทาง: `src/components/finance/plan/`

- [x] **4.1** สร้าง `src/components/finance/plan/plan-settings-card.tsx`
  - ย้ายการ์ดตั้งค่าเงินเดือนคงที่, รายได้เสริม, วันเงินออก และกระเป๋ารับเงิน
- [x] **4.2** สร้าง `src/components/finance/plan/plan-allocations-list.tsx`
  - ย้ายรายการก้อนเป้าหมาย (เงินเย็น / DCA / ของที่อยากได้ / อื่นๆ) + แบนเนอร์โอนตามแผน + ตัวช่วยแนะนำสัดส่วน
- [x] **4.3** สร้าง `src/components/finance/plan/plan-allocation-dialog.tsx`
  - ย้าย Modal เพิ่ม/แก้ไขก้อนเป้าหมาย และ Modal ยืนยันการโอนตามแผน
- [x] **4.4 ตรวจสอบ:** รัน `npm run typecheck && npm run lint && npm test` ผ่านครบทั้งหมด *(พร้อมให้ตรวจสอบและ `git commit` บน Branch `refactor/split-ui-components`)*

---

## Phase 5: แตก `investments-view.tsx` (`3,136` ➔ ~`700` บรรทัด)
> โฟลเดอร์ปลายทาง: `src/components/finance/investments/`

- [x] **5.1** สร้าง `src/components/finance/investments/investment-dialogs.tsx`
  - ย้าย Modal ทั้ง 4 ตัว (Add/Edit Holding, Snapshot, Record DCA, Record Dividend)
- [x] **5.2** สร้าง `src/components/finance/investments/investment-simulator-card.tsx`
  - ย้ายส่วนตั้งค่า & กราฟจำลอง DCA ระยะยาว
- [x] **5.3** สร้าง `src/components/finance/investments/investment-holdings-section.tsx`
  - ย้ายตาราง/การ์ดสินทรัพย์ในพอร์ต และประวัติการบันทึก DCA/ปันผล
- [x] **5.4 ตรวจสอบเต็มรูปแบบ:** รัน `npm run typecheck && npm run lint && npm test && npm run build` ผ่านครบทั้งหมด *(พร้อมให้ตรวจสอบและ Commit / Merge จาก Branch `refactor/split-ui-components`)*
