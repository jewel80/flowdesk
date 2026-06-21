-- Add InvoiceLineItem model
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- Add indexes for invoice_line_items
CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");

-- Add foreign key constraint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new columns to invoices table
ALTER TABLE "invoices" ADD COLUMN "issuerName" TEXT;
ALTER TABLE "invoices" ADD COLUMN "issuerAddress" TEXT;
ALTER TABLE "invoices" ADD COLUMN "issuerTaxId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "issuerEmail" TEXT;
ALTER TABLE "invoices" ADD COLUMN "issuerPhone" TEXT;

-- Make bill-to fields required (we'll add them as nullable first, then update existing data, then make them required)
ALTER TABLE "invoices" ADD COLUMN "billToName" TEXT NOT NULL DEFAULT 'Unknown Customer';
ALTER TABLE "invoices" ADD COLUMN "billToAddress" TEXT NOT NULL DEFAULT 'Unknown Address';
ALTER TABLE "invoices" ADD COLUMN "billToEmail" TEXT;
ALTER TABLE "invoices" ADD COLUMN "billToPhone" TEXT;

-- Add money breakdown columns
ALTER TABLE "invoices" ADD COLUMN "subtotalCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "taxRatePercent" DECIMAL(65,0) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "taxAmountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "totalCents" INTEGER NOT NULL DEFAULT 0;

-- Add payment and bank details
ALTER TABLE "invoices" ADD COLUMN "paymentTerms" TEXT;
ALTER TABLE "invoices" ADD COLUMN "notes" TEXT;
ALTER TABLE "invoices" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "invoices" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "invoices" ADD COLUMN "bankName" TEXT;
ALTER TABLE "invoices" ADD COLUMN "bankSwiftOrRouting" TEXT;

-- Update existing invoices to have valid values
UPDATE "invoices" SET
    "billToName" = 'Customer Name',
    "billToAddress" = 'Customer Address',
    "subtotalCents" = "amountCents",
    "totalCents" = "amountCents"
WHERE "subtotalCents" = 0;
