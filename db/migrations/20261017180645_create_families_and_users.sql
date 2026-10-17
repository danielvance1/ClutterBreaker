-- migrate:up
CREATE TABLE families (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  join_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id integer NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('parent', 'kid')),
  display_name text NOT NULL,
  email text,
  password_hash text,
  pin_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Parents sign in with email and password; kids sign in with a PIN only.
  CONSTRAINT users_credentials_match_role CHECK (
    (role = 'parent' AND email IS NOT NULL AND password_hash IS NOT NULL AND pin_hash IS NULL)
    OR
    (role = 'kid' AND pin_hash IS NOT NULL AND email IS NULL AND password_hash IS NULL)
  )
);

CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
CREATE UNIQUE INDEX users_family_display_name_lower_key ON users (family_id, lower(display_name));
CREATE INDEX users_family_id_idx ON users (family_id);

-- migrate:down
DROP TABLE users;
DROP TABLE families;
