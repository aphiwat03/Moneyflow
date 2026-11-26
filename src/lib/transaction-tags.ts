export interface TransactionTagDefinition {
  name: string;
  categoryName: string;
  type: "income" | "expense";
  description: string;
}

export interface CategoryDescriptionItem {
  name: string;
  type: "income" | "expense";
  description: string;
}

export const EXPENSE_CATEGORY_DESCRIPTIONS: CategoryDescriptionItem[] = [
  { name: "อาหารและเครื่องดื่ม", type: "expense", description: "ค่าอาหาร มื้อหลัก กาแฟ ขนม ซูเปอร์มาร์เก็ต" },
  { name: "เดินทาง", type: "expense", description: "รถไฟฟ้า รถเมล์ แท็กซี่ น้ำมัน ค่าจอดรถ ซ่อมบำรุงรถ" },
  { name: "ที่พักและค่าน้ำไฟ", type: "expense", description: "ค่าเช่าบ้าน ค่าน้ำ ค่าไฟ ค่าเน็ต ของใช้ในบ้าน ซ่อมแซม" },
  { name: "ช้อปปิ้ง", type: "expense", description: "ซื้อของทั่วไป สั่งของออนไลน์ ช้อปปิ้งต่างๆ" },
  { name: "สุขภาพ", type: "expense", description: "พบแพทย์ ทำฟัน ค่ายา วิตามินและอาหารเสริม" },
  { name: "ดูแลตัวเอง", type: "expense", description: "ตัดผม เครื่องสำอาง สกินแคร์ ของใช้ส่วนตัว" },
  { name: "ออกกำลังกายและกีฬา", type: "expense", description: "ค่าฟิตเนส ยิม สนามกีฬา อุปกรณ์ออกกำลังกาย" },
  { name: "เสื้อผ้าและรองเท้า", type: "expense", description: "เสื้อผ้า รองเท้า กระเป๋า และเครื่องประดับ" },
  { name: "การศึกษา", type: "expense", description: "ค่าคอร์สเรียน หนังสือ และอุปกรณ์การเรียน" },
  { name: "บันเทิง", type: "expense", description: "ดูหนัง เกม สตรีมมิ่ง งานอดิเรก สังสรรค์" },
  { name: "ครอบครัว", type: "expense", description: "ค่าใช้จ่ายในครอบครัว และเงินส่งให้ที่บ้าน" },
  { name: "ของขวัญ", type: "expense", description: "ของขวัญวันเกิด เทศกาล และโอกาสพิเศษ" },
  { name: "ทำบุญและบริจาค", type: "expense", description: "ทำบุญ กุศล และบริจาคเพื่อสังคม" },
  { name: "ประกัน", type: "expense", description: "เบี้ยประกันชีวิต ประกันสุขภาพ ประกันรถ" },
  { name: "ผ่อนชำระและหนี้สิน", type: "expense", description: "ค่างวดผ่อนของ ผ่อนบ้าน ผ่อนรถ ชำระหนี้" },
  { name: "ท่องเที่ยว", type: "expense", description: "ค่าที่พักโรงแรม ตั๋วเดินทาง และกิจกรรมทริป" },
  { name: "รายจ่ายอื่นๆ", type: "expense", description: "รายจ่ายเบ็ดเตล็ดอื่นๆ ที่ไม่เข้าหมวดข้างต้น" },
];

export const INCOME_CATEGORY_DESCRIPTIONS: CategoryDescriptionItem[] = [
  { name: "เงินเดือน", type: "income", description: "เงินเดือนประจำ และโบนัสจากงานหลัก" },
  { name: "รายได้เสริม / ฟรีแลนซ์", type: "income", description: "งานพิเศษ พาร์ทไทม์ ฟรีแลนซ์ ขายของ" },
  { name: "กองทุนสำรองเลี้ยงชีพ", type: "income", description: "เงินสมทบหรือผลประโยชน์จากกองทุนสำรองเลี้ยงชีพ" },
  { name: "ดอกเบี้ย / เงินปันผล", type: "income", description: "ดอกเบี้ยธนาคาร แคชแบ็ก และเงินปันผล" },
  { name: "เงินคืน / เบิกคืน", type: "income", description: "เงินคืนสินค้า เบิกค่าใช้จ่าย หรือเพื่อนโอนคืน" },
  { name: "รายรับอื่นๆ", type: "income", description: "รายรับอื่นๆ ที่ไม่เข้าหมวดข้างต้น" },
];

