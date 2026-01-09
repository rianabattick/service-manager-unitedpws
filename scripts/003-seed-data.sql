-- Service Manager 1.0 - Seed Data
-- This script adds sample data for testing and development

-- ============================================================================
-- SAMPLE ORGANIZATION
-- ============================================================================

INSERT INTO organizations (id, name, slug, description, email, phone, address, city, state, zip_code, timezone, currency, tax_rate)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Elite Service Co.',
    'elite-service-co',
    'Full-service HVAC, Plumbing, and Electrical contractor',
    'info@eliteservice.com',
    '(555) 123-4567',
    '123 Business Park Dr',
    'Austin',
    'TX',
    '78701',
    'America/Chicago',
    'USD',
    8.25
);

-- Note: Users will be created through Supabase Auth
-- After authentication, user records should reference auth.users(id)

-- ============================================================================
-- SAMPLE SERVICE ZONES
-- ============================================================================

INSERT INTO service_zones (organization_id, name, description, zip_codes, color, is_active)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'North Austin', 'North Austin service area', ARRAY['78701', '78702', '78703', '78751', '78752'], '#3B82F6', true),
    ('00000000-0000-0000-0000-000000000001', 'South Austin', 'South Austin service area', ARRAY['78704', '78745', '78746', '78747', '78748'], '#10B981', true),
    ('00000000-0000-0000-0000-000000000001', 'West Austin', 'West Austin service area', ARRAY['78705', '78731', '78732', '78733', '78734'], '#F59E0B', true);

-- ============================================================================
-- SAMPLE INVENTORY ITEMS
-- ============================================================================

INSERT INTO inventory_items (organization_id, sku, name, description, category, manufacturer, cost_price, sell_price, quantity_on_hand, reorder_point, is_taxable, is_active)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'HVAC-001', 'Air Filter 16x25x1', 'Standard MERV 8 air filter', 'HVAC', 'FilterBrand', 3.50, 12.99, 50, 10, true, true),
    ('00000000-0000-0000-0000-000000000001', 'HVAC-002', 'Thermostat - Smart WiFi', 'Programmable WiFi thermostat', 'HVAC', 'Nest', 89.00, 249.99, 15, 5, true, true),
    ('00000000-0000-0000-0000-000000000001', 'PLUMB-001', 'Wax Ring Toilet Seal', 'Standard wax ring with flange', 'Plumbing', 'Fluidmaster', 2.25, 8.99, 30, 8, true, true),
    ('00000000-0000-0000-0000-000000000001', 'PLUMB-002', 'Faucet Cartridge', 'Universal faucet cartridge', 'Plumbing', 'Moen', 15.50, 45.99, 20, 5, true, true),
    ('00000000-0000-0000-0000-000000000001', 'ELEC-001', 'GFCI Outlet 15A', '15A GFCI outlet with LED', 'Electrical', 'Leviton', 8.75, 24.99, 25, 10, true, true),
    ('00000000-0000-0000-0000-000000000001', 'ELEC-002', 'Circuit Breaker 20A', '20A single pole breaker', 'Electrical', 'Square D', 12.00, 35.99, 40, 8, true, true),
    ('00000000-0000-0000-0000-000000000001', 'LABOR-001', 'Labor - Regular Rate', 'Standard hourly labor rate', 'Labor', 'Internal', 35.00, 95.00, 9999, 0, false, true),
    ('00000000-0000-0000-0000-000000000001', 'LABOR-002', 'Labor - After Hours', 'After hours & emergency rate', 'Labor', 'Internal', 50.00, 145.00, 9999, 0, false, true),
    ('00000000-0000-0000-0000-000000000001', 'FEE-001', 'Service Call Fee', 'Standard service call fee', 'Fees', 'Internal', 0.00, 75.00, 9999, 0, false, true),
    ('00000000-0000-0000-0000-000000000001', 'FEE-002', 'Emergency Service Fee', 'Emergency after-hours service', 'Fees', 'Internal', 0.00, 150.00, 9999, 0, false, true);

-- ============================================================================
-- NOTES
-- ============================================================================

-- After running these scripts:
-- 1. Create user accounts through Supabase Auth (email/password or OAuth)
-- 2. Insert user records in the users table that reference auth.users(id)
-- 3. Sample users should have organization_id = '00000000-0000-0000-0000-000000000001'
-- 4. Assign appropriate roles: 'owner', 'admin', 'manager', 'technician', 'dispatcher', 'viewer'
-- 5. Create sample customers, jobs, and invoices as needed for testing
