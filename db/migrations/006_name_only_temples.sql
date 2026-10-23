-- Name-only temples: a real, named temple with a state (usually a district) but no known coordinate, e.g. an entry in a state
-- endowment list or a Wikidata item without coordinates. The coordinate stays NULL; nothing is guessed or taken from a village centre.
ALTER TABLE temples ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE temples ALTER COLUMN lon DROP NOT NULL;
ALTER TABLE temples ADD COLUMN IF NOT EXISTS located boolean NOT NULL DEFAULT true;
