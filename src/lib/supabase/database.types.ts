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
      application_settings: {
        Row: {
          active_competition_id: string | null
          active_season_id: string | null
          club_id: string
          created_at: string
          default_team_id: string | null
          min_observations_for_index: number
          settings: Json
          updated_at: string
        }
        Insert: {
          active_competition_id?: string | null
          active_season_id?: string | null
          club_id: string
          created_at?: string
          default_team_id?: string | null
          min_observations_for_index?: number
          settings?: Json
          updated_at?: string
        }
        Update: {
          active_competition_id?: string | null
          active_season_id?: string | null
          club_id?: string
          created_at?: string
          default_team_id?: string | null
          min_observations_for_index?: number
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_settings_active_competition_id_fkey"
            columns: ["active_competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_settings_active_season_id_fkey"
            columns: ["active_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_settings_default_team_id_fkey"
            columns: ["default_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_history: {
        Row: {
          actor_id: string | null
          club_id: string
          created_at: string
          entity_id: string
          entity_type: string
          from_status: string | null
          id: number
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          club_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          from_status?: string | null
          id?: never
          to_status: string
        }
        Update: {
          actor_id?: string | null
          club_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          from_status?: string | null
          id?: never
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          club_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          club_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          club_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          audience: string | null
          club_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          event_date: string
          id: string
          intensity: Database["public"]["Enums"]["intensity_level"] | null
          location: string | null
          microcycle_id: string | null
          notes: string | null
          objective: string | null
          responsible_staff_id: string | null
          season_id: string | null
          starts_at: string | null
          sub_theme: string | null
          team_id: string
          theme: string | null
          title: string
          type: Database["public"]["Enums"]["calendar_event_type"]
          updated_at: string
        }
        Insert: {
          audience?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_date: string
          id?: string
          intensity?: Database["public"]["Enums"]["intensity_level"] | null
          location?: string | null
          microcycle_id?: string | null
          notes?: string | null
          objective?: string | null
          responsible_staff_id?: string | null
          season_id?: string | null
          starts_at?: string | null
          sub_theme?: string | null
          team_id: string
          theme?: string | null
          title: string
          type: Database["public"]["Enums"]["calendar_event_type"]
          updated_at?: string
        }
        Update: {
          audience?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_date?: string
          id?: string
          intensity?: Database["public"]["Enums"]["intensity_level"] | null
          location?: string | null
          microcycle_id?: string | null
          notes?: string | null
          objective?: string | null
          responsible_staff_id?: string | null
          season_id?: string | null
          starts_at?: string | null
          sub_theme?: string | null
          team_id?: string
          theme?: string | null
          title?: string
          type?: Database["public"]["Enums"]["calendar_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_microcycle_id_fkey"
            columns: ["microcycle_id"]
            isOneToOne: false
            referencedRelation: "microcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_responsible_staff_id_fkey"
            columns: ["responsible_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          city: string | null
          country: string
          created_at: string
          id: string
          logo_path: string | null
          name: string
          short_name: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          short_name?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          short_name?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      competitions: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_primary: boolean
          name: string
          season_id: string
          squad_size_limit: number
          team_id: string
          type: Database["public"]["Enums"]["competition_type"]
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          season_id: string
          squad_size_limit?: number
          team_id: string
          type?: Database["public"]["Enums"]["competition_type"]
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          season_id?: string
          squad_size_limit?: number
          team_id?: string
          type?: Database["public"]["Enums"]["competition_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      delegation_members: {
        Row: {
          club_id: string
          created_at: string
          delegation_id: string
          external_name: string | null
          function_label: string | null
          id: string
          member_group: Database["public"]["Enums"]["delegation_group"]
          player_id: string | null
          room: string | null
          staff_member_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          delegation_id: string
          external_name?: string | null
          function_label?: string | null
          id?: string
          member_group: Database["public"]["Enums"]["delegation_group"]
          player_id?: string | null
          room?: string | null
          staff_member_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          delegation_id?: string
          external_name?: string | null
          function_label?: string | null
          id?: string
          member_group?: Database["public"]["Enums"]["delegation_group"]
          player_id?: string | null
          room?: string | null
          staff_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delegation_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegation_members_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegation_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_current_availability"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "delegation_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegation_members_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      delegations: {
        Row: {
          accommodation: string | null
          budget_actual: number | null
          budget_planned: number | null
          catering: string | null
          club_id: string
          created_at: string
          currency: string
          departure_at: string | null
          driver: string | null
          equipment: string | null
          head_staff_id: string | null
          id: string
          match_id: string
          published_at: string | null
          return_at: string | null
          schedule: string | null
          status: Database["public"]["Enums"]["workflow_status"]
          transport: string | null
          trip_program: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          accommodation?: string | null
          budget_actual?: number | null
          budget_planned?: number | null
          catering?: string | null
          club_id: string
          created_at?: string
          currency?: string
          departure_at?: string | null
          driver?: string | null
          equipment?: string | null
          head_staff_id?: string | null
          id?: string
          match_id: string
          published_at?: string | null
          return_at?: string | null
          schedule?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          transport?: string | null
          trip_program?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          accommodation?: string | null
          budget_actual?: number | null
          budget_planned?: number | null
          catering?: string | null
          club_id?: string
          created_at?: string
          currency?: string
          departure_at?: string | null
          driver?: string | null
          equipment?: string | null
          head_staff_id?: string | null
          id?: string
          match_id?: string
          published_at?: string | null
          return_at?: string | null
          schedule?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          transport?: string | null
          trip_program?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delegations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegations_head_staff_id_fkey"
            columns: ["head_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          archived_at: string | null
          category: Database["public"]["Enums"]["exercise_category"]
          club_id: string
          corrections: string | null
          created_at: string
          created_by: string | null
          diagram_path: string | null
          dimensions: string | null
          duration_min: number | null
          id: string
          instructions: string | null
          objective: string | null
          organisation: string | null
          players_count: string | null
          recovery: string | null
          repetitions: string | null
          success_criteria: string | null
          title: string
          updated_at: string
          variables: string | null
          video_url: string | null
        }
        Insert: {
          archived_at?: string | null
          category: Database["public"]["Enums"]["exercise_category"]
          club_id: string
          corrections?: string | null
          created_at?: string
          created_by?: string | null
          diagram_path?: string | null
          dimensions?: string | null
          duration_min?: number | null
          id?: string
          instructions?: string | null
          objective?: string | null
          organisation?: string | null
          players_count?: string | null
          recovery?: string | null
          repetitions?: string | null
          success_criteria?: string | null
          title: string
          updated_at?: string
          variables?: string | null
          video_url?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: Database["public"]["Enums"]["exercise_category"]
          club_id?: string
          corrections?: string | null
          created_at?: string
          created_by?: string | null
          diagram_path?: string | null
          dimensions?: string | null
          duration_min?: number | null
          id?: string
          instructions?: string | null
          objective?: string | null
          organisation?: string | null
          players_count?: string | null
          recovery?: string | null
          repetitions?: string | null
          success_criteria?: string | null
          title?: string
          updated_at?: string
          variables?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_players: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_captain: boolean
          lineup_id: string
          player_id: string
          position_label: string | null
          responsibilities: string | null
          slot: Database["public"]["Enums"]["lineup_slot"]
          sort_order: number
          takes_corners: boolean
          takes_free_kicks: boolean
          takes_penalties: boolean
          x: number | null
          y: number | null
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_captain?: boolean
          lineup_id: string
          player_id: string
          position_label?: string | null
          responsibilities?: string | null
          slot: Database["public"]["Enums"]["lineup_slot"]
          sort_order?: number
          takes_corners?: boolean
          takes_free_kicks?: boolean
          takes_penalties?: boolean
          x?: number | null
          y?: number | null
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_captain?: boolean
          lineup_id?: string
          player_id?: string
          position_label?: string | null
          responsibilities?: string | null
          slot?: Database["public"]["Enums"]["lineup_slot"]
          sort_order?: number
          takes_corners?: boolean
          takes_free_kicks?: boolean
          takes_penalties?: boolean
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lineup_players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_players_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_current_availability"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "lineup_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_snapshots: {
        Row: {
          club_id: string
          data: Json
          id: number
          lineup_id: string
          saved_at: string
          saved_by: string | null
          status: Database["public"]["Enums"]["lineup_status"]
          version: number
        }
        Insert: {
          club_id: string
          data: Json
          id?: never
          lineup_id: string
          saved_at?: string
          saved_by?: string | null
          status: Database["public"]["Enums"]["lineup_status"]
          version: number
        }
        Update: {
          club_id?: string
          data?: Json
          id?: never
          lineup_id?: string
          saved_at?: string
          saved_by?: string | null
          status?: Database["public"]["Enums"]["lineup_status"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "lineup_snapshots_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_snapshots_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          club_id: string
          communicated_at: string | null
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          label: string
          match_id: string
          status: Database["public"]["Enums"]["lineup_status"]
          system: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          version: number
        }
        Insert: {
          club_id: string
          communicated_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          label?: string
          match_id: string
          status?: Database["public"]["Enums"]["lineup_status"]
          system?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          version?: number
        }
        Update: {
          club_id?: string
          communicated_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          label?: string
          match_id?: string
          status?: Database["public"]["Enums"]["lineup_status"]
          system?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "lineups_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      macrocycles: {
        Row: {
          club_id: string
          created_at: string
          ends_on: string
          id: string
          name: string
          objective: string | null
          season_id: string
          starts_on: string
          team_id: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          ends_on: string
          id?: string
          name: string
          objective?: string | null
          season_id: string
          starts_on: string
          team_id: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          name?: string
          objective?: string | null
          season_id?: string
          starts_on?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "macrocycles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "macrocycles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "macrocycles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          added_minute: number | null
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          match_id: string
          minute: number
          note: string | null
          period: Database["public"]["Enums"]["match_period"]
          player_id: string | null
          related_player_id: string | null
          type: Database["public"]["Enums"]["match_event_type"]
          updated_at: string
        }
        Insert: {
          added_minute?: number | null
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_id: string
          minute: number
          note?: string | null
          period?: Database["public"]["Enums"]["match_period"]
          player_id?: string | null
          related_player_id?: string | null
          type: Database["public"]["Enums"]["match_event_type"]
          updated_at?: string
        }
        Update: {
          added_minute?: number | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_id?: string
          minute?: number
          note?: string | null
          period?: Database["public"]["Enums"]["match_period"]
          player_id?: string | null
          related_player_id?: string | null
          type?: Database["public"]["Enums"]["match_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_current_availability"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_related_player_id_fkey"
            columns: ["related_player_id"]
            isOneToOne: false
            referencedRelation: "player_current_availability"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_events_related_player_id_fkey"
            columns: ["related_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_squad_players: {
        Row: {
          club_id: string
          confidential_comment: string | null
          created_at: string
          id: string
          player_id: string
          shirt_number: number | null
          squad_id: string
          status: Database["public"]["Enums"]["squad_player_status"]
          updated_at: string
        }
        Insert: {
          club_id: string
          confidential_comment?: string | null
          created_at?: string
          id?: string
          player_id: string
          shirt_number?: number | null
          squad_id: string
          status?: Database["public"]["Enums"]["squad_player_status"]
          updated_at?: string
        }
        Update: {
          club_id?: string
          confidential_comment?: string | null
          created_at?: string
          id?: string
          player_id?: string
          shirt_number?: number | null
          squad_id?: string
          status?: Database["public"]["Enums"]["squad_player_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_squad_players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_squad_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_current_availability"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_squad_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_squad_players_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "match_squads"
            referencedColumns: ["id"]
          },
        ]
      }
      match_squads: {
        Row: {
          club_id: string
          created_at: string
          id: string
          match_id: string
          notes: string | null
          published_at: string | null
          size_limit: number
          status: Database["public"]["Enums"]["workflow_status"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          match_id: string
          notes?: string | null
          published_at?: string | null
          size_limit?: number
          status?: Database["public"]["Enums"]["workflow_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          match_id?: string
          notes?: string | null
          published_at?: string | null
          size_limit?: number
          status?: Database["public"]["Enums"]["workflow_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_squads_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_squads_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          briefing: string | null
          club_id: string
          competition_id: string | null
          created_at: string
          development_axes: string | null
          duration_min: number
          game_plan: string | null
          goals_against: number | null
          goals_for: number | null
          home_away: Database["public"]["Enums"]["home_away"]
          id: string
          kickoff_at: string
          logistics: string | null
          matchday: string | null
          meeting_place: string | null
          meeting_time: string | null
          objectives: string | null
          opponent_id: string
          post_report: string | null
          referee: string | null
          season_id: string
          status: Database["public"]["Enums"]["match_status"]
          team_id: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          briefing?: string | null
          club_id: string
          competition_id?: string | null
          created_at?: string
          development_axes?: string | null
          duration_min?: number
          game_plan?: string | null
          goals_against?: number | null
          goals_for?: number | null
          home_away?: Database["public"]["Enums"]["home_away"]
          id?: string
          kickoff_at: string
          logistics?: string | null
          matchday?: string | null
          meeting_place?: string | null
          meeting_time?: string | null
          objectives?: string | null
          opponent_id: string
          post_report?: string | null
          referee?: string | null
          season_id: string
          status?: Database["public"]["Enums"]["match_status"]
          team_id: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          briefing?: string | null
          club_id?: string
          competition_id?: string | null
          created_at?: string
          development_axes?: string | null
          duration_min?: number
          game_plan?: string | null
          goals_against?: number | null
          goals_for?: number | null
          home_away?: Database["public"]["Enums"]["home_away"]
          id?: string
          kickoff_at?: string
          logistics?: string | null
          matchday?: string | null
          meeting_place?: string | null
          meeting_time?: string | null
          objectives?: string | null
          opponent_id?: string
          post_report?: string | null
          referee?: string | null
          season_id?: string
          status?: Database["public"]["Enums"]["match_status"]
          team_id?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "opponents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      mesocycles: {
        Row: {
          club_id: string
          created_at: string
          ends_on: string
          focus: string | null
          id: string
          macrocycle_id: string
          name: string
          objective: string | null
          starts_on: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          ends_on: string
          focus?: string | null
          id?: string
          macrocycle_id: string
          name: string
          objective?: string | null
          starts_on: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          ends_on?: string
          focus?: string | null
          id?: string
          macrocycle_id?: string
          name?: string
          objective?: string | null
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesocycles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesocycles_macrocycle_id_fkey"
            columns: ["macrocycle_id"]
            isOneToOne: false
            referencedRelation: "macrocycles"
            referencedColumns: ["id"]
          },
        ]
      }
      microcycles: {
        Row: {
          club_id: string
          created_at: string
          id: string
          label: string | null
          mesocycle_id: string | null
          objective: string | null
          published_at: string | null
          season_id: string
          status: Database["public"]["Enums"]["workflow_status"]
          team_id: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          week_start: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          label?: string | null
          mesocycle_id?: string | null
          objective?: string | null
          published_at?: string | null
          season_id: string
          status?: Database["public"]["Enums"]["workflow_status"]
          team_id: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          week_start: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          label?: string | null
          mesocycle_id?: string | null
          objective?: string | null
          published_at?: string | null
          season_id?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          team_id?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "microcycles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microcycles_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microcycles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microcycles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          club_id: string
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          club_id: string
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          club_id?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      opponents: {
        Row: {
          city: string | null
          club_id: string
          created_at: string
          id: string
          logo_path: string | null
          name: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          club_id: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          club_id?: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opponents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          id: string
          is_sensitive: boolean
          label: string
          module: string
          phase: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_sensitive?: boolean
          label: string
          module: string
          phase?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_sensitive?: boolean
          label?: string
          module?: string
          phase?: number
        }
        Relationships: []
      }
      player_availability: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          ended_on: string | null
          expected_end_on: string | null
          id: string
          player_id: string
          reason: Database["public"]["Enums"]["availability_reason"] | null
          sporting_note: string | null
          starts_on: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          expected_end_on?: string | null
          id?: string
          player_id: string
          reason?: Database["public"]["Enums"]["availability_reason"] | null
          sporting_note?: string | null
          starts_on?: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          expected_end_on?: string | null
          id?: string
          player_id?: string
          reason?: Database["public"]["Enums"]["availability_reason"] | null
          sporting_note?: string | null
          starts_on?: string
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_availability_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_availability_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_current_availability"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_availability_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_documents: {
        Row: {
          club_id: string
          created_at: string
          expires_on: string | null
          id: string
          kind: string
          player_id: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          expires_on?: string | null
          id?: string
          kind: string
          player_id: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          kind?: string
          player_id?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_documents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_current_availability"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_documents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_positions: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_primary: boolean
          player_id: string
          position_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          player_id: string
          position_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          player_id?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_positions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_positions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_current_availability"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_positions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_seasons: {
        Row: {
          club_id: string
          created_at: string
          id: string
          player_id: string
          season_id: string
          shirt_number: number | null
          status: Database["public"]["Enums"]["player_season_status"]
          tactical_role: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          player_id: string
          season_id: string
          shirt_number?: number | null
          status?: Database["public"]["Enums"]["player_season_status"]
          tactical_role?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          player_id?: string
          season_id?: string
          shirt_number?: number | null
          status?: Database["public"]["Enums"]["player_season_status"]
          tactical_role?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_seasons_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_seasons_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_current_availability"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_seasons_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_seasons_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_seasons_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          admin_status: Database["public"]["Enums"]["player_admin_status"]
          archived_at: string | null
          birth_date: string | null
          club_id: string
          created_at: string
          created_by: string | null
          first_name: string
          height_cm: number | null
          id: string
          joined_on: string | null
          last_name: string
          licence_number: string | null
          nationality: string | null
          photo_path: string | null
          preferred_foot: Database["public"]["Enums"]["preferred_foot"] | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          admin_status?: Database["public"]["Enums"]["player_admin_status"]
          archived_at?: string | null
          birth_date?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          first_name: string
          height_cm?: number | null
          id?: string
          joined_on?: string | null
          last_name: string
          licence_number?: string | null
          nationality?: string | null
          photo_path?: string | null
          preferred_foot?: Database["public"]["Enums"]["preferred_foot"] | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_status?: Database["public"]["Enums"]["player_admin_status"]
          archived_at?: string | null
          birth_date?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          first_name?: string
          height_cm?: number | null
          id?: string
          joined_on?: string | null
          last_name?: string
          licence_number?: string | null
          nationality?: string | null
          photo_path?: string | null
          preferred_foot?: Database["public"]["Enums"]["preferred_foot"] | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          code: string
          created_at: string
          framework_key: string
          id: string
          label: string
          line: Database["public"]["Enums"]["position_line"]
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          framework_key: string
          id?: string
          label: string
          line: Database["public"]["Enums"]["position_line"]
          sort_order: number
        }
        Update: {
          code?: string
          created_at?: string
          framework_key?: string
          id?: string
          label?: string
          line?: Database["public"]["Enums"]["position_line"]
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          locale: string
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          locale?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          locale?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_staff: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_staff?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_staff?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          club_id: string
          created_at: string
          ends_on: string
          id: string
          is_active: boolean
          label: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          ends_on: string
          id?: string
          is_active?: boolean
          label: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          is_active?: boolean
          label?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      session_evaluations: {
        Row: {
          actual_duration_min: number | null
          club_id: string
          created_at: string
          engagement: number | null
          evaluated_by: string | null
          id: string
          improvements: string | null
          intensity_observed:
            | Database["public"]["Enums"]["intensity_level"]
            | null
          objectives_reached: number | null
          session_id: string
          strengths: string | null
          updated_at: string
        }
        Insert: {
          actual_duration_min?: number | null
          club_id: string
          created_at?: string
          engagement?: number | null
          evaluated_by?: string | null
          id?: string
          improvements?: string | null
          intensity_observed?:
            | Database["public"]["Enums"]["intensity_level"]
            | null
          objectives_reached?: number | null
          session_id: string
          strengths?: string | null
          updated_at?: string
        }
        Update: {
          actual_duration_min?: number | null
          club_id?: string
          created_at?: string
          engagement?: number | null
          evaluated_by?: string | null
          id?: string
          improvements?: string | null
          intensity_observed?:
            | Database["public"]["Enums"]["intensity_level"]
            | null
          objectives_reached?: number | null
          session_id?: string
          strengths?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_evaluations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercises: {
        Row: {
          block: Database["public"]["Enums"]["session_block"]
          club_id: string
          created_at: string
          duration_min: number | null
          exercise_id: string
          id: string
          notes: string | null
          recovery: string | null
          repetitions: string | null
          session_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          block: Database["public"]["Enums"]["session_block"]
          club_id: string
          created_at?: string
          duration_min?: number | null
          exercise_id: string
          id?: string
          notes?: string | null
          recovery?: string | null
          repetitions?: string | null
          session_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          block?: Database["public"]["Enums"]["session_block"]
          club_id?: string
          created_at?: string
          duration_min?: number | null
          exercise_id?: string
          id?: string
          notes?: string | null
          recovery?: string | null
          repetitions?: string | null
          session_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          club_id: string
          created_at: string
          email: string | null
          ends_on: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          photo_path: string | null
          profile_id: string | null
          qualifications: string | null
          role_id: string
          starts_on: string | null
          status: Database["public"]["Enums"]["staff_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          email?: string | null
          ends_on?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          photo_path?: string | null
          profile_id?: string | null
          qualifications?: string | null
          role_id: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["staff_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          email?: string | null
          ends_on?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          photo_path?: string | null
          profile_id?: string | null
          qualifications?: string | null
          role_id?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["staff_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      standings: {
        Row: {
          as_of: string
          club_id: string
          competition_id: string
          created_at: string
          drawn: number
          goals_against: number
          goals_for: number
          id: string
          is_own_team: boolean
          lost: number
          played: number
          points: number
          position: number
          team_name: string
          updated_at: string
          won: number
        }
        Insert: {
          as_of?: string
          club_id: string
          competition_id: string
          created_at?: string
          drawn?: number
          goals_against?: number
          goals_for?: number
          id?: string
          is_own_team?: boolean
          lost?: number
          played?: number
          points?: number
          position: number
          team_name: string
          updated_at?: string
          won?: number
        }
        Update: {
          as_of?: string
          club_id?: string
          competition_id?: string
          created_at?: string
          drawn?: number
          goals_against?: number
          goals_for?: number
          id?: string
          is_own_team?: boolean
          lost?: number
          played?: number
          points?: number
          position?: number
          team_name?: string
          updated_at?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "standings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          category: Database["public"]["Enums"]["team_category"]
          club_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["team_category"]
          club_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["team_category"]
          club_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_attendance: {
        Row: {
          club_id: string
          created_at: string
          id: string
          note: string | null
          player_id: string
          recorded_by: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          note?: string | null
          player_id: string
          recorded_by?: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          note?: string | null
          player_id?: string
          recorded_by?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_attendance_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_current_availability"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "training_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          audience: string | null
          club_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          equipment: string | null
          game_system: string | null
          id: string
          intensity: Database["public"]["Enums"]["intensity_level"] | null
          location: string | null
          main_objective: string | null
          microcycle_id: string | null
          notes: string | null
          number: number
          published_at: string | null
          responsible_staff_id: string | null
          season_id: string
          secondary_objectives: string | null
          session_date: string
          starts_at: string | null
          status: Database["public"]["Enums"]["workflow_status"]
          sub_theme: string | null
          team_id: string
          theme: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          audience?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          equipment?: string | null
          game_system?: string | null
          id?: string
          intensity?: Database["public"]["Enums"]["intensity_level"] | null
          location?: string | null
          main_objective?: string | null
          microcycle_id?: string | null
          notes?: string | null
          number: number
          published_at?: string | null
          responsible_staff_id?: string | null
          season_id: string
          secondary_objectives?: string | null
          session_date: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          sub_theme?: string | null
          team_id: string
          theme: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          audience?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          equipment?: string | null
          game_system?: string | null
          id?: string
          intensity?: Database["public"]["Enums"]["intensity_level"] | null
          location?: string | null
          main_objective?: string | null
          microcycle_id?: string | null
          notes?: string | null
          number?: number
          published_at?: string | null
          responsible_staff_id?: string | null
          season_id?: string
          secondary_objectives?: string | null
          session_date?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          sub_theme?: string | null
          team_id?: string
          theme?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_microcycle_id_fkey"
            columns: ["microcycle_id"]
            isOneToOne: false
            referencedRelation: "microcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_responsible_staff_id_fkey"
            columns: ["responsible_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          club_id: string
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          role_id: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          role_id: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          role_id?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      player_current_availability: {
        Row: {
          availability_id: string | null
          club_id: string | null
          expected_end_on: string | null
          player_id: string | null
          reason: Database["public"]["Enums"]["availability_reason"] | null
          sporting_note: string | null
          starts_on: string | null
          status: Database["public"]["Enums"]["availability_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bootstrap_first_admin: {
        Args: { p_club: string; p_email: string }
        Returns: undefined
      }
      my_memberships: {
        Args: never
        Returns: {
          club_id: string
          club_name: string
          role_code: string
          role_label: string
          team_id: string
        }[]
      }
      my_permissions: { Args: { p_club: string }; Returns: string[] }
      squad_confidential_comments: {
        Args: { p_squad: string }
        Returns: {
          confidential_comment: string
          player_id: string
        }[]
      }
    }
    Enums: {
      attendance_status:
        | "present"
        | "retard"
        | "absente_justifiee"
        | "absente_non_justifiee"
        | "blessee"
        | "dispensee"
      availability_reason:
        | "blessure"
        | "maladie"
        | "suspension"
        | "selection_nationale"
        | "raison_personnelle"
        | "administratif"
        | "scolaire_professionnel"
        | "autre"
      availability_status:
        | "disponible"
        | "incertaine"
        | "restreinte"
        | "indisponible"
      calendar_event_type:
        | "seance_video"
        | "test_physique"
        | "reunion"
        | "deplacement"
        | "stage"
        | "repos"
        | "recuperation"
        | "soins"
        | "autre"
      competition_type: "championnat" | "coupe" | "amical" | "tournoi" | "autre"
      delegation_group:
        | "joueuse"
        | "staff_technique"
        | "staff_performance"
        | "staff_medical"
        | "administration"
        | "communication"
        | "logistique"
        | "autre"
      exercise_category:
        | "technique_offensive"
        | "technique_defensive"
        | "tactique_offensive"
        | "tactique_defensive"
        | "transition_offensive"
        | "transition_defensive"
        | "pressing"
        | "cpa"
        | "gardiennes"
        | "endurance"
        | "vitesse"
        | "coordination"
        | "developpement_individuel"
        | "developpement_sectoriel"
        | "developpement_collectif"
      home_away: "domicile" | "exterieur" | "neutre"
      intensity_level: "repos" | "faible" | "moderee" | "elevee" | "maximale"
      lineup_slot: "titulaire" | "remplacante"
      lineup_status: "provisoire" | "validee" | "communiquee"
      match_event_type:
        | "but"
        | "but_adverse"
        | "csc_pour"
        | "csc_contre"
        | "penalty_manque"
        | "carton_jaune"
        | "carton_rouge"
        | "remplacement"
        | "changement_tactique"
        | "blessure"
        | "observation"
      match_period: "1MT" | "2MT" | "PROL1" | "PROL2" | "TAB"
      match_status: "programme" | "joue" | "reporte" | "annule"
      player_admin_status:
        | "licenciee"
        | "en_cours"
        | "non_licenciee"
        | "pret"
        | "essai"
        | "partie"
      player_season_status:
        | "active"
        | "pret"
        | "blessee_longue_duree"
        | "partie"
      position_line: "gardienne" | "defense" | "milieu" | "attaque"
      preferred_foot: "droit" | "gauche" | "deux"
      session_block:
        | "activation"
        | "echauffement"
        | "mise_en_train"
        | "situation_apprentissage"
        | "exercice_technique"
        | "exercice_tactique"
        | "jeu_dirige"
        | "jeu_application"
        | "retour_au_calme"
      squad_player_status: "convoquee" | "reserviste" | "non_retenue"
      staff_status: "actif" | "inactif" | "parti"
      team_category:
        | "senior"
        | "u20"
        | "u17"
        | "u15"
        | "u13"
        | "academie"
        | "autre"
      workflow_status: "brouillon" | "soumis" | "valide" | "publie" | "archive"
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
      attendance_status: [
        "present",
        "retard",
        "absente_justifiee",
        "absente_non_justifiee",
        "blessee",
        "dispensee",
      ],
      availability_reason: [
        "blessure",
        "maladie",
        "suspension",
        "selection_nationale",
        "raison_personnelle",
        "administratif",
        "scolaire_professionnel",
        "autre",
      ],
      availability_status: [
        "disponible",
        "incertaine",
        "restreinte",
        "indisponible",
      ],
      calendar_event_type: [
        "seance_video",
        "test_physique",
        "reunion",
        "deplacement",
        "stage",
        "repos",
        "recuperation",
        "soins",
        "autre",
      ],
      competition_type: ["championnat", "coupe", "amical", "tournoi", "autre"],
      delegation_group: [
        "joueuse",
        "staff_technique",
        "staff_performance",
        "staff_medical",
        "administration",
        "communication",
        "logistique",
        "autre",
      ],
      exercise_category: [
        "technique_offensive",
        "technique_defensive",
        "tactique_offensive",
        "tactique_defensive",
        "transition_offensive",
        "transition_defensive",
        "pressing",
        "cpa",
        "gardiennes",
        "endurance",
        "vitesse",
        "coordination",
        "developpement_individuel",
        "developpement_sectoriel",
        "developpement_collectif",
      ],
      home_away: ["domicile", "exterieur", "neutre"],
      intensity_level: ["repos", "faible", "moderee", "elevee", "maximale"],
      lineup_slot: ["titulaire", "remplacante"],
      lineup_status: ["provisoire", "validee", "communiquee"],
      match_event_type: [
        "but",
        "but_adverse",
        "csc_pour",
        "csc_contre",
        "penalty_manque",
        "carton_jaune",
        "carton_rouge",
        "remplacement",
        "changement_tactique",
        "blessure",
        "observation",
      ],
      match_period: ["1MT", "2MT", "PROL1", "PROL2", "TAB"],
      match_status: ["programme", "joue", "reporte", "annule"],
      player_admin_status: [
        "licenciee",
        "en_cours",
        "non_licenciee",
        "pret",
        "essai",
        "partie",
      ],
      player_season_status: [
        "active",
        "pret",
        "blessee_longue_duree",
        "partie",
      ],
      position_line: ["gardienne", "defense", "milieu", "attaque"],
      preferred_foot: ["droit", "gauche", "deux"],
      session_block: [
        "activation",
        "echauffement",
        "mise_en_train",
        "situation_apprentissage",
        "exercice_technique",
        "exercice_tactique",
        "jeu_dirige",
        "jeu_application",
        "retour_au_calme",
      ],
      squad_player_status: ["convoquee", "reserviste", "non_retenue"],
      staff_status: ["actif", "inactif", "parti"],
      team_category: [
        "senior",
        "u20",
        "u17",
        "u15",
        "u13",
        "academie",
        "autre",
      ],
      workflow_status: ["brouillon", "soumis", "valide", "publie", "archive"],
    },
  },
} as const

