-- migrate:up
CREATE TABLE parent_invites (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id integer NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  invited_by integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz -- NULL means not used yet.
);

CREATE INDEX parent_invites_family_id_idx ON parent_invites (family_id);
CREATE INDEX parent_invites_invited_by_idx ON parent_invites (invited_by);

-- migrate:down
DROP TABLE parent_invites;