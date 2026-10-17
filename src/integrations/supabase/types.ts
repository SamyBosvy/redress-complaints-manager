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
          holding_reason: string | null
          holding_sent_at: string | null
          id: string
          language: string
          org_id: string
          outcome: Database["public"]["Enums"]["complaint_outcome"] | null
          priority: Database["public"]["Enums"]["complaint_priority"]
          product: Database["public"]["Enums"]["complaint_product"]
          received_at: string
          redress_amount: number | null
          redress_currency: string | null
          reference: string
          root_cause_category: string | null
          root_cause_note: string | null
          rule_set_id: string | null
          seq: number
          status: Database["public"]["Enums"]["complaint_status"]
          summary: string
          updated_at: string
          vulnerable: boolean
          vulnerable_note: string | null
        }
        Insert: {
          ack_due?: string | null
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
          holding_reason?: string | null
          holding_sent_at?: string | null
          id?: string
          language?: string
          org_id: string
          outcome?: Database["public"]["Enums"]["complaint_outcome"] | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          product: Database["public"]["Enums"]["complaint_product"]
          received_at?: string
          redress_amount?: number | null
          redress_currency?: string | null
          reference?: string
          root_cause_category?: string | null
          root_cause_note?: string | null
          rule_set_id?: string | null
          seq?: number
          status?: Database["public"]["Enums"]["complaint_status"]
          summary: string
          updated_at?: string
          vulnerable?: boolean
          vulnerable_note?: string | null
        }
        Update: {
          ack_due?: string | null
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
          holding_reason?: string | null
          holding_sent_at?: string | null
          id?: string
          language?: string
          org_id?: string
          outcome?: Database["public"]["Enums"]["complaint_outcome"] | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          product?: Database["public"]["Enums"]["complaint_product"]
          received_at?: string
          redress_amount?: number | null
          redress_currency?: string | null
          reference?: string
          root_cause_category?: string | null
          root_cause_note?: string | null
          rule_set_id?: string | null
          seq?: number
          status?: Database["public"]["Enums"]["complaint_status"]
          summary?: string
          updated_at?: string
          vulnerable?: boolean
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
          body: string
          complaint_id: string
          id: string
          kind: Database["public"]["Enums"]["template_kind"]
          language: string
          org_id: string
          sent_at: string
          sent_by: string
          subject: string
        }
        Insert: {
          body: string
          complaint_id: string
          id?: string
          kind: Database["public"]["Enums"]["template_kind"]
          language: string
          org_id: string
          sent_at?: string
          sent_by?: string
          subject?: string
        }
        Update: {
          body?: string
          complaint_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["template_kind"]
          language?: string
          org_id?: string
          sent_at?: string
          sent_by?: string
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
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      organisations: {
        Row: {
          created_at: string
          created_by: string
          home_country: string | null
          id: string
          legal_name: string
          licence_type: Database["public"]["Enums"]["licence_type"]
          qa_required: boolean
          qa_sample_pct: number
          regulator: string | null
          retention_years: number
          setup_complete: boolean
          trial_ends_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          home_country?: string | null
          id?: string
          legal_name: string
          licence_type?: Database["public"]["Enums"]["licence_type"]
          qa_required?: boolean
          qa_sample_pct?: number
          regulator?: string | null
          retention_years?: number
          setup_complete?: boolean
          trial_ends_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          home_country?: string | null
          id?: string
          legal_name?: string
          licence_type?: Database["public"]["Enums"]["licence_type"]
          qa_required?: boolean
          qa_sample_pct?: number
          regulator?: string | null
          retention_years?: number
          setup_complete?: boolean
          trial_ends_at?: string
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
      add_business_days: {
        Args: { _country: string; _n: number; _org: string; _start: string }
        Returns: string
      }
      business_days_between: {
        Args: { _country: string; _from: string; _org: string; _to: string }
        Returns: number
      }
      create_organisation: { Args: { _legal_name: string }; Returns: string }
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
      resolve_rule_set: {
        Args: { _country: string; _org: string; _product: string }
        Returns: string
      }
      seed_templates: { Args: { _org: string }; Returns: undefined }
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
