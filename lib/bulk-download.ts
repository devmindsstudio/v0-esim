import JSZip from 'jszip'
import QRCode from 'qrcode'

export interface BulkEsimRow {
  esimNumber: string
  iccid: string
  activationCode: string
  qrPayload: string
}

function csvCell(v: string): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

/**
 * Builds a ZIP in the browser — one QR PNG per eSIM under /qr-codes plus an
 * esims.csv listing every eSIM's details — then triggers a download. Runs
 * entirely client-side, so there's no server round-trip for the batch.
 */
export async function downloadEsimBatch(
  rows: BulkEsimRow[],
  opts: { packageTitle: string; customerName: string },
): Promise<void> {
  const zip = new JSZip()
  const qrFolder = zip.folder('qr-codes')

  const lines = ['#,eSIM number,ICCID,Activation code,QR payload']
  const pad = String(rows.length).length

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const n = String(i + 1).padStart(pad, '0')
    const dataUrl = await QRCode.toDataURL(r.qrPayload, { width: 400, margin: 2 })
    const base64 = dataUrl.split(',')[1] ?? ''
    qrFolder?.file(`esim-${n}.png`, base64, { base64: true })
    lines.push(
      [n, r.esimNumber, r.iccid, r.activationCode, r.qrPayload].map((v) => csvCell(String(v))).join(','),
    )
  }

  zip.file('esims.csv', lines.join('\n'))

  const blob = await zip.generateAsync({ type: 'blob' })
  const name = `esims-${slug(opts.customerName) || 'batch'}-${slug(opts.packageTitle) || 'esim'}.zip`
  triggerDownload(blob, name)
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
