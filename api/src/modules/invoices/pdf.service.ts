import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { toInvoiceResponse } from './invoice.mapper';

type InvoiceData = ReturnType<typeof toInvoiceResponse>;

@Injectable()
export class PdfService {
  generate(invoice: InvoiceData, output: NodeJS.WritableStream): void {
    const M = 50;
    const PW = 595.28; // A4 width pts
    const W = PW - M * 2;
    const R = PW - M;

    const doc = new PDFDocument({ size: 'A4', margin: M });
    doc.pipe(output);

    const TEXT = '#1b2333';
    const MUTED = '#6b7689';
    const BLUE = '#3b5bdb';
    const GREEN = '#10b981';
    const LINE = '#e3e8f0';

    const money = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(n);

    const fmtDate = (d: Date | string | null): string => {
      if (!d) return '—';
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // ── HEADER ──────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(18).fillColor(BLUE);
    doc.text('FlowDesk', M, M);

    doc.font('Helvetica-Bold').fontSize(20).fillColor(TEXT);
    doc.text(invoice.invoiceNumber, M, M, { align: 'right', width: W });

    const statusColor =
      invoice.status === 'PAID' ? GREEN
      : invoice.status === 'ISSUED' ? '#f08c00'
      : MUTED;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(statusColor);
    doc.text(invoice.status, M, M + 26, { align: 'right', width: W });

    doc.moveTo(M, M + 46).lineTo(R, M + 46).lineWidth(0.5).strokeColor(LINE).stroke();

    // ── ISSUER (left) + INVOICE META (right) ──────────────────────────────
    const sY = M + 58;
    let leftY = sY;

    if (invoice.issuerName) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT);
      doc.text(invoice.issuerName, M, leftY, { width: W / 2 - 10 });
      leftY += 16;
    }
    if (invoice.issuerAddress) {
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
      doc.text(invoice.issuerAddress, M, leftY, { width: W / 2 - 10 });
      leftY += 14;
    }
    if (invoice.issuerTaxId) {
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
      doc.text(`Tax ID: ${invoice.issuerTaxId}`, M, leftY);
      leftY += 13;
    }
    const contact = [invoice.issuerEmail, invoice.issuerPhone].filter(Boolean).join(' · ');
    if (contact) {
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
      doc.text(contact, M, leftY, { width: W / 2 - 10 });
      leftY += 13;
    }

    // Invoice meta — right column
    const metaX = M + W / 2 + 10;
    const metaW = W / 2 - 10;
    let rightY = sY;

    const metaRow = (label: string, value: string) => {
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
      doc.text(label, metaX, rightY, { width: metaW / 2 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(TEXT);
      doc.text(value, metaX, rightY, { align: 'right', width: metaW });
      rightY += 15;
    };

    metaRow('Invoice date', fmtDate(invoice.issuedAt));
    metaRow('Due date', fmtDate(invoice.dueDate));
    if (invoice.paidAt) metaRow('Paid on', fmtDate(invoice.paidAt));

    let y = Math.max(leftY, rightY) + 16;

    // ── BILL TO ────────────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
    y += 10;

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED);
    doc.text('BILL TO', M, y);
    y += 13;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT);
    doc.text(invoice.billToName, M, y, { width: W / 2 });
    y += 14;

    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    if (invoice.billToAddress) { doc.text(invoice.billToAddress, M, y, { width: W / 2 }); y += 13; }
    if (invoice.billToEmail) { doc.text(invoice.billToEmail, M, y); y += 13; }
    if (invoice.billToPhone) { doc.text(invoice.billToPhone, M, y); y += 13; }
    y += 14;

    // ── LINE ITEMS TABLE ──────────────────────────────────────────────────
    doc.rect(M, y, W, 20).fillColor('#f4f6fb').fill();

