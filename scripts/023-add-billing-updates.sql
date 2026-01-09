-- Part 1: Add billing_type to contracts table
ALTER TABLE service_agreements ADD COLUMN IF NOT EXISTS billing_type TEXT;

-- Add check constraint for billing_type values
ALTER TABLE service_agreements DROP CONSTRAINT IF EXISTS service_agreements_billing_type_check;
ALTER TABLE service_agreements ADD CONSTRAINT service_agreements_billing_type_check 
  CHECK (billing_type IS NULL OR billing_type IN ('annual', 'quarterly', 'semi_annual', 'due_on_receipt', 'billed_after_service'));

COMMENT ON COLUMN service_agreements.billing_type IS 'Type of billing: annual, quarterly, semi_annual, due_on_receipt, or billed_after_service';

-- Part 2: Update jobs billing_status to add new values
-- First, drop the existing constraint if it exists
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_billing_status_check;

-- Add updated constraint with new values
ALTER TABLE jobs ADD CONSTRAINT jobs_billing_status_check 
  CHECK (billing_status IS NULL OR billing_status IN ('processing', 'sent_to_billing', 'invoiced', 'paid', 'un_billable'));

COMMENT ON COLUMN jobs.billing_status IS 'Billing status: processing (default), sent_to_billing, invoiced, paid, or un_billable';
