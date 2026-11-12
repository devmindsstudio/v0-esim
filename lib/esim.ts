/**
 * Demo eSIM credential generator (server-side).
 *
 * These are realistic-looking but FAKE — used in Demo Mode so a distributor can
 * complete the whole booking flow and get a QR + eSIM number to show/print.
 * In Real Mode these values will come from the eTijwaal order API instead.
 */
export interface DemoEsim {
  iccid: string
  esimNumber: string
  qrPayload: string
  activationCode: string
}

function randomDigits(n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10)
  return s
}

function randomAlphaNum(n: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I
  let s = ''
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function generateDemoEsim(): DemoEsim {
  // ICCID: telecom SIM identifier, starts with 89, ~19 digits.
  const iccid = '89' + randomDigits(17)
  // A friendly reference number shown to the traveler.
  const esimNumber = `ESIM-${randomDigits(4)}-${randomDigits(4)}`
  // LPA activation string — this is what the QR code encodes.
  const matchingId = randomAlphaNum(16)
  const activationCode = matchingId
  const qrPayload = `LPA:1$demo.rsp.esim.io$${matchingId}`
  return { iccid, esimNumber, qrPayload, activationCode }
}
