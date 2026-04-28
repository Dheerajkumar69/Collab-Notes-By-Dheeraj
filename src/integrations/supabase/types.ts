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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          group_id: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          group_id: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string
          group_id?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          type: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          type: string
          updated_at?: string
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          type?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      folders: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          group_id: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invite_codes: {
        Row: {
          created_at: string
          group_id: string
          invite_code: string
        }
        Insert: {
          created_at?: string
          group_id: string
          invite_code: string
        }
        Update: {
          created_at?: string
          group_id?: string
          invite_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invite_codes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          background_image_url: string | null
          color: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          members: string[] | null
          name: string
        }
        Insert: {
          background_image_url?: string | null
          color?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          members?: string[] | null
          name: string
        }
        Update: {
          background_image_url?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          members?: string[] | null
          name?: string
        }
        Relationships: []
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          created_at: string
          group_id: string
          id: string
          is_edited: boolean | null
          message: string
          reactions: Json | null
          reply_to: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          group_id: string
          id?: string
          is_edited?: boolean | null
          message: string
          reactions?: Json | null
          reply_to?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          group_id?: string
          id?: string
          is_edited?: boolean | null
          message?: string
          reactions?: Json | null
          reply_to?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      note_reminders: {
        Row: {
          created_at: string
          due_date: string
          group_id: string
          id: string
          is_completed: boolean
          note_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          group_id: string
          id?: string
          is_completed?: boolean
          note_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          group_id?: string
          id?: string
          is_completed?: boolean
          note_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_reminders_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_reminders_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      note_versions: {
        Row: {
          content: string | null
          created_at: string
          created_by: string
          id: string
          note_id: string
          title: string
          version_number: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          note_id: string
          title: string
          version_number?: number
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          note_id?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "note_versions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          attachments: Json | null
          author_name: string | null
          color: string | null
          content: string | null
          created_at: string | null
          created_by: string
          due_date: string | null
          edit_requests: Json | null
          folder_id: string | null
          group_id: string
          id: string
          is_archived: boolean | null
          is_pinned: boolean | null
          labels: string[] | null
          lecture_number: number | null
          reactions: Json | null
          telegram_file_id: string | null
          telegram_message_id: string | null
          title: string
          topic: string | null
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          author_name?: string | null
          color?: string | null
          content?: string | null
          created_at?: string | null
          created_by: string
          due_date?: string | null
          edit_requests?: Json | null
          folder_id?: string | null
          group_id: string
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          labels?: string[] | null
          lecture_number?: number | null
          reactions?: Json | null
          telegram_file_id?: string | null
          telegram_message_id?: string | null
          title: string
          topic?: string | null
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          author_name?: string | null
          color?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string
          due_date?: string | null
          edit_requests?: Json | null
          folder_id?: string | null
          group_id?: string
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          labels?: string[] | null
          lecture_number?: number | null
          reactions?: Json | null
          telegram_file_id?: string | null
          telegram_message_id?: string | null
          title?: string
          topic?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          recipient_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          recipient_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          recipient_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          group_id: string
          id: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          group_id: string
          id?: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          group_id?: string
          id?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          group_id: string
          id: string
          is_online: boolean
          last_seen: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          is_online?: boolean
          last_seen?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          is_online?: boolean
          last_seen?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      cleanup_typing_indicators: { Args: never; Returns: undefined }
      create_notification:
        | {
            Args: {
              p_link?: string
              p_message: string
              p_recipient_email: string
            }
            Returns: string
          }
        | {
            Args: { p_link?: string; p_message: string; p_user_id: string }
            Returns: string
          }
      delete_group_cascade: { Args: { p_group_id: string }; Returns: Json }
      get_current_user_email: { Args: never; Returns: string }
      get_group_invite_code: { Args: { p_group_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_group_with_code: {
        Args: { p_invite_code: string; p_user_email?: string }
        Returns: Json
      }
      remove_group_member: {
        Args: { p_email: string; p_group_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
