import Link from "next/link";
import { ArrowRight, Database as DatabaseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DatabaseConnectionWarning() {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
          <DatabaseIcon className="h-4 w-4" />
          ยังไม่สามารถเชื่อมต่อฐานข้อมูล PostgreSQL ได้
        </CardTitle>
        <CardDescription>
          กรุณาตรวจสอบค่า DATABASE_URL ในไฟล์ .env.local และรันคำสั่ง npm run
          db:migrate หรือใช้งานโหมด UI ทันทีโดยบันทึกข้อมูลไว้ในเบราว์เซอร์ชั่วคราว
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/demo">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-9 max-w-full gap-1.5 border-teal-600/40 py-2 text-left whitespace-normal text-teal-700 hover:bg-teal-600/10 dark:text-teal-300"
          >
            <span>เปิดใช้งานโหมด UI ทันที (ไม่ต้องต่อ Database)</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