export const TRANSACTION_TAGS: TransactionTagDefinition[] = [
  // อาหารและเครื่องดื่ม
  { name: "ร้านอาหาร", categoryName: "อาหารและเครื่องดื่ม", type: "expense", description: "รับประทานที่ร้านอาหารหรือบุฟเฟต์" },
  { name: "อาหารข้างทาง", categoryName: "อาหารและเครื่องดื่ม", type: "expense", description: "อาหารตามสั่ง ข้าวแกง สตรีทฟู้ด" },
  { name: "เดลิเวอรี่", categoryName: "อาหารและเครื่องดื่ม", type: "expense", description: "สั่งอาหารเดลิเวอรี่ผ่านแอป" },
  { name: "ร้านกาแฟ", categoryName: "อาหารและเครื่องดื่ม", type: "expense", description: "กาแฟ ชา เครื่องดื่ม คาเฟ่" },
  { name: "ขนมและของว่าง", categoryName: "อาหารและเครื่องดื่ม", type: "expense", description: "ขนม เบเกอรี่ ของทานเล่น" },
  { name: "ซูเปอร์มาร์เก็ต", categoryName: "อาหารและเครื่องดื่ม", type: "expense", description: "วัตถุดิบทำอาหารและของกินจากซูเปอร์ฯ" },

  // เดินทาง
  { name: "รถสาธารณะ / รถไฟฟ้า", categoryName: "เดินทาง", type: "expense", description: "BTS, MRT, รถเมล์, เรือโดยสาร" },
  { name: "เรียกรถ / แท็กซี่", categoryName: "เดินทาง", type: "expense", description: "แท็กซี่ วินมอเตอร์ไซค์ แอปเรียกรถ" },
  { name: "ค่าน้ำมัน", categoryName: "เดินทาง", type: "expense", description: "เติมน้ำมันหรือชาร์จไฟ EV" },
  { name: "ค่าจอดรถ", categoryName: "เดินทาง", type: "expense", description: "ค่าที่จอดรถและค่าทางด่วน" },
  { name: "ซ่อมบำรุงรถ", categoryName: "เดินทาง", type: "expense", description: "เช็คระยะ เปลี่ยนยาง ล้างรถ ซ่อมรถ" },

  // ที่พักและค่าน้ำไฟ
  { name: "ค่าไฟฟ้า", categoryName: "ที่พักและค่าน้ำไฟ", type: "expense", description: "บิลค่าไฟฟ้ารายเดือน" },
  { name: "ค่าน้ำประปา", categoryName: "ที่พักและค่าน้ำไฟ", type: "expense", description: "บิลค่าน้ำประปารายเดือน" },
  { name: "ค่าอินเทอร์เน็ต", categoryName: "ที่พักและค่าน้ำไฟ", type: "expense", description: "ค่าเน็ตบ้านและแพ็กเกจมือถือ" },
  { name: "ของใช้ในบ้าน", categoryName: "ที่พักและค่าน้ำไฟ", type: "expense", description: "น้ำยาซักผ้า กระดาษทิชชู่ ของใช้ประจำบ้าน" },
  { name: "เฟอร์นิเจอร์", categoryName: "ที่พักและค่าน้ำไฟ", type: "expense", description: "ของแต่งบ้านและเฟอร์นิเจอร์" },
  { name: "ค่าซ่อมแซม", categoryName: "ที่พักและค่าน้ำไฟ", type: "expense", description: "ซ่อมบำรุงบ้านและเครื่องใช้ไฟฟ้า" },

  // สุขภาพ
  { name: "พบแพทย์", categoryName: "สุขภาพ", type: "expense", description: "ค่ารักษาพยาบาล คลินิก ตรวจสุขภาพ" },
  { name: "ทำฟัน", categoryName: "สุขภาพ", type: "expense", description: "ขูดหินปูน อุดฟัน จัดฟัน ทันตกรรม" },
  { name: "ค่ายา", categoryName: "สุขภาพ", type: "expense", description: "ยารักษาโรค เวชภัณฑ์จากร้านยา" },
  { name: "อาหารเสริม", categoryName: "สุขภาพ", type: "expense", description: "วิตามิน โปรตีน และอาหารเสริม" },

  // ดูแลตัวเอง
  { name: "ตัดผม", categoryName: "ดูแลตัวเอง", type: "expense", description: "ตัดผม ทำผม ร้านเสริมสวย" },
  { name: "เครื่องสำอาง / สกินแคร์", categoryName: "ดูแลตัวเอง", type: "expense", description: "ผลิตภัณฑ์บำรุงผิวและเครื่องสำอาง" },
  { name: "ของใช้ส่วนตัว", categoryName: "ดูแลตัวเอง", type: "expense", description: "สบู่ ยาสีฟัน ของใช้ส่วนตัวทั่วไป" },

  // ออกกำลังกายและกีฬา
  { name: "ค่าฟิตเนส / ยิม", categoryName: "ออกกำลังกายและกีฬา", type: "expense", description: "สมาชิกฟิตเนส คลาสออกกำลังกาย" },
  { name: "อุปกรณ์กีฬา", categoryName: "ออกกำลังกายและกีฬา", type: "expense", description: "ชุดกีฬา รองเท้าวิ่ง และอุปกรณ์กีฬา" },

  // เสื้อผ้าและรองเท้า
  { name: "เสื้อผ้า", categoryName: "เสื้อผ้าและรองเท้า", type: "expense", description: "เสื้อ กางเกง ชุดทำงาน ชุดลำลอง" },
  { name: "รองเท้า", categoryName: "เสื้อผ้าและรองเท้า", type: "expense", description: "รองเท้าผ้าใบ รองเท้าทำงาน" },
  { name: "เครื่องประดับ / กระเป๋า", categoryName: "เสื้อผ้าและรองเท้า", type: "expense", description: "กระเป๋า นาฬิกา แว่นตา เครื่องประดับ" },

  // การศึกษา
  { name: "ค่าคอร์ส / ค่าเรียน", categoryName: "การศึกษา", type: "expense", description: "คอร์สออนไลน์ เวิร์กชอป ค่าเล่าเรียน" },
  { name: "หนังสือ", categoryName: "การศึกษา", type: "expense", description: "หนังสือ E-book นิตยสาร" },
  { name: "อุปกรณ์การเรียน", categoryName: "การศึกษา", type: "expense", description: "เครื่องเขียน สมุด อุปกรณ์เสริมการเรียน" },

  // บันเทิง
  { name: "ดูหนัง", categoryName: "บันเทิง", type: "expense", description: "ตั๋วภาพยนตร์ ป๊อปคอร์น คอนเสิร์ต" },
  { name: "เกม", categoryName: "บันเทิง", type: "expense", description: "ซื้อเกม เติมเกม อุปกรณ์เกม" },
  { name: "สตรีมมิ่ง / Subscription", categoryName: "บันเทิง", type: "expense", description: "Netflix, Spotify, YouTube, AI รายเดือน" },
  { name: "งานอดิเรก", categoryName: "บันเทิง", type: "expense", description: "ของสะสม กิจกรรมยามว่าง" },
  { name: "สังสรรค์ / ฉลอง", categoryName: "บันเทิง", type: "expense", description: "ปาร์ตี้ เลี้ยงฉลอง นัดพบเพื่อน" },

  // ครอบครัว / ของขวัญ / ทำบุญ
  { name: "ค่าใช้จ่ายครอบครัว", categoryName: "ครอบครัว", type: "expense", description: "ค่าอาหารหรือค่าใช้จ่ายส่วนรวมในบ้าน" },
  { name: "ส่งให้ครอบครัว", categoryName: "ครอบครัว", type: "expense", description: "โอนเงินให้พ่อแม่หรือคนในครอบครัว" },
  { name: "ซื้อของขวัญ", categoryName: "ของขวัญ", type: "expense", description: "ของขวัญให้แฟน เพื่อน หรือครอบครัว" },
  { name: "ทำบุญ / บริจาค", categoryName: "ทำบุญและบริจาค", type: "expense", description: "ทำบุญตักบาตร บริจาคการกุศล" },

  // ประกัน / หนี้สิน / ท่องเที่ยว / อื่นๆ
  { name: "ค่าเบี้ยประกัน", categoryName: "ประกัน", type: "expense", description: "จ่ายเบี้ยประกันรายเดือน/รายปี" },
  { name: "ค่างวด / ผ่อนชำระ", categoryName: "ผ่อนชำระและหนี้สิน", type: "expense", description: "ผ่อนบัตรเครดิต ผ่อนสินค้า SPayLater" },
  { name: "ค่าที่พัก / โรงแรม", categoryName: "ท่องเที่ยว", type: "expense", description: "โรงแรม รีสอร์ต ที่พักทริป" },
  { name: "ค่าตั๋วเดินทาง", categoryName: "ท่องเที่ยว", type: "expense", description: "ตั๋วเครื่องบิน รถไฟ รถทัวร์ต่างจังหวัด" },
  { name: "กิจกรรมท่องเที่ยว", categoryName: "ท่องเที่ยว", type: "expense", description: "บัตรเข้าชม ทัวร์ ของฝากทริป" },
  { name: "เบ็ดเตล็ด", categoryName: "รายจ่ายอื่นๆ", type: "expense", description: "รายจ่ายทั่วไปอื่นๆ" },

  // รายรับ
  { name: "เงินเดือนประจำ", categoryName: "เงินเดือน", type: "income", description: "เงินเดือนประจำรายเดือน" },
  { name: "กองทุนสำรองเลี้ยงชีพ", categoryName: "กองทุนสำรองเลี้ยงชีพ", type: "income", description: "เงินกองทุนสำรองเลี้ยงชีพ" },
  { name: "ดอกเบี้ย", categoryName: "ดอกเบี้ย / เงินปันผล", type: "income", description: "ดอกเบี้ยเงินฝากและเงินปันผล" },
  { name: "แคชแบ็ก / เงินคืนบัตร", categoryName: "ดอกเบี้ย / เงินปันผล", type: "income", description: "เงินคืนจากบัตรเครดิต/แอปจ่ายเงิน" },
  { name: "เบิกคืน / โอนคืน", categoryName: "เงินคืน / เบิกคืน", type: "income", description: "เงินที่เพื่อนโอนคืนหรือเบิกคืนบริษัท" },
  { name: "รายรับอื่นๆ", categoryName: "รายรับอื่นๆ", type: "income", description: "รายรับพิเศษหรือรายรับอื่นๆ" },
];

