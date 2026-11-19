ALTER TYPE public.template_kind ADD VALUE IF NOT EXISTS 'custom';
--> statement-breakpoint
-- Review of letter/template reactors (latest live definitions): letters_guard, complaints_status_guard, qa_on_pending,
-- qa_reviews_guard/after_decide, notification_deadline_job, complaint_queue.acknowledged_at, response metrics and
-- regulatory reports match only 'acknowledgement', 'holding', 'closure' or 'final_%' explicitly, so kind='custom'
-- is already a no-op for status, deadlines, QA and response counts. Only letters_after_insert and
-- capture_template_version are replaced below to carry the custom type. Enum literal 'custom' is compared as text
-- so the new value is not used inside this transaction.
CREATE TABLE public.custom_letter_types(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
 name text NOT NULL CONSTRAINT custom_letter_types_name_length CHECK (name=btrim(name) AND char_length(name) BETWEEN 2 AND 80),
 description text CONSTRAINT custom_letter_types_description_length CHECK (description IS NULL OR char_length(description)<=300),
 requires_adr_block boolean NOT NULL DEFAULT false,
 archived_at timestamptz,
 created_by uuid DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT custom_letter_types_org_id_id_key UNIQUE(org_id,id)
);
CREATE UNIQUE INDEX custom_letter_types_org_name_key ON public.custom_letter_types(org_id,lower(name));
GRANT SELECT,INSERT,UPDATE ON public.custom_letter_types TO authenticated;
GRANT ALL ON public.custom_letter_types TO service_role;
ALTER TABLE public.custom_letter_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom letter types read" ON public.custom_letter_types FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "custom letter types insert" ON public.custom_letter_types FOR INSERT TO authenticated WITH CHECK (public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]));
CREATE POLICY "custom letter types update" ON public.custom_letter_types FOR UPDATE TO authenticated USING (public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[])) WITH CHECK (public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]));
CREATE OR REPLACE FUNCTION public.custom_letter_type_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.created_by:=coalesce(auth.uid(),NEW.created_by); NEW.created_at:=now(); NEW.updated_at:=now(); NEW.archived_at:=NULL;
 ELSE
  IF NEW.org_id<>OLD.org_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'Custom letter type identity cannot change'; END IF;
  NEW.updated_at:=now();
 END IF;
 IF NEW.archived_at IS NULL AND (TG_OP='INSERT' OR OLD.archived_at IS NOT NULL) THEN
  PERFORM 1 FROM public.organisations WHERE id=NEW.org_id FOR UPDATE;
  IF (SELECT count(*) FROM public.custom_letter_types t WHERE t.org_id=NEW.org_id AND t.archived_at IS NULL AND t.id<>NEW.id)>=50 THEN RAISE EXCEPTION 'A firm can have at most 50 active custom letter types'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.custom_letter_type_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER custom_letter_types_guard BEFORE INSERT OR UPDATE ON public.custom_letter_types FOR EACH ROW EXECUTE FUNCTION public.custom_letter_type_guard();
CREATE TRIGGER audit_custom_letter_types AFTER INSERT OR UPDATE OR DELETE ON public.custom_letter_types FOR EACH ROW EXECUTE FUNCTION public.audit_capture();

ALTER TABLE public.templates ADD COLUMN custom_type_id uuid;
ALTER TABLE public.template_versions ADD COLUMN custom_type_id uuid;
ALTER TABLE public.letters ADD COLUMN custom_type_id uuid;
ALTER TABLE public.templates ADD CONSTRAINT templates_custom_type_fkey FOREIGN KEY (org_id,custom_type_id) REFERENCES public.custom_letter_types(org_id,id);
ALTER TABLE public.template_versions ADD CONSTRAINT template_versions_custom_type_fkey FOREIGN KEY (org_id,custom_type_id) REFERENCES public.custom_letter_types(org_id,id);
ALTER TABLE public.letters ADD CONSTRAINT letters_custom_type_fkey FOREIGN KEY (org_id,custom_type_id) REFERENCES public.custom_letter_types(org_id,id);
ALTER TABLE public.templates ADD CONSTRAINT templates_custom_type_match CHECK ((kind::text='custom')=(custom_type_id IS NOT NULL));
ALTER TABLE public.letters ADD CONSTRAINT letters_custom_type_match CHECK ((kind::text='custom')=(custom_type_id IS NOT NULL));
CREATE INDEX letters_custom_type_idx ON public.letters(org_id,custom_type_id) WHERE custom_type_id IS NOT NULL;
CREATE UNIQUE INDEX templates_builtin_language_key ON public.templates(org_id,kind,language) WHERE custom_type_id IS NULL;
CREATE UNIQUE INDEX templates_custom_language_key ON public.templates(org_id,custom_type_id,language) WHERE custom_type_id IS NOT NULL;
ALTER TABLE public.templates DROP CONSTRAINT templates_org_id_kind_language_key;

CREATE OR REPLACE FUNCTION public.custom_type_link_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.custom_letter_types%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.custom_type_id IS DISTINCT FROM OLD.custom_type_id OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.org_id IS DISTINCT FROM OLD.org_id) THEN RAISE EXCEPTION 'Letter type cannot change'; END IF;
 IF NEW.custom_type_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO t FROM public.custom_letter_types WHERE id=NEW.custom_type_id AND org_id=NEW.org_id;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Custom letter type must belong to this firm'; END IF;
 IF TG_OP='INSERT' AND TG_TABLE_NAME<>'template_versions' AND t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This custom letter type is archived'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.custom_type_link_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER templates_custom_type_guard BEFORE INSERT OR UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.custom_type_link_guard();
CREATE TRIGGER letters_custom_type_guard BEFORE INSERT ON public.letters FOR EACH ROW EXECUTE FUNCTION public.custom_type_link_guard();
CREATE TRIGGER template_versions_custom_type_guard BEFORE INSERT ON public.template_versions FOR EACH ROW EXECUTE FUNCTION public.custom_type_link_guard();

CREATE OR REPLACE FUNCTION public.capture_template_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ BEGIN IF NEW.restored_from IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.template_versions v WHERE v.id=NEW.restored_from AND v.org_id=NEW.org_id AND v.template_id=NEW.id) THEN RAISE EXCEPTION 'Restore source must belong to this template'; END IF; INSERT INTO public.template_versions(org_id,template_id,subject,body,saved_by,restored_from,custom_type_id) VALUES(NEW.org_id,NEW.id,NEW.subject,NEW.body,auth.uid(),NEW.restored_from,NEW.custom_type_id); RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION public.letters_after_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ BEGIN INSERT INTO public.complaint_events(org_id,complaint_id,actor,kind,detail) VALUES(NEW.org_id,NEW.complaint_id,NEW.sent_by,CASE WHEN NEW.status='pending_approval' THEN 'letter_drafted' ELSE 'letter_sent' END,jsonb_build_object('letter_id',NEW.id,'template',NEW.kind,'language',NEW.language) || CASE WHEN NEW.custom_type_id IS NOT NULL THEN jsonb_build_object('custom_type_id',NEW.custom_type_id,'custom_type_name',(SELECT t.name FROM public.custom_letter_types t WHERE t.id=NEW.custom_type_id AND t.org_id=NEW.org_id)) ELSE '{}'::jsonb END); RETURN NEW; END $function$;