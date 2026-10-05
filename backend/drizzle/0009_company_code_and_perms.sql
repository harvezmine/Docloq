-- companyCode on organizations: auto-generated 8-char unique identifier
ALTER TABLE organizations ADD COLUMN company_code varchar(8);
UPDATE organizations SET company_code = UPPER(SUBSTRING(REPLACE(id::text,'-',''),1,8)) WHERE company_code IS NULL;
ALTER TABLE organizations ALTER COLUMN company_code SET NOT NULL;
CREATE UNIQUE INDEX org_company_code_idx ON organizations(company_code);
