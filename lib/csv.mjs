// RFC 4180 CSV reader. Zero dependencies, and deliberately not a one-liner.
//
// A collector response is three boxes of free prose about an industry. Those answers WILL contain
// commas, double quotes, and newlines — a respondent pasting a bulleted list is the normal case,
// not the edge case. `line.split(",")` shreds every one of them, silently, and the damage is only
// visible much later when a triaged candidate reads like nonsense.
//
// The grammar implemented:
//   * fields separated by `,`, records by `\n` or `\r\n`
//   * a field may be wrapped in `"`; inside quotes, `,` `\n` and `\r\n` are literal
//   * `""` inside a quoted field is one literal `"`
//   * a trailing newline does not produce an empty final record
//   * a UTF-8 BOM is stripped (Google Sheets exports one)

/**
 * @param {string} text
 * @returns {string[][]} rows of raw cell strings
 */
export function parseCsv(text) {
  let s = String(text);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = 0;
  let started = false; // did this record have any content at all

  const endField = () => { row.push(field); field = ""; };
  const endRecord = () => { endField(); rows.push(row); row = []; started = false; };

  while (i < s.length) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"' && field === "") { quoted = true; started = true; i++; continue; }
    if (c === ",") { started = true; endField(); i++; continue; }
    if (c === "\r" && s[i + 1] === "\n") { endRecord(); i += 2; continue; }
    if (c === "\n" || c === "\r") { endRecord(); i++; continue; }
    field += c; started = true; i++;
  }
  // A trailing newline must not invent an empty last row.
  if (started || field !== "" || row.length) endRecord();
  return rows;
}

/**
 * Rows as objects keyed by the header row, preserving header order.
 * @returns {{headers: string[], rows: Record<string,string>[]}}
 */
export function parseCsvObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  return {
    headers,
    rows: rows.slice(1)
      // A wholly blank line is padding, not a response.
      .filter((r) => r.some((c) => c.trim() !== ""))
      .map((r) => Object.fromEntries(headers.map((h, n) => [h, r[n] ?? ""]))),
  };
}
