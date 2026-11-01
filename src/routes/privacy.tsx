import { createFileRoute } from '@tanstack/react-router';
import { PolicyDocument } from '@/components/policy-document';
import { privacyHead } from '@/lib/privacy';
import { getRequestOrigin } from '@/lib/origin.functions';
export const Route=createFileRoute('/privacy')({loader:()=>getRequestOrigin(),head:({loaderData})=>privacyHead('Privacy policy','Draft privacy policy for Redress complaints management.',loaderData),component:()=> <PolicyDocument title="Privacy policy" sections={[
  {heading:'Controller and contact',text:'[Insert the Redress legal entity, registered address, privacy contact and applicable supervisory authority.] Each customer firm determines how its complainants’ data is processed.'},
  {heading:'Data and purposes',text:'Redress processes account details, organisation membership, complaint details, correspondence, attachments, deadlines and audit records for complaint handling, regulatory recordkeeping and service operation. [Insert applicable lawful bases and contact details.]'},
  {heading:'Access and service providers',text:'Complaint data is restricted to authorised members of the relevant organisation. Lovable Cloud provides authentication, database and file storage. [Insert the approved subprocessor list, verified processing locations and any international-transfer safeguards.]'},
  {heading:'Retention and deletion',text:'The default working-record retention is six years after closure and can be configured by the firm. Legal holds postpone anonymisation. Historical immutable audit snapshots may contain personal data and are not removed by working-record erasure or organisation deletion. [Approve a separate lawful basis and retention policy for audit records and backups.]'},
  {heading:'Your rights',text:'Contact the firm handling your complaint to request access, correction, restriction or erasure, subject to applicable legal obligations. [Insert contact, response procedures and complaint rights.]'},
  {heading:'Cookies and tracking',text:'Authentication and app preferences use necessary browser storage. Redress does not add analytics or third-party trackers. [Review the complete service-provider disclosures before approval.]'},
]}/>});