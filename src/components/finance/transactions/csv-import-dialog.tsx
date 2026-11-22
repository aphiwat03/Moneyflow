"use client";

import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { TransactionFormInput } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseCsvTransactions,
  SAMPLE_CSV_TEMPLATE,
  type CsvImportCandidate,
} from "@/lib/csv-import";
import type { ActionResult, CategoryDTO, WalletDTO } from "@/lib/types";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  onImportTransactions?: (
    rows: TransactionFormInput[]
  ) => Promise<ActionResult<{ importedCount: number }>>;
  onImportSuccess: (message: string) => void;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  wallets,
  categories,
  onImportTransactions,
  onImportSuccess,
}: CsvImportDialogProps) {
  const [csvText, setCsvText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const importCandidates = useMemo<CsvImportCandidate[]>(() => {
    if (!csvText.trim()) return [];
    return parseCsvTransactions(csvText, wallets, categories);
  }, [csvText, wallets, categories]);

  const validImportPayloads = useMemo(() => {
    return importCandidates
      .filter((c) => c.valid && c.payload)
      .map((c) => c.payload!);
  }, [importCandidates]);

  function handleDownloadCsvTemplate() {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "MoneyFlow_Import_Template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      setCsvText(text);
    } catch {
      setImportError("ไม่สามารถอ่านไฟล์ CSV ได้");
    }
  }

  async function handleConfirmImport() {
    if (!onImportTransactions || validImportPayloads.length === 0) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const res = await onImportTransactions(validImportPayloads);
      if (!res.ok) {
        setImportError(res.error ?? "นำเข้ารายการไม่สำเร็จ");
        return;
      }
      onOpenChange(false);
      setCsvText("");
      onImportSuccess(
        `นำเข้าข้อมูลสำเร็จ ${res.data?.importedCount ?? validImportPayloads.length} รายการ`
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setImportError(null);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>นำเข้ารายการจากไฟล์ CSV (Import CSV)</DialogTitle>
          <DialogDescription>
            เลือกไฟล์ `.csv` หรือวางข้อความตารางเพื่อนำเข้ารายรับ-รายจ่ายหลายรายการพร้อมกัน
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {importError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {importError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
            <span className="text-muted-foreground">
              รองรับรูปแบบคอลัมน์มาตรฐานของ MoneyFlow หรือ `วันที่,ประเภท,จำนวนเงิน,กระเป๋า,หมวดหมู่,หมายเหตุ`
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadCsvTemplate}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>ดาวน์โหลดไฟล์ตัวอย่าง .csv</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              เลือกไฟล์ .csv จากเครื่อง
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCsvText(SAMPLE_CSV_TEMPLATE)}
            >
              วางข้อมูลตัวอย่างเพื่อทดสอบ
            </Button>
          </div>

          <div className="space-y-1.5">
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="วันที่,ประเภท,หมวดหมู่,จากกระเป๋า,ไปยังกระเป๋า,รายละเอียด/หมายเหตุ,จำนวนเงิน"
              className="w-full rounded-lg border border-input bg-background p-2.5 font-mono text-base outline-none focus-visible:border-ring lg:text-xs"
            />
          </div>

          {importCandidates.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  ตรวจสอบข้อมูลก่อนนำเข้า ({validImportPayloads.length} /{" "}
                  {importCandidates.length} รายการพร้อมบันทึก)
                </span>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-lg border text-xs">
                <div className="divide-y">
                  {importCandidates.slice(0, 50).map((c) => (
                    <div
                      key={c.rowNumber}
                      className="flex items-center justify-between gap-2 px-3 py-1.5"
                    >
                      <div className="min-w-0 truncate">
                        <span className="text-muted-foreground">
                          #{c.rowNumber}
                        </span>{" "}
                        <span className="font-medium">{c.rawDate}</span> •{" "}
                        <span>{c.rawCategory || c.rawType}</span> (
                        {c.rawWallet})
                      </div>
                      <div className="shrink-0">
                        {c.valid ? (
                          <span className="font-semibold text-emerald-600 tabular-nums">
                            ฿{c.rawAmount}
                          </span>
                        ) : (
                          <span className="text-destructive">{c.error}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isImporting}
            onClick={() => onOpenChange(false)}
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            loading={isImporting}
            loadingText="กำลังนำเข้า..."
            disabled={validImportPayloads.length === 0}
            onClick={handleConfirmImport}
            className="bg-teal-700 text-white hover:bg-teal-800"
          >
            นำเข้า {validImportPayloads.length} รายการ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