export const RECIPIENT_BANK_OPTIONS = [
  { value: "", label: "ไม่ระบุธนาคาร" },
  { value: "กสิกรไทย (K PLUS)", label: "กสิกรไทย (K PLUS)", dotColor: "#138f2d" },
  { value: "ไทยพาณิชย์ (SCB)", label: "ไทยพาณิชย์ (SCB)", dotColor: "#4e2a84" },
  { value: "กรุงไทย (Krungthai NEXT)", label: "กรุงไทย (Krungthai NEXT)", dotColor: "#00a5e3" },
  { value: "กรุงเทพ (Bualuang)", label: "กรุงเทพ (Bualuang)", dotColor: "#1e4598" },
  { value: "กรุงศรี (KMA)", label: "กรุงศรี (KMA)", dotColor: "#fec43b" },
  { value: "ทีทีบี (ttb)", label: "ทีทีบี (ttb)", dotColor: "#0050f0" },
  { value: "ออมสิน (MyMo)", label: "ออมสิน (MyMo)", dotColor: "#eb198d" },
  { value: "พร้อมเพย์ (PromptPay)", label: "พร้อมเพย์ (PromptPay)", dotColor: "#0f766e" },
  { value: "TrueMoney Wallet", label: "TrueMoney Wallet", dotColor: "#f97316" },
  { value: "ShopeePay", label: "ShopeePay", dotColor: "#ee4d2d" },
  { value: "ธนาคารอื่น", label: "ธนาคารอื่น", dotColor: "#64748b" },
];

