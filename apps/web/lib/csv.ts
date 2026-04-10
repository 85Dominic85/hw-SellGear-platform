/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Escape a value for CSV: wrap in quotes if it contains commas, quotes, or newlines.
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Generate a CSV string from an array of objects using column definitions.
 */
export function buildCSV<T>(
  data: T[],
  columns: { key: keyof T; header: string; transform?: (val: T[keyof T], row: T) => string }[]
): string {
  const header = columns.map((c) => c.header).join(',')
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const raw = row[col.key]
        const value = col.transform ? col.transform(raw, row) : String(raw ?? '')
        return escapeCSV(value)
      })
      .join(',')
  )
  return [header, ...rows].join('\n')
}
