-- Add PO# and Estimate# fields to jobs table

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS po_number TEXT,
ADD COLUMN IF NOT EXISTS estimate_number TEXT;

-- Add indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_jobs_po_number ON jobs(po_number);
CREATE INDEX IF NOT EXISTS idx_jobs_estimate_number ON jobs(estimate_number);

COMMENT ON COLUMN jobs.po_number IS 'Purchase Order number for this job';
COMMENT ON COLUMN jobs.estimate_number IS 'Estimate number associated with this job';
