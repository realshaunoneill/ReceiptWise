export interface ExportReceipt {
  merchantName?: string;
  totalAmount?: string;
  currency?: string;
  transactionDate?: string;
  category?: string;
  paymentMethod?: string;
  location?: string;
  isBusinessExpense?: boolean;
  subtotal?: string;
  tax?: string;
  serviceCharge?: string;
  imageUrl?: string;
  items?: Array<{
    name: string;
    quantity?: string;
    price?: string;
    totalPrice?: string;
  }>;
}

export interface ExportData {
  receipts?: ExportReceipt[];
}

/**
 * Escape text for HTML. Every receipt field here is model output from an arbitrary image (or
 * user input), and it was interpolated raw — a merchant name like `<img src=x onerror=…>`
 * would run script when the exported file was opened.
 */
function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) image URLs make it into src; anything else (javascript:, data:) is dropped. */
function safeImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function generateReceiptExportHtml(data: ExportData): string {
  const receipts = data.receipts || [];
  const totalSpent = receipts
    .reduce((sum, r) => sum + (parseFloat(r.totalAmount || '0') || 0), 0)
    .toFixed(2);

  const receiptCards = receipts.length === 0
    ? `
    <div class="empty-state">
      <div class="empty-state-icon">📄</div>
      <p>No receipts to export</p>
    </div>`
    : receipts.map(receipt => {
      const currency = esc(receipt.currency);
      const imageUrl = safeImageUrl(receipt.imageUrl);
      return `
    <div class="receipt">
      <div class="receipt-image">
        ${imageUrl
          ? `<img src="${esc(imageUrl)}" alt="Receipt from ${esc(receipt.merchantName || 'Unknown')}" loading="lazy" />`
          : '<div class="no-image"><span style="font-size: 32px;">🧾</span><span>No image</span></div>'
        }
      </div>
      <div class="receipt-details">
        <div class="receipt-header">
          <span class="merchant">${esc(receipt.merchantName || 'Unknown Merchant')}</span>
          <span class="amount">${currency} ${esc(receipt.totalAmount || '0.00')}</span>
        </div>
        <div class="meta">
          ${receipt.transactionDate ? `<span class="meta-item">📅 ${esc(receipt.transactionDate)}</span>` : ''}
          ${receipt.category ? `<span class="badge badge-category">${esc(receipt.category)}</span>` : ''}
          ${receipt.paymentMethod ? `<span class="meta-item">💳 ${esc(receipt.paymentMethod)}</span>` : ''}
          ${receipt.location ? `<span class="meta-item">📍 ${esc(receipt.location)}</span>` : ''}
          ${receipt.isBusinessExpense ? '<span class="badge badge-business">💼 Business</span>' : ''}
        </div>
        ${receipt.items && receipt.items.length > 0 ? `
        <div class="items-section">
          <div class="items-title">Items (${receipt.items.length})</div>
          ${receipt.items.map(item => `
          <div class="item">
            <span class="item-name">${esc(item.name)}${item.quantity ? `<span class="item-qty">× ${esc(item.quantity)}</span>` : ''}</span>
            <span class="item-price">${currency} ${esc(item.totalPrice || item.price || '')}</span>
          </div>
          `).join('')}
        </div>
        ` : ''}
        <div class="totals">
          ${receipt.subtotal ? `<div class="total-row"><span>Subtotal</span><span>${currency} ${esc(receipt.subtotal)}</span></div>` : ''}
          ${receipt.tax ? `<div class="total-row"><span>Tax</span><span>${currency} ${esc(receipt.tax)}</span></div>` : ''}
          ${receipt.serviceCharge ? `<div class="total-row"><span>Service Charge</span><span>${currency} ${esc(receipt.serviceCharge)}</span></div>` : ''}
          <div class="total-row grand"><span>Total</span><span>${currency} ${esc(receipt.totalAmount || '0.00')}</span></div>
        </div>
      </div>
    </div>`;
    }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ReceiptWise Export - ${new Date().toLocaleDateString()}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --background: #fafafa;
      --foreground: #171717;
      --card: #ffffff;
      --card-foreground: #171717;
      --primary: #10b981;
      --primary-foreground: #ffffff;
      --muted: #f5f5f5;
      --muted-foreground: #737373;
      --border: #e5e5e5;
      --radius: 0.75rem;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --background: #171717;
        --foreground: #fafafa;
        --card: #262626;
        --card-foreground: #fafafa;
        --muted: #262626;
        --muted-foreground: #a3a3a3;
        --border: #404040;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--background);
      color: var(--foreground);
      padding: 24px;
      line-height: 1.5;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .logo img {
      height: 40px;
      width: auto;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--foreground);
    }
    .summary {
      color: var(--muted-foreground);
      font-size: 14px;
    }
    .stats {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-top: 16px;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
    }
    .stat-label {
      font-size: 12px;
      color: var(--muted-foreground);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .receipt {
      background: var(--card);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      margin-bottom: 20px;
      overflow: hidden;
      display: grid;
      grid-template-columns: 280px 1fr;
    }
    @media (max-width: 768px) {
      .receipt { grid-template-columns: 1fr; }
    }
    .receipt-image {
      background: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      border-right: 1px solid var(--border);
    }
    @media (max-width: 768px) {
      .receipt-image { border-right: none; border-bottom: 1px solid var(--border); }
    }
    .receipt-image img {
      max-width: 100%;
      max-height: 350px;
      object-fit: contain;
    }
    .receipt-image .no-image {
      color: var(--muted-foreground);
      font-size: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .receipt-details { padding: 20px; }
    .receipt-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .merchant {
      font-size: 18px;
      font-weight: 600;
      color: var(--card-foreground);
    }
    .amount {
      font-size: 18px;
      font-weight: 700;
      color: var(--primary);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
      font-size: 13px;
      color: var(--muted-foreground);
    }
    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-category {
      background: rgba(16, 185, 129, 0.1);
      color: var(--primary);
    }
    .badge-business {
      background: rgba(245, 158, 11, 0.1);
      color: #f59e0b;
    }
    .items-section {
      border-top: 1px solid var(--border);
      padding-top: 16px;
      margin-top: 8px;
    }
    .items-title {
      font-weight: 600;
      margin-bottom: 12px;
      font-size: 14px;
      color: var(--card-foreground);
    }
    .item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    .item:last-child { border-bottom: none; }
    .item-name { color: var(--card-foreground); }
    .item-qty {
      color: var(--muted-foreground);
      margin-left: 6px;
      font-size: 12px;
    }
    .item-price {
      font-weight: 500;
      color: var(--card-foreground);
    }
    .totals {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
      color: var(--muted-foreground);
    }
    .total-row span:last-child { color: var(--card-foreground); }
    .total-row.grand {
      font-weight: 700;
      font-size: 16px;
      margin-top: 8px;
      padding-top: 12px;
      border-top: 2px solid var(--border);
      color: var(--card-foreground);
    }
    .total-row.grand span:last-child { color: var(--primary); }
    .footer {
      text-align: center;
      margin-top: 48px;
      padding: 24px;
      border-top: 1px solid var(--border);
      color: var(--muted-foreground);
      font-size: 13px;
    }
    .footer p { margin-bottom: 4px; }
    .empty-state {
      text-align: center;
      padding: 64px 24px;
      color: var(--muted-foreground);
    }
    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="https://www.receiptwise.io/logo.png" alt="ReceiptWise" />
      </div>
      <h1>Receipt Export</h1>
      <p class="summary">Exported on ${new Date().toLocaleString()}</p>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${receipts.length}</div>
          <div class="stat-label">Receipts</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalSpent}</div>
          <div class="stat-label">Total Spent</div>
        </div>
      </div>
    </div>

    ${receiptCards}

    <div class="footer">
      <p><strong>ReceiptWise</strong> • Your personal finance companion</p>
      <p>Generated on ${new Date().toLocaleString()} • Receipt images require internet connection</p>
    </div>
  </div>
</body>
</html>`;
}
