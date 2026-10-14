-- Simple admin approval for volunteer changes, with an admin switch to bypass it.
-- require_approval = false (default): volunteer changes go live at once. true: they wait as 'pending' until an admin decides.

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);
INSERT INTO settings (key, value) VALUES ('require_approval', 'false') ON CONFLICT (key) DO NOTHING;

ALTER TABLE field_values  ADD COLUMN IF NOT EXISTS approval text NOT NULL DEFAULT 'approved' CHECK (approval IN ('pending', 'approved', 'rejected'));
ALTER TABLE field_values  ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE needs_reports ADD COLUMN IF NOT EXISTS approval text NOT NULL DEFAULT 'approved' CHECK (approval IN ('pending', 'approved', 'rejected'));
ALTER TABLE needs_reports ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE notes         ADD COLUMN IF NOT EXISTS approval text NOT NULL DEFAULT 'approved' CHECK (approval IN ('pending', 'approved', 'rejected'));
ALTER TABLE notes         ADD COLUMN IF NOT EXISTS reject_reason text;

CREATE INDEX IF NOT EXISTS field_values_pending_idx  ON field_values  (created_at) WHERE approval = 'pending';
CREATE INDEX IF NOT EXISTS needs_reports_pending_idx ON needs_reports (created_at) WHERE approval = 'pending';
CREATE INDEX IF NOT EXISTS notes_pending_idx         ON notes         (created_at) WHERE approval = 'pending';
