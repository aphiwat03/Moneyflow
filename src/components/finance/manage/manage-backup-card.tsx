"use client";

import { useRef, useState } from "react";
import { Download, HardDriveDownload, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBangkokToday } from "@/lib/date";
import {
  parseBackupBundle,
  type MoneyFlowBackupBundle,
} from "@/lib/portable-backup";
import type { ActionResult } from "@/lib/types";
import type { ManageNotice } from "./manage-wallets-section";

interface ManageBackupCardProps {
  onExportFullBackup?: () => Promise<ActionResult<MoneyFlowBackupBundle>>;
  onRestoreFullBackup?: (
    bundle: MoneyFlowBackupBundle
  ) => Promise<
    ActionResult<{
      walletsCount: number;
      categoriesCount: number;
      transactionsCount: number;
      allocationsCount: number;
    }>
  >;
  onNotify: (notice: ManageNotice | null) => void;
}

export function ManageBackupCard({
  onExportFullBackup,
  onRestoreFullBackup,
  onNotify,
}: ManageBackupCardProps) {
  const [backupExporting, setBackupExporting] = useState(false);
  const [backupRestoring, setBackupRestoring] = useState(false);
  const [pendingRestoreBundle, setPendingRestoreBundle] =
    useState<MoneyFlowBackupBundle | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleExportFullBackupClick() {
    if (!onExportFullBackup) return;
    setBackupExporting(true);
    onNotify(null);
    try {
      const res = await onExportFullBackup();
      if (!res.ok || !res.data) {
        onNotify({
          type: "error",
          message: res.error ?? "ไม่สามารถส่งออกไฟล์สำรองข้อมูลได้",
        });
        return;
      }

      const jsonText = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonText], {
        type: "application/json;charset=utf-8",
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `MoneyFlow_Backup_${getBangkokToday()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      onNotify({
        type: "success",
        message: `ส่งออกไฟล์สำรองข้อมูลเรียบร้อย (${res.data.wallets.length} กระเป๋า, ${res.data.transactions.length} รายการ)`,
      });
    } catch {
      onNotify({
        type: "error",
        message: "เกิดข้อผิดพลาดในการสร้างไฟล์สำรองข้อมูล",
      });
    } finally {
      setBackupExporting(false);
    }
  }

  async function handleBackupFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    onNotify(null);
    try {
      const text = await file.text();
      const parsed = parseBackupBundle(text);
      if (!parsed.ok) {
        onNotify({
          type: "error",
          message: parsed.error,
        });
        return;
      }
      setPendingRestoreBundle(parsed.data);
    } catch {
      onNotify({
        type: "error",
        message: "ไม่สามารถอ่านไฟล์ที่เลือกได้ กรุณาตรวจสอบว่าเป็นไฟล์ .json",
      });
    }
  }

  async function handleConfirmRestoreBackup() {
    if (!pendingRestoreBundle || !onRestoreFullBackup) return;
    setBackupRestoring(true);
    onNotify(null);
    try {
      const res = await onRestoreFullBackup(pendingRestoreBundle);
      if (!res.ok) {
        onNotify({
          type: "error",
          message: res.error ?? "กู้คืนข้อมูลจากไฟล์สำรองไม่สำเร็จ",
        });
        return;
      }
      setPendingRestoreBundle(null);
      onNotify({
        type: "success",
        message: res.data
          ? `กู้คืนข้อมูลเรียบร้อย (${res.data.walletsCount} กระเป๋า, ${res.data.categoriesCount} หมวดหมู่, ${res.data.allocationsCount} เป้าหมาย, ${res.data.transactionsCount} รายการ)`
          : "กู้คืนข้อมูลจากไฟล์สำรองเรียบร้อยแล้ว",
      });
    } finally {
      setBackupRestoring(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDriveDownload className="h-4 w-4 text-teal-600" />
            <span>ย้ายเครื่อง / สำรองและกู้คืนข้อมูลทั้งหมด (.json)</span>
          </CardTitle>
          <CardDescription>
            ส่งออกข้อมูลทั้งหมด (กระเป๋าเงิน หมวดหมู่ ตั้งค่าเงินเดือน เป้าหมายออม/DCA และรายการรับ-จ่าย-โอนทุกวัน)
            เป็นไฟล์ .json เดียวเพื่อย้ายข้ามเครื่อง หรือย้ายจากโหมดทดลอง UI เข้า PostgreSQL ได้ทันที
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {onExportFullBackup ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleExportFullBackupClick}
                loading={backupExporting}
                loadingText="กำลังสร้างไฟล์..."
                disabled={backupRestoring}
                className="h-auto min-h-10 w-full max-w-full gap-1.5 py-2 text-left whitespace-normal sm:w-auto"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span>ดาวน์โหลดไฟล์สำรองข้อมูล (.json สำหรับย้ายเครื่อง)</span>
              </Button>
            ) : null}

            {onRestoreFullBackup ? (
              <>
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleBackupFileChange}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => backupFileInputRef.current?.click()}
                  disabled={backupExporting || backupRestoring}
                  className="h-auto min-h-10 w-full max-w-full gap-1.5 py-2 text-left whitespace-normal sm:w-auto"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>นำเข้า / กู้คืนจากไฟล์สำรอง (.json)</span>
                </Button>
              </>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            หมายเหตุ: การกู้คืนจากไฟล์สำรองจะแทนที่ข้อมูลเดิมในบัญชี/โหมดปัจจุบันทั้งหมดด้วยข้อมูลจากไฟล์ที่เลือก
          </p>
        </CardContent>
      </Card>

      {/* Restore Full Backup Confirmation Modal */}
      <Dialog
        open={Boolean(pendingRestoreBundle)}
        onOpenChange={(open) => {
          if (!open && !backupRestoring) setPendingRestoreBundle(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการกู้คืนข้อมูลจากไฟล์สำรอง</DialogTitle>
            <DialogDescription>
              ระบบจะเขียนทับข้อมูลกระเป๋า หมวดหมู่ แผนเงินเดือน และรายการทั้งหมดในบัญชีปัจจุบันด้วยข้อมูลจากไฟล์นี้
            </DialogDescription>
          </DialogHeader>

          {pendingRestoreBundle ? (
            <div className="space-y-3 text-sm">
              <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3 text-xs">
                <p>
                  วันที่ส่งออกไฟล์:{" "}
                  <strong className="font-mono">
                    {pendingRestoreBundle.exportedAt
                      .slice(0, 19)
                      .replace("T", " ")}
                  </strong>
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div>
                    กระเป๋าเงิน:{" "}
                    <strong className="tabular-nums">
                      {pendingRestoreBundle.wallets.length}
                    </strong>{" "}
                    รายการ
                  </div>
                  <div>
                    หมวดหมู่:{" "}
                    <strong className="tabular-nums">
                      {pendingRestoreBundle.categories.length}
                    </strong>{" "}
                    รายการ
                  </div>
                  <div>
                    เป้าหมายออม/DCA:{" "}
                    <strong className="tabular-nums">
                      {pendingRestoreBundle.salaryAllocations.length}
                    </strong>{" "}
                    รายการ
                  </div>
                  <div>
                    รายการรับ-จ่าย-โอน:{" "}
                    <strong className="tabular-nums">
                      {pendingRestoreBundle.transactions.length}
                    </strong>{" "}
                    รายการ
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                คำแนะนำ: หากมีข้อมูลสำคัญอยู่ในเครื่องนี้ แนะนำให้กดดาวน์โหลดไฟล์สำรองปัจจุบันเก็บไว้ก่อนกู้คืน
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={backupRestoring}
              onClick={() => setPendingRestoreBundle(null)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRestoreBackup}
              loading={backupRestoring}
              loadingText="กำลังกู้คืนข้อมูล..."
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              ยืนยันกู้คืนข้อมูลทั้งหมด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
