-- =============================================================================
-- Fix: employees.position was found to be NOT NULL in production, even
-- though supabase/schema.sql declares it nullable and the "Add Employee"
-- form (src/components/hr/employee-form.tsx) always treated Position as an
-- optional field (no required validation, no asterisk). Discovered while
-- verifying the paid-seat/role-template feature: leaving Position blank on
-- a brand-new employee failed with a NOT NULL constraint violation this
-- form never guarded against. Restoring the column to match its documented,
-- intended shape rather than making Position required in the UI, since
-- nothing about this app's HR model actually needs a job title to create an
-- employee record.
-- =============================================================================

ALTER TABLE employees ALTER COLUMN position DROP NOT NULL;
