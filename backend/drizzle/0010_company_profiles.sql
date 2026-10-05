-- Company Profiles: separate tenant identity/branding from organizations (tenant container)
CREATE TABLE IF NOT EXISTS company_profiles (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  display_name      text,
  description       text,
  industry          varchar(100),
  founded_year      integer,
  employee_count    varchar(20),    -- '1-10', '11-50', '51-200', '201-500', '500+'

  -- Contact
  contact_email     text,
  phone             varchar(20),
  website           text,

  -- Address
  address           text,
  city              varchar(100),
  province          varchar(100),
  postal_code       varchar(10),
  country           varchar(100) DEFAULT 'Indonesia',

  -- Branding
  logo_url          text,
  cover_url         text,
  primary_color     varchar(7),     -- Hex e.g. '#6366f1'

  -- Legal
  tax_id            varchar(50),    -- NPWP / Tax ID

  created_at        timestamp DEFAULT now(),
  updated_at        timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cp_org_idx ON company_profiles(organization_id);
