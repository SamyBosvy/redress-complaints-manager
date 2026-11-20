export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_recovery: {
        Row: {
          attempts: number
          hashes: Json
          id: string
          org_id: string
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          attempts?: number
          hashes?: Json
          id?: string
          org_id: string
          updated_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          attempts?: number
          hashes?: Json
          id?: string
          org_id?: string
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_recovery_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      adr_cases: {
        Row: {
          adr_body_name: string
          adr_reference: string | null
          award_amount: number | null
          award_currency: string | null
          complaint_id: string
          created_at: string
          created_by: string | null
          decision: string
          decision_on: string | null
          escalated_on: string
          firm_notified_on: string | null
          firm_response_due: string | null
          firm_response_sent_on: string | null
          id: string
          notes: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          adr_body_name: string
          adr_reference?: string | null
          award_amount?: number | null
          award_currency?: string | null
          complaint_id: string
          created_at?: string
          created_by?: string | null
          decision?: string
          decision_on?: string | null
          escalated_on: string
          firm_notified_on?: string | null
          firm_response_due?: string | null
          firm_response_sent_on?: string | null
          id?: string
          notes?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          adr_body_name?: string
          adr_reference?: string | null
          award_amount?: number | null
          award_currency?: string | null
          complaint_id?: string
          created_at?: string
          created_by?: string | null
          decision?: string
          decision_on?: string | null
          escalated_on?: string
          firm_notified_on?: string | null
          firm_response_due?: string | null
          firm_response_sent_on?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adr_cases_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: true
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adr_cases_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: true
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adr_cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_capacity: {
        Row: {
          accepting_new: boolean
          away_from: string | null
          away_until: string | null
          languages: string[]
          last_assigned_at: string | null
          last_auto_assigned_at: string | null
          max_open_cases: number | null
          org_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          accepting_new?: boolean
          away_from?: string | null
          away_until?: string | null
          languages?: string[]
          last_assigned_at?: string | null
          last_auto_assigned_at?: string | null
          max_open_cases?: number | null
          org_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          accepting_new?: boolean
          away_from?: string | null
          away_until?: string | null
          languages?: string[]
          last_assigned_at?: string | null
          last_auto_assigned_at?: string | null
          max_open_cases?: number | null
          org_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_capacity_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: number
          org_id: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          org_id: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          org_id?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      board_reports: {
        Row: {
          commentary: Json
          created_at: string
          created_by: string
          id: string
          issued_at: string | null
          issued_by: string | null
          org_id: string
          period_end: string
          period_start: string
          previous_report_id: string | null
          snapshot: Json
          snapshot_sha256: string | null
          status: string
          title: string
          version: number
        }
        Insert: {
          commentary?: Json
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          org_id: string
          period_end: string
          period_start: string
          previous_report_id?: string | null
          snapshot?: Json
          snapshot_sha256?: string | null
          status?: string
          title: string
          version?: number
        }
        Update: {
          commentary?: Json
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          org_id?: string
          period_end?: string
          period_start?: string
          previous_report_id?: string | null
          snapshot?: Json
          snapshot_sha256?: string | null
          status?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_reports_previous_report_id_fkey"
            columns: ["previous_report_id"]
            isOneToOne: false
            referencedRelation: "board_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_attachments: {
        Row: {
          category: Database["public"]["Enums"]["attachment_category"]
          complaint_id: string
          description: string | null
          file_name: string
          id: string
          mime_type: string
          org_id: string
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          sha256: string | null
          size_bytes: number
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["attachment_category"]
          complaint_id: string
          description?: string | null
          file_name: string
          id?: string
          mime_type: string
          org_id: string
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          sha256?: string | null
          size_bytes?: number
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["attachment_category"]
          complaint_id?: string
          description?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          org_id?: string
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          sha256?: string | null
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_attachments_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_attachments_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_events: {
        Row: {
          actor: string | null
          complaint_id: string
          created_at: string
          detail: Json
          id: string
          kind: string
          org_id: string
        }
        Insert: {
          actor?: string | null
          complaint_id: string
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          org_id: string
        }
        Update: {
          actor?: string | null
          complaint_id?: string
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_events_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_events_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_reopenings: {
        Row: {
          complaint_id: string
          deadline_mode: string
          id: string
          org_id: string
          previous_final_due: string | null
          previous_status: Database["public"]["Enums"]["complaint_status"]
          reason: string
          reason_category: string
          reopened_at: string
          reopened_by: string
        }
        Insert: {
          complaint_id: string
          deadline_mode: string
          id?: string
          org_id: string
          previous_final_due?: string | null
          previous_status: Database["public"]["Enums"]["complaint_status"]
          reason: string
          reason_category: string
          reopened_at?: string
          reopened_by: string
        }
        Update: {
          complaint_id?: string
          deadline_mode?: string
          id?: string
          org_id?: string
          previous_final_due?: string | null
          previous_status?: Database["public"]["Enums"]["complaint_status"]
          reason?: string
          reason_category?: string
          reopened_at?: string
          reopened_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_reopenings_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_reopenings_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_reopenings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_vulnerability: {
        Row: {
          adjustments: string[]
          adjustments_note: string | null
          assessed_at: string
          assessed_by: string | null
          complaint_id: string
          customer_consented: boolean
          drivers: string[]
          id: string
          org_id: string
          review_by: string | null
          source: string
        }
        Insert: {
          adjustments?: string[]
          adjustments_note?: string | null
          assessed_at?: string
          assessed_by?: string | null
          complaint_id: string
          customer_consented?: boolean
          drivers?: string[]
          id?: string
          org_id: string
          review_by?: string | null
          source?: string
        }
        Update: {
          adjustments?: string[]
          adjustments_note?: string | null
          assessed_at?: string
          assessed_by?: string | null
          complaint_id?: string
          customer_consented?: boolean
          drivers?: string[]
          id?: string
          org_id?: string
          review_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_vulnerability_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: true
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_vulnerability_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: true
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_vulnerability_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          ack_due: string | null
          adr_rights_given: boolean
          anonymised_at: string | null
          assigned_to: string | null
          assignment_source: string
          category: Database["public"]["Enums"]["complaint_category"]
          channel: Database["public"]["Enums"]["complaint_channel"]
          closed_at: string | null
          complainant_email: string | null
          complainant_name: string
          complainant_phone: string | null
          country_code: string
          created_at: string
          created_by: string | null
          customer_ref: string | null
          desired_outcome: string | null
          extended_due: string | null
          final_due: string | null
          goodwill_amount: number | null
          goodwill_currency: string | null
          goodwill_none: boolean
          holding_reason: string | null
          holding_sent_at: string | null
          id: string
          language: string
          legal_hold: boolean
          org_id: string
          outcome: Database["public"]["Enums"]["complaint_outcome"] | null
          priority: Database["public"]["Enums"]["complaint_priority"]
          privacy_processing: boolean
          product: Database["public"]["Enums"]["complaint_product"]
          received_at: string
          redress_amount: number | null
          redress_currency: string | null
          redress_none: boolean
          reference: string
          root_cause_category: string | null
          root_cause_id: string | null
          root_cause_note: string | null
          rule_set_id: string | null
          seq: number
          status: Database["public"]["Enums"]["complaint_status"]
          summary: string
          updated_at: string
          vulnerable: boolean
          vulnerable_note: string | null
          withdrawal_reason: string | null
        }
        Insert: {
          ack_due?: string | null
          adr_rights_given?: boolean
          anonymised_at?: string | null
          assigned_to?: string | null
          assignment_source?: string
          category: Database["public"]["Enums"]["complaint_category"]
          channel: Database["public"]["Enums"]["complaint_channel"]
          closed_at?: string | null
          complainant_email?: string | null
          complainant_name: string
          complainant_phone?: string | null
          country_code: string
          created_at?: string
          created_by?: string | null
          customer_ref?: string | null
          desired_outcome?: string | null
          extended_due?: string | null
          final_due?: string | null
          goodwill_amount?: number | null
          goodwill_currency?: string | null
          goodwill_none?: boolean
          holding_reason?: string | null
          holding_sent_at?: string | null
          id?: string
          language?: string
          legal_hold?: boolean
          org_id: string
          outcome?: Database["public"]["Enums"]["complaint_outcome"] | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          privacy_processing?: boolean
          product: Database["public"]["Enums"]["complaint_product"]
          received_at?: string
          redress_amount?: number | null
          redress_currency?: string | null
          redress_none?: boolean
          reference?: string
          root_cause_category?: string | null
          root_cause_id?: string | null
          root_cause_note?: string | null
          rule_set_id?: string | null
          seq?: number
          status?: Database["public"]["Enums"]["complaint_status"]
          summary: string
          updated_at?: string
          vulnerable?: boolean
          vulnerable_note?: string | null
          withdrawal_reason?: string | null
        }
        Update: {
          ack_due?: string | null
          adr_rights_given?: boolean
          anonymised_at?: string | null
          assigned_to?: string | null
          assignment_source?: string
          category?: Database["public"]["Enums"]["complaint_category"]
          channel?: Database["public"]["Enums"]["complaint_channel"]
          closed_at?: string | null
          complainant_email?: string | null
          complainant_name?: string
          complainant_phone?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          customer_ref?: string | null
          desired_outcome?: string | null
          extended_due?: string | null
          final_due?: string | null
          goodwill_amount?: number | null
          goodwill_currency?: string | null
          goodwill_none?: boolean
          holding_reason?: string | null
          holding_sent_at?: string | null
          id?: string
          language?: string
          legal_hold?: boolean
          org_id?: string
          outcome?: Database["public"]["Enums"]["complaint_outcome"] | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          privacy_processing?: boolean
          product?: Database["public"]["Enums"]["complaint_product"]
          received_at?: string
          redress_amount?: number | null
          redress_currency?: string | null
          redress_none?: boolean
          reference?: string
          root_cause_category?: string | null
          root_cause_id?: string | null
          root_cause_note?: string | null
          rule_set_id?: string | null
          seq?: number
          status?: Database["public"]["Enums"]["complaint_status"]
          summary?: string
          updated_at?: string
          vulnerable?: boolean
          vulnerable_note?: string | null
          withdrawal_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_root_cause_org_fk"
            columns: ["org_id", "root_cause_id"]
            isOneToOne: false
            referencedRelation: "root_causes"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "complaints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_letter_types: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          org_id: string
          requires_adr_block: boolean
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
          requires_adr_block?: boolean
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          requires_adr_block?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_letter_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          country_code: string
          holiday_date: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          country_code: string
          holiday_date: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          country_code?: string
          holiday_date?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      letters: {
        Row: {
          approved_by: string | null
          body: string
          complaint_id: string
          custom_type_id: string | null
          id: string
          kind: Database["public"]["Enums"]["template_kind"]
          language: string
          org_id: string
          sent_at: string
          sent_by: string
          status: string
          subject: string
        }
        Insert: {
          approved_by?: string | null
          body: string
          complaint_id: string
          custom_type_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["template_kind"]
          language: string
          org_id: string
          sent_at?: string
          sent_by?: string
          status?: string
          subject?: string
        }
        Update: {
          approved_by?: string | null
          body?: string
          complaint_id?: string
          custom_type_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["template_kind"]
          language?: string
          org_id?: string
          sent_at?: string
          sent_by?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "letters_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_custom_type_fkey"
            columns: ["org_id", "custom_type_id"]
            isOneToOne: false
            referencedRelation: "custom_letter_types"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "letters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      note_mentions: {
        Row: {
          complaint_id: string
          created_at: string
          event_id: string
          id: string
          mentioned_by: string
          mentioned_user: string
          org_id: string
          read_at: string | null
        }
        Insert: {
          complaint_id: string
          created_at?: string
          event_id: string
          id?: string
          mentioned_by: string
          mentioned_user: string
          org_id: string
          read_at?: string | null
        }
        Update: {
          complaint_id?: string
          created_at?: string
          event_id?: string
          id?: string
          mentioned_by?: string
          mentioned_user?: string
          org_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_mentions_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_mentions_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_mentions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "complaint_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_mentions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          in_app: boolean
          kind: string
          org_id: string
          user_id: string
        }
        Insert: {
          in_app?: boolean
          kind: string
          org_id: string
          user_id: string
        }
        Update: {
          in_app?: boolean
          kind?: string
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor: string | null
          complaint_id: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          link_path: string | null
          org_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor?: string | null
          complaint_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          link_path?: string | null
          org_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor?: string | null
          complaint_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          link_path?: string | null
          org_id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_countries: {
        Row: {
          adr_contact: string | null
          adr_name: string | null
          adr_website: string | null
          country_code: string
          id: string
          org_id: string
        }
        Insert: {
          adr_contact?: string | null
          adr_name?: string | null
          adr_website?: string | null
          country_code: string
          id?: string
          org_id: string
        }
        Update: {
          adr_contact?: string | null
          adr_name?: string | null
          adr_website?: string | null
          country_code?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_countries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          org_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          org_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          org_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          active: boolean
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_privacy_settings: {
        Row: {
          billing_cancellation_verified_at: string | null
          deletion_due_at: string | null
          deletion_requested_at: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          billing_cancellation_verified_at?: string | null
          deletion_due_at?: string | null
          deletion_requested_at?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          billing_cancellation_verified_at?: string | null
          deletion_due_at?: string | null
          deletion_requested_at?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_privacy_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          auto_assign_match_language: boolean
          auto_assign_mode: Database["public"]["Enums"]["auto_assign_mode"]
          auto_assign_sources: string[]
          base_currency: string
          complaints_email: string | null
          created_at: string
          created_by: string
          firm_address: string
          home_country: string | null
          id: string
          idle_timeout_minutes: number
          legal_name: string
          licence_type: Database["public"]["Enums"]["licence_type"]
          max_session_hours: number
          qa_required: boolean
          qa_sample_pct: number
          regulator: string | null
          reopen_deadline_mode: string
          require_2fa: boolean
          retention_years: number
          setup_complete: boolean
          time_zone: string
          trial_ends_at: string
        }
        Insert: {
          auto_assign_match_language?: boolean
          auto_assign_mode?: Database["public"]["Enums"]["auto_assign_mode"]
          auto_assign_sources?: string[]
          base_currency?: string
          complaints_email?: string | null
          created_at?: string
          created_by: string
          firm_address?: string
          home_country?: string | null
          id?: string
          idle_timeout_minutes?: number
          legal_name: string
          licence_type?: Database["public"]["Enums"]["licence_type"]
          max_session_hours?: number
          qa_required?: boolean
          qa_sample_pct?: number
          regulator?: string | null
          reopen_deadline_mode?: string
          require_2fa?: boolean
          retention_years?: number
          setup_complete?: boolean
          time_zone?: string
          trial_ends_at?: string
        }
        Update: {
          auto_assign_match_language?: boolean
          auto_assign_mode?: Database["public"]["Enums"]["auto_assign_mode"]
          auto_assign_sources?: string[]
          base_currency?: string
          complaints_email?: string | null
          created_at?: string
          created_by?: string
          firm_address?: string
          home_country?: string | null
          id?: string
          idle_timeout_minutes?: number
          legal_name?: string
          licence_type?: Database["public"]["Enums"]["licence_type"]
          max_session_hours?: number
          qa_required?: boolean
          qa_sample_pct?: number
          regulator?: string | null
          reopen_deadline_mode?: string
          require_2fa?: boolean
          retention_years?: number
          setup_complete?: boolean
          time_zone?: string
          trial_ends_at?: string
        }
        Relationships: []
      }
      privacy_operations: {
        Row: {
          actor: string | null
          complaint_id: string | null
          created_at: string
          detail: Json
          id: string
          kind: string
          org_id: string
        }
        Insert: {
          actor?: string | null
          complaint_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          org_id: string
        }
        Update: {
          actor?: string | null
          complaint_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          org_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      public_complaint_forms: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          logo_path: string | null
          org_id: string
          privacy_notice: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          logo_path?: string | null
          org_id: string
          privacy_notice?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          logo_path?: string | null
          org_id?: string
          privacy_notice?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_complaint_forms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_form_privacy_notices: {
        Row: {
          body: string
          form_id: string
          language: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          form_id: string
          language: string
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          form_id?: string
          language?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_form_privacy_notices_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "public_complaint_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_form_privacy_notices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_form_submissions: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          org_id: string
          privacy_notice: string
          privacy_notice_language: string | null
          privacy_notice_sha256: string | null
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id: string
          org_id: string
          privacy_notice: string
          privacy_notice_language?: string | null
          privacy_notice_sha256?: string | null
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          org_id?: string
          privacy_notice?: string
          privacy_notice_language?: string | null
          privacy_notice_sha256?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_form_submissions_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_form_submissions_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_form_submissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_reviews: {
        Row: {
          comments: string | null
          complaint_id: string
          created_at: string
          decided_at: string | null
          id: string
          kind: string
          letter_id: string | null
          org_id: string
          reviewer: string | null
          scorecard: Json | null
          status: string
        }
        Insert: {
          comments?: string | null
          complaint_id: string
          created_at?: string
          decided_at?: string | null
          id?: string
          kind: string
          letter_id?: string | null
          org_id: string
          reviewer?: string | null
          scorecard?: Json | null
          status?: string
        }
        Update: {
          comments?: string | null
          complaint_id?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          kind?: string
          letter_id?: string | null
          org_id?: string
          reviewer?: string | null
          scorecard?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_reviews_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_reviews_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_reviews_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      reopen_requests: {
        Row: {
          category: string
          complaint_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          org_id: string
          reason: string
          requested_by: string
          status: string
        }
        Insert: {
          category: string
          complaint_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          org_id: string
          reason: string
          requested_by: string
          status?: string
        }
        Update: {
          category?: string
          complaint_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          org_id?: string
          reason?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reopen_requests_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaint_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reopen_requests_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reopen_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      root_causes: {
        Row: {
          active: boolean
          id: string
          name: string
          org_id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
          org_id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
          org_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "root_causes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_set_assignments: {
        Row: {
          country_code: string | null
          id: string
          org_id: string
          product: string | null
          rule_set_id: string
        }
        Insert: {
          country_code?: string | null
          id?: string
          org_id: string
          product?: string | null
          rule_set_id: string
        }
        Update: {
          country_code?: string | null
          id?: string
          org_id?: string
          product?: string | null
          rule_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_set_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_set_assignments_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_sets: {
        Row: {
          ack_days: number
          created_at: string
          extended_days: number
          final_days: number
          id: string
          is_default: boolean
          name: string
          org_id: string
        }
        Insert: {
          ack_days?: number
          created_at?: string
          extended_days?: number
          final_days?: number
          id?: string
          is_default?: boolean
          name: string
          org_id: string
        }
        Update: {
          ack_days?: number
          created_at?: string
          extended_days?: number
          final_days?: number
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_sets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      session_security_events: {
        Row: {
          actor: string
          created_at: string
          id: string
          kind: string
          org_id: string
          session_id: string | null
          target_user: string
        }
        Insert: {
          actor: string
          created_at?: string
          id?: string
          kind: string
          org_id: string
          session_id?: string | null
          target_user: string
        }
        Update: {
          actor?: string
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          session_id?: string | null
          target_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_security_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          body: string
          custom_type_id: string | null
          id: string
          org_id: string
          restored_from: string | null
          saved_at: string
          saved_by: string | null
          subject: string
          template_id: string
        }
        Insert: {
          body: string
          custom_type_id?: string | null
          id?: string
          org_id: string
          restored_from?: string | null
          saved_at?: string
          saved_by?: string | null
          subject: string
          template_id: string
        }
        Update: {
          body?: string
          custom_type_id?: string | null
          id?: string
          org_id?: string
          restored_from?: string | null
          saved_at?: string
          saved_by?: string | null
          subject?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_custom_type_fkey"
            columns: ["org_id", "custom_type_id"]
            isOneToOne: false
            referencedRelation: "custom_letter_types"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "template_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_versions_restoration_fk"
            columns: ["org_id", "restored_from"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      templates: {
        Row: {
          body: string
          custom_type_id: string | null
          id: string
          kind: Database["public"]["Enums"]["template_kind"]
          language: string
          org_id: string
          restored_from: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          custom_type_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["template_kind"]
          language: string
          org_id: string
          restored_from?: string | null
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          custom_type_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["template_kind"]
          language?: string
          org_id?: string
          restored_from?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_custom_type_fkey"
            columns: ["org_id", "custom_type_id"]
            isOneToOne: false
            referencedRelation: "custom_letter_types"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      complaint_queue: {
        Row: {
          ack_due: string | null
          acknowledged_at: string | null
          adr_award_amount: number | null
          adr_award_currency: string | null
          adr_decision: string | null
          adr_decision_on: string | null
          adr_escalated_on: string | null
          anonymised_at: string | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["complaint_category"] | null
          channel: Database["public"]["Enums"]["complaint_channel"] | null
          closed_at: string | null
          complainant_email: string | null
          complainant_name: string | null
          complainant_phone: string | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          current_due: string | null
          customer_ref: string | null
          days_left: number | null
          desired_outcome: string | null
          extended_due: string | null
          final_due: string | null
          goodwill_amount: number | null
          goodwill_currency: string | null
          has_reopened: boolean | null
          holding_reason: string | null
          holding_sent_at: string | null
          id: string | null
          language: string | null
          legal_hold: boolean | null
          org_id: string | null
          outcome: Database["public"]["Enums"]["complaint_outcome"] | null
          priority: Database["public"]["Enums"]["complaint_priority"] | null
          product: Database["public"]["Enums"]["complaint_product"] | null
          received_at: string | null
          redress_amount: number | null
          redress_currency: string | null
          reference: string | null
          resolved_within_deadline: boolean | null
          root_cause_category: string | null
          root_cause_id: string | null
          root_cause_note: string | null
          rule_set_id: string | null
          seq: number | null
          status: Database["public"]["Enums"]["complaint_status"] | null
          summary: string | null
          updated_at: string | null
          vulnerable: boolean | null
          vulnerable_note: string | null
          acknowledgement_on_time: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_root_cause_org_fk"
            columns: ["org_id", "root_cause_id"]
            isOneToOne: false
            referencedRelation: "root_causes"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "complaints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_org_invite: { Args: { _hash: string }; Returns: string }
      acknowledgement_on_time: {
        Args: { "": Database["public"]["Views"]["complaint_queue"]["Row"] }
        Returns: {
          error: true
        } & "the function public.acknowledgement_on_time with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
      }
      add_business_days: {
        Args: { _country: string; _n: number; _org: string; _start: string }
        Returns: string
      }
      add_note_with_mentions: {
        Args: { _complaint_id: string; _mentions?: string[]; _text: string }
        Returns: string
      }
      audit_minimise: { Args: { _row: Json; _table: string }; Returns: Json }
      business_days_between: {
        Args: { _country: string; _from: string; _org: string; _to: string }
        Returns: number
      }
      can_read_mention_case: {
        Args: { _case: string; _org: string; _user: string }
        Returns: boolean
      }
      can_request_reopen: {
        Args: { _case: string; _org: string }
        Returns: boolean
      }
      case_mention_members: {
        Args: { _complaint_id: string }
        Returns: {
          name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      case_reopen_requests: {
        Args: { _case: string; _org: string }
        Returns: Json
      }
      case_timeline_page: {
        Args: {
          _case: string
          _cursor_id?: string
          _cursor_time?: string
          _groups?: string[]
          _mine?: boolean
          _oldest?: boolean
          _query?: string
        }
        Returns: Json
      }
      change_org_member: {
        Args: {
          _active: boolean
          _member: string
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      complaint_deadlines: {
        Args: {
          _country: string
          _org: string
          _product: string
          _received: string
        }
        Returns: Json
      }
      create_org_invite: {
        Args: {
          _email: string
          _hash: string
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      create_organisation: { Args: { _legal_name: string }; Returns: string }
      decide_reopen_request: {
        Args: {
          _decision: string
          _mode?: string
          _note?: string
          _request: string
        }
        Returns: undefined
      }
      edit_complaint_details: {
        Args: { _case: string; _org: string; _patch: Json; _reason: string }
        Returns: undefined
      }
      firm_date: { Args: { _at: string; _org: string }; Returns: string }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      is_business_day: {
        Args: { _country: string; _d: string; _org: string }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      is_public_firm_logo: { Args: { _path: string }; Returns: boolean }
      mask_session_ip: { Args: { _ip: unknown }; Returns: string }
      my_organisations: { Args: never; Returns: Json }
      my_session_limits: {
        Args: never
        Returns: {
          idle_timeout_minutes: number
          max_session_hours: number
        }[]
      }
      my_sessions: {
        Args: never
        Returns: {
          aal: string
          created_at: string
          id: string
          ip: string
          is_current: boolean
          last_active: string
          user_agent: string
        }[]
      }
      notification_deadline_job: { Args: { _at?: string }; Returns: number }
      notification_retention_job: { Args: never; Returns: number }
      org_member_directory: {
        Args: { _org: string }
        Returns: {
          active: boolean
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      org_session_summary: {
        Args: { _org: string }
        Returns: {
          last_active: string
          session_count: number
          user_id: string
        }[]
      }
      pick_assignee: {
        Args: { _complaint: string; _org: string }
        Returns: string
      }
      privacy_anonymise_case: {
        Args: {
          _actor: string
          _case: string
          _org: string
          _reason: string
          _retention?: boolean
        }
        Returns: undefined
      }
      privacy_cancel_org_deletion: {
        Args: { _org: string }
        Returns: undefined
      }
      privacy_change_hold: {
        Args: { _actor: string; _case: string; _held: boolean; _org: string }
        Returns: undefined
      }
      privacy_claim_case: {
        Args: { _case: string; _org: string; _retention?: boolean }
        Returns: undefined
      }
      privacy_purge_org: { Args: { _org: string }; Returns: undefined }
      privacy_request_org_deletion: {
        Args: { _confirm: string; _org: string }
        Returns: undefined
      }
      privacy_retention_candidates: {
        Args: never
        Returns: {
          org_id: string
          retention_years: number
        }[]
      }
      privacy_set_retention: {
        Args: { _org: string; _years: number }
        Returns: undefined
      }
      public_form_details:
        | { Args: { _id: string }; Returns: Json }
        | { Args: { _id: string; _language: string }; Returns: Json }
      public_form_notice_receipt: {
        Args: { _case: string; _org: string }
        Returns: Json
      }
      rebalance_complaint: {
        Args: { _complaint: string; _org: string }
        Returns: string
      }
      recalculate_complaint: {
        Args: { _case: string; _org: string; _reason: string }
        Returns: undefined
      }
      recovery_attempt: {
        Args: { _org: string; _user: string }
        Returns: boolean
      }
      recovery_consume: {
        Args: { _hash: string; _org: string; _user: string }
        Returns: boolean
      }
      recovery_store: {
        Args: { _hashes: Json; _org: string }
        Returns: undefined
      }
      remove_complaint_attachment: {
        Args: { _attachment: string; _org: string; _reason: string }
        Returns: undefined
      }
      reopen_complaint: {
        Args: {
          _case: string
          _category: string
          _mode?: string
          _org: string
          _reason: string
        }
        Returns: undefined
      }
      reopen_deadlines: {
        Args: { _case: string; _mode: string; _org: string }
        Returns: Json
      }
      reorder_root_causes: {
        Args: { _ids: string[]; _org: string }
        Returns: undefined
      }
      request_reopen: {
        Args: {
          _case: string
          _category: string
          _org: string
          _reason: string
        }
        Returns: string
      }
      resolve_rule_set: {
        Args: { _country: string; _org: string; _product: string }
        Returns: string
      }
      revoke_member_sessions: {
        Args: { _org: string; _user: string }
        Returns: undefined
      }
      revoke_my_session: { Args: { _session: string }; Returns: undefined }
      revoke_org_invite: {
        Args: { _invite: string; _org: string }
        Returns: undefined
      }
      save_rule_assignment: {
        Args: {
          _country: string
          _org: string
          _product: string
          _rule: string
        }
        Returns: undefined
      }
      seed_templates: { Args: { _org: string }; Returns: undefined }
      session_expiry_job: { Args: { _at?: string }; Returns: number }
      set_default_rule: {
        Args: { _org: string; _rule: string }
        Returns: undefined
      }
      submit_public_complaint: {
        Args: { _data: Json; _form_id: string; _submission_id: string }
        Returns: string
      }
      timeline_group: { Args: { _kind: string }; Returns: string }
      transfer_org_admin: {
        Args: { _member: string; _org: string }
        Returns: undefined
      }
      valid_time_zone: { Args: { _zone: string }; Returns: boolean }
      withdraw_reopen_request: {
        Args: { _request: string }
        Returns: undefined
      }
      workload_summary: {
        Args: { _org: string }
        Returns: {
          accepting_new: boolean
          ack_overdue: number
          agent_name: string
          away_from: string
          away_until: string
          due_soon: number
          high_priority_open: number
          languages: string[]
          max_open_cases: number
          open_cases: number
          overdue: number
          received_30: number
          user_id: string
          vulnerable_open: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "org_admin"
        | "complaints_manager"
        | "agent"
        | "qa_reviewer"
        | "read_only"
      attachment_category:
        | "customer_evidence"
        | "firm_document"
        | "correspondence"
        | "other"
      auto_assign_mode: "off" | "least_loaded" | "round_robin"
      complaint_category:
        | "unauthorised_transaction"
        | "fraud_or_scam"
        | "fees_and_charges"
        | "account_blocked_or_closed"
        | "payment_delay_or_failure"
        | "refund_or_chargeback"
        | "customer_service"
        | "data_protection"
        | "other"
      complaint_channel:
        | "email"
        | "phone"
        | "chat"
        | "letter"
        | "web_form"
        | "social_media"
        | "in_person"
      complaint_outcome:
        | "upheld"
        | "partially_upheld"
        | "not_upheld"
        | "withdrawn"
      complaint_priority: "standard" | "high"
      complaint_product:
        | "payment_account"
        | "card"
        | "credit_transfer"
        | "direct_debit"
        | "e_money_wallet"
        | "merchant_acquiring"
        | "other"
      complaint_status:
        | "received"
        | "acknowledged"
        | "under_investigation"
        | "holding_response_sent"
        | "final_response_sent"
        | "closed"
        | "escalated_to_adr"
        | "reopened"
        | "pending_qa"
      licence_type:
        | "payment_institution"
        | "e_money_institution"
        | "credit_institution"
        | "other"
      template_kind:
        | "acknowledgement"
        | "holding"
        | "final_upheld"
        | "final_partially_upheld"
        | "final_not_upheld"
        | "information_request"
        | "closure"
        | "custom"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "org_admin",
        "complaints_manager",
        "agent",
        "qa_reviewer",
        "read_only",
      ],
      attachment_category: [
        "customer_evidence",
        "firm_document",
        "correspondence",
        "other",
      ],
      auto_assign_mode: ["off", "least_loaded", "round_robin"],
      complaint_category: [
        "unauthorised_transaction",
        "fraud_or_scam",
        "fees_and_charges",
        "account_blocked_or_closed",
        "payment_delay_or_failure",
        "refund_or_chargeback",
        "customer_service",
        "data_protection",
        "other",
      ],
      complaint_channel: [
        "email",
        "phone",
        "chat",
        "letter",
        "web_form",
        "social_media",
        "in_person",
      ],
      complaint_outcome: [
        "upheld",
        "partially_upheld",
        "not_upheld",
        "withdrawn",
      ],
      complaint_priority: ["standard", "high"],
      complaint_product: [
        "payment_account",
        "card",
        "credit_transfer",
        "direct_debit",
        "e_money_wallet",
        "merchant_acquiring",
        "other",
      ],
      complaint_status: [
        "received",
        "acknowledged",
        "under_investigation",
        "holding_response_sent",
        "final_response_sent",
        "closed",
        "escalated_to_adr",
        "reopened",
        "pending_qa",
      ],
      licence_type: [
        "payment_institution",
        "e_money_institution",
        "credit_institution",
        "other",
      ],
      template_kind: [
        "acknowledgement",
        "holding",
        "final_upheld",
        "final_partially_upheld",
        "final_not_upheld",
        "information_request",
        "closure",
        "custom",
      ],
    },
  },
} as const
