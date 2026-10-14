-- Global Temple Directory: initial schema. Plain Postgres (>=12); no extensions required.
-- Every statement is idempotent so the file can be re-run safely.

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- People ------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS magic_links (
  token_hash text PRIMARY KEY,
  email text NOT NULL,
  display_name text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- An anonymous browser (httpOnly cookie). Used to allow one rating per item and one upvote per comment.
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
-- Optional contact emails left by anonymous raters. NEVER returned by any public endpoint.
CREATE TABLE IF NOT EXISTS contacts (
  email text PRIMARY KEY,
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  consent_at timestamptz NOT NULL DEFAULT now()
);

-- Temples (one row per OpenStreetMap object; id = 'osm-<type>-<osm id>') ------------------------------------
CREATE TABLE IF NOT EXISTS temples (
  id text PRIMARY KEY,
  osm_type text NOT NULL,
  osm_id bigint NOT NULL,
  country text NOT NULL DEFAULT 'India',
  state text NOT NULL,
  district text,
  name text NOT NULL,
  native_name text,
  named boolean NOT NULL DEFAULT true,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  deity text,
  deity_basis text,                -- osm_tag | wikidata_link | spatial_name | INFERRED_from_name
  tradition text,
  tags jsonb NOT NULL DEFAULT '{}',      -- raw OpenStreetMap tags
  enrich jsonb NOT NULL DEFAULT '{}',    -- Wikidata / Wikipedia / nearby photo, each with its basis
  computed jsonb NOT NULL DEFAULT '{}',  -- nearest rail / bus / airport, toilets, parking ... (OSM-computed)
  completeness smallint,
  photo jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (osm_type, osm_id)
);
CREATE INDEX IF NOT EXISTS temples_country_state_idx ON temples (country, state, district);
CREATE INDEX IF NOT EXISTS temples_name_idx ON temples (lower(name));
CREATE INDEX IF NOT EXISTS temples_deity_idx ON temples (deity);

-- Volunteer-supplied data (needs sign-in). Writes are live at once and logged in `edits`. -------------------
CREATE TABLE IF NOT EXISTS field_values (
  id bigserial PRIMARY KEY,
  temple_id text NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value text NOT NULL,
  source_type text NOT NULL,
  source_ref text NOT NULL,
  checked_on date NOT NULL,
  user_id uuid REFERENCES users(id),
  display_name text,
  current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS field_values_current_uq ON field_values (temple_id, field_key) WHERE current;

CREATE TABLE IF NOT EXISTS needs_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id text NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  category text NOT NULL,
  area text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('Low', 'Medium', 'High')),
  title text NOT NULL,
  description text NOT NULL,
  observed_on date NOT NULL,
  evidence text,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In progress', 'Resolved')),
  user_id uuid REFERENCES users(id),
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS needs_temple_idx ON needs_reports (temple_id);

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id text NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  type text NOT NULL,
  text text NOT NULL,
  basis text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES users(id),
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_temple_idx ON notes (temple_id);

-- Open community actions (no sign-in) ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ratings (
  temple_id text NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  display_name text,
  user_id uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (temple_id, item_key, device_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id text NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  text text NOT NULL,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  display_name text,
  hidden boolean NOT NULL DEFAULT false,
  hidden_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_item_idx ON comments (temple_id, item_key);
CREATE TABLE IF NOT EXISTS upvotes (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, device_id)
);

-- Audit log: every volunteer write and admin action. `revert_of` points at the edit that was undone. ------------
CREATE TABLE IF NOT EXISTS edits (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES users(id),
  actor_name text,
  entity text NOT NULL,          -- field_value | needs_report | note | comment
  entity_id text NOT NULL,
  action text NOT NULL,          -- create | update | hide | restore | revert
  before jsonb,
  after jsonb,
  revert_of bigint REFERENCES edits(id)
);
CREATE INDEX IF NOT EXISTS edits_at_idx ON edits (at DESC);