const SHOPPING_EXTRA_TAGS = new Set([
  "เสื้อผ้า",
  "รองเท้า",
  "เครื่องประดับ / กระเป๋า",
  "เครื่องสำอาง / สกินแคร์",
  "ของใช้ในบ้าน",
  "ของใช้ส่วนตัว",
]);

/**
 * Returns tags sorted so tags matching the selected category appear first,
 * followed by all other tags for the given transaction type.
 */
export function getTagOptionsForCategory(params: {
  type: "income" | "expense";
  categoryName?: string | null;
  categoryColor?: string | null;
  currentTag?: string | null;
}): Array<{
  value: string;
  label: string;
  dotColor?: string | null;
  badge?: string | null;
}> {
  const { type, categoryName, categoryColor, currentTag } = params;
  const typedTags = TRANSACTION_TAGS.filter((t) => t.type === type);

  const recommended: TransactionTagDefinition[] = [];
  const others: TransactionTagDefinition[] = [];

  for (const tag of typedTags) {
    const isDirectMatch = categoryName && tag.categoryName === categoryName;
    const isShoppingMatch =
      categoryName === "ช้อปปิ้ง" && SHOPPING_EXTRA_TAGS.has(tag.name);

    if (isDirectMatch || isShoppingMatch) {
      recommended.push(tag);
    } else {
      others.push(tag);
    }
  }

  const options: Array<{
    value: string;
    label: string;
    dotColor?: string | null;
    badge?: string | null;
  }> = [{ value: "", label: "ไม่ระบุแท็ก" }];

  const seen = new Set<string>();

  for (const tag of recommended) {
    seen.add(tag.name);
    options.push({
      value: tag.name,
      label: tag.name,
      dotColor: categoryColor ?? "#0f766e",
      badge: "แนะนำ",
    });
  }

  for (const tag of others) {
    if (seen.has(tag.name)) continue;
    seen.add(tag.name);
    options.push({
      value: tag.name,
      label: tag.name,
      dotColor: "#94a3b8",
      badge: tag.categoryName,
    });
  }

  const trimmedCurrent = currentTag?.trim();
  if (trimmedCurrent && !seen.has(trimmedCurrent)) {
    options.splice(1, 0, {
      value: trimmedCurrent,
      label: trimmedCurrent,
      dotColor: "#64748b",
      badge: "กำหนดเอง",
    });
  }

  return options;
}
