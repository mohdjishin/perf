/**
 * Generates a PDF invoice for a delivered order using jsPDF.
 * Uses website logo and company info from Super Admin config (or defaults).
 */
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'

const LOGO_URL = '/images/logo.png'
const DEFAULT_COMPANY_NAME = 'Blue Mist Perfumes'

function loadImageAsDataUrl(url) {
  return fetch(url)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
    )
}

/**
 * Load image from URL, return { dataUrl, width, height } so PDF can preserve aspect ratio.
 */
function loadImageWithDimensions(url) {
  return loadImageAsDataUrl(url).then((dataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = reject
      img.src = dataUrl
    })
  })
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function formatMoney(amount) {
  return typeof amount === 'number' ? `AED ${amount.toFixed(2)}` : '—'
}

/**
 * Generate and download a PDF invoice for an order (for delivered orders).
 * @param {Object} order - Order object with orderNumber, createdAt, items, total, address
 * @param {Object} [invoice] - Optional company/invoice config from Super Admin (companyName, street, city, state, zip, country, phone, email)
 * @returns {Promise<void>}
 */
export async function downloadOrderInvoice(order, invoice = {}) {
  const companyName = (invoice.companyName || '').trim() || DEFAULT_COMPANY_NAME
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 18

  // Logo (top-left): preserve aspect ratio, max 24mm height or 40mm width
  const logoMaxHeightMm = 24
  const logoMaxWidthMm = 40
  const logoX = 14
  const logoY = 10
  try {
    const { dataUrl, width: imgW, height: imgH } = await loadImageWithDimensions(LOGO_URL)
    const aspectRatio = imgW / imgH
    const widthMm = Math.min(logoMaxWidthMm, logoMaxHeightMm * aspectRatio)
    const heightMm = widthMm / aspectRatio
    doc.addImage(dataUrl, 'PNG', logoX, logoY, widthMm, heightMm)
  } catch (_) {
    // No logo: leave space or skip
  }

  // Company name and title (top-right area)
  doc.setFontSize(20)
  doc.setFont(undefined, 'bold')
  doc.text(companyName, pageW - 14, 22, { align: 'right' })
  doc.setFontSize(12)
  doc.setFont(undefined, 'normal')
  doc.text('INVOICE', pageW - 14, 30, { align: 'right' })

  // Company address / contact (right side, below INVOICE) if configured
  const addrLines = [invoice.street, [invoice.city, invoice.state, invoice.zip].filter(Boolean).join(' '), invoice.country].filter(Boolean)
  if (addrLines.length > 0 || invoice.phone || invoice.email || invoice.trn) {
    y = 38
    doc.setFontSize(9)
    addrLines.forEach((line) => {
      doc.text(line, pageW - 14, y, { align: 'right' })
      y += 4
    })
    if (invoice.trn) {
      y += 2
      doc.setFont(undefined, 'bold')
      doc.text(`TRN: ${invoice.trn}`, pageW - 14, y, { align: 'right' })
      doc.setFont(undefined, 'normal')
      y += 5
    }
    if (invoice.phone) {
      y += 2
      doc.text(invoice.phone, pageW - 14, y, { align: 'right' })
      y += 4
    }
    if (invoice.email) {
      doc.text(invoice.email, pageW - 14, y, { align: 'right' })
      y += 6
    }
  }

  y = Math.max(y, 52)

  // Order info
  doc.setFontSize(10)
  doc.text(`Order: ${order.orderNumber || '—'}`, 14, y)
  y += 6
  doc.text(`Date: ${formatDate(order.createdAt)}`, 14, y)
  y += 6
  doc.text(`Status: Delivered`, 14, y)
  y += 12

  // Shipping address
  const addr = order.address && typeof order.address === 'object' ? order.address : null
  if (addr) {
    doc.setFont(undefined, 'bold')
    doc.text('Ship to:', 14, y)
    doc.setFont(undefined, 'normal')
    y += 6
    const lines = [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean)
    lines.forEach((line) => {
      doc.text(line, 14, y)
      y += 5
    })
    y += 8
  }

  // Items table: professional layout with clear borders and spacing
  const items = Array.isArray(order.items) ? order.items : []
  const tableData = items.map((item) => [
    (item && item.name) || '—',
    String(item && item.quantity != null ? item.quantity : 0),
    formatMoney(item && item.price != null ? item.price : 0),
    formatMoney(Number(item?.price ?? 0) * Number(item?.quantity ?? 0)),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit Price (AED)', 'Amount (AED)']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    bodyStyles: { fontSize: 9, cellPadding: 4 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 14 },
    tableWidth: pageW - 28,
  })

  y = doc.lastAutoTable.finalY + 14

  // Payment summary: clearly segregated block (subtotal → fees → total)
  const subtotal =
    typeof order.subtotal === 'number'
      ? order.subtotal
      : items.reduce((sum, it) => sum + Number(it?.price ?? 0) * Number(it?.quantity ?? 0), 0)
  const breakdown = Array.isArray(order.feeBreakdown) ? order.feeBreakdown : []
  const showBreakdown = breakdown.length > 0 || (typeof order.subtotal === 'number' && order.total !== subtotal)

  const summaryX = pageW - 14
  const summaryLabelX = pageW - 70
  doc.setFontSize(9)
  doc.setTextColor(75, 85, 99)

  doc.setFont(undefined, 'normal')
  doc.text('Subtotal', summaryLabelX, y)
  doc.text(formatMoney(subtotal), summaryX, y, { align: 'right' })
  y += 6

  if (showBreakdown && breakdown.length > 0) {
    breakdown.forEach((line) => {
      const label = (line && line.label) || 'Fee'
      const amt = Number(line?.amount) ?? 0
      const text = amt >= 0 ? formatMoney(amt) : `-${formatMoney(-amt)}`
      doc.text(label, summaryLabelX, y)
      doc.text(text, summaryX, y, { align: 'right' })
      y += 5
    })
    y += 2
  }

  doc.setDrawColor(209, 213, 219)
  doc.setLineWidth(0.3)
  doc.line(14, y, pageW - 14, y)
  y += 8

  doc.setFont(undefined, 'bold')
  doc.setFontSize(10)
  doc.setTextColor(17, 24, 39)
  doc.text('Total (AED)', summaryLabelX, y)
  doc.text(formatMoney(order.total), summaryX, y, { align: 'right' })
  doc.setFont(undefined, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Thank you for your order. ${companyName}.`, pageW / 2, doc.internal.pageSize.getHeight() - 10, {
    align: 'center',
  })

  const fileName = `invoice-${(order.orderNumber || 'order').toString().replace(/\s/g, '-')}.pdf`
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
