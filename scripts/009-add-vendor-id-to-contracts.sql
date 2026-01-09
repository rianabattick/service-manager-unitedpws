-- Add vendor_id column to service_agreements table to replace subcontracted_by text field

ALTER TABLE service_agreements 
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);

-- Create index for vendor_id
CREATE INDEX IF NOT EXISTS idx_service_agreements_vendor_id 
ON service_agreements(vendor_id);

-- Migrate data: If you have existing subcontracted_by data, you would need to:
-- 1. Create vendor records for unique subcontracted_by values
-- 2. Update service_agreements to reference the new vendor_id
-- (This migration is left as a comment since we don't know the existing data state)

-- Add comment
COMMENT ON COLUMN service_agreements.vendor_id IS 'Reference to vendor when customer_type is subcontract';
