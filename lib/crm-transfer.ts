import { RequestLimitError } from "./requests";

// Forty 100-row pages leave room for preflight reads and the final page probe.
export const EXPORT_LIMIT = 4000;
export const RESTORE_BYTES = 1_500_000;
const PAGE_SIZE = 100;

type Cursor = { created_at: string; id: string };

export function likePattern(query: string): string {
  const pattern = "%" + query.replace(/[\\%_]/g, c => "\\" + c) + "%";
  if (new TextEncoder().encode(pattern).length > 50) {
    throw new RequestLimitError(400, "Search is too long. Use a shorter name, company or email.");
  }
  return pattern;
}

export function checkExportCount(count: number) {
  if (count > EXPORT_LIMIT) {
    throw new RequestLimitError(413, "This export exceeds 4,000 enquiries. Filter the CSV, or use an authorized D1 database export for a full backup.");
  }
}

export function pagedExport<T extends Cursor>(
  start: string,
  end: string,
  page: (after: Cursor | null, size: number) => Promise<T[]>,
  format: (rows: T[], first: boolean) => string,
) {
  const encoder = new TextEncoder();
  let cursor: Cursor | null = null;
  let count = 0;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(start));
    },
    async pull(controller) {
      const rows = await page(cursor, PAGE_SIZE);
      checkExportCount(count + rows.length);
      if (rows.length) {
        controller.enqueue(encoder.encode(format(rows, count === 0)));
        cursor = rows[rows.length - 1];
        count += rows.length;
      }
      if (rows.length < PAGE_SIZE) {
        controller.enqueue(encoder.encode(end));
        controller.close();
      }
    },
  });
}
