-- Migration: Add customer_type to customers and create job_contacts table

-- 1. Add customer_type column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS customer_type TEXT
CHECK (customer_type IN ('direct', 'subcontract'))
DEFAULT 'direct';

-- 2. Create job_contacts table
CREATE TABLE IF NOT EXISTS job_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create index for faster lookups
CREATE INDEX IF NOT EXISTS job_contacts_job_id_idx ON job_contacts(job_id);
