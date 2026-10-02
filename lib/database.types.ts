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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean
          show_late_button: boolean
          teachers_can_view_all: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          show_late_button?: boolean
          teachers_can_view_all?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          show_late_button?: boolean
          teachers_can_view_all?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string
          comment: string | null
          date: string
          id: string
          last_modified_at: string
          last_modified_by: string
          recorded_at: string
          recorded_by: string
          status: string
          student_id: string
        }
        Insert: {
          class_id: string
          comment?: string | null
          date: string
          id?: string
          last_modified_at?: string
          last_modified_by: string
          recorded_at?: string
          recorded_by: string
          status: string
          student_id: string
        }
        Update: {
          class_id?: string
          comment?: string | null
          date?: string
          id?: string
          last_modified_at?: string
          last_modified_by?: string
          recorded_at?: string
          recorded_by?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_review_replies: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          review_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          review_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_review_replies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "class_weekly_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      class_weekly_reviews: {
        Row: {
          body: string
          class_id: string
          id: string
          last_modified_at: string
          last_modified_by: string
          recorded_at: string
          recorded_by: string
          week_start: string
        }
        Insert: {
          body?: string
          class_id: string
          id?: string
          last_modified_at?: string
          last_modified_by: string
          recorded_at?: string
          recorded_by: string
          week_start: string
        }
        Update: {
          body?: string
          class_id?: string
          id?: string
          last_modified_at?: string
          last_modified_by?: string
          recorded_at?: string
          recorded_by?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_weekly_reviews_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_weekly_reviews_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_weekly_reviews_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      student_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          student_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          student_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_id: string
          created_at: string
          enrolled_date: string
          grade: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          class_id: string
          created_at?: string
          enrolled_date?: string
          grade?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          class_id?: string
          created_at?: string
          enrolled_date?: string
          grade?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_attendance: {
        Row: {
          comment: string | null
          date: string
          id: string
          last_modified_at: string
          last_modified_by: string
          recorded_at: string
          recorded_by: string
          status: string
          teacher_id: string
        }
        Insert: {
          comment?: string | null
          date: string
          id?: string
          last_modified_at?: string
          last_modified_by: string
          recorded_at?: string
          recorded_by: string
          status: string
          teacher_id: string
        }
        Update: {
          comment?: string | null
          date?: string
          id?: string
          last_modified_at?: string
          last_modified_by?: string
          recorded_at?: string
          recorded_by?: string
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_classes: {
        Row: {
          class_id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_invite_classes: {
        Row: {
          class_id: string
          invite_id: string
        }
        Insert: {
          class_id: string
          invite_id: string
        }
        Update: {
          class_id?: string
          invite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_invite_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_invite_classes_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "teacher_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_invites: {
        Row: {
          email: string
          id: string
          invited_at: string
          invited_by: string
          name: string
          role: string
        }
        Insert: {
          email: string
          id?: string
          invited_at?: string
          invited_by: string
          name: string
          role: string
        }
        Update: {
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string
          name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          name: string
          role: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_class: { Args: { target_class_id: string }; Returns: boolean }
      claim_teacher_invite: { Args: never; Returns: boolean }
      class_month_stats: {
        Args: { p_month: string }
        Returns: {
          absent_count: number
          class_id: string
          class_name: string
          expected_slots: number
          late_count: number
          present_count: number
          present_rate: number
          recorded_count: number
          worship_count: number
        }[]
      }
      current_role_name: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_attendance_teacher: {
        Args: { target_teacher_id: string }
        Returns: boolean
      }
      is_pastor: { Args: never; Returns: boolean }
      list_attendance_teachers: {
        Args: never
        Returns: {
          class_names: string[]
          id: string
          name: string
        }[]
      }
      list_teacher_names: {
        Args: { ids: string[] }
        Returns: {
          id: string
          name: string
        }[]
      }
      student_month_stats: {
        Args: { p_class_id: string; p_month: string }
        Returns: {
          absent_count: number
          grade: string
          late_count: number
          present_count: number
          present_rate: number
          recorded_count: number
          student_id: string
          student_name: string
          worship_count: number
        }[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
