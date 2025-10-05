-- Merged migration file for remote Supabase deployment
-- Execute this file in your Supabase SQL Editor
-- Generated from all migration files in supabase/migrations/


-- ============================================
-- Migration: 20240108234540_setup.sql
-- ============================================

-- Enable HTTP extension
create extension http with schema extensions;

-- Enable vector extension
create extension vector with schema extensions;

-- Function to update modified column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now(); 
    RETURN NEW; 
END;
$$ language 'plpgsql';

-- Function to delete a message and all following messages
CREATE OR REPLACE FUNCTION delete_message_including_and_after(
    p_user_id UUID, 
    p_chat_id UUID, 
    p_sequence_number INT
)
RETURNS VOID AS $$
BEGIN
    DELETE FROM messages 
    WHERE user_id = p_user_id AND chat_id = p_chat_id AND sequence_number >= p_sequence_number;
END;
$$ LANGUAGE plpgsql;

-- Function to create duplicate messages for a new chat
CREATE OR REPLACE FUNCTION create_duplicate_messages_for_new_chat(old_chat_id UUID, new_chat_id UUID, new_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO messages (user_id, chat_id, content, role, model, sequence_number, tokens, created_at, updated_at)
    SELECT new_user_id, new_chat_id, content, role, model, sequence_number, tokens, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM messages
    WHERE chat_id = old_chat_id;
END;
$$ LANGUAGE plpgsql;

-- Policy to allow users to read their own files
CREATE POLICY "Allow users to read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (auth.uid()::text = owner_id::text);

-- Function to delete a storage object
CREATE OR REPLACE FUNCTION delete_storage_object(bucket TEXT, object TEXT, OUT status INT, OUT content TEXT)
RETURNS RECORD
LANGUAGE 'plpgsql'
SECURITY DEFINER
AS $$
DECLARE
  project_url TEXT := 'https://hqgmocxaxslkuqvshasv.supabase.co';
  service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxZ21vY3hheHNsa3VxdnNoYXN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTYzNDg0MiwiZXhwIjoyMDc1MjEwODQyfQ.STmA5kW-I0zXd62ccLkoKIRpxGLbhZOwbQyGs316H3M'; -- full access needed for http request to storage
  url TEXT := project_url || '/storage/v1/object/' || bucket || '/' || object;
BEGIN
  SELECT
      INTO status, content
           result.status::INT, result.content::TEXT
      FROM extensions.http((
    'DELETE',
    url,
    ARRAY[extensions.http_header('authorization','Bearer ' || service_role_key)],
    NULL,
    NULL)::extensions.http_request) AS result;
END;
$$;

-- Function to delete a storage object from a bucket
CREATE OR REPLACE FUNCTION delete_storage_object_from_bucket(bucket_name TEXT, object_path TEXT, OUT status INT, OUT content TEXT)
RETURNS RECORD
LANGUAGE 'plpgsql'
SECURITY DEFINER
AS $$
BEGIN
  SELECT
      INTO status, content
           result.status, result.content
      FROM public.delete_storage_object(bucket_name, object_path) AS result;
END;
$$;
-- ============================================
-- Migration: 20240108234541_add_profiles.sql
-- ============================================

--------------- PROFILES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS profiles (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- RELATIONSHIPS
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    -- REQUIRED
    bio TEXT NOT NULL CHECK (char_length(bio) <= 500),
    has_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    image_url TEXT NOT NULL CHECK (char_length(image_url) <= 1000), -- public file url in profile_images bucket
    image_path TEXT NOT NULL CHECK (char_length(image_path) <= 1000), -- file path in profile_images bucket
    profile_context TEXT NOT NULL CHECK (char_length(profile_context) <= 1500),
    display_name TEXT NOT NULL CHECK (char_length(display_name) <= 100),
    use_azure_openai BOOLEAN NOT NULL,
    username TEXT NOT NULL UNIQUE CHECK (char_length(username) >= 3 AND char_length(username) <= 25),

    -- OPTIONAL
    anthropic_api_key TEXT CHECK (char_length(anthropic_api_key) <= 1000),
    azure_openai_35_turbo_id TEXT CHECK (char_length(azure_openai_35_turbo_id) <= 1000),
    azure_openai_45_turbo_id TEXT CHECK (char_length(azure_openai_45_turbo_id) <= 1000),
    azure_openai_45_vision_id TEXT CHECK (char_length(azure_openai_45_vision_id) <= 1000),
    azure_openai_api_key TEXT CHECK (char_length(azure_openai_api_key) <= 1000),
    azure_openai_endpoint TEXT CHECK (char_length(azure_openai_endpoint) <= 1000),
    google_gemini_api_key TEXT CHECK (char_length(google_gemini_api_key) <= 1000),
    mistral_api_key TEXT CHECK (char_length(mistral_api_key) <= 1000),
    openai_api_key TEXT CHECK (char_length(openai_api_key) <= 1000),
    openai_organization_id TEXT CHECK (char_length(openai_organization_id) <= 1000),
    perplexity_api_key TEXT CHECK (char_length(perplexity_api_key) <= 1000)
);

-- INDEXES --

CREATE INDEX idx_profiles_user_id ON profiles (user_id);

-- RLS --

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own profiles"
    ON profiles
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- FUNCTIONS --

CREATE OR REPLACE FUNCTION delete_old_profile_image()
RETURNS TRIGGER
LANGUAGE 'plpgsql'
SECURITY DEFINER
AS $$
DECLARE
  status INT;
  content TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT
      INTO status, content
      result.status, result.content
      FROM public.delete_storage_object_from_bucket('profile_images', OLD.image_path) AS result;
    IF status <> 200 THEN
      RAISE WARNING 'Could not delete profile image: % %', status, content;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- TRIGGERS --

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE FUNCTION create_profile_and_workspace() 
RETURNS TRIGGER
security definer set search_path = public
AS $$
DECLARE
    random_username TEXT;
BEGIN
    -- Generate a random username
    random_username := 'user' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

    -- Create a profile for the new user
    INSERT INTO public.profiles(user_id, anthropic_api_key, azure_openai_35_turbo_id, azure_openai_45_turbo_id, azure_openai_45_vision_id, azure_openai_api_key, azure_openai_endpoint, google_gemini_api_key, has_onboarded, image_url, image_path, mistral_api_key, display_name, bio, openai_api_key, openai_organization_id, perplexity_api_key, profile_context, use_azure_openai, username)
    VALUES(
        NEW.id,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        FALSE,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        FALSE,
        random_username
    );

    -- Create the home workspace for the new user
    INSERT INTO public.workspaces(user_id, is_home, name, default_context_length, default_model, default_prompt, default_temperature, description, embeddings_provider, include_profile_context, include_workspace_instructions, instructions)
    VALUES(
        NEW.id,
        TRUE,
        'Home',
        4096,
        'gpt-4-1106-preview',
        'You are a friendly, helpful AI assistant.',
        0.5,
        'My home workspace.',
        'openai',
        TRUE,
        TRUE,
        ''
    );

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_profile_and_workspace_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.create_profile_and_workspace();

CREATE TRIGGER delete_old_profile_image
AFTER DELETE ON profiles
FOR EACH ROW
EXECUTE PROCEDURE delete_old_profile_image();

-- STORAGE --

INSERT INTO storage.buckets (id, name, public) VALUES ('profile_images', 'profile_images', true);

CREATE POLICY "Allow public read access on profile images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile_images');

CREATE POLICY "Allow authenticated insert access to own profile images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'profile_images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow authenticated update access to own profile images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'profile_images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow authenticated delete access to own profile images"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'profile_images' AND (storage.foldername(name))[1] = auth.uid()::text);
-- ============================================
-- Migration: 20240108234542_add_workspaces.sql
-- ============================================

