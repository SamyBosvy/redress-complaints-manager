-- Compliance hardening: DB-enforced complaint workflow, four-eyes QA, currency validation, close checklist.
-- PENDING: apply via the migration tool once the hosted database is resumed (paused: workspace out of Cloud credits).
-- Until applied, src/test/workflow-database.test.ts executes these routines in local PostgreSQL (PGlite).

-- Letters gain an approval state; existing letters are already sent.
ALTER TABLE public.letters ADD COLUMN status text NOT NULL DEFAULT 'sent';
ALTER TABLE public.letters ADD CONSTRAINT letters_status_check CHECK (status IN ('pending_approval','sent'));
ALTER TABLE public.letters ADD COLUMN approved_by uuid;

-- QA approval reviews link to the letter under review.
ALTER TABLE public.qa_reviews ADD COLUMN letter_id uuid REFERENCES public.letters(id) ON DELETE SET NULL;

-- Complaints: withdrawal reason and explicit "no payment" confirmations for the close checklist.
ALTER TABLE public.complaints ADD COLUMN withdrawal_reason text;
ALTER TABLE public.complaints ADD COLUMN redress_none boolean NOT NULL DEFAULT false;
ALTER TABLE public.complaints ADD COLUMN goodwill_none boolean NOT NULL DEFAULT false;

-- ISO currency validation (amount requires currency; "none" flag forbids an amount).
CREATE OR REPLACE FUNCTION public.complaints_currency_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE codes text[] := ARRAY['EUR','GBP','PLN','CZK','HUF','RON','SEK','DKK','NOK','CHF','BGN','ISK','USD'];
BEGIN
  IF NEW.redress_currency IS NOT NULL AND NOT (NEW.redress_currency = ANY(codes)) THEN
    RAISE EXCEPTION 'Invalid currency code: %', NEW.redress_currency; END IF;
  IF NEW.goodwill_currency IS NOT NULL AND NOT (NEW.goodwill_currency = ANY(codes)) THEN
    RAISE EXCEPTION 'Invalid currency code: %', NEW.goodwill_currency; END IF;
  IF NEW.redress_amount IS NOT NULL AND NEW.redress_currency IS NULL THEN
    RAISE EXCEPTION 'Redress amount requires a currency'; END IF;
  IF NEW.goodwill_amount IS NOT NULL AND NEW.goodwill_currency IS NULL THEN
    RAISE EXCEPTION 'Goodwill amount requires a currency'; END IF;
  IF NEW.redress_currency IS NOT NULL AND NEW.redress_amount IS NULL THEN
    RAISE EXCEPTION 'Redress currency requires an amount'; END IF;
  IF NEW.goodwill_currency IS NOT NULL AND NEW.goodwill_amount IS NULL THEN
    RAISE EXCEPTION 'Goodwill currency requires an amount'; END IF;
  IF NEW.redress_none AND NEW.redress_amount IS NOT NULL THEN
    RAISE EXCEPTION 'Redress cannot be both confirmed none and paid'; END IF;
  IF NEW.goodwill_none AND NEW.goodwill_amount IS NOT NULL THEN
    RAISE EXCEPTION 'Goodwill cannot be both confirmed none and paid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER complaints_currency_guard BEFORE INSERT OR UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.complaints_currency_guard();

