-- Remove the fixed CHECK constraint on agreement_party so admins can type any value
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_agreement_party_check;

-- Allow NULL (field is now optional, filled in by admin after project creation)
ALTER TABLE projects ALTER COLUMN agreement_party DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN agreement_party SET DEFAULT NULL;
