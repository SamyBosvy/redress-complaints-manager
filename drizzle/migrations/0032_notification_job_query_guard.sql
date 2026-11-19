CREATE OR REPLACE FUNCTION public.notification_deadline_job(_at timestamptz DEFAULT now()) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c record;d date;k text;recipient uuid;total integer:=0;changed integer; BEGIN
FOR c IN SELECT case_row.*,o.time_zone FROM public.complaints case_row JOIN public.organisations o ON o.id=case_row.org_id WHERE case_row.status<>'closed' AND case_row.anonymised_at IS NULL AND NOT case_row.privacy_processing LOOP
 d:=public.firm_date(c.org_id,_at);
 k:=CASE WHEN c.final_due<d OR (c.ack_due<d AND NOT EXISTS(SELECT 1 FROM public.letters l WHERE l.org_id=c.org_id AND l.complaint_id=c.id AND l.kind='acknowledgement' AND l.sent_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM public.complaint_events e WHERE e.org_id=c.org_id AND e.complaint_id=c.id AND e.detail->>'after'='acknowledged')) THEN 'deadline_overdue' WHEN c.final_due BETWEEN d AND public.add_business_days(c.org_id,c.country_code,d,3) THEN 'deadline_at_risk' ELSE NULL END;
 IF k IS NULL THEN CONTINUE; END IF;
 FOR recipient IN SELECT m.user_id FROM public.org_members m WHERE m.org_id=c.org_id AND m.active AND ((c.assigned_to IS NOT NULL AND m.user_id=c.assigned_to) OR (c.assigned_to IS NULL AND m.role='complaints_manager')) LOOP
 INSERT INTO public.notifications(org_id,user_id,kind,title,complaint_id,link_path,dedupe_key,created_at) VALUES(c.org_id,recipient,k,CASE WHEN k='deadline_overdue' THEN 'Response deadline overdue: ' ELSE 'Final response due within 3 business days: ' END||c.reference,c.id,'/app/c/'||c.id::text,k||':'||c.id::text||':'||d::text,_at) ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
 GET DIAGNOSTICS changed=ROW_COUNT; total:=total+changed;
 END LOOP;
END LOOP; RETURN total; END $$;