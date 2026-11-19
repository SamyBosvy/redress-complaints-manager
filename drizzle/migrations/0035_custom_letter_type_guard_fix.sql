CREATE OR REPLACE FUNCTION public.custom_type_link_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.custom_letter_types%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.custom_type_id IS DISTINCT FROM OLD.custom_type_id OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN RAISE EXCEPTION 'Letter type cannot change'; END IF;
 END IF;
 IF NEW.custom_type_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO t FROM public.custom_letter_types WHERE id=NEW.custom_type_id AND org_id=NEW.org_id;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Custom letter type must belong to this firm'; END IF;
 IF TG_OP='INSERT' AND TG_TABLE_NAME<>'template_versions' AND t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This custom letter type is archived'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.custom_type_link_guard() FROM PUBLIC, anon, authenticated;