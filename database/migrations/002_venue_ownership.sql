ALTER TABLE venues
  ADD COLUMN owner_id UUID REFERENCES users(id) ON DELETE RESTRICT;

CREATE INDEX venues_owner_id_idx ON venues (owner_id);