    const cDesc = M + 8;
    const cQty  = M + W * 0.58;
    const cUp   = M + W * 0.73;

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED);
    doc.text('DESCRIPTION', cDesc, y + 6);
    doc.text('QTY',         cQty,  y + 6);
    doc.text('UNIT PRICE',  cUp,   y + 6);
    doc.text('AMOUNT', M, y + 6, { align: 'right', width: W - 8 });
    y += 20;

    for (const item of invoice.lineItems) {
      doc.moveTo(M, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
      y += 7;

      doc.font('Helvetica').fontSize(9).fillColor(TEXT);
      doc.text(item.description, cDesc, y, { width: W * 0.52 });
      doc.text(String(item.quantity), cQty, y);
      doc.text(money(item.unitPrice), cUp, y);
      doc.text(money(item.amount), M, y, { align: 'right', width: W - 8 });
      y += 18;
    }

    doc.moveTo(M, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
    y += 14;

    // ── TOTALS ─────────────────────────────────────────────────────────────
    const tX = M + W / 2;
    const tW = W / 2;

    const tRow = (label: string, val: string, bold = false) => {
      const font = bold ? 'Helvetica-Bold' : 'Helvetica';
      doc.font(font).fontSize(9).fillColor(bold ? TEXT : MUTED);
      doc.text(label, tX, y, { width: tW / 2 });
      doc.font(font).fontSize(9).fillColor(bold ? TEXT : MUTED);
      doc.text(val, tX, y, { align: 'right', width: tW });
      y += 15;
    };

    tRow('Subtotal', money(invoice.subtotal));
    if (invoice.discount > 0) tRow('Discount', `−${money(invoice.discount)}`);
    if (invoice.taxRatePercent > 0) tRow(`Tax (${invoice.taxRatePercent}%)`, money(invoice.taxAmount));

    y += 3;
    doc.moveTo(tX, y).lineTo(R, y).lineWidth(1).strokeColor(TEXT).stroke();
    y += 9;

    doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT);
    doc.text('Total Due', tX, y, { width: tW / 2 });
    doc.text(money(invoice.total), tX, y, { align: 'right', width: tW });
    y += 22;

    // ── PAID WATERMARK ─────────────────────────────────────────────────────
    if (invoice.status === 'PAID') {
      doc.save();
      doc.font('Helvetica-Bold').fontSize(56).fillColor(GREEN).opacity(0.10);
      doc.text('PAID', M, 340, { align: 'right', width: W });
      doc.restore();
    }

    // ── PAYMENT DETAILS ────────────────────────────────────────────────────
    if (invoice.paymentTerms || invoice.bankName || invoice.bankAccountName) {
      doc.moveTo(M, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
      y += 12;

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED);
      doc.text('PAYMENT DETAILS', M, y);
      y += 13;

      doc.font('Helvetica').fontSize(9).fillColor(TEXT);
      if (invoice.paymentTerms)      { doc.text(`Payment terms: ${invoice.paymentTerms}`, M, y); y += 13; }
      if (invoice.bankName)          { doc.text(`Bank: ${invoice.bankName}`, M, y); y += 13; }
      if (invoice.bankAccountName)   { doc.text(`Account name: ${invoice.bankAccountName}`, M, y); y += 13; }
      if (invoice.bankAccountNumber) { doc.text(`Account: ${invoice.bankAccountNumber}`, M, y); y += 13; }
      if (invoice.bankSwiftOrRouting){ doc.text(`SWIFT / Routing: ${invoice.bankSwiftOrRouting}`, M, y); y += 13; }
      y += 8;
    }

    // ── NOTES ──────────────────────────────────────────────────────────────
    if (invoice.notes) {
      doc.moveTo(M, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
      y += 12;

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED);
      doc.text('NOTES', M, y);
      y += 13;

      doc.font('Helvetica').fontSize(9).fillColor(MUTED);
      doc.text(invoice.notes, M, y, { width: W });
    }

    // ── FOOTER ─────────────────────────────────────────────────────────────
    doc.moveTo(M, 792).lineTo(R, 792).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text('Generated by FlowDesk \xb7 billing@flowdesk.com', M, 798, {
      align: 'center',
      width: W,
    });

    doc.end();
  }
}
