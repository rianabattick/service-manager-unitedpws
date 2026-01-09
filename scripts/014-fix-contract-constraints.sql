-- Fix service_agreements constraints to match the form requirements

-- 1. Update the type check constraint to match the actual coverage types
ALTER TABLE service_agreements 
DROP CONSTRAINT IF EXISTS service_agreements_type_check;

ALTER TABLE service_agreements 
ADD CONSTRAINT service_agreements_type_check 
CHECK (type IN ('gold', 'remedial', 'pm_contract', 'pseudo_gold', 'maintenance', 'warranty', 'service_plan'));

-- 2. Update the status check constraint to include 'job_creation_needed'
ALTER TABLE service_agreements 
DROP CONSTRAINT IF EXISTS service_agreements_status_check;

ALTER TABLE service_agreements 
ADD CONSTRAINT service_agreements_status_check 
CHECK (status IN ('draft', 'active', 'expired', 'cancelled', 'job_creation_needed'));

-- 3. Make amount nullable since not all contracts require an amount field
ALTER TABLE service_agreements 
ALTER COLUMN amount DROP NOT NULL;

-- 4. Make name nullable to be more flexible (agreement_number is the unique identifier)
ALTER TABLE service_agreements 
ALTER COLUMN name DROP NOT NULL;

-- 5. Make description nullable
ALTER TABLE service_agreements 
ALTER COLUMN description DROP NOT NULL;

-- 6. Make type nullable to allow drafts without type specified
ALTER TABLE service_agreements 
ALTER COLUMN type DROP NOT NULL;

-- 7. Add vendor_id column if it doesn't exist (for subcontracted agreements)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_agreements' AND column_name = 'vendor_id'
    ) THEN
        ALTER TABLE service_agreements 
        ADD COLUMN vendor_id UUID REFERENCES vendors(id);
    END IF;
END $$;

-- 8. Add agreement_length_years column to track multi-year contracts
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_agreements' AND column_name = 'agreement_length_years'
    ) THEN
        ALTER TABLE service_agreements 
        ADD COLUMN agreement_length_years INTEGER DEFAULT 1;
    END IF;
END $$;

-- 9. Add service_count column to track remaining services
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_agreements' AND column_name = 'service_count'
    ) THEN
        ALTER TABLE service_agreements 
        ADD COLUMN service_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 10. Add pm_due_next column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_agreements' AND column_name = 'pm_due_next'
    ) THEN
        ALTER TABLE service_agreements 
        ADD COLUMN pm_due_next DATE;
    END IF;
END $$;

-- 11. Add unit_information column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_agreements' AND column_name = 'unit_information'
    ) THEN
        ALTER TABLE service_agreements 
        ADD COLUMN unit_information TEXT;
    END IF;
END $$;
