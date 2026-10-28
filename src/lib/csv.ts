function escapeCsv(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Scarica un CSV pronto per Excel in italiano: separatore ";" e BOM UTF-8
 * (così accenti e colonne si aprono correttamente con un doppio clic).
 */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const content = [headers, ...rows].map((r) => r.map(escapeCsv).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
