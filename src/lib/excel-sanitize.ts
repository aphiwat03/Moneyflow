const FORMULA_TRIGGER_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Prevents spreadsheet formula injection when exporting user-entered strings to Excel/CSV.
 * Prefixes values starting with formula trigger characters with a single quote.
 */
export function sanitizeExcelCellText(value: string | null | undefined): string {
  if (!value) return "";
  const firstChar = value.charAt(0);
  if (FORMULA_TRIGGER_PREFIXES.includes(firstChar)) {
    return `'${value}`;
  }
  return value;
}
