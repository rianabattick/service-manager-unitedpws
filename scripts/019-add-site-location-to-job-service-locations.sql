-- Add site_location_id to job_service_locations to track which site locations are selected per job
ALTER TABLE job_service_locations 
ADD COLUMN IF NOT EXISTS site_location_id UUID REFERENCES site_locations(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_job_service_locations_site_location_id ON job_service_locations(site_location_id);

-- Update the unique constraint to allow multiple records per job+service_location if they have different site_locations
ALTER TABLE job_service_locations DROP CONSTRAINT IF EXISTS job_service_locations_job_id_service_location_id_key;
ALTER TABLE job_service_locations ADD CONSTRAINT job_service_locations_unique 
  UNIQUE(job_id, service_location_id, site_location_id);

-- Comment
COMMENT ON COLUMN job_service_locations.site_location_id IS 'Optional: Which site location (sub-location) is associated with this job-site pairing.';