--------------- WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS workspaces (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    -- SHARING
    sharing TEXT NOT NULL DEFAULT 'private',

    -- REQUIRED
    default_context_length INTEGER NOT NULL,
    default_model TEXT NOT NULL CHECK (char_length(default_model) <= 1000),
    default_prompt TEXT NOT NULL CHECK (char_length(default_prompt) <= 100000),
    default_temperature REAL NOT NULL,
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    embeddings_provider TEXT NOT NULL CHECK (char_length(embeddings_provider) <= 1000),
    include_profile_context BOOLEAN NOT NULL,
    include_workspace_instructions BOOLEAN NOT NULL,
    instructions TEXT NOT NULL CHECK (char_length(instructions) <= 1500),
    is_home BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT NOT NULL CHECK (char_length(name) <= 100)
);

-- INDEXES --

CREATE INDEX idx_workspaces_user_id ON workspaces (user_id);

-- RLS --

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own workspaces"
    ON workspaces
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to non-private workspaces"
    ON workspaces
    FOR SELECT
    USING (sharing <> 'private');

-- FUNCTIONS --

CREATE OR REPLACE FUNCTION prevent_home_field_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_home IS DISTINCT FROM OLD.is_home THEN
    RAISE EXCEPTION 'Updating the home field of workspace is not allowed.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS --

CREATE TRIGGER update_workspaces_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE FUNCTION prevent_home_workspace_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_home THEN
    RAISE EXCEPTION 'Home workspace deletion is not allowed.';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_update_of_home_field
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE PROCEDURE prevent_home_field_update();

-- INDEXES --

CREATE UNIQUE INDEX idx_unique_home_workspace_per_user 
ON workspaces(user_id) 
WHERE is_home;
-- ============================================
-- Migration: 20240108234543_add_folders.sql
-- ============================================

--------------- FOLDERS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS folders (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    -- REQUIRED
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL
);

-- INDEXES --

CREATE INDEX folders_user_id_idx ON folders(user_id);
CREATE INDEX folders_workspace_id_idx ON folders(workspace_id);

