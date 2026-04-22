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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          address: string | null
          booking_status: string
          city: string | null
          course: string
          created_at: string
          date_of_birth: string | null
          email: string
          fee: string | null
          first_name: string
          gender: string | null
          id: string
          is_retest: boolean
          issuing_country: string | null
          issuing_state: string | null
          last_name: string
          license_expiration: string | null
          license_number: string | null
          location: string
          location_label: string
          payment_status: string
          phone: string
          referral_source: string | null
          result: string | null
          roster_comment: string | null
          schedule_date: string | null
          schedule_id: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          booking_status?: string
          city?: string | null
          course: string
          created_at?: string
          date_of_birth?: string | null
          email: string
          fee?: string | null
          first_name: string
          gender?: string | null
          id?: string
          is_retest?: boolean
          issuing_country?: string | null
          issuing_state?: string | null
          last_name: string
          license_expiration?: string | null
          license_number?: string | null
          location: string
          location_label: string
          payment_status?: string
          phone: string
          referral_source?: string | null
          result?: string | null
          roster_comment?: string | null
          schedule_date?: string | null
          schedule_id?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          booking_status?: string
          city?: string | null
          course?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string
          fee?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          is_retest?: boolean
          issuing_country?: string | null
          issuing_state?: string | null
          last_name?: string
          license_expiration?: string | null
          license_number?: string | null
          location?: string
          location_label?: string
          payment_status?: string
          phone?: string
          referral_source?: string | null
          result?: string | null
          roster_comment?: string | null
          schedule_date?: string | null
          schedule_id?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissed_weekends: {
        Row: {
          created_at: string
          date: string
          dismissed_by: string
          id: string
        }
        Insert: {
          created_at?: string
          date: string
          dismissed_by: string
          id?: string
        }
        Update: {
          created_at?: string
          date?: string
          dismissed_by?: string
          id?: string
        }
        Relationships: []
      }
      employee_logins: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          bio: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          must_change_password: boolean
          phone: string | null
          photo_position_x: number
          photo_position_y: number
          photo_url: string | null
          photo_zoom: number
          position: string | null
          show_on_website: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          phone?: string | null
          photo_position_x?: number
          photo_position_y?: number
          photo_url?: string | null
          photo_zoom?: number
          position?: string | null
          show_on_website?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          phone?: string | null
          photo_position_x?: number
          photo_position_y?: number
          photo_url?: string | null
          photo_zoom?: number
          position?: string | null
          show_on_website?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      instructor_assignments: {
        Row: {
          assigned_by: string | null
          assignment_role: string
          created_at: string
          employee_id: string
          id: string
          schedule_id: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_role?: string
          created_at?: string
          employee_id: string
          id?: string
          schedule_id: string
        }
        Update: {
          assigned_by?: string | null
          assignment_role?: string
          created_at?: string
          employee_id?: string
          id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_availability: {
        Row: {
          created_at: string
          id: string
          schedule_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          schedule_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          schedule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_availability_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_date_availability: {
        Row: {
          created_at: string
          date: string
          id: string
          location: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          location: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          location?: string
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          page_name: string | null
          page_path: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_name?: string | null
          page_path: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_name?: string | null
          page_path?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      referral_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          course: string
          created_at: string
          created_by: string | null
          date: string
          group_name: string | null
          id: string
          location: string
          location_label: string
          price: string
          schedule: string
          spots_available: number
          updated_at: string
        }
        Insert: {
          course: string
          created_at?: string
          created_by?: string | null
          date: string
          group_name?: string | null
          id?: string
          location: string
          location_label: string
          price: string
          schedule: string
          spots_available?: number
          updated_at?: string
        }
        Update: {
          course?: string
          created_at?: string
          created_by?: string | null
          date?: string
          group_name?: string | null
          id?: string
          location?: string
          location_label?: string
          price?: string
          schedule?: string
          spots_available?: number
          updated_at?: string
        }
        Relationships: []
      }
      security_questions: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          question_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          question_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          question_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          content_key: string
          content_value: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_key: string
          content_value?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_key?: string
          content_value?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "employee" | "manager" | "owner"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "moderator", "employee", "manager", "owner"],
    },
  },
} as const
