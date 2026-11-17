import { z } from 'zod';
import { COUNTRIES, LICENCE_LABELS } from './countries';
import type { SetupStorage } from './onboarding';

export const WIZARD_STEPS = ['Legal entity', 'Countries', 'ADR bodies', 'Calendars', 'Deadline rules'] as const;
export const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'] as const;
export const EEA_COUNTRIES = [...EU_COUNTRIES, 'IS', 'LI', 'NO'] as const;
const NATIVE_NAMES: Record<string,string> = {
 AT:'Österreich', BE:'België Belgique Belgien', BG:'България', HR:'Hrvatska', CY:'Κύπρος Kıbrıs', CZ:'Česko Česká republika',
 DK:'Danmark', EE:'Eesti', FI:'Suomi', FR:'France', DE:'Deutschland', GR:'Ελλάδα', HU:'Magyarország', IS:'Ísland', IE:'Éire',
 IT:'Italia', LV:'Latvija', LI:'Liechtenstein', LT:'Lietuva', LU:'Lëtzebuerg', MT:'Malta', NL:'Nederland', NO:'Norge Noreg',
 PL:'Polska', PT:'Portugal', RO:'România', SK:'Slovensko', SI:'Slovenija', ES:'España', SE:'Sverige', GB:'United Kingdom', CH:'Schweiz Suisse Svizzera Svizra',
};
export const searchText = (value:string) => value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('en').trim();
export function searchCountries(query:string) { const needle=searchText(query); return Object.entries(COUNTRIES).filter(([code,name])=>searchText(`${code} ${name} ${NATIVE_NAMES[code]??''}`).includes(needle)); }
export function defaultTimeZone(country:string) { return ({IE:'Europe/Dublin',FR:'Europe/Paris',PL:'Europe/Warsaw',PT:'Europe/Lisbon',ES:'Europe/Madrid',NL:'Europe/Amsterdam'} as Record<string,string>)[country]??'Europe/Brussels'; }
export function timeZones() { return [...new Set([...Intl.supportedValuesOf('timeZone'), 'Europe/Dublin','Europe/Brussels'])].sort(); }
export const ADR_MEMBERS_URL = 'https://finance.ec.europa.eu/consumer-finance-and-payments/retail-financial-services/financial-dispute-resolution-network-fin-net/members-fin-net-country_en';
const country=z.string().refine(c=>Object.hasOwn(COUNTRIES,c));
const adrSchema=z.object({name:z.string().max(300),contact:z.string().max(300),website:z.string().max(300)});
export type WizardAdr=z.infer<typeof adrSchema>;
export function copyAdr(values:Record<string,WizardAdr>,from:string,to:string) { const source=values[from];return source?{...values,[to]:{...source}}:values; }
export function validAdr(value:WizardAdr|undefined) { return Boolean(value?.name.trim()&&(value.contact.trim()||value.website.trim())); }
const draftSchema=z.object({
 version:z.literal(1),step:z.number().int().min(0).max(4),
 entity:z.object({name:z.string().max(200),licence:z.enum(Object.keys(LICENCE_LABELS) as [keyof typeof LICENCE_LABELS,...(keyof typeof LICENCE_LABELS)[]]),home:z.union([country,z.literal('')]),regulator:z.string().max(200),timeZone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}})}),
 countries:z.array(country).max(32),adr:z.record(z.string(),adrSchema),addLater:z.array(country),
 holidays:z.array(z.object({country:z.union([country,z.literal('')]),date:z.string(),name:z.string().max(100)})),
 loadedHolidayCountries:z.array(country),rules:z.object({name:z.string(),ack:z.number().min(0),final:z.number().min(0),extended:z.number().min(0)}),
});
export type WizardDraft=z.infer<typeof draftSchema>;
export const wizardDraftKey=(user:string,org:string)=>`redress-wizard:${encodeURIComponent(user)}:${encodeURIComponent(org)}`;
export function saveWizardDraft(storage:SetupStorage,user:string,org:string,draft:WizardDraft) { try{storage.setItem(wizardDraftKey(user,org),JSON.stringify(draftSchema.parse(draft)));return true;}catch{return false;} }
export function readWizardDraft(storage:SetupStorage,user:string,org:string):WizardDraft|null { try{const parsed=draftSchema.safeParse(JSON.parse(storage.getItem(wizardDraftKey(user,org))??'null'));return parsed.success?parsed.data:null;}catch{return null;} }
export function clearWizardDraft(storage:SetupStorage,user:string,org:string) { try{storage.removeItem(wizardDraftKey(user,org));return true;}catch{return false;} }
export function wizardProgress(step:number) { const index=Math.max(0,Math.min(WIZARD_STEPS.length-1,Math.trunc(step)||0));return {index,label:WIZARD_STEPS[index],number:index+1,total:WIZARD_STEPS.length,canBack:index>0,isLast:index===WIZARD_STEPS.length-1}; }