-- Add is_lead column to job_technicians table
-- This allows the app to designate which technician is the lead for each job

-- Add the is_lead column with default false
ALTER TABLE public.job_technicians
ADD COLUMN IF NOT EXISTS is_lead boolean NOT NULL DEFAULT false;

-- Add a comment for documentation
COMMENT ON COLUMN public.job_technicians.is_lead IS 'Indicates whether this technician is the lead for the job';

-- Optional: Add an index for performance if querying lead technicians becomes common
CREATE INDEX IF NOT EXISTS idx_job_technicians_is_lead 
ON public.job_technicians(job_id, is_lead) 
WHERE is_lead = true;

-- Add a check to ensure only one lead per job (optional constraint)
-- This creates a unique partial index that prevents multiple leads per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_technicians_one_lead_per_job
ON public.job_technicians(job_id)
WHERE is_lead = true;
