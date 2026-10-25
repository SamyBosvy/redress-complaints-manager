import type {QueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {clearSelectedOrganisation} from '@/lib/org';
export async function clearAndSignOut(qc:QueryClient,scope:'local'|'global'='local'){await qc.cancelQueries();qc.clear();const {error}=await supabase.auth.signOut({scope});if(error)throw error;clearSelectedOrganisation();}
