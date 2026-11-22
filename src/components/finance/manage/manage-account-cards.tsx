"use client";

import { useState } from "react";
import { KeyRound, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/types";
import type { ManageNotice } from "./manage-wallets-section";

interface ManageAccountCardsProps {
  userProfile: {
    name: string | null;
    email: string;
  };
  onUpdateProfile?: (input: {
    name: string;
  }) => Promise<ActionResult<{ name: string }>>;
  onChangePassword?: (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<ActionResult<unknown>>;
  onNotify: (notice: ManageNotice | null) => void;
}

export function ManageAccountCards({
  userProfile,
  onUpdateProfile,
  onChangePassword,
  onNotify,
}: ManageAccountCardsProps) {
  const [profileName, setProfileName] = useState(userProfile.name ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onUpdateProfile) return;
    setProfileSaving(true);
    onNotify(null);
    try {
      const res = await onUpdateProfile({ name: profileName });
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        onNotify({
          type: "error",
          message: firstErr ?? res.error ?? "อัปเดตชื่อโปรไฟล์ไม่สำเร็จ",
        });
      } else {
        onNotify({
          type: "success",
          message: "อัปเดตชื่อโปรไฟล์เรียบร้อยแล้ว",
        });
      }
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onChangePassword) return;
    setPasswordSaving(true);
    onNotify(null);
    try {
      const res = await onChangePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        onNotify({
          type: "error",
          message: firstErr ?? res.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ",
        });
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onNotify({
          type: "success",
          message:
            "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว ระบบกำลังพาไปหน้าเข้าสู่ระบบใหม่เพื่อความปลอดภัย",
        });
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {onUpdateProfile ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-teal-600" />
              <span>ข้อมูลบัญชีผู้ใช้</span>
            </CardTitle>
            <CardDescription>
              แก้ไขชื่อที่แสดงบน Dashboard และเมนูผู้ใช้งาน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">อีเมล</Label>
                <Input
                  id="profile-email"
                  value={userProfile.email}
                  disabled
                  className="opacity-70"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">ชื่อที่แสดง</Label>
                <Input
                  id="profile-name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="ชื่อของคุณ"
                  required
                />
              </div>
              <Button
                type="submit"
                size="sm"
                loading={profileSaving}
                loadingText="กำลังบันทึก..."
              >
                บันทึกชื่อโปรไฟล์
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {onChangePassword ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-teal-600" />
              <span>เปลี่ยนรหัสผ่าน</span>
            </CardTitle>
            <CardDescription>
              กำหนดรหัสผ่านใหม่สำหรับเข้าสู่ระบบด้วยอีเมล
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">รหัสผ่านปัจจุบัน</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                size="sm"
                loading={passwordSaving}
                loadingText="กำลังบันทึก..."
              >
                เปลี่ยนรหัสผ่าน
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
