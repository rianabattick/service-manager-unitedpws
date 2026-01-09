-- Add missing fields and tables for contracts module

-- Update service_agreements table with new fields if they don't exist
DO $$ 
BEGIN
  -- Add customer_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_agreements' AND column_name = 'customer_type') THEN
    ALTER TABLE service_agreements ADD COLUMN customer_type TEXT;
  END IF;
  
  -- Add subcontracted_by if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_agreements' AND column_name = 'subcontracted_by') THEN
    ALTER TABLE service_agreements ADD COLUMN subcontracted_by TEXT;
  END IF;

  -- Add title as alias for name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_agreements' AND column_name = 'title') THEN
    ALTER TABLE service_agreements ADD COLUMN title TEXT;
  END IF;

  -- Add coverage_plan
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_agreements' AND column_name = 'coverage_plan') THEN
    ALTER TABLE service_agreements ADD COLUMN coverage_plan TEXT;
  END IF;

  -- Add service_notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_agreements' AND column_name = 'service_notes') THEN
    ALTER TABLE service_agreements ADD COLUMN service_notes TEXT;
  END IF;

  -- Add pm_completed
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_agreements' AND column_name = 'pm_completed') THEN
    ALTER TABLE service_agreements ADD COLUMN pm_completed DATE;
  END IF;

  -- Add pm_due_next
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_agreements' AND column_name = 'pm_due_next') THEN
    ALTER TABLE service_agreements ADD COLUMN pm_due_next DATE;
  END IF;

  -- Add unit_information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_agreements' AND column_name = 'unit_information') THEN
    ALTER TABLE service_agreements ADD COLUMN unit_information TEXT;
  END IF;

  -- Add last_notified_at for scanner
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_agreements' AND column_name = 'last_notified_at') THEN
    ALTER TABLE service_agreements ADD COLUMN last_notified_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create contract_services table for multiple services per contract
CREATE TABLE IF NOT EXISTS contract_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES service_agreements(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('MJPM', 'MNPM')),
  frequency_months INTEGER NOT NULL DEFAULT 6,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for contract_services
ALTER TABLE contract_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view organization contract services"
  ON contract_services FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "Managers can manage contract services"
  ON contract_services FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager', 'dispatcher')
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_contract_services_contract_id ON contract_services(contract_id);
CREATE INDEX IF NOT EXISTS idx_service_agreements_status ON service_agreements(status);
CREATE INDEX IF NOT EXISTS idx_service_agreements_end_date ON service_agreements(end_date);