-- RLS --

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own folders"
    ON folders
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_folders_updated_at
BEFORE UPDATE ON folders
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
-- ============================================
-- Migration: 20240108234544_add_files.sql
-- ============================================

--------------- FILES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS files (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- OPTIONAL RELATIONSHIPS
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    -- SHARING
    sharing TEXT NOT NULL DEFAULT 'private',

    -- REQUIRED
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    file_path TEXT NOT NULL CHECK (char_length(file_path) <= 1000),
    name TEXT NOT NULL CHECK (char_length(name) <= 100),
    size INT NOT NULL,
    tokens INT NOT NULL,
    type TEXT NOT NULL CHECK (char_length(type) <= 100)
);

-- INDEXES --

CREATE INDEX files_user_id_idx ON files(user_id);

-- RLS --

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own files"
    ON files
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to non-private files"
    ON files
    FOR SELECT
    USING (sharing <> 'private');

-- FUNCTIONS --

CREATE OR REPLACE FUNCTION delete_old_file()
RETURNS TRIGGER
LANGUAGE 'plpgsql'
SECURITY DEFINER
AS $$
DECLARE
  status INT;
  content TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT
      INTO status, content
      result.status, result.content
      FROM public.delete_storage_object_from_bucket('files', OLD.file_path) AS result;
    IF status <> 200 THEN
      RAISE WARNING 'Could not delete file: % %', status, content;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- TRIGGERS --

CREATE TRIGGER update_files_updated_at
BEFORE UPDATE ON files
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER delete_old_file
BEFORE DELETE ON files
FOR EACH ROW
EXECUTE PROCEDURE delete_old_file();

-- STORAGE --

INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', false);

CREATE OR REPLACE FUNCTION public.non_private_file_exists(p_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM files
        WHERE (id::text = (storage.foldername(p_name))[2]) AND sharing <> 'private'
    );
$$;

CREATE POLICY "Allow public read access on non-private files"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'files' AND public.non_private_file_exists(name));

CREATE POLICY "Allow authenticated insert access to own file"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow authenticated update access to own file"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow authenticated delete access to own file"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

