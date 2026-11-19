import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileQuestion className="h-6 w-6" />
          </div>
          <CardTitle>ไม่พบหน้าที่คุณต้องการ (404)</CardTitle>
          <CardDescription>
            ลิงก์ที่คุณเข้าถึงอาจถูกย้ายหรือไม่มีอยู่ในระบบ MoneyFlow
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Link href="/">
            <Button className="gap-1.5 bg-teal-700 text-white hover:bg-teal-800">
              <Home className="h-4 w-4" />
              <span>กลับสู่หน้าภาพรวม</span>
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
