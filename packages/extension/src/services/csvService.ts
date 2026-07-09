import Papa from 'papaparse';

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
}

function normalize(result: Papa.ParseResult<Record<string, unknown>>): ParsedTable {
  const headers = (result.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);
  const rows: Record<string, string>[] = [];
  for (const raw of result.data) {
    const row: Record<string, string> = {};
    let hasAny = false;
    for (const h of headers) {
      const v = raw[h];
      const s = v == null ? '' : String(v).trim();
      row[h] = s;
      if (s) hasAny = true;
    }
    if (hasAny) rows.push(row); // drop fully-empty rows
  }
  return { headers, rows };
}

/** Parse an uploaded CSV file. Handles quoting, embedded commas, and encoding. */
export function parseCsvFile(file: File): Promise<ParsedTable> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (res) => resolve(normalize(res)),
      error: (err: Error) => reject(err),
    });
  });
}

/** Parse text pasted from a spreadsheet (tab- or comma-delimited, auto-detected). */
export function parsePastedText(text: string): ParsedTable {
  const res = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  return normalize(res);
}
