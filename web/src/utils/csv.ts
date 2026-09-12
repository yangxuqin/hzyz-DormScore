// CSV 工具：RFC 4180 转义 + UTF-8 BOM（Excel 直接打开不乱码）
export type CsvCell = string | number | null | undefined;

/** 以 = + @ 开头、制表符开头，或 - 紧跟数字的文本会被表格软件当作公式，前置单引号中和 */
function neutralizeFormula(text: string): string {
  return /^[=+@\t\r]|^-\d/.test(text) ? `'${text}` : text;
}

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const text = neutralizeFormula(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 二维单元格 → CSV 文本（CRLF 换行，兼容 Excel） */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** 生成并下载 CSV 文件（带 BOM，确保中文在 Excel 中正常显示） */
export function downloadCsv(filename: string, rows: CsvCell[][]): void {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