-- Status transition guard: the only legal moves, with letter/QA/close-checklist requirements.
CREATE OR REPLACE FUNCTION public.complaints_status_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.organisations%ROWTYPE; adr text; final_letter public.letters%ROWTYPE;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT * INTO o FROM public.organisations WHERE id = NEW.org_id;

  IF OLD.status = 'received' AND NEW.status = 'acknowledged' THEN
    IF NOT EXISTS (SELECT 1 FROM public.letters l WHERE l.complaint_id = NEW.id AND l.kind = 'acknowledgement' AND l.status = 'sent') THEN
      RAISE EXCEPTION 'Acknowledgement requires a recorded acknowledgement letter'; END IF;

  ELSIF NEW.status = 'holding_response_sent' AND OLD.status IN ('acknowledged','under_investigation') THEN
    IF NOT EXISTS (SELECT 1 FROM public.letters l WHERE l.complaint_id = NEW.id AND l.kind = 'holding' AND l.status = 'sent') THEN
      RAISE EXCEPTION 'Holding response requires a recorded holding letter'; END IF;
    IF NEW.holding_reason IS NULL OR length(trim(NEW.holding_reason)) = 0 THEN
      RAISE EXCEPTION 'Holding response requires a reason for the delay'; END IF;

  ELSIF NEW.status = 'under_investigation' AND OLD.status IN ('acknowledged','holding_response_sent','reopened','pending_qa') THEN
    NULL; -- manual move or QA return

  ELSIF NEW.status = 'pending_qa' AND OLD.status IN ('acknowledged','under_investigation','holding_response_sent','reopened') THEN
    IF NOT o.qa_required THEN RAISE EXCEPTION 'QA approval is not enabled for this organisation'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.letters l WHERE l.complaint_id = NEW.id AND l.kind::text LIKE 'final_%' AND l.status = 'pending_approval') THEN
      RAISE EXCEPTION 'Submit a final response letter for QA first'; END IF;

  ELSIF NEW.status = 'final_response_sent' THEN
    IF OLD.status = 'pending_qa' THEN
      IF NOT EXISTS (SELECT 1 FROM public.qa_reviews q WHERE q.complaint_id = NEW.id AND q.kind = 'approval' AND q.status = 'approved') THEN
        RAISE EXCEPTION 'Final response requires QA approval'; END IF;
    ELSIF OLD.status IN ('acknowledged','under_investigation','holding_response_sent','reopened') THEN
      IF o.qa_required THEN RAISE EXCEPTION 'Final response must go through QA approval'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.letters l WHERE l.complaint_id = NEW.id AND l.kind::text LIKE 'final_%' AND l.status = 'sent') THEN
        RAISE EXCEPTION 'Final response requires a recorded final-response letter'; END IF;
    ELSE
      RAISE EXCEPTION 'Invalid status change: % to %', OLD.status, NEW.status;
    END IF;

  ELSIF NEW.status = 'closed' THEN
    IF OLD.status IN ('closed','escalated_to_adr') THEN
      RAISE EXCEPTION 'Invalid status change: % to %', OLD.status, NEW.status; END IF;
    IF NEW.outcome = 'withdrawn' THEN
      IF NEW.withdrawal_reason IS NULL OR length(trim(NEW.withdrawal_reason)) = 0 THEN
        RAISE EXCEPTION 'Closing as withdrawn requires a reason'; END IF;
    ELSE
      IF OLD.status <> 'final_response_sent' THEN
        RAISE EXCEPTION 'A complaint can only be closed after the final response is sent (or withdrawn with a reason)'; END IF;
      IF NEW.outcome IS NULL THEN RAISE EXCEPTION 'Set the outcome before closing'; END IF;
      IF NEW.root_cause_category IS NULL OR length(trim(NEW.root_cause_category)) = 0 THEN
        RAISE EXCEPTION 'Set the root cause before closing'; END IF;
      IF NOT (NEW.redress_none OR (NEW.redress_amount IS NOT NULL AND NEW.redress_currency IS NOT NULL)) THEN
        RAISE EXCEPTION 'Record redress paid or confirm none before closing'; END IF;
      IF NOT (NEW.goodwill_none OR (NEW.goodwill_amount IS NOT NULL AND NEW.goodwill_currency IS NOT NULL)) THEN
        RAISE EXCEPTION 'Record goodwill paid or confirm none before closing'; END IF;
      SELECT * INTO final_letter FROM public.letters l
        WHERE l.complaint_id = NEW.id AND l.kind::text LIKE 'final_%' AND l.status = 'sent'
        ORDER BY l.sent_at DESC LIMIT 1;
      IF final_letter.id IS NULL THEN
        RAISE EXCEPTION 'A final response must be recorded as sent before closing'; END IF;
      SELECT oc.adr_name INTO adr FROM public.org_countries oc
        WHERE oc.org_id = NEW.org_id AND oc.country_code = NEW.country_code;
      IF adr IS NULL OR length(trim(adr)) = 0 THEN
        RAISE EXCEPTION 'Set an ADR body for this country before closing'; END IF;
      IF final_letter.body NOT ILIKE '%' || adr || '%' THEN
        RAISE EXCEPTION 'The final response must include the ADR referral'; END IF;
    END IF;

  ELSIF NEW.status = 'reopened' AND OLD.status = 'closed' THEN
    NULL;
  ELSIF NEW.status = 'escalated_to_adr' AND OLD.status IN ('final_response_sent','closed') THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Invalid status change: % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER complaints_status_guard BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.complaints_status_guard();

-- Letter insert guard: final responses are drafts pending QA when the org requires it.
CREATE OR REPLACE FUNCTION public.letters_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind::text LIKE 'final_%'
     AND (SELECT qa_required FROM public.organisations WHERE id = NEW.org_id) THEN
    NEW.status := 'pending_approval';
  ELSE
    NEW.status := 'sent';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER letters_guard BEFORE INSERT ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.letters_guard();

-- Letter timeline event reflects the real state (draft vs sent).
CREATE OR REPLACE FUNCTION public.letters_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
  VALUES (NEW.org_id, NEW.complaint_id, NEW.sent_by,
    CASE WHEN NEW.status = 'pending_approval' THEN 'letter_drafted' ELSE 'letter_sent' END,
    jsonb_build_object('letter_id', NEW.id, 'template', NEW.kind, 'language', NEW.language));
  RETURN NEW;
END $$;

