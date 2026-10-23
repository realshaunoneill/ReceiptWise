/**
 * Turn pasted text into plan lines: "Rent 150", "Niamhs wedding 400", "Car: €469.00", or a
 * column copied from Google Sheets or Excel, where the label and amount are separated by a tab.
 * One line each. A line with no amount (the usual items Megan keeps blank until they come up) is
 * returned as a label only, so it can be offered as a quick pick instead of added.
 */

export type ParsedLine = { label: string; amount: string | null };

// An amount at the end of the line: optional currency sign, thousands separators, decimals.
const TRAILING_AMOUNT = /^(.*?)[\s:=\t]+[€£$]?\s*(-?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|-?\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)?$/i;

function normaliseAmount(raw: string): string {
  // "1,500" and "1 500" are thousands; "12,50" (a comma then exactly two digits) is a decimal.
  if (/^-?\d+,\d{1,2}$/.test(raw)) return raw.replace(',', '.');
  return raw.replace(/[,\s]/g, '');
}

export function parseLines(text: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Copied from a spreadsheet: the cells say which part is the label and which the amount, so a
    // label ending in a number ("Until Aug 25" with its amount cell empty) stays a label.
    if (rawLine.includes('\t')) {
      const cells = rawLine.split('\t').map((cell) => cell.trim());
      const labelIndex = cells.findIndex(Boolean);
      const amountCell = cells.slice(labelIndex + 1).reverse().find(Boolean)?.replace(/[€£$]/g, '').trim();
      lines.push({
        label: cells[labelIndex],
        amount: amountCell && /^-?[\d.,\s]+$/.test(amountCell) ? normaliseAmount(amountCell) : null,
      });
      continue;
    }

    const match = TRAILING_AMOUNT.exec(line);
    if (match && match[1].trim()) {
      lines.push({ label: match[1].trim().replace(/[:=-]$/, '').trim(), amount: normaliseAmount(match[2]) });
    } else {
      lines.push({ label: line, amount: null });
    }
  }
  return lines;
}
