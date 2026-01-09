-- Phase 1: Scrap "Site Location" UI and replace with Notes fields
-- Keep site_locations table for Phase 2, but stop using it in Phase 1

-- Add site_notes column to job_service_locations
ALTER TABLE job_service_locations 
ADD COLUMN IF NOT EXISTS site_notes text;

-- Add unit_notes column to job_equipment
ALTER TABLE job_equipment
ADD COLUMN IF NOT EXISTS unit_notes text;

COMMENT ON COLUMN job_service_locations.site_notes IS 'Free-text notes about this specific site address for this job (access instructions, parking, contact info, etc.)';
COMMENT ON COLUMN job_equipment.unit_notes IS 'Free-text notes about this specific unit assignment on this job (location within building, special access requirements, etc.)';
