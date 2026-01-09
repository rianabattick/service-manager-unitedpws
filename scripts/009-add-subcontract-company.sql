-- Add subcontract company name field to jobs table
ALTER TABLE jobs
ADD COLUMN subcontract_company_name TEXT;

COMMENT ON COLUMN jobs.subcontract_company_name IS 'Name of the company the customer is subcontracted by (only for subcontract jobs)';
