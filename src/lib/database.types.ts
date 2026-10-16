// Design Ref: §4 — Supabase 표 구조에서 자동으로 만든 타입 파일이다. 직접 고치지 않는다.
// 표 구조를 바꾸면 supabase/migrations에 새 SQL을 추가해 적용한 뒤 아래 명령으로 다시 만든다.
//   supabase gen types typescript --project-id <프로젝트 ref> --schema public > src/lib/database.types.ts

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
      analysis_log: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      extracted_values: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          item_id: string
          source_quote: string | null
          source_ref: string | null
          status: string
          unit: string | null
          unverifiable_reason: string | null
          user_id: string
          value_number: number | null
          value_text: string | null
          value_year: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          item_id: string
          source_quote?: string | null
          source_ref?: string | null
          status: string
          unit?: string | null
          unverifiable_reason?: string | null
          user_id?: string
          value_number?: number | null
          value_text?: string | null
          value_year?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          item_id?: string
          source_quote?: string | null
          source_ref?: string | null
          status?: string
          unit?: string | null
          unverifiable_reason?: string | null
          user_id?: string
          value_number?: number | null
          value_text?: string | null
          value_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extracted_values_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_values_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_texts: {
        Row: {
          char_count: number
          content: string
          created_at: string
          institution_id: string
          page_count: number
          user_id: string
        }
        Insert: {
          char_count: number
          content: string
          created_at?: string
          institution_id: string
          page_count: number
          user_id?: string
        }
        Update: {
          char_count?: number
          content?: string
          created_at?: string
          institution_id?: string
          page_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_texts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          base_year: number | null
          created_at: string
          failure_reason: string | null
          id: string
          is_home: boolean
          name: string
          normalized_name: string | null
          saved_at: string | null
          source_ref: string
          source_type: string
          started_at: string
          status: string
          step: string | null
          user_id: string
        }
        Insert: {
          base_year?: number | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          is_home?: boolean
          name: string
          normalized_name?: string | null
          saved_at?: string | null
          source_ref: string
          source_type: string
          started_at?: string
          status?: string
          step?: string | null
          user_id?: string
        }
        Update: {
          base_year?: number | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          is_home?: boolean
          name?: string
          normalized_name?: string | null
          saved_at?: string | null
          source_ref?: string
          source_type?: string
          started_at?: string
          status?: string
          step?: string | null
          user_id?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number
          user_id: string
          value_type: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          user_id?: string
          value_type: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          user_id?: string
          value_type?: string
        }
        Relationships: []
      }
      login_failures: {
        Row: {
          created_at: string
          email_hash: string
          id: number
        }
        Insert: {
          created_at?: string
          email_hash: string
          id?: never
        }
        Update: {
          created_at?: string
          email_hash?: string
          id?: never
        }
        Relationships: []
      }
      usage_log: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      login_is_blocked: { Args: { p_email_hash: string }; Returns: boolean }
      login_record_failure: {
        Args: { p_email_hash: string }
        Returns: undefined
      }
      read_sources: { Args: { p_id: string }; Returns: string[] }
      save_institution: {
        Args: { p_id: string; p_overwrite: boolean; p_year: number }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