-- Four-eyes guard: a reviewer cannot decide on their own letter or their own caseload.
CREATE OR REPLACE FUNCTION public.qa_reviews_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE author uuid; handler uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','returned','passed','failed') THEN
    IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'This review has already been decided'; END IF;
    NEW.reviewer := auth.uid();
    NEW.decided_at := now();
    IF NEW.kind = 'approval' THEN
      SELECT l.sent_by INTO author FROM public.letters l WHERE l.id = NEW.letter_id;
      SELECT c.assigned_to INTO handler FROM public.complaints c WHERE c.id = NEW.complaint_id;
      IF author IS NOT NULL AND author = auth.uid() THEN
        RAISE EXCEPTION 'You cannot approve a letter you wrote'; END IF;
      IF handler IS NOT NULL AND handler = auth.uid() THEN
        RAISE EXCEPTION 'You cannot review a complaint assigned to you'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER qa_reviews_guard BEFORE UPDATE ON public.qa_reviews
  FOR EACH ROW EXECUTE FUNCTION public.qa_reviews_guard();

-- QA decisions cascade: approval sends the letter and advances the case; return sends it back with notice.
CREATE OR REPLACE FUNCTION public.qa_reviews_after_decide()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.complaints%ROWTYPE;
BEGIN
  IF NEW.kind = 'approval' AND OLD.status = 'pending' AND NEW.status = 'approved' THEN
    UPDATE public.letters SET status = 'sent', sent_at = now(), approved_by = NEW.reviewer WHERE id = NEW.letter_id;
    UPDATE public.complaints SET status = 'final_response_sent' WHERE id = NEW.complaint_id AND status = 'pending_qa';
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.complaint_id, NEW.reviewer, 'letter_sent',
      jsonb_build_object('letter_id', NEW.letter_id, 'template', 'final', 'language', '', 'qa', 'approved'));
  ELSIF NEW.kind = 'approval' AND OLD.status = 'pending' AND NEW.status = 'returned' THEN
    UPDATE public.complaints SET status = 'under_investigation' WHERE id = NEW.complaint_id AND status = 'pending_qa' RETURNING * INTO c;
    IF c.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (org_id, user_id, kind, title, complaint_id)
      VALUES (NEW.org_id, c.assigned_to, 'qa_returned', 'Final response returned by QA: ' || c.reference, NEW.complaint_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER qa_reviews_after_decide AFTER UPDATE ON public.qa_reviews
  FOR EACH ROW EXECUTE FUNCTION public.qa_reviews_after_decide();

-- Entering pending_qa links the approval review to the draft final letter.
CREATE OR REPLACE FUNCTION public.qa_on_pending() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending_qa' AND (OLD.status IS DISTINCT FROM 'pending_qa') THEN
    INSERT INTO public.qa_reviews (org_id, complaint_id, kind, letter_id)
    SELECT NEW.org_id, NEW.id, 'approval', l.id FROM public.letters l
    WHERE l.complaint_id = NEW.id AND l.kind::text LIKE 'final_%' AND l.status = 'pending_approval'
    ORDER BY l.sent_at DESC LIMIT 1;
    INSERT INTO public.notifications (org_id, user_id, kind, title, complaint_id)
    SELECT NEW.org_id, om.user_id, 'qa_pending', 'Final response awaiting QA: ' || NEW.reference, NEW.id
    FROM public.org_members om
    WHERE om.org_id = NEW.org_id AND om.role IN ('qa_reviewer','complaints_manager','org_admin');
  END IF;
  RETURN NEW;
END $$;

-- Outcome timeline events also capture the withdrawal reason.
CREATE OR REPLACE FUNCTION public.complaints_log_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'created', jsonb_build_object('reference', NEW.reference, 'channel', NEW.channel, 'final_due', NEW.final_due));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'status', jsonb_build_object('before', OLD.status, 'after', NEW.status));
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'reassigned', jsonb_build_object('before', OLD.assigned_to, 'after', NEW.assigned_to));
  END IF;
  IF NEW.holding_sent_at IS DISTINCT FROM OLD.holding_sent_at OR NEW.final_due IS DISTINCT FROM OLD.final_due OR NEW.extended_due IS DISTINCT FROM OLD.extended_due THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'deadline', jsonb_build_object(
      'before', CASE WHEN OLD.holding_sent_at IS NOT NULL THEN OLD.extended_due ELSE OLD.final_due END,
      'after', CASE WHEN NEW.holding_sent_at IS NOT NULL THEN NEW.extended_due ELSE NEW.final_due END,
      'reason', NEW.holding_reason));
  END IF;
  IF NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.redress_amount IS DISTINCT FROM OLD.redress_amount
     OR NEW.goodwill_amount IS DISTINCT FROM OLD.goodwill_amount OR NEW.root_cause_category IS DISTINCT FROM OLD.root_cause_category
     OR NEW.withdrawal_reason IS DISTINCT FROM OLD.withdrawal_reason THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'outcome', jsonb_build_object(
      'before', jsonb_build_object('outcome', OLD.outcome, 'redress', OLD.redress_amount, 'goodwill', OLD.goodwill_amount, 'root_cause', OLD.root_cause_category),
      'after', jsonb_build_object('outcome', NEW.outcome, 'redress', NEW.redress_amount, 'goodwill', NEW.goodwill_amount, 'root_cause', NEW.root_cause_category, 'withdrawal_reason', NEW.withdrawal_reason)));
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'priority', jsonb_build_object('before', OLD.priority, 'after', NEW.priority));
  END IF;
  RETURN NEW;
END $$;
