-- Location-by-location temple collection (internal working tables; the public site reads only `temples`).
-- Rules: unknown = NULL; every claim has a source and a retrieval date; a coverage % measures work done, not temples found.
-- Only reviewed candidates are promoted into `temples` (temple_candidates.temple_id).

CREATE TABLE IF NOT EXISTS sources (
  id bigserial PRIMARY KEY,
  url text NOT NULL UNIQUE,
  publisher text,
  licence text,                       -- reuse terms as stated by the publisher
  robots_ok boolean,                  -- NULL = not checked yet
  retrieved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (  -- fetched pages/files cached so reruns cost nothing
  id bigserial PRIMARY KEY,
  source_id bigint NOT NULL REFERENCES sources(id),
  content_hash text NOT NULL,
  body text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, content_hash)
);

-- Location master ---------------------------------------------------------------------------------------
-- city -> town -> village is NOT one hierarchy: revenue and local-government structures are kept separately in geo_links.
CREATE TABLE IF NOT EXISTS geo_entities (
  id bigserial PRIMARY KEY,
  lgd_code text,                      -- Local Government Directory code where one exists; else NULL
  type text NOT NULL CHECK (type IN ('state','district','taluk','revenue_village','urban_body','ward','panchayat','hamlet')),
  name_en text NOT NULL,
  name_ta text,
  parent_id bigint REFERENCES geo_entities(id),   -- primary revenue/administrative parent
  source_id bigint REFERENCES sources(id),
  valid_from date,
  valid_to date
);
CREATE UNIQUE INDEX IF NOT EXISTS geo_entities_lgd ON geo_entities (type, lgd_code) WHERE lgd_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS geo_entities_parent ON geo_entities (parent_id);
CREATE TABLE IF NOT EXISTS geo_links (
  child_id bigint NOT NULL REFERENCES geo_entities(id) ON DELETE CASCADE,
  parent_id bigint NOT NULL REFERENCES geo_entities(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('revenue','urban','rural_lg','coverage')),
  PRIMARY KEY (child_id, parent_id, kind)
);
CREATE TABLE IF NOT EXISTS place_aliases (
  entity_id bigint NOT NULL REFERENCES geo_entities(id) ON DELETE CASCADE,
  alias text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  kind text NOT NULL DEFAULT 'spelling' CHECK (kind IN ('spelling','old_name','local')),
  PRIMARY KEY (entity_id, alias)
);

-- Discovery work ----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coverage_units (   -- one row per place that needs searching; overlaps handled here, not in geo_entities
  id bigserial PRIMARY KEY,
  entity_id bigint NOT NULL UNIQUE REFERENCES geo_entities(id),
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN
    ('NOT_STARTED','IN_PROGRESS','BLOCKED','SEARCH_COMPLETE_WITH_FINDINGS','SEARCH_COMPLETE_NO_FINDINGS','REVIEW_PENDING','REVIEW_COMPLETE')),
  tasks_planned int NOT NULL DEFAULT 0,
  tasks_ok int NOT NULL DEFAULT 0,
  second_pass_done boolean NOT NULL DEFAULT false,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS discovery_jobs (
  id bigserial PRIMARY KEY,
  job_key text NOT NULL UNIQUE,       -- unit + source/query + cursor + pipeline version => idempotent, resumable
  unit_id bigint NOT NULL REFERENCES coverage_units(id),
  pass text NOT NULL CHECK (pass IN ('A','B','C')),
  query text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','retry','failed','blocked')),
  attempts int NOT NULL DEFAULT 0,
  error text,
  document_id bigint REFERENCES documents(id),
  result_count int,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discovery_jobs_status ON discovery_jobs (status, unit_id);

-- Candidates and evidence -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS temple_candidates (
  id bigserial PRIMARY KEY,
  name_en text,
  name_ta text,
  place_id bigint REFERENCES geo_entities(id),    -- NULL = location unresolved (goes to review_queue)
  lat double precision,
  lon double precision,
  coordinate_basis text CHECK (coordinate_basis IN ('osm','wikidata','source_page','user','village_centre')),  -- village_centre is never shown as exact
  deity text,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN
    ('candidate','source_supported','corroborated','management_confirmed','conflicted','rejected')),
  temple_id text REFERENCES temples(id),          -- set when promoted to the public table
  parent_candidate_id bigint REFERENCES temple_candidates(id),  -- inner shrine of a complex; independent temples stay separate
  physical_status text NOT NULL DEFAULT 'active' CHECK (physical_status IN ('active','closed','relocated','ruined')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS temple_candidates_place ON temple_candidates (place_id);
CREATE TABLE IF NOT EXISTS candidate_external_ids (
  candidate_id bigint NOT NULL REFERENCES temple_candidates(id) ON DELETE CASCADE,
  scheme text NOT NULL CHECK (scheme IN ('osm','wikidata','hrce','lgd','other')),
  value text NOT NULL,
  PRIMARY KEY (scheme, value)
);
CREATE TABLE IF NOT EXISTS field_evidence (
  id bigserial PRIMARY KEY,
  candidate_id bigint NOT NULL REFERENCES temple_candidates(id) ON DELETE CASCADE,
  field_key text NOT NULL,            -- keys from data/field-schema.json
  value text,
  source_id bigint NOT NULL REFERENCES sources(id),
  passage text,                       -- supporting text copied from the source
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  independent_group text,             -- sources that copy each other share a group, so they count once
  conflicts_with bigint REFERENCES field_evidence(id)
);
CREATE INDEX IF NOT EXISTS field_evidence_cand ON field_evidence (candidate_id, field_key);
CREATE TABLE IF NOT EXISTS review_queue (
  id bigserial PRIMARY KEY,
  candidate_id bigint NOT NULL REFERENCES temple_candidates(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('duplicate','location_unresolved','conflict','other')),
  detail text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id)
);
