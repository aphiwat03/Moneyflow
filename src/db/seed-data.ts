export interface DefaultWalletTemplate {
  name: string;
  type: "cash" | "bank" | "credit_card" | "ewallet";
  initialBalance: string;
  color: string;
  icon: string;
}

export interface DefaultCategoryTemplate {
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
  isDefault: true;
}

export const DEFAULT_WALLETS: DefaultWalletTemplate[] = [
  {
    name: "เงินสด",
    type: "cash",
    initialBalance: "0.00",
    color: "#10b981",
    icon: "Banknote",
  },
  {
    name: "บัญชีธนาคารหลัก",
    type: "bank",
    initialBalance: "0.00",
    color: "#3b82f6",
    icon: "Landmark",
  },
];

export const DEFAULT_CATEGORIES: DefaultCategoryTemplate[] = [
  // Expense categories (expanded Thai standard set)
  {
    name: "อาหารและเครื่องดื่ม",
    type: "expense",
    color: "#f97316",
    icon: "Utensils",
    isDefault: true,
  },
  {
    name: "เดินทาง",
    type: "expense",
    color: "#0ea5e9",
    icon: "Car",
    isDefault: true,
  },
  {
    name: "ที่พักและค่าน้ำไฟ",
    type: "expense",
    color: "#8b5cf6",
    icon: "Home",
    isDefault: true,
  },
  {
    name: "ช้อปปิ้ง",
    type: "expense",
    color: "#ec4899",
    icon: "ShoppingBag",
    isDefault: true,
  },
  {
    name: "สุขภาพ",
    type: "expense",
    color: "#ef4444",
    icon: "HeartPulse",
    isDefault: true,
  },
  {
    name: "ดูแลตัวเอง",
    type: "expense",
    color: "#f472b6",
    icon: "Sparkles",
    isDefault: true,
  },
  {
    name: "ออกกำลังกายและกีฬา",
    type: "expense",
    color: "#10b981",
    icon: "Dumbbell",
    isDefault: true,
  },
  {
    name: "เสื้อผ้าและรองเท้า",
    type: "expense",
    color: "#d946ef",
    icon: "Shirt",
    isDefault: true,
  },
  {
    name: "การศึกษา",
    type: "expense",
    color: "#6366f1",
    icon: "GraduationCap",
    isDefault: true,
  },
  {
    name: "บันเทิง",
    type: "expense",
    color: "#eab308",
    icon: "Gamepad2",
    isDefault: true,
  },
  {
    name: "ครอบครัว",
    type: "expense",
    color: "#fb7185",
    icon: "Users",
    isDefault: true,
  },
  {
    name: "ของขวัญ",
    type: "expense",
    color: "#f43f5e",
    icon: "Gift",
    isDefault: true,
  },
  {
    name: "ทำบุญและบริจาค",
    type: "expense",
    color: "#f59e0b",
    icon: "HeartHandshake",
    isDefault: true,
  },
  {
    name: "ประกัน",
    type: "expense",
    color: "#0284c7",
    icon: "ShieldCheck",
    isDefault: true,
  },
  {
    name: "ผ่อนชำระและหนี้สิน",
    type: "expense",
    color: "#dc2626",
    icon: "CreditCard",
    isDefault: true,
  },
  {
    name: "ท่องเที่ยว",
    type: "expense",
    color: "#14b8a6",
    icon: "Plane",
    isDefault: true,
  },
  {
    name: "รายจ่ายอื่นๆ",
    type: "expense",
    color: "#64748b",
    icon: "CircleEllipsis",
    isDefault: true,
  },

  // Income categories
  {
    name: "เงินเดือน",
    type: "income",
    color: "#22c55e",
    icon: "Briefcase",
    isDefault: true,
  },
  {
    name: "รายได้เสริม / ฟรีแลนซ์",
    type: "income",
    color: "#14b8a6",
    icon: "Laptop",
    isDefault: true,
  },
  {
    name: "กองทุนสำรองเลี้ยงชีพ",
    type: "income",
    color: "#059669",
    icon: "Landmark",
    isDefault: true,
  },
  {
    name: "ดอกเบี้ย / เงินปันผล",
    type: "income",
    color: "#06b6d4",
    icon: "TrendingUp",
    isDefault: true,
  },
  {
    name: "เงินคืน / เบิกคืน",
    type: "income",
    color: "#0ea5e9",
    icon: "RotateCcw",
    isDefault: true,
  },
  {
    name: "รายรับอื่นๆ",
    type: "income",
    color: "#64748b",
    icon: "PlusCircle",
    isDefault: true,
  },
];
