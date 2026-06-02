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
      auto_email_templates: {
        Row: {
          attachments: Json
          available_variables: string[]
          body: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          match_course: string | null
          match_group: string | null
          match_location: string | null
          name: string
          subject: string
          trigger_event: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attachments?: Json
          available_variables?: string[]
          body: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          match_course?: string | null
          match_group?: string | null
          match_location?: string | null
          name: string
          subject: string
          trigger_event: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attachments?: Json
          available_variables?: string[]
          body?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          match_course?: string | null
          match_group?: string | null
          match_location?: string | null
          name?: string
          subject?: string
          trigger_event?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          address: string | null
          booking_status: string
          city: string | null
          course: string
          created_at: string
          date_of_birth: string | null
          dl389_completed: boolean
          dl389_completed_at: string | null
          dl389_completed_by: string | null
          dropped: boolean
          dropped_at: string | null
          dropped_by: string | null
          dropped_reason: string | null
          email: string
          fee: string | null
          first_name: string
          gender: string | null
          guardian_id_photo_path: string | null
          id: string
          id_photo_path: string | null
          is_retest: boolean
          issuing_country: string | null
          issuing_state: string | null
          last_name: string
          license_expiration: string | null
          license_number: string | null
          location: string
          location_label: string
          middle_name: string | null
          needs_reschedule: boolean
          original_course: string | null
          original_location_label: string | null
          original_schedule_date: string | null
          original_schedule_id: string | null
          payment_provider: string | null
          payment_status: string
          phone: string
          preferred_name: string | null
          referral_source: string | null
          reschedule_part: string | null
          reschedule_reason: string | null
          rescheduled_at: string | null
          rescheduled_by: string | null
          result: string | null
          retest_type: string | null
          roster_comment: string | null
          schedule_date: string | null
          schedule_id: string | null
          state: string | null
          updated_at: string
          waiver_id: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          booking_status?: string
          city?: string | null
          course: string
          created_at?: string
          date_of_birth?: string | null
          dl389_completed?: boolean
          dl389_completed_at?: string | null
          dl389_completed_by?: string | null
          dropped?: boolean
          dropped_at?: string | null
          dropped_by?: string | null
          dropped_reason?: string | null
          email: string
          fee?: string | null
          first_name: string
          gender?: string | null
          guardian_id_photo_path?: string | null
          id?: string
          id_photo_path?: string | null
          is_retest?: boolean
          issuing_country?: string | null
          issuing_state?: string | null
          last_name: string
          license_expiration?: string | null
          license_number?: string | null
          location: string
          location_label: string
          middle_name?: string | null
          needs_reschedule?: boolean
          original_course?: string | null
          original_location_label?: string | null
          original_schedule_date?: string | null
          original_schedule_id?: string | null
          payment_provider?: string | null
          payment_status?: string
          phone: string
          preferred_name?: string | null
          referral_source?: string | null
          reschedule_part?: string | null
          reschedule_reason?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
          result?: string | null
          retest_type?: string | null
          roster_comment?: string | null
          schedule_date?: string | null
          schedule_id?: string | null
          state?: string | null
          updated_at?: string
          waiver_id?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          booking_status?: string
          city?: string | null
          course?: string
          created_at?: string
          date_of_birth?: string | null
          dl389_completed?: boolean
          dl389_completed_at?: string | null
          dl389_completed_by?: string | null
          dropped?: boolean
          dropped_at?: string | null
          dropped_by?: string | null
          dropped_reason?: string | null
          email?: string
          fee?: string | null
          first_name?: string
          gender?: string | null
          guardian_id_photo_path?: string | null
          id?: string
          id_photo_path?: string | null
          is_retest?: boolean
          issuing_country?: string | null
          issuing_state?: string | null
          last_name?: string
          license_expiration?: string | null
          license_number?: string | null
          location?: string
          location_label?: string
          middle_name?: string | null
          needs_reschedule?: boolean
          original_course?: string | null
          original_location_label?: string | null
          original_schedule_date?: string | null
          original_schedule_id?: string | null
          payment_provider?: string | null
          payment_status?: string
          phone?: string
          preferred_name?: string | null
          referral_source?: string | null
          reschedule_part?: string | null
          reschedule_reason?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
          result?: string | null
          retest_type?: string | null
          roster_comment?: string | null
          schedule_date?: string | null
          schedule_id?: string | null
          state?: string | null
          updated_at?: string
          waiver_id?: string | null
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
      email_bcc_settings: {
        Row: {
          bcc_email: string
          enabled: boolean
          excluded_triggers: string[]
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bcc_email?: string
          enabled?: boolean
          excluded_triggers?: string[]
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bcc_email?: string
          enabled?: boolean
          excluded_triggers?: string[]
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
          part: string | null
          schedule_id: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_role?: string
          created_at?: string
          employee_id: string
          id?: string
          part?: string | null
          schedule_id: string
        }
        Update: {
          assigned_by?: string | null
          assignment_role?: string
          created_at?: string
          employee_id?: string
          id?: string
          part?: string | null
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
          parts: string[] | null
          schedule_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts?: string[] | null
          schedule_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: string[] | null
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
      it_tickets: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          id: string
          priority: string
          resolved_at: string | null
          status: string
          submitter_email: string
          submitter_name: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          submitter_email: string
          submitter_name?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          submitter_email?: string
          submitter_name?: string | null
          title?: string
          updated_at?: string
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
      payment_settings: {
        Row: {
          active_provider: string
          created_at: string
          id: string
          notes: string | null
          paypal_enabled: boolean
          paypal_mode: string
          singleton: boolean
          square_enabled: boolean
          square_mode: string
          stripe_enabled: boolean
          stripe_mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_provider?: string
          created_at?: string
          id?: string
          notes?: string | null
          paypal_enabled?: boolean
          paypal_mode?: string
          singleton?: boolean
          square_enabled?: boolean
          square_mode?: string
          stripe_enabled?: boolean
          stripe_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_provider?: string
          created_at?: string
          id?: string
          notes?: string | null
          paypal_enabled?: boolean
          paypal_mode?: string
          singleton?: boolean
          square_enabled?: boolean
          square_mode?: string
          stripe_enabled?: boolean
          stripe_mode?: string
          updated_at?: string
          updated_by?: string | null
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
      schedule_cancellations: {
        Row: {
          cancelled_at: string
          cancelled_by: string | null
          cancelled_part: string
          id: string
          reason: string | null
          schedule_id: string
        }
        Insert: {
          cancelled_at?: string
          cancelled_by?: string | null
          cancelled_part: string
          id?: string
          reason?: string | null
          schedule_id: string
        }
        Update: {
          cancelled_at?: string
          cancelled_by?: string | null
          cancelled_part?: string
          id?: string
          reason?: string | null
          schedule_id?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
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
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
      shared_files: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string | null
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: []
      }
      signed_waivers: {
        Row: {
          consent_acknowledgments: Json
          course: string | null
          created_at: string
          date_of_birth: string | null
          document_hash: string
          document_text: string
          document_type: string
          document_version: string
          guardian_name: string | null
          guardian_relationship: string | null
          guardian_signature_drawn: string | null
          guardian_signature_typed: string | null
          id: string
          ip_address: string | null
          is_minor: boolean
          license_number: string | null
          license_state: string | null
          location: string | null
          location_label: string | null
          pdf_path: string | null
          schedule_date: string | null
          schedule_id: string | null
          signature_drawn: string
          signature_typed: string
          signed_at: string
          signer_email: string
          signer_first_name: string
          signer_last_name: string
          signer_middle_name: string | null
          signer_phone: string | null
          user_agent: string | null
        }
        Insert: {
          consent_acknowledgments?: Json
          course?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_hash: string
          document_text: string
          document_type?: string
          document_version: string
          guardian_name?: string | null
          guardian_relationship?: string | null
          guardian_signature_drawn?: string | null
          guardian_signature_typed?: string | null
          id?: string
          ip_address?: string | null
          is_minor?: boolean
          license_number?: string | null
          license_state?: string | null
          location?: string | null
          location_label?: string | null
          pdf_path?: string | null
          schedule_date?: string | null
          schedule_id?: string | null
          signature_drawn: string
          signature_typed: string
          signed_at?: string
          signer_email: string
          signer_first_name: string
          signer_last_name: string
          signer_middle_name?: string | null
          signer_phone?: string | null
          user_agent?: string | null
        }
        Update: {
          consent_acknowledgments?: Json
          course?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_hash?: string
          document_text?: string
          document_type?: string
          document_version?: string
          guardian_name?: string | null
          guardian_relationship?: string | null
          guardian_signature_drawn?: string | null
          guardian_signature_typed?: string | null
          id?: string
          ip_address?: string | null
          is_minor?: boolean
          license_number?: string | null
          license_state?: string | null
          location?: string | null
          location_label?: string | null
          pdf_path?: string | null
          schedule_date?: string | null
          schedule_id?: string | null
          signature_drawn?: string
          signature_typed?: string
          signed_at?: string
          signer_email?: string
          signer_first_name?: string
          signer_last_name?: string
          signer_middle_name?: string | null
          signer_phone?: string | null
          user_agent?: string | null
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_active_payment_provider: { Args: never; Returns: string }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
