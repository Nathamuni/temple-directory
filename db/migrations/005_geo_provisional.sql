-- Provisional locations (e.g. from OpenStreetMap) are marked so they can be reconciled with official LGD files later
-- without losing collected data: temples point at geo_entities.id, which stays stable; LGD codes are filled in afterwards.
ALTER TABLE geo_entities ADD COLUMN IF NOT EXISTS basis text NOT NULL DEFAULT 'official' CHECK (basis IN ('official','provisional_osm'));
ALTER TABLE geo_entities ADD COLUMN IF NOT EXISTS osm_id text;
ALTER TABLE geo_entities ADD COLUMN IF NOT EXISTS place_kind text;      -- the source's own label, e.g. OSM place=village
ALTER TABLE geo_entities ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE geo_entities ADD COLUMN IF NOT EXISTS lon double precision;
CREATE UNIQUE INDEX IF NOT EXISTS geo_entities_osm ON geo_entities (osm_id) WHERE osm_id IS NOT NULL;
