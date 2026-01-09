-- Migration: Add site locations (sub-locations) and multi-site support for jobs
-- This script creates new tables and relationships to support multiple site addresses per job
-- and optional site locations (sub-locations) within each site address.

-- 1. CREATE SITE_LOCATIONS TABLE (sub-locations within a service_location)
CREATE TABLE IF NOT EXISTS site_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_location_id UUID NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
  name TEXT,
  unit_location TEXT, -- "Under the stairs", "Basement", "Roof", etc.
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_site_locations_organization_id ON site_locations(organization_id);
CREATE INDEX idx_site_locations_service_location_id ON site_locations(service_location_id);

-- Updated_at trigger
CREATE TRIGGER update_site_locations_updated_at
BEFORE UPDATE ON site_locations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE site_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization site locations"
ON site_locations FOR SELECT
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create site locations"
ON site_locations FOR INSERT
WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update site locations"
ON site_locations FOR UPDATE
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete site locations"
ON site_locations FOR DELETE
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- 2. CREATE JOB_SERVICE_LOCATIONS JOIN TABLE (many-to-many between jobs and service_locations)
CREATE TABLE IF NOT EXISTS job_service_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  service_location_id UUID NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, service_location_id)
);

-- Indexes
CREATE INDEX idx_job_service_locations_job_id ON job_service_locations(job_id);
CREATE INDEX idx_job_service_locations_service_location_id ON job_service_locations(service_location_id);

-- Updated_at trigger
CREATE TRIGGER update_job_service_locations_updated_at
BEFORE UPDATE ON job_service_locations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE job_service_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view job service locations in their organization"
ON job_service_locations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_service_locations.job_id
    AND j.organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  )
);

CREATE POLICY "Users can insert job service locations in their organization"
ON job_service_locations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_service_locations.job_id
    AND j.organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  )
);

CREATE POLICY "Users can update job service locations in their organization"
ON job_service_locations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_service_locations.job_id
    AND j.organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  )
);

CREATE POLICY "Managers can delete job service locations"
ON job_service_locations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM jobs j
    JOIN users u ON u.id = auth.uid()
    WHERE j.id = job_service_locations.job_id
    AND j.organization_id = u.organization_id
    AND u.role IN ('owner', 'admin', 'manager', 'dispatcher')
  )
);

-- 3. ADD SITE AND SITE_LOCATION COLUMNS TO JOB_EQUIPMENT
-- This allows tagging which site address and site location each unit belongs to
ALTER TABLE job_equipment 
ADD COLUMN IF NOT EXISTS service_location_id UUID REFERENCES service_locations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS site_location_id UUID REFERENCES site_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_equipment_service_location_id ON job_equipment(service_location_id);
CREATE INDEX IF NOT EXISTS idx_job_equipment_site_location_id ON job_equipment(site_location_id);

-- 4. BACKFILL EXISTING JOBS INTO job_service_locations
-- For backward compatibility, migrate existing jobs that have service_location_id set
INSERT INTO job_service_locations (job_id, service_location_id, created_at, updated_at)
SELECT id, service_location_id, created_at, updated_at
FROM jobs
WHERE service_location_id IS NOT NULL
ON CONFLICT (job_id, service_location_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE site_locations IS 'Sub-locations within a service location (site address). Examples: "Basement", "Roof", "Under stairs".';
COMMENT ON COLUMN site_locations.unit_location IS 'Descriptive location text like "Under the stairs", "Basement", "Roof"';
COMMENT ON TABLE job_service_locations IS 'Junction table allowing jobs to have multiple site addresses.';
COMMENT ON COLUMN job_equipment.service_location_id IS 'Optional: Which site address this equipment is associated with for this job.';
COMMENT ON COLUMN job_equipment.site_location_id IS 'Optional: Which site location (sub-location) this equipment is associated with for this job.';
