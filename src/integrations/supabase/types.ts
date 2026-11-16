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
      complaints: {
        Row: {
          ack_due: string | null
          adr_rights_given: boolean
          anonymised_at: string | null
          assigned_to: string | null
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
            foreignKeyName: "letters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          complaint_id: string | null
          created_at: string
          id: string
          kind: string
          org_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          complaint_id?: string | null
          created_at?: string
          id?: string
          kind: string
          org_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          complaint_id?: string | null
          created_at?: string
          id?: string
          kind?: string
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
          base_currency: string
          created_at: string
          created_by: string
          firm_address: string
          home_country: string | null
          id: string
          legal_name: string
          licence_type: Database["public"]["Enums"]["licence_type"]
          qa_required: boolean
          qa_sample_pct: number
          regulator: string | null
          require_2fa: boolean
          retention_years: number
          setup_complete: boolean
          trial_ends_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          created_by: string
          firm_address?: string
          home_country?: string | null
          id?: string
          legal_name: string
          licence_type?: Database["public"]["Enums"]["licence_type"]
          qa_required?: boolean
          qa_sample_pct?: number
          regulator?: string | null
          require_2fa?: boolean
          retention_years?: number
          setup_complete?: boolean
          trial_ends_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          created_by?: string
          firm_address?: string
          home_country?: string | null
          id?: string
          legal_name?: string
          licence_type?: Database["public"]["Enums"]["licence_type"]
          qa_required?: boolean
          qa_sample_pct?: number
          regulator?: string | null
          require_2fa?: boolean
          retention_years?: number
          setup_complete?: boolean
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
      public_form_submissions: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          org_id: string
          privacy_notice: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id: string
          org_id: string
          privacy_notice: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          org_id?: string
          privacy_notice?: string
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
      templates: {
        Row: {
          body: string
          id: string
          kind: Database["public"]["Enums"]["template_kind"]
          language: string
          org_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          id?: string
          kind: Database["public"]["Enums"]["template_kind"]
          language: string
          org_id: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          kind?: Database["public"]["Enums"]["template_kind"]
          language?: string
          org_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
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
          root_cause_category: string | null
          root_cause_note: string | null
          rule_set_id: string | null
          seq: number | null
          status: Database["public"]["Enums"]["complaint_status"] | null
          summary: string | null
          updated_at: string | null
          vulnerable: boolean | null
          vulnerable_note: string | null
        }
        Insert: {
          ack_due?: string | null
          anonymised_at?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["complaint_category"] | null
          channel?: Database["public"]["Enums"]["complaint_channel"] | null
          closed_at?: string | null
          complainant_email?: string | null
          complainant_name?: string | null
          complainant_phone?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          current_due?: never
          customer_ref?: string | null
          days_left?: never
          desired_outcome?: string | null
          extended_due?: string | null
          final_due?: string | null
          goodwill_amount?: number | null
          goodwill_currency?: string | null
          holding_reason?: string | null
          holding_sent_at?: string | null
          id?: string | null
          language?: string | null
          legal_hold?: boolean | null
          org_id?: string | null
          outcome?: Database["public"]["Enums"]["complaint_outcome"] | null
          priority?: Database["public"]["Enums"]["complaint_priority"] | null
          product?: Database["public"]["Enums"]["complaint_product"] | null
          received_at?: string | null
          redress_amount?: number | null
          redress_currency?: string | null
          reference?: string | null
          root_cause_category?: string | null
          root_cause_note?: string | null
          rule_set_id?: string | null
          seq?: number | null
          status?: Database["public"]["Enums"]["complaint_status"] | null
          summary?: string | null
          updated_at?: string | null
          vulnerable?: boolean | null
          vulnerable_note?: string | null
        }
        Update: {
          ack_due?: string | null
          anonymised_at?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["complaint_category"] | null
          channel?: Database["public"]["Enums"]["complaint_channel"] | null
          closed_at?: string | null
          complainant_email?: string | null
          complainant_name?: string | null
          complainant_phone?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          current_due?: never
          customer_ref?: string | null
          days_left?: never
          desired_outcome?: string | null
          extended_due?: string | null
          final_due?: string | null
          goodwill_amount?: number | null
          goodwill_currency?: string | null
          holding_reason?: string | null
          holding_sent_at?: string | null
          id?: string | null
          language?: string | null
          legal_hold?: boolean | null
          org_id?: string | null
          outcome?: Database["public"]["Enums"]["complaint_outcome"] | null
          priority?: Database["public"]["Enums"]["complaint_priority"] | null
          product?: Database["public"]["Enums"]["complaint_product"] | null
          received_at?: string | null
          redress_amount?: number | null
          redress_currency?: string | null
          reference?: string | null
          root_cause_category?: string | null
          root_cause_note?: string | null
          rule_set_id?: string | null
          seq?: number | null
          status?: Database["public"]["Enums"]["complaint_status"] | null
          summary?: string | null
          updated_at?: string | null
          vulnerable?: boolean | null
          vulnerable_note?: string | null
        }
        Relationships: [
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
      add_business_days: {
        Args: { _country: string; _n: number; _org: string; _start: string }
        Returns: string
      }
      audit_minimise: { Args: { _row: Json; _table: string }; Returns: Json }
      business_days_between: {
        Args: { _country: string; _from: string; _org: string; _to: string }
        Returns: number
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
      edit_complaint_details: {
        Args: { _case: string; _org: string; _patch: Json; _reason: string }
        Returns: undefined
      }
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
      my_organisations: { Args: never; Returns: Json }
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
      public_form_details: { Args: { _id: string }; Returns: Json }
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
      resolve_rule_set: {
        Args: { _country: string; _org: string; _product: string }
        Returns: string
      }
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
      set_default_rule: {
        Args: { _org: string; _rule: string }
        Returns: undefined
      }
      submit_public_complaint: {
        Args: { _data: Json; _form_id: string; _submission_id: string }
        Returns: string
      }
      transfer_org_admin: {
        Args: { _member: string; _org: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "org_admin"
        | "complaints_manager"
        | "agent"
        | "qa_reviewer"
        | "read_only"
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
      ],
    },
  },
} as const
