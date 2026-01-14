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
      accounts: {
        Row: {
          balance: number
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      axiom_score_history: {
        Row: {
          breakdown: Json | null
          calculated_at: string
          clarity_score: number
          execution_score: number
          financial_score: number
          habits_score: number
          id: string
          projects_score: number
          total_score: number
          user_id: string
        }
        Insert: {
          breakdown?: Json | null
          calculated_at?: string
          clarity_score?: number
          execution_score?: number
          financial_score?: number
          habits_score?: number
          id?: string
          projects_score?: number
          total_score?: number
          user_id: string
        }
        Update: {
          breakdown?: Json | null
          calculated_at?: string
          clarity_score?: number
          execution_score?: number
          financial_score?: number
          habits_score?: number
          id?: string
          projects_score?: number
          total_score?: number
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          context_topics: string[] | null
          created_at: string | null
          id: string
          message_count: number | null
          summary: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context_topics?: string[] | null
          created_at?: string | null
          id?: string
          message_count?: number | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context_topics?: string[] | null
          created_at?: string | null
          id?: string
          message_count?: number | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_goals: {
        Row: {
          action_plan: Json | null
          created_at: string | null
          current_amount: number | null
          deadline: string | null
          id: string
          status: string | null
          target_amount: number
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_plan?: Json | null
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          id?: string
          status?: string | null
          target_amount: number
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_plan?: Json | null
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          id?: string
          status?: string | null
          target_amount?: number
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          completed_at: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          best_streak: number
          color: string
          created_at: string
          current_streak: number
          description: string | null
          frequency: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          best_streak?: number
          color?: string
          created_at?: string
          current_streak?: number
          description?: string | null
          frequency?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          best_streak?: number
          color?: string
          created_at?: string
          current_streak?: number
          description?: string | null
          frequency?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          ai_insights: string | null
          content: string
          created_at: string
          entry_date: string
          id: string
          mood: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_insights?: string | null
          content: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_insights?: string | null
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          archived_at: string | null
          content: string
          context: Json | null
          conversation_id: string | null
          created_at: string | null
          embedding: string | null
          id: string
          last_used_at: string | null
          type: Database["public"]["Enums"]["memory_type"]
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          content: string
          context?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          last_used_at?: string | null
          type: Database["public"]["Enums"]["memory_type"]
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          content?: string
          context?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          last_used_at?: string | null
          type?: Database["public"]["Enums"]["memory_type"]
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_ai: boolean
          message_type: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_ai?: boolean
          message_type?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_ai?: boolean
          message_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          ai_insights: string | null
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_insights?: string | null
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_insights?: string | null
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proactive_questions: {
        Row: {
          answered_at: string | null
          context: string | null
          created_at: string
          id: string
          priority: string
          question: string
          sent_at: string | null
          status: string
          trigger_type: string
          user_id: string
          user_response: string | null
        }
        Insert: {
          answered_at?: string | null
          context?: string | null
          created_at?: string
          id?: string
          priority?: string
          question: string
          sent_at?: string | null
          status?: string
          trigger_type: string
          user_id: string
          user_response?: string | null
        }
        Update: {
          answered_at?: string | null
          context?: string | null
          created_at?: string
          id?: string
          priority?: string
          question?: string
          sent_at?: string | null
          status?: string
          trigger_type?: string
          user_id?: string
          user_response?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          deletion_scheduled_for: string | null
          full_name: string | null
          id: string
          notification_preferences: Json | null
          personality_mode: string | null
          updated_at: string
          user_context: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_scheduled_for?: string | null
          full_name?: string | null
          id: string
          notification_preferences?: Json | null
          personality_mode?: string | null
          updated_at?: string
          user_context?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_scheduled_for?: string | null
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          personality_mode?: string | null
          updated_at?: string
          user_context?: string | null
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          project_id: string
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          project_id: string
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          project_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          progress: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          progress?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          progress?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_library: {
        Row: {
          ai_diagnosis: string | null
          analysis_problems: string[] | null
          analysis_score: number | null
          analysis_status: string | null
          analysis_strengths: string[] | null
          category: string
          created_at: string
          id: string
          improvements: Json | null
          is_pinned: boolean
          last_used_at: string | null
          optimized_prompt: string | null
          prompt_text: string
          title: string
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          ai_diagnosis?: string | null
          analysis_problems?: string[] | null
          analysis_score?: number | null
          analysis_status?: string | null
          analysis_strengths?: string[] | null
          category?: string
          created_at?: string
          id?: string
          improvements?: Json | null
          is_pinned?: boolean
          last_used_at?: string | null
          optimized_prompt?: string | null
          prompt_text: string
          title: string
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          ai_diagnosis?: string | null
          analysis_problems?: string[] | null
          analysis_score?: number | null
          analysis_status?: string | null
          analysis_strengths?: string[] | null
          category?: string
          created_at?: string
          id?: string
          improvements?: Json | null
          is_pinned?: boolean
          last_used_at?: string | null
          optimized_prompt?: string | null
          prompt_text?: string
          title?: string
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          device_name: string | null
          endpoint: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          device_name?: string | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          device_name?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_completed: boolean
          is_recurring: boolean
          recurrence_type: string | null
          remind_at: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          is_recurring?: boolean
          recurrence_type?: string | null
          remind_at: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          is_recurring?: boolean
          recurrence_type?: string | null
          remind_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_sites: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_deletions: {
        Row: {
          cancelled_at: string | null
          confirmation_token: string | null
          confirmed: boolean | null
          executed_at: string | null
          id: string
          requested_at: string
          scheduled_for: string
          status: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          confirmation_token?: string | null
          confirmed?: boolean | null
          executed_at?: string | null
          id?: string
          requested_at?: string
          scheduled_for: string
          status?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          confirmation_token?: string | null
          confirmed?: boolean | null
          executed_at?: string | null
          id?: string
          requested_at?: string
          scheduled_for?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          current_installment: number | null
          id: string
          is_fixed: boolean
          is_installment: boolean
          is_paid: boolean
          parent_transaction_id: string | null
          payment_method: string | null
          recurrence_day: number | null
          reference_month: string | null
          title: string
          total_installments: number | null
          transaction_date: string
          transfer_id: string | null
          type: string
          user_id: string
          version: number
        }
        Insert: {
          account_id?: string | null
          amount: number
          category: string
          created_at?: string
          current_installment?: number | null
          id?: string
          is_fixed?: boolean
          is_installment?: boolean
          is_paid?: boolean
          parent_transaction_id?: string | null
          payment_method?: string | null
          recurrence_day?: number | null
          reference_month?: string | null
          title: string
          total_installments?: number | null
          transaction_date?: string
          transfer_id?: string | null
          type: string
          user_id: string
          version?: number
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          current_installment?: number | null
          id?: string
          is_fixed?: boolean
          is_installment?: boolean
          is_paid?: boolean
          parent_transaction_id?: string | null
          payment_method?: string | null
          recurrence_day?: number | null
          reference_month?: string | null
          title?: string
          total_installments?: number | null
          transaction_date?: string
          transfer_id?: string | null
          type?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pay_transaction_atomic: {
        Args: { p_transaction_id: string; p_user_id: string }
        Returns: undefined
      }
      unpay_transaction_atomic: {
        Args: { p_transaction_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      memory_type:
        | "personality"
        | "routine"
        | "goal"
        | "pattern"
        | "preference"
        | "fact"
        | "insight"
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
      memory_type: [
        "personality",
        "routine",
        "goal",
        "pattern",
        "preference",
        "fact",
        "insight",
      ],
    },
  },
} as const
