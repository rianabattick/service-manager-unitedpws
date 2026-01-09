-- Make amount column nullable in service_agreements table
-- Removing the NOT NULL constraint from amount column
ALTER TABLE service_agreements ALTER COLUMN amount DROP NOT NULL;
