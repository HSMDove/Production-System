CREATE TABLE IF NOT EXISTS integration_channels (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  name text NOT NULL,
  credentials jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folder_channel_mappings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id varchar NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  integration_channel_id varchar NOT NULL REFERENCES integration_channels(id) ON DELETE CASCADE,
  target_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW()
);