--------------- FILE WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS file_workspaces (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    PRIMARY KEY(file_id, workspace_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX file_workspaces_user_id_idx ON file_workspaces(user_id);
CREATE INDEX file_workspaces_file_id_idx ON file_workspaces(file_id);
CREATE INDEX file_workspaces_workspace_id_idx ON file_workspaces(workspace_id);

-- RLS --

ALTER TABLE file_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own file_workspaces"
    ON file_workspaces
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_file_workspaces_updated_at
BEFORE UPDATE ON file_workspaces 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();
-- ============================================
-- Migration: 20240108234545_add_file_items.sql
-- ============================================

--------------- FILE ITEMS ---------------

create table file_items (
  -- ID
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- RELATIONSHIPS
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- METADATA
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ,

  -- SHARING
  sharing TEXT NOT NULL DEFAULT 'private',

  -- REQUIRED
  content TEXT NOT NULL,
  local_embedding vector(384), -- 384 works for local w/ Xenova/all-MiniLM-L6-v2
  openai_embedding vector(1536), -- 1536 for OpenAI
  tokens INT NOT NULL
);

-- INDEXES --

CREATE INDEX file_items_file_id_idx ON file_items(file_id);

CREATE INDEX file_items_embedding_idx ON file_items
  USING hnsw (openai_embedding vector_cosine_ops);

CREATE INDEX file_items_local_embedding_idx ON file_items
  USING hnsw (local_embedding vector_cosine_ops);

-- RLS

ALTER TABLE file_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own file items"
    ON file_items
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to non-private file items"
    ON file_items
    FOR SELECT
    USING (file_id IN (
        SELECT id FROM files WHERE sharing <> 'private'
    ));

-- TRIGGERS --

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON file_items
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- FUNCTIONS --

create function match_file_items_local (
  query_embedding vector(384),
  match_count int DEFAULT null,
  file_ids UUID[] DEFAULT null
) returns table (
  id UUID,
  file_id UUID,
  content TEXT,
  tokens INT,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    file_id,
    content,
    tokens,
    1 - (file_items.local_embedding <=> query_embedding) as similarity
  from file_items
  where (file_id = ANY(file_ids))
  order by file_items.local_embedding <=> query_embedding
  limit match_count;
end;
$$;

create function match_file_items_openai (
  query_embedding vector(1536),
  match_count int DEFAULT null,
  file_ids UUID[] DEFAULT null
) returns table (
  id UUID,
  file_id UUID,
  content TEXT,
  tokens INT,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    file_id,
    content,
    tokens,
    1 - (file_items.openai_embedding <=> query_embedding) as similarity
  from file_items
  where (file_id = ANY(file_ids))
  order by file_items.openai_embedding <=> query_embedding
  limit match_count;
end;
$$;
-- ============================================
-- Migration: 20240108234546_add_presets.sql
-- ============================================

--------------- PRESETS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS presets (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- OPTIONAL RELATIONSHIPS
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    -- SHARING
    sharing TEXT NOT NULL DEFAULT 'private',

    -- REQUIRED
    context_length INT NOT NULL,
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    embeddings_provider TEXT NOT NULL CHECK (char_length(embeddings_provider) <= 1000),
    include_profile_context BOOLEAN NOT NULL,
    include_workspace_instructions BOOLEAN NOT NULL,
    model TEXT NOT NULL CHECK (char_length(model) <= 1000),
    name TEXT NOT NULL CHECK (char_length(name) <= 100),
    prompt TEXT NOT NULL CHECK (char_length(prompt) <= 100000),
    temperature REAL NOT NULL
);

-- INDEXES --

CREATE INDEX presets_user_id_idx ON presets(user_id);

-- RLS --

ALTER TABLE presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own presets"
    ON presets
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to non-private presets"
    ON presets
    FOR SELECT
    USING (sharing <> 'private');

-- TRIGGERS --

CREATE TRIGGER update_presets_updated_at
BEFORE UPDATE ON presets 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();

--------------- PRESET WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS preset_workspaces (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    PRIMARY KEY(preset_id, workspace_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX preset_workspaces_user_id_idx ON preset_workspaces(user_id);
CREATE INDEX preset_workspaces_preset_id_idx ON preset_workspaces(preset_id);
CREATE INDEX preset_workspaces_workspace_id_idx ON preset_workspaces(workspace_id);

-- RLS --

ALTER TABLE preset_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own preset_workspaces"
    ON preset_workspaces
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_preset_workspaces_updated_at
BEFORE UPDATE ON preset_workspaces 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- Migration: 20240108234547_add_assistants.sql
-- ============================================

--------------- ASSISTANTS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS assistants (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- OPTIONAL RELATIONSHIPS
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

     --SHARING
    sharing TEXT NOT NULL DEFAULT 'private',

    -- REQUIRED
    context_length INT NOT NULL,
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    embeddings_provider TEXT NOT NULL CHECK (char_length(embeddings_provider) <= 1000),
    include_profile_context BOOLEAN NOT NULL,
    include_workspace_instructions BOOLEAN NOT NULL,
    model TEXT NOT NULL CHECK (char_length(model) <= 1000),
    name TEXT NOT NULL CHECK (char_length(name) <= 100),
    image_path TEXT NOT NULL CHECK (char_length(image_path) <= 1000), -- file path in assistant_images bucket
    prompt TEXT NOT NULL CHECK (char_length(prompt) <= 100000),
    temperature REAL NOT NULL
);

-- INDEXES --

CREATE INDEX assistants_user_id_idx ON assistants(user_id);

-- RLS --

ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own assistants"
    ON assistants
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to non-private assistants"
    ON assistants
    FOR SELECT
    USING (sharing <> 'private');

-- FUNCTIONS --

CREATE OR REPLACE FUNCTION delete_old_assistant_image()
RETURNS TRIGGER
LANGUAGE 'plpgsql'
SECURITY DEFINER
AS $$
DECLARE
  status INT;
  content TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT
      INTO status, content
      result.status, result.content
      FROM public.delete_storage_object_from_bucket('assistant_images', OLD.image_path) AS result;
    IF status <> 200 THEN
      RAISE WARNING 'Could not delete assistant image: % %', status, content;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- TRIGGERS --

CREATE TRIGGER update_assistants_updated_at
BEFORE UPDATE ON assistants
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER delete_old_assistant_image
AFTER DELETE ON assistants
FOR EACH ROW
EXECUTE PROCEDURE delete_old_assistant_image();

-- STORAGE --

INSERT INTO storage.buckets (id, name, public) VALUES ('assistant_images', 'assistant_images', false);

CREATE OR REPLACE FUNCTION public.non_private_assistant_exists(p_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM assistants
        WHERE (id::text = (storage.filename(p_name))) AND sharing <> 'private'
    );
$$;

CREATE POLICY "Allow public read access on non-private assistant images"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'assistant_images' AND public.non_private_assistant_exists(name));

CREATE POLICY "Allow insert access to own assistant images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'assistant_images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow update access to own assistant images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'assistant_images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow delete access to own assistant images"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'assistant_images' AND (storage.foldername(name))[1] = auth.uid()::text);

--------------- ASSISTANT WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS assistant_workspaces (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    PRIMARY KEY(assistant_id, workspace_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX assistant_workspaces_user_id_idx ON assistant_workspaces(user_id);
CREATE INDEX assistant_workspaces_assistant_id_idx ON assistant_workspaces(assistant_id);
CREATE INDEX assistant_workspaces_workspace_id_idx ON assistant_workspaces(workspace_id);

-- RLS --

ALTER TABLE assistant_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own assistant_workspaces"
    ON assistant_workspaces
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_assistant_workspaces_updated_at
BEFORE UPDATE ON assistant_workspaces 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- Migration: 20240108234548_add_chats.sql
-- ============================================

--------------- CHATS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS chats (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- OPTIONAL RELATIONSHIPS
    assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    -- SHARING
    sharing TEXT NOT NULL DEFAULT 'private',

    -- REQUIRED
    context_length INT NOT NULL,
    embeddings_provider TEXT NOT NULL CHECK (char_length(embeddings_provider) <= 1000),
    include_profile_context BOOLEAN NOT NULL,
    include_workspace_instructions BOOLEAN NOT NULL,
    model TEXT NOT NULL CHECK (char_length(model) <= 1000),
    name TEXT NOT NULL CHECK (char_length(name) <= 200),
    prompt TEXT NOT NULL CHECK (char_length(prompt) <= 100000),
    temperature REAL NOT NULL
);

-- INDEXES --

CREATE INDEX idx_chats_user_id ON chats (user_id);
CREATE INDEX idx_chats_workspace_id ON chats (workspace_id);

-- RLS --

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own chats"
    ON chats
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to non-private chats"
    ON chats
    FOR SELECT
    USING (sharing <> 'private');

-- TRIGGERS --

CREATE TRIGGER update_chats_updated_at
BEFORE UPDATE ON chats 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();

--------------- CHAT FILES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS chat_files (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,

    PRIMARY KEY(chat_id, file_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX idx_chat_files_chat_id ON chat_files (chat_id);

-- RLS --

ALTER TABLE chat_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own chat_files"
    ON chat_files
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_chat_files_updated_at
BEFORE UPDATE ON chat_files 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();
-- ============================================
-- Migration: 20240108234549_add_messages.sql
-- ============================================

--------------- MESSAGES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS messages (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- RELATIONSHIPS
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    -- REQUIRED
    content TEXT NOT NULL CHECK (char_length(content) <= 1000000),
    image_paths TEXT[] NOT NULL, -- file paths in message_images bucket
    model TEXT NOT NULL CHECK (char_length(model) <= 1000),
    role TEXT NOT NULL CHECK (char_length(role) <= 1000),
    sequence_number INT NOT NULL,

    -- CONSTRAINTS
    CONSTRAINT check_image_paths_length CHECK (array_length(image_paths, 1) <= 16)
);

-- INDEXES --

CREATE INDEX idx_messages_chat_id ON messages (chat_id);

-- RLS --

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own messages"
    ON messages
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to messages for non-private chats"
    ON messages
    FOR SELECT
    USING (chat_id IN (
        SELECT id FROM chats WHERE sharing <> 'private'
    ));

-- FUNCTIONS --

CREATE OR REPLACE FUNCTION delete_old_message_images()
RETURNS TRIGGER
LANGUAGE 'plpgsql'
SECURITY DEFINER
AS $$
DECLARE
  status INT;
  content TEXT;
  image_path TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    FOREACH image_path IN ARRAY OLD.image_paths
    LOOP
      SELECT
        INTO status, content
        result.status, result.content
        FROM public.delete_storage_object_from_bucket('message_images', image_path) AS result;
      IF status <> 200 THEN
        RAISE WARNING 'Could not delete message image: % %', status, content;
      END IF;
    END LOOP;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION delete_messages_including_and_after(
    p_user_id UUID, 
    p_chat_id UUID, 
    p_sequence_number INT
)
RETURNS VOID AS $$
BEGIN
    DELETE FROM messages 
    WHERE user_id = p_user_id AND chat_id = p_chat_id AND sequence_number >= p_sequence_number;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS --

CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER delete_old_message_images
AFTER DELETE ON messages
FOR EACH ROW
EXECUTE PROCEDURE delete_old_message_images();

-- STORAGE --

-- MESSAGE IMAGES

INSERT INTO storage.buckets (id, name, public) VALUES ('message_images', 'message_images', false);

CREATE POLICY "Allow read access to own message images"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'message_images' AND 
        (
            (storage.foldername(name))[1] = auth.uid()::text OR
            (
                EXISTS (
                    SELECT 1 FROM chats 
                    WHERE id = (
                        SELECT chat_id FROM messages WHERE id = (storage.foldername(name))[2]::uuid
                    ) AND sharing <> 'private'
                )
            )
        )
    );

CREATE POLICY "Allow insert access to own message images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'message_images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow update access to own message images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'message_images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow delete access to own message images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'message_images' AND (storage.foldername(name))[1] = auth.uid()::text);

--------------- MESSAGE FILE ITEMS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS message_file_items (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_item_id UUID NOT NULL REFERENCES file_items(id) ON DELETE CASCADE,

    PRIMARY KEY(message_id, file_item_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX idx_message_file_items_message_id ON message_file_items (message_id);

-- RLS --

ALTER TABLE message_file_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own message_file_items"
    ON message_file_items
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_message_file_items_updated_at
BEFORE UPDATE ON message_file_items 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();
-- ============================================
-- Migration: 20240108234550_add_prompts.sql
-- ============================================

--------------- PROMPTS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS prompts (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- OPTIONAL RELATIONSHIPS
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    -- SHARING
    sharing TEXT NOT NULL DEFAULT 'private',

    -- REQUIRED
    content TEXT NOT NULL CHECK (char_length(content) <= 100000),
    name TEXT NOT NULL CHECK (char_length(name) <= 100)
);

-- INDEXES --

CREATE INDEX prompts_user_id_idx ON prompts(user_id);

-- RLS --

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own prompts"
    ON prompts
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to non-private prompts"
    ON prompts
    FOR SELECT
    USING (sharing <> 'private');

-- TRIGGERS --

CREATE TRIGGER update_prompts_updated_at
BEFORE UPDATE ON prompts
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

--------------- PROMPT WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS prompt_workspaces (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    PRIMARY KEY(prompt_id, workspace_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX prompt_workspaces_user_id_idx ON prompt_workspaces(user_id);
CREATE INDEX prompt_workspaces_prompt_id_idx ON prompt_workspaces(prompt_id);
CREATE INDEX prompt_workspaces_workspace_id_idx ON prompt_workspaces(workspace_id);

-- RLS --

ALTER TABLE prompt_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own prompt_workspaces"
    ON prompt_workspaces
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_prompt_workspaces_updated_at
BEFORE UPDATE ON prompt_workspaces 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- Migration: 20240108234551_add_collections.sql
-- ============================================

--------------- COLLECTIONS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS collections (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- OPTIONAL RELATIONSHIPS
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    -- SHARING
    sharing TEXT NOT NULL DEFAULT 'private',

    -- REQUIRED
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    name TEXT NOT NULL CHECK (char_length(name) <= 100)
);

-- INDEXES --

CREATE INDEX collections_user_id_idx ON collections(user_id);

-- RLS --

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own collections"
    ON collections
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to non-private collections"
    ON collections
    FOR SELECT
    USING (sharing <> 'private');

-- TRIGGERS --

CREATE TRIGGER update_collections_updated_at
BEFORE UPDATE ON collections
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

--------------- COLLECTION WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS collection_workspaces (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    PRIMARY KEY(collection_id, workspace_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX collection_workspaces_user_id_idx ON collection_workspaces(user_id);
CREATE INDEX collection_workspaces_collection_id_idx ON collection_workspaces(collection_id);
CREATE INDEX collection_workspaces_workspace_id_idx ON collection_workspaces(workspace_id);

-- RLS --

ALTER TABLE collection_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own collection_workspaces"
    ON collection_workspaces
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_collection_workspaces_updated_at
BEFORE UPDATE ON collection_workspaces 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();

--------------- COLLECTION FILES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS collection_files (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,

    PRIMARY KEY(collection_id, file_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX idx_collection_files_collection_id ON collection_files (collection_id);
CREATE INDEX idx_collection_files_file_id ON collection_files (file_id);

-- RLS --

ALTER TABLE collection_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own collection_files"
    ON collection_files
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to collection files for non-private collections"
    ON collection_files
    FOR SELECT
    USING (collection_id IN (
        SELECT id FROM collections WHERE sharing <> 'private'
    ));

-- TRIGGERS --

CREATE TRIGGER update_collection_files_updated_at
BEFORE UPDATE ON collection_files 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();

--------------- REFERS BACK TO FILES ---------------

CREATE POLICY "Allow view access to files for non-private collections"
    ON files
    FOR SELECT
    USING (id IN (
        SELECT file_id FROM collection_files WHERE collection_id IN (
            SELECT id FROM collections WHERE sharing <> 'private'
        )
    ));
-- ============================================
-- Migration: 20240115135033_add_openrouter.sql
-- ============================================

ALTER TABLE profiles
ADD COLUMN openrouter_api_key TEXT CHECK (char_length(openrouter_api_key) <= 1000);

-- ============================================
-- Migration: 20240115171510_add_assistant_files.sql
-- ============================================

--------------- ASSISTANT FILES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS assistant_files (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,

    PRIMARY KEY(assistant_id, file_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX assistant_files_user_id_idx ON assistant_files(user_id);
CREATE INDEX assistant_files_assistant_id_idx ON assistant_files(assistant_id);
CREATE INDEX assistant_files_file_id_idx ON assistant_files(file_id);

-- RLS --

ALTER TABLE assistant_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own assistant_files"
    ON assistant_files
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_assistant_files_updated_at
BEFORE UPDATE ON assistant_files 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();

--------------- ASSISTANT COLLECTIONS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS assistant_collections (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,

    PRIMARY KEY(assistant_id, collection_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX assistant_collections_user_id_idx ON assistant_collections(user_id);
CREATE INDEX assistant_collections_assistant_id_idx ON assistant_collections(assistant_id);
CREATE INDEX assistant_collections_collection_id_idx ON assistant_collections(collection_id);

-- RLS --

ALTER TABLE assistant_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own assistant_collections"
    ON assistant_collections
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_assistant_collections_updated_at
BEFORE UPDATE ON assistant_collections 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();
-- ============================================
-- Migration: 20240115171524_add_tools.sql
-- ============================================

--------------- TOOLS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS tools (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- OPTIONAL RELATIONSHIPS
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

     --SHARING
    sharing TEXT NOT NULL DEFAULT 'private',

    -- REQUIRED
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    name TEXT NOT NULL CHECK (char_length(name) <= 100),
    schema JSONB NOT NULL,
    url TEXT NOT NULL CHECK (char_length(url) <= 1000)
);

-- INDEXES --

CREATE INDEX tools_user_id_idx ON tools(user_id);

-- RLS --

ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own tools"
    ON tools
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to non-private tools"
    ON tools
    FOR SELECT
    USING (sharing <> 'private');

-- TRIGGERS --

CREATE TRIGGER update_tools_updated_at
BEFORE UPDATE ON tools
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

--------------- TOOL WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS tool_workspaces (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    PRIMARY KEY(tool_id, workspace_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX tool_workspaces_user_id_idx ON tool_workspaces(user_id);
CREATE INDEX tool_workspaces_tool_id_idx ON tool_workspaces(tool_id);
CREATE INDEX tool_workspaces_workspace_id_idx ON tool_workspaces(workspace_id);

-- RLS --

ALTER TABLE tool_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own tool_workspaces"
    ON tool_workspaces
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_tool_workspaces_updated_at
BEFORE UPDATE ON tool_workspaces 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();
-- ============================================
-- Migration: 20240115172125_add_assistant_tools.sql
-- ============================================

--------------- ASSISTANT TOOLS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS assistant_tools (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,

    PRIMARY KEY(assistant_id, tool_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX assistant_tools_user_id_idx ON assistant_tools(user_id);
CREATE INDEX assistant_tools_assistant_id_idx ON assistant_tools(assistant_id);
CREATE INDEX assistant_tools_tool_id_idx ON assistant_tools(tool_id);

-- RLS --

ALTER TABLE assistant_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own assistant_tools"
    ON assistant_tools
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_assistant_tools_updated_at
BEFORE UPDATE ON assistant_tools 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();
-- ============================================
-- Migration: 20240118224049_add_azure_embeddings.sql
-- ============================================

ALTER TABLE profiles
ADD COLUMN azure_openai_embeddings_id TEXT CHECK (char_length(azure_openai_embeddings_id) <= 1000);

-- ============================================
-- Migration: 20240124234424_tool_improvements.sql
-- ============================================

ALTER TABLE tools
ADD COLUMN custom_headers JSONB NOT NULL DEFAULT '{}',
ADD COLUMN request_in_body BOOLEAN NOT NULL DEFAULT TRUE,
ALTER COLUMN schema SET DEFAULT '{}';

-- ============================================
-- Migration: 20240125192042_upgrade_openai_models.sql
-- ============================================

-- WORKSPACES

UPDATE workspaces
SET default_model = 'gpt-4-turbo-preview'
WHERE default_model = 'gpt-4-1106-preview';

UPDATE workspaces
SET default_model = 'gpt-3.5-turbo'
WHERE default_model = 'gpt-3.5-turbo-1106';

-- PRESETS

UPDATE presets
SET model = 'gpt-4-turbo-preview'
WHERE model = 'gpt-4-1106-preview';

UPDATE presets
SET model = 'gpt-3.5-turbo'
WHERE model = 'gpt-3.5-turbo-1106';

-- ASSISTANTS

UPDATE assistants
SET model = 'gpt-4-turbo-preview'
WHERE model = 'gpt-4-1106-preview';

UPDATE assistants
SET model = 'gpt-3.5-turbo'
WHERE model = 'gpt-3.5-turbo-1106';

-- CHATS

UPDATE chats
SET model = 'gpt-4-turbo-preview'
WHERE model = 'gpt-4-1106-preview';

UPDATE chats
SET model = 'gpt-3.5-turbo'
WHERE model = 'gpt-3.5-turbo-1106';

-- MESSAGES

UPDATE messages
SET model = 'gpt-4-turbo-preview'
WHERE model = 'gpt-4-1106-preview';

UPDATE messages
SET model = 'gpt-3.5-turbo'
WHERE model = 'gpt-3.5-turbo-1106';

-- PROFILES

CREATE OR REPLACE FUNCTION create_profile_and_workspace() 
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    random_username TEXT;
BEGIN
    -- Generate a random username
    random_username := 'user' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

    -- Create a profile for the new user
    INSERT INTO public.profiles(user_id, anthropic_api_key, azure_openai_35_turbo_id, azure_openai_45_turbo_id, azure_openai_45_vision_id, azure_openai_api_key, azure_openai_endpoint, google_gemini_api_key, has_onboarded, image_url, image_path, mistral_api_key, display_name, bio, openai_api_key, openai_organization_id, perplexity_api_key, profile_context, use_azure_openai, username)
    VALUES(
        NEW.id,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        FALSE,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        FALSE,
        random_username
    );

    INSERT INTO public.workspaces(user_id, is_home, name, default_context_length, default_model, default_prompt, default_temperature, description, embeddings_provider, include_profile_context, include_workspace_instructions, instructions)
    VALUES(
        NEW.id,
        TRUE,
        'Home',
        4096,
        'gpt-4-turbo-preview', -- Updated default model
        'You are a friendly, helpful AI assistant.',
        0.5,
        'My home workspace.',
        'openai',
        TRUE,
        TRUE,
        ''
    );

    RETURN NEW;
END;
$$;

-- ============================================
-- Migration: 20240125194719_add_custom_models.sql
-- ============================================

--------------- MODELS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS models (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- OPTIONAL RELATIONSHIPS
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    -- SHARING
    sharing TEXT NOT NULL DEFAULT 'private',

    -- REQUIRED
    api_key TEXT NOT NULL CHECK (char_length(api_key) <= 1000),
    base_url TEXT NOT NULL CHECK (char_length(base_url) <= 1000),
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    model_id TEXT NOT NULL CHECK (char_length(model_id) <= 1000),
    name TEXT NOT NULL CHECK (char_length(name) <= 100)
);

-- INDEXES --

CREATE INDEX models_user_id_idx ON models(user_id);

-- RLS --

ALTER TABLE models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own models"
    ON models
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow view access to non-private models"
    ON models
    FOR SELECT
    USING (sharing <> 'private');

-- TRIGGERS --

CREATE TRIGGER update_models_updated_at
BEFORE UPDATE ON models 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();

--------------- MODEL WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS model_workspaces (
    -- REQUIRED RELATIONSHIPS
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    PRIMARY KEY(model_id, workspace_id),

    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES --

CREATE INDEX model_workspaces_user_id_idx ON model_workspaces(user_id);
CREATE INDEX model_workspaces_model_id_idx ON model_workspaces(model_id);
CREATE INDEX model_workspaces_workspace_id_idx ON model_workspaces(workspace_id);

-- RLS --

ALTER TABLE model_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to own model_workspaces"
    ON model_workspaces
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRIGGERS --

CREATE TRIGGER update_model_workspaces_updated_at
BEFORE UPDATE ON model_workspaces 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- Migration: 20240129232644_add_workspace_images.sql
-- ============================================

-- ALTER TABLE --

ALTER TABLE workspaces
ADD COLUMN image_path TEXT DEFAULT '' NOT NULL CHECK (char_length(image_path) <= 1000);

-- STORAGE --

INSERT INTO storage.buckets (id, name, public) VALUES ('workspace_images', 'workspace_images', false);

-- FUNCTIONS --

CREATE OR REPLACE FUNCTION delete_old_workspace_image()
RETURNS TRIGGER
LANGUAGE 'plpgsql'
SECURITY DEFINER
AS $$
DECLARE
  status INT;
  content TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT
      INTO status, content
      result.status, result.content
      FROM public.delete_storage_object_from_bucket('workspace_images', OLD.image_path) AS result;
    IF status <> 200 THEN
      RAISE WARNING 'Could not delete workspace image: % %', status, content;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- TRIGGERS --

CREATE TRIGGER delete_old_workspace_image
AFTER DELETE ON workspaces
FOR EACH ROW
EXECUTE PROCEDURE delete_old_workspace_image();

-- POLICIES --

CREATE OR REPLACE FUNCTION public.non_private_workspace_exists(p_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM workspaces
        WHERE (id::text = (storage.filename(p_name))) AND sharing <> 'private'
    );
$$;

CREATE POLICY "Allow public read access on non-private workspace images"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'workspace_images' AND public.non_private_workspace_exists(name));

CREATE POLICY "Allow insert access to own workspace images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'workspace_images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow update access to own workspace images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'workspace_images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow delete access to own workspace images"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'workspace_images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- Migration: 20240212063532_add_at_assistants.sql
-- ============================================

ALTER TABLE messages ADD COLUMN assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE DEFAULT NULL;

-- ============================================
-- Migration: 20240213040255_remove_request_in_body_from_tools.sql
-- ============================================

ALTER TABLE tools
DROP COLUMN request_in_body;

-- ============================================
-- Migration: 20240213085646_add_context_length_to_custom_models.sql
-- ============================================

ALTER TABLE models ADD COLUMN context_length INT NOT NULL DEFAULT 4096;
-- ============================================
-- Migration: 20240302004845_add_groq.sql
-- ============================================

ALTER TABLE profiles ADD COLUMN groq_api_key TEXT CHECK (char_length(groq_api_key) <= 1000);
