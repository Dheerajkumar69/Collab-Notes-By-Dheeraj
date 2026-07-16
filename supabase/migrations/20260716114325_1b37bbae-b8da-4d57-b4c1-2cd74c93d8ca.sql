
-- ============ Pass 1: Search + Notifications inbox ============

-- 1) Full-text search on notes
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.notes_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(regexp_replace(NEW.content, '<[^>]*>', ' ', 'g'), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.labels, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notes_search_vector_trigger ON public.notes;
CREATE TRIGGER notes_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, content, labels ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.notes_search_vector_update();

CREATE INDEX IF NOT EXISTS notes_search_vector_idx ON public.notes USING GIN (search_vector);

-- Backfill
UPDATE public.notes SET title = title WHERE search_vector IS NULL;

-- 2) Full-text search on messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.messages_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.message, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_search_vector_trigger ON public.messages;
CREATE TRIGGER messages_search_vector_trigger
BEFORE INSERT OR UPDATE OF message ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_search_vector_update();

CREATE INDEX IF NOT EXISTS messages_search_vector_idx ON public.messages USING GIN (search_vector);

UPDATE public.messages SET message = message WHERE search_vector IS NULL;

-- 3) Membership-aware unified search RPC
CREATE OR REPLACE FUNCTION public.search_all(q text)
RETURNS TABLE (
  kind text,
  id uuid,
  group_id uuid,
  group_name text,
  title text,
  snippet text,
  rank real,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_uid uuid := auth.uid();
  v_query tsquery;
BEGIN
  IF v_uid IS NULL OR q IS NULL OR length(trim(q)) = 0 THEN
    RETURN;
  END IF;

  -- Build a forgiving prefix query
  BEGIN
    v_query := websearch_to_tsquery('english', q);
  EXCEPTION WHEN OTHERS THEN
    v_query := plainto_tsquery('english', q);
  END;

  RETURN QUERY
  SELECT 'note'::text, n.id, n.group_id, g.name,
         n.title,
         left(regexp_replace(coalesce(n.content, ''), '<[^>]*>', ' ', 'g'), 160),
         ts_rank(n.search_vector, v_query),
         n.created_at
  FROM public.notes n
  JOIN public.groups g ON g.id = n.group_id
  WHERE (g.created_by = v_uid OR v_email = ANY(g.members))
    AND n.is_archived IS NOT TRUE
    AND n.search_vector @@ v_query
  UNION ALL
  SELECT 'message'::text, m.id, m.group_id, g.name,
         m.user_name,
         left(m.message, 160),
         ts_rank(m.search_vector, v_query),
         m.created_at
  FROM public.messages m
  JOIN public.groups g ON g.id = m.group_id
  WHERE (g.created_by = v_uid OR v_email = ANY(g.members))
    AND m.search_vector @@ v_query
  ORDER BY rank DESC, created_at DESC
  LIMIT 30;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_all(text) TO authenticated;

-- 4) Notifications grouping
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS group_key text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS count integer NOT NULL DEFAULT 1;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS notifications_recipient_key_idx
  ON public.notifications (recipient_email, group_key, is_read);

-- Trigger: coalesce identical unread notifications into one grouped row
CREATE OR REPLACE FUNCTION public.notifications_group_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
BEGIN
  IF NEW.group_key IS NULL OR NEW.group_key = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing
    FROM public.notifications
    WHERE recipient_email = NEW.recipient_email
      AND group_key = NEW.group_key
      AND is_read IS NOT TRUE
    ORDER BY updated_at DESC
    LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.notifications
      SET count = count + 1,
          message = NEW.message,
          link = COALESCE(NEW.link, link),
          updated_at = now()
      WHERE id = v_existing;
    RETURN NULL; -- skip the insert
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_group_before_insert_trg ON public.notifications;
CREATE TRIGGER notifications_group_before_insert_trg
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notifications_group_before_insert();

-- 5) Mark-all-read RPC
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_count integer;
BEGIN
  IF v_email = '' THEN
    RETURN 0;
  END IF;

  WITH upd AS (
    UPDATE public.notifications
      SET is_read = true, updated_at = now()
      WHERE recipient_email = v_email AND is_read IS NOT TRUE
      RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
