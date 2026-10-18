ALTER TYPE complaint_status ADD VALUE 'pending_qa';

CREATE TABLE public.qa_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id),
  kind text NOT NULL CHECK (kind IN ('approval','sample')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','returned','passed','failed')),
  reviewer uuid,
  comments text,
  scorecard jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.qa_reviews TO authenticated;
GRANT ALL ON public.qa_reviews TO service_role;
ALTER TABLE public.qa_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa read" ON public.qa_reviews FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY "qa insert" ON public.qa_reviews FOR INSERT TO authenticated WITH CHECK (has_org_role(org_id, ARRAY['org_admin'::app_role,'complaints_manager'::app_role,'qa_reviewer'::app_role]));
CREATE POLICY "qa decide" ON public.qa_reviews FOR UPDATE TO authenticated USING (has_org_role(org_id, ARRAY['org_admin'::app_role,'complaints_manager'::app_role,'qa_reviewer'::app_role]));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  complaint_id uuid REFERENCES public.complaints(id),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications read own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications update own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.qa_on_pending() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending_qa' AND (OLD.status IS DISTINCT FROM 'pending_qa') THEN
    INSERT INTO public.qa_reviews (org_id, complaint_id, kind) VALUES (NEW.org_id, NEW.id, 'approval');
    INSERT INTO public.notifications (org_id, user_id, kind, title, complaint_id)
    SELECT NEW.org_id, om.user_id, 'qa_pending', 'Final response awaiting QA: ' || NEW.reference, NEW.id
    FROM public.org_members om
    WHERE om.org_id = NEW.org_id AND om.role IN ('qa_reviewer','complaints_manager','org_admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER complaints_qa_pending AFTER UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.qa_on_pending();

CREATE OR REPLACE FUNCTION public.qa_on_close() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.organisations%ROWTYPE;
BEGIN
  IF NEW.status IN ('closed','final_response_sent') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO o FROM public.organisations WHERE id = NEW.org_id;
    IF o.qa_required AND random() < (o.qa_sample_pct / 100.0) THEN
      INSERT INTO public.qa_reviews (org_id, complaint_id, kind) VALUES (NEW.org_id, NEW.id, 'sample');
      INSERT INTO public.notifications (org_id, user_id, kind, title, complaint_id)
      SELECT NEW.org_id, om.user_id, 'qa_sample', 'Complaint selected for QA sampling: ' || NEW.reference, NEW.id
      FROM public.org_members om
      WHERE om.org_id = NEW.org_id AND om.role IN ('qa_reviewer','complaints_manager');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER complaints_qa_sample AFTER UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.qa_on_close();

CREATE OR REPLACE FUNCTION public.notify_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.notifications (org_id, user_id, kind, title, complaint_id)
    VALUES (NEW.org_id, NEW.assigned_to, 'assigned', 'Complaint assigned to you: ' || NEW.reference, NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER complaints_notify_assignment AFTER INSERT OR UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.notify_assignment();

CREATE TRIGGER qa_reviews_audit AFTER INSERT OR UPDATE OR DELETE ON public.qa_reviews FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE TRIGGER notifications_audit AFTER INSERT OR UPDATE OR DELETE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.audit_capture();