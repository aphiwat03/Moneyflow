"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle>เกิดข้อผิดพลาดในการโหลดข้อมูล</CardTitle>
          <CardDescription>
            ระบบไม่สามารถดำเนินการตามคำขอได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            <span>ลองใหม่อีกครั้ง</span>
          </Button>
          <Link href="/">
            <Button type="button" variant="outline" className="gap-1.5">
              <Home className="h-4 w-4" />
              <span>กลับหน้าหลัก</span>
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
