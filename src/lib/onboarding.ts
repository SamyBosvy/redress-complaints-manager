import type { AppRole } from './org';
import { inviteState } from './settings';

export const SETUP_STEPS = [
  {id:'firm',label:'Firm details complete',why:'Use the correct firm identity in customer responses.',to:'/app/settings'},
  {id:'countries',label:'Countries & ADR bodies checked',why:'Give customers the right independent dispute-resolution contact.',to:'/app/settings/countries'},
  {id:'calendar',label:'Business calendar loaded',why:'Calculate deadlines using each country’s public holidays.',to:'/app/settings/calendars'},
  {id:'team',label:'Team invited',why:'Share complaint handling with another member of your firm.',to:'/app/settings/users'},
  {id:'templates',label:'Templates reviewed',why:'Check all five core responses before sending them to customers.',to:'/app/templates'},
  {id:'causes',label:'Root causes reviewed',why:'Use meaningful categories to identify recurring problems.',to:'/app/settings/root-causes'},
  {id:'form',label:'Public complaint form ready',why:'Let customers submit complaints with your privacy notice.',to:'/app/forms'},
  {id:'qa',label:'QA settings chosen',why:'Confirm the approval and sampling approach for your firm.',to:'/app/settings/rules'},
  {id:'complaint',label:'First complaint logged',why:'Check your intake process with a clearly labelled test case.',to:'/app/new'},
] as const;
export type SetupId = typeof SETUP_STEPS[number]['id'];
type Audit = {actor:string|null;table_name:string;created_at:string;before:unknown;after:unknown;action?:string};
export type SetupEvidence = {
  org:{legal_name:string;firm_address:string;complaints_email:string|null;time_zone:string;home_country:string|null};
  countries: {country_code:string;adr_name:string|null;adr_contact:string|null;adr_website:string|null}[]|null;
  holidays:{country_code:string;holiday_date:string}[]|null;
  team:{members:{active:boolean}[];invites:{accepted_at:string|null;revoked_at:string|null;expires_at:string}[]}|null;
  templates:{kind:string;language:string;template_versions:{saved_at:string;saved_by:string|null}[]}[]|null;
  rootAudit:Audit[]|null; qaAudit:Audit[]|null;
  form:{enabled:boolean;privacy_notice:string;updated_at:string}|null|undefined;
  complaint:{created_at:string}|null|undefined;
};
export function setupRole(role:AppRole|null|undefined){return role==='org_admin'?'edit':role==='complaints_manager'?'read':null;}
export function firmMainLanguage(country:string|null){return ({FR:'fr',PL:'pl',PT:'pt',ES:'es',NL:'nl'} as Record<string,string>)[country??'']??'en';}
const text=(v:string|null|undefined)=>Boolean(v?.trim());
const record=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function qaReviewed(a:Audit){const before=record(a.before),after=record(a.after);return a.actor!==null&&a.action==='UPDATE'&&['qa_required','qa_sample_pct'].some(k=>Object.hasOwn(before,k)&&Object.hasOwn(after,k)&&before[k]!==after[k]);}
export function detectSetup(e:SetupEvidence,year:number,now=Date.now()){
 const language=firmMainLanguage(e.org.home_country);
 const kinds=['acknowledgement','holding','final_upheld','final_partially_upheld','final_not_upheld'];
 const saves=kinds.map(kind=>e.templates?.filter(t=>t.kind===kind&&t.language===language).flatMap(t=>t.template_versions.filter(v=>v.saved_by!==null).map(v=>v.saved_at)).sort()[0]);
 const root=e.rootAudit?.find(a=>a.actor!==null);
 const qa=e.qaAudit?.find(qaReviewed);
 const results:Record<SetupId,{done:boolean;date?:string|undefined;unknown?:boolean;optional?:boolean}>={
  firm:{done:[e.org.legal_name,e.org.firm_address,e.org.complaints_email,e.org.time_zone].every(text)},
  countries:{done:Boolean(e.countries?.length)&&Boolean(e.countries?.every(c=>text(c.adr_name)&&(text(c.adr_contact)||text(c.adr_website)))),unknown:e.countries===null},
  calendar:{done:Boolean(e.countries?.length)&&Boolean(e.countries?.every(c=>e.holidays?.some(h=>h.country_code===c.country_code&&h.holiday_date.startsWith(`${year}-`)))),unknown:e.holidays===null||e.countries===null},
  team:{done:Boolean(e.team&&(e.team.members.filter(m=>m.active).length>=2||e.team.invites.some(i=>inviteState(i,now)==='Invited'))),unknown:e.team===null},
  templates:{done:saves.every(Boolean),unknown:e.templates===null,...(saves.every(Boolean)?{date:saves.filter((s):s is string=>Boolean(s)).sort().at(-1)}:{})},
  causes:{done:Boolean(root),unknown:e.rootAudit===null,...(root?{date:root.created_at}:{})},
  form:{done:Boolean(e.form?.enabled&&text(e.form.privacy_notice)),unknown:e.form===undefined,...(e.form?.enabled&&text(e.form.privacy_notice)?{date:e.form.updated_at}:{})},
  qa:{done:Boolean(qa),optional:!qa,...(qa?{date:qa.created_at}:{})},
  complaint:{done:Boolean(e.complaint),unknown:e.complaint===undefined,...(e.complaint?{date:e.complaint.created_at}:{})},
 };
 return SETUP_STEPS.map(s=>({...s,...results[s.id]}));
}
export function setupProgress(steps:readonly {id:SetupId;done:boolean;optional?:boolean}[]){return {done:steps.filter(s=>s.done).length,total:steps.length,next:steps.find(s=>!s.done&&!s.optional)?.id??steps.find(s=>!s.done)?.id,complete:steps.every(s=>s.done||s.optional)};}
export type SetupStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export const setupKey=(user:string,org:string)=>`redress-setup:${user}:${org}`;
export function setupHidden(storage:SetupStorage,user:string,org:string){try{return storage.getItem(setupKey(user,org))==='hidden';}catch{return false;}}
export function saveSetupHidden(storage:SetupStorage,user:string,org:string,hidden:boolean){try{if(hidden)storage.setItem(setupKey(user,org),'hidden');else storage.removeItem(setupKey(user,org));return true;}catch{return false;}}
export function setupCompletion(storage:SetupStorage,user:string,org:string){try{const key=setupKey(user,org)+':complete';if(storage.getItem(key)==='yes')return false;storage.setItem(key,'yes');return true;}catch{return false;}}
export const TEST_COMPLAINT={complainant_name:'TEST — Onboarding customer',customer_ref:'TEST-ONBOARDING',summary:'TEST COMPLAINT — Setup check only. Not a real customer complaint.'};