CREATE TABLE public.board_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organisations(id),period_start date NOT NULL,period_end date NOT NULL,title text NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 160),commentary jsonb NOT NULL DEFAULT '{}'::jsonb,snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,snapshot_sha256 text,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued')),version integer NOT NULL DEFAULT 0,previous_report_id uuid REFERENCES public.board_reports(id),issued_by uuid,issued_at timestamptz,created_by uuid NOT NULL DEFAULT auth.uid(),created_at timestamptz NOT NULL DEFAULT now(),CHECK(period_start<=period_end));
GRANT SELECT,INSERT,UPDATE ON public.board_reports TO authenticated;
GRANT ALL ON public.board_reports TO service_role;
REVOKE ALL ON public.board_reports FROM anon;
REVOKE DELETE,TRUNCATE ON public.board_reports FROM authenticated;
ALTER TABLE public.board_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_read ON public.board_reports FOR SELECT TO authenticated USING(public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]) OR (status='issued' AND public.has_org_role(org_id,ARRAY['qa_reviewer','read_only']::public.app_role[])));
CREATE POLICY board_create ON public.board_reports FOR INSERT TO authenticated WITH CHECK(public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]) AND created_by=auth.uid());
CREATE POLICY board_edit ON public.board_reports FOR UPDATE TO authenticated USING(status='draft' AND public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[])) WITH CHECK(public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]));
CREATE UNIQUE INDEX board_issued_version ON public.board_reports(org_id,period_start,period_end,version) WHERE status='issued';
CREATE INDEX board_reports_org_created ON public.board_reports(org_id,created_at DESC,id DESC);
CREATE FUNCTION public.board_report_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE previous public.board_reports; BEGIN
 IF TG_OP='DELETE' OR TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'Board reports cannot be deleted'; END IF;
 IF TG_OP='UPDATE' THEN
 IF OLD.status='issued' THEN RAISE EXCEPTION 'Issued board reports are immutable'; END IF;
 IF (NEW.org_id,NEW.created_by,NEW.created_at,NEW.id) IS DISTINCT FROM (OLD.org_id,OLD.created_by,OLD.created_at,OLD.id) THEN RAISE EXCEPTION 'Report identity cannot change'; END IF;
 END IF;
 IF NOT public.has_org_role(NEW.org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]) THEN RAISE EXCEPTION 'Only managers and administrators can manage board reports'; END IF;
 IF jsonb_typeof(NEW.commentary)<>'object' OR NEW.commentary-ARRAY['keyThemes','actionsTaken','actionsPlanned']<>'{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_each(NEW.commentary) e WHERE jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}')>2000) THEN RAISE EXCEPTION 'Invalid management commentary'; END IF;
 IF NEW.status='issued' THEN
 IF jsonb_typeof(NEW.snapshot)<>'object' OR NEW.snapshot->>'schema'<>'1' OR NOT(NEW.snapshot ? 'headlines' AND NEW.snapshot ? 'tables') OR NEW.snapshot->'commentary' IS DISTINCT FROM NEW.commentary THEN RAISE EXCEPTION 'A rendered snapshot is required'; END IF;
 IF (NEW.snapshot->'range'->>'from') IS DISTINCT FROM NEW.period_start::text OR (NEW.snapshot->'range'->>'to') IS DISTINCT FROM NEW.period_end::text THEN RAISE EXCEPTION 'Snapshot period must match'; END IF;
 PERFORM 1 FROM public.organisations WHERE id=NEW.org_id FOR UPDATE;
 SELECT * INTO previous FROM public.board_reports WHERE org_id=NEW.org_id AND period_start=NEW.period_start AND period_end=NEW.period_end AND status='issued' ORDER BY version DESC LIMIT 1;
 NEW.version:=coalesce(previous.version,0)+1;NEW.previous_report_id:=previous.id;NEW.issued_by:=auth.uid();NEW.issued_at:=now();
 NEW.snapshot_sha256:=encode(sha256(convert_to(NEW.snapshot::text,'UTF8')),'hex');
 ELSE NEW.version:=0;NEW.previous_report_id:=NULL;NEW.issued_by:=NULL;NEW.issued_at:=NULL;NEW.snapshot_sha256:=NULL;NEW.snapshot:='{}'::jsonb; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER board_report_guard BEFORE INSERT OR UPDATE OR DELETE ON public.board_reports FOR EACH ROW EXECUTE FUNCTION public.board_report_guard();
CREATE TRIGGER board_report_no_truncate BEFORE TRUNCATE ON public.board_reports FOR EACH STATEMENT EXECUTE FUNCTION public.board_report_guard();
CREATE TRIGGER board_reports_audit AFTER INSERT OR UPDATE OR DELETE ON public.board_reports FOR EACH ROW EXECUTE FUNCTION public.audit_capture();