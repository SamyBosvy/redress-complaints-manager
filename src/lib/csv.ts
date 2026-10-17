/** RFC 4180 CSV. Prefixes cells starting with = + - @ to prevent spreadsheet formula injection. */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) =>
      r
        .map((v) => {
          let s = v === null || v === undefined ? "" : String(v);
          if (/^[=+\-@]/.test(s)) s = "'" + s;
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

export function downloadFile(name: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["\ufeff" + content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
