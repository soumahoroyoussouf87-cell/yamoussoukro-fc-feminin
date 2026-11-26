
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "application_settings": {
                  Row: {
                    "active_competition_id": string | null,"active_season_id": string | null,"club_id": string,"created_at": string,"default_team_id": string | null,"min_observations_for_index": number,"settings": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_competition_id"?: string | null,"active_season_id"?: string | null,"club_id": string,"created_at"?: string,"default_team_id"?: string | null,"min_observations_for_index"?: number,"settings"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "active_competition_id"?: string | null,"active_season_id"?: string | null,"club_id"?: string,"created_at"?: string,"default_team_id"?: string | null,"min_observations_for_index"?: number,"settings"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "application_settings_active_competition_id_fkey"
      columns: ["active_competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "application_settings_active_season_id_fkey"
      columns: ["active_season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "application_settings_club_id_fkey"
      columns: ["club_id"]
isOneToOne: true
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "application_settings_default_team_id_fkey"
      columns: ["default_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"club_id": string | null,"created_at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"club_id"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"club_id"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"clubs": {
                  Row: {
                    "city": string | null,"country": string,"created_at": string,"id": string,"logo_path": string | null,"name": string,"short_name": string | null,"tagline": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"country"?: string,"created_at"?: string,"id"?: string,"logo_path"?: string | null,"name": string,"short_name"?: string | null,"tagline"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "city"?: string | null,"country"?: string,"created_at"?: string,"id"?: string,"logo_path"?: string | null,"name"?: string,"short_name"?: string | null,"tagline"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"competitions": {
                  Row: {
                    "club_id": string,"created_at": string,"id": string,"is_primary": boolean,"name": string,"season_id": string,"squad_size_limit": number,"team_id": string,"type": Database["public"]['Enums']["competition_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"name": string,"season_id": string,"squad_size_limit"?: number,"team_id": string,"type"?: Database["public"]['Enums']["competition_type"],"updated_at"?: string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"name"?: string,"season_id"?: string,"squad_size_limit"?: number,"team_id"?: string,"type"?: Database["public"]['Enums']["competition_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "competitions_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competitions_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competitions_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "club_id": string,"competition_id": string | null,"created_at": string,"goals_against": number | null,"goals_for": number | null,"home_away": Database["public"]['Enums']["home_away"],"id": string,"kickoff_at": string,"matchday": string | null,"opponent_id": string,"season_id": string,"status": Database["public"]['Enums']["match_status"],"team_id": string,"updated_at": string,"venue": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"competition_id"?: string | null,"created_at"?: string,"goals_against"?: number | null,"goals_for"?: number | null,"home_away"?: Database["public"]['Enums']["home_away"],"id"?: string,"kickoff_at": string,"matchday"?: string | null,"opponent_id": string,"season_id": string,"status"?: Database["public"]['Enums']["match_status"],"team_id": string,"updated_at"?: string,"venue"?: string | null
                  }
                  Update: {
                    "club_id"?: string,"competition_id"?: string | null,"created_at"?: string,"goals_against"?: number | null,"goals_for"?: number | null,"home_away"?: Database["public"]['Enums']["home_away"],"id"?: string,"kickoff_at"?: string,"matchday"?: string | null,"opponent_id"?: string,"season_id"?: string,"status"?: Database["public"]['Enums']["match_status"],"team_id"?: string,"updated_at"?: string,"venue"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_opponent_id_fkey"
      columns: ["opponent_id"]
isOneToOne: false
      referencedRelation: "opponents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"club_id": string,"created_at": string,"id": string,"kind": string,"link": string | null,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"club_id": string,"created_at"?: string,"id"?: string,"kind": string,"link"?: string | null,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"club_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"opponents": {
                  Row: {
                    "city": string | null,"club_id": string,"created_at": string,"id": string,"logo_path": string | null,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"club_id": string,"created_at"?: string,"id"?: string,"logo_path"?: string | null,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "city"?: string | null,"club_id"?: string,"created_at"?: string,"id"?: string,"logo_path"?: string | null,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opponents_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_sensitive": boolean,"label": string,"module": string,"phase": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_sensitive"?: boolean,"label": string,"module": string,"phase"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_sensitive"?: boolean,"label"?: string,"module"?: string,"phase"?: number
                  }
                  Relationships: [
                    
                  ]
                },"player_availability": {
                  Row: {
                    "club_id": string,"created_at": string,"created_by": string | null,"ended_on": string | null,"expected_end_on": string | null,"id": string,"player_id": string,"reason": Database["public"]['Enums']["availability_reason"] | null,"sporting_note": string | null,"starts_on": string,"status": Database["public"]['Enums']["availability_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"created_by"?: string | null,"ended_on"?: string | null,"expected_end_on"?: string | null,"id"?: string,"player_id": string,"reason"?: Database["public"]['Enums']["availability_reason"] | null,"sporting_note"?: string | null,"starts_on"?: string,"status": Database["public"]['Enums']["availability_status"],"updated_at"?: string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"created_by"?: string | null,"ended_on"?: string | null,"expected_end_on"?: string | null,"id"?: string,"player_id"?: string,"reason"?: Database["public"]['Enums']["availability_reason"] | null,"sporting_note"?: string | null,"starts_on"?: string,"status"?: Database["public"]['Enums']["availability_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_availability_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_availability_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_current_availability"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_availability_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"player_documents": {
                  Row: {
                    "club_id": string,"created_at": string,"expires_on": string | null,"id": string,"kind": string,"player_id": string,"storage_path": string,"title": string,"updated_at": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"expires_on"?: string | null,"id"?: string,"kind": string,"player_id": string,"storage_path": string,"title": string,"updated_at"?: string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"expires_on"?: string | null,"id"?: string,"kind"?: string,"player_id"?: string,"storage_path"?: string,"title"?: string,"updated_at"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_documents_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_documents_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_current_availability"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_documents_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"player_positions": {
                  Row: {
                    "club_id": string,"created_at": string,"id": string,"is_primary": boolean,"player_id": string,"position_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"player_id": string,"position_id": string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"player_id"?: string,"position_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_positions_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_positions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_current_availability"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_positions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_positions_position_id_fkey"
      columns: ["position_id"]
isOneToOne: false
      referencedRelation: "positions"
      referencedColumns: ["id"]
    }
                  ]
                },"player_seasons": {
                  Row: {
                    "club_id": string,"created_at": string,"id": string,"player_id": string,"season_id": string,"shirt_number": number | null,"status": Database["public"]['Enums']["player_season_status"],"tactical_role": string | null,"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"id"?: string,"player_id": string,"season_id": string,"shirt_number"?: number | null,"status"?: Database["public"]['Enums']["player_season_status"],"tactical_role"?: string | null,"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"id"?: string,"player_id"?: string,"season_id"?: string,"shirt_number"?: number | null,"status"?: Database["public"]['Enums']["player_season_status"],"tactical_role"?: string | null,"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_seasons_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_seasons_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_current_availability"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_seasons_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_seasons_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_seasons_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "admin_status": Database["public"]['Enums']["player_admin_status"],"archived_at": string | null,"birth_date": string | null,"club_id": string,"created_at": string,"created_by": string | null,"first_name": string,"height_cm": number | null,"id": string,"joined_on": string | null,"last_name": string,"licence_number": string | null,"nationality": string | null,"photo_path": string | null,"preferred_foot": Database["public"]['Enums']["preferred_foot"] | null,"profile_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_status"?: Database["public"]['Enums']["player_admin_status"],"archived_at"?: string | null,"birth_date"?: string | null,"club_id": string,"created_at"?: string,"created_by"?: string | null,"first_name": string,"height_cm"?: number | null,"id"?: string,"joined_on"?: string | null,"last_name": string,"licence_number"?: string | null,"nationality"?: string | null,"photo_path"?: string | null,"preferred_foot"?: Database["public"]['Enums']["preferred_foot"] | null,"profile_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "admin_status"?: Database["public"]['Enums']["player_admin_status"],"archived_at"?: string | null,"birth_date"?: string | null,"club_id"?: string,"created_at"?: string,"created_by"?: string | null,"first_name"?: string,"height_cm"?: number | null,"id"?: string,"joined_on"?: string | null,"last_name"?: string,"licence_number"?: string | null,"nationality"?: string | null,"photo_path"?: string | null,"preferred_foot"?: Database["public"]['Enums']["preferred_foot"] | null,"profile_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "players_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "players_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"positions": {
                  Row: {
                    "code": string,"created_at": string,"framework_key": string,"id": string,"label": string,"line": Database["public"]['Enums']["position_line"],"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"framework_key": string,"id"?: string,"label": string,"line": Database["public"]['Enums']["position_line"],"sort_order": number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"framework_key"?: string,"id"?: string,"label"?: string,"line"?: Database["public"]['Enums']["position_line"],"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"email": string | null,"full_name": string,"id": string,"locale": string,"theme": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id": string,"locale"?: string,"theme"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"locale"?: string,"theme"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"role_permissions": {
                  Row: {
                    "created_at": string,"permission_id": string,"role_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"permission_id": string,"role_id": string
                  }
                  Update: {
                    "created_at"?: string,"permission_id"?: string,"role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_id_fkey"
      columns: ["permission_id"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "role_permissions_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"id": string,"is_staff": boolean,"label": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_staff"?: boolean,"label": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_staff"?: boolean,"label"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"seasons": {
                  Row: {
                    "club_id": string,"created_at": string,"ends_on": string,"id": string,"is_active": boolean,"label": string,"starts_on": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"ends_on": string,"id"?: string,"is_active"?: boolean,"label": string,"starts_on": string,"updated_at"?: string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"ends_on"?: string,"id"?: string,"is_active"?: boolean,"label"?: string,"starts_on"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seasons_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_members": {
                  Row: {
                    "club_id": string,"created_at": string,"email": string | null,"ends_on": string | null,"first_name": string,"id": string,"last_name": string,"phone": string | null,"photo_path": string | null,"profile_id": string | null,"qualifications": string | null,"role_id": string,"starts_on": string | null,"status": Database["public"]['Enums']["staff_status"],"team_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"email"?: string | null,"ends_on"?: string | null,"first_name": string,"id"?: string,"last_name": string,"phone"?: string | null,"photo_path"?: string | null,"profile_id"?: string | null,"qualifications"?: string | null,"role_id": string,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["staff_status"],"team_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"email"?: string | null,"ends_on"?: string | null,"first_name"?: string,"id"?: string,"last_name"?: string,"phone"?: string | null,"photo_path"?: string | null,"profile_id"?: string | null,"qualifications"?: string | null,"role_id"?: string,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["staff_status"],"team_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_members_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_members_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "category": Database["public"]['Enums']["team_category"],"club_id": string,"created_at": string,"id": string,"is_default": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: Database["public"]['Enums']["team_category"],"club_id": string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["team_category"],"club_id"?: string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "club_id": string,"created_at": string,"granted_at": string,"granted_by": string | null,"id": string,"revoked_at": string | null,"role_id": string,"team_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"revoked_at"?: string | null,"role_id": string,"team_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"revoked_at"?: string | null,"role_id"?: string,"team_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "player_current_availability": {
                  Row: {
                    "availability_id": string | null,"club_id": string,"expected_end_on": string | null,"player_id": string,"reason": Database["public"]['Enums']["availability_reason"] | null,"sporting_note": string | null,"starts_on": string | null,"status": Database["public"]['Enums']["availability_status"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "players_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "my_memberships":
{ Args: Record<PropertyKey, never>; Returns: {
              "club_id": string,"club_name": string,"role_code": string,"role_label": string,"team_id": string
            }[]
                           },
"my_permissions":
{ Args: { "p_club": string }; Returns: string[]
                           }
          }
          Enums: {
            "availability_reason": "blessure"|"maladie"|"suspension"|"selection_nationale"|"raison_personnelle"|"administratif"|"scolaire_professionnel"|"autre","availability_status": "disponible"|"incertaine"|"restreinte"|"indisponible","competition_type": "championnat"|"coupe"|"amical"|"tournoi"|"autre","home_away": "domicile"|"exterieur"|"neutre","match_status": "programme"|"joue"|"reporte"|"annule","player_admin_status": "licenciee"|"en_cours"|"non_licenciee"|"pret"|"essai"|"partie","player_season_status": "active"|"pret"|"blessee_longue_duree"|"partie","position_line": "gardienne"|"defense"|"milieu"|"attaque","preferred_foot": "droit"|"gauche"|"deux","staff_status": "actif"|"inactif"|"parti","team_category": "senior"|"u20"|"u17"|"u15"|"u13"|"academie"|"autre","workflow_status": "brouillon"|"soumis"|"valide"|"publie"|"archive"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "availability_reason": ["blessure", "maladie", "suspension", "selection_nationale", "raison_personnelle", "administratif", "scolaire_professionnel", "autre"],"availability_status": ["disponible", "incertaine", "restreinte", "indisponible"],"competition_type": ["championnat", "coupe", "amical", "tournoi", "autre"],"home_away": ["domicile", "exterieur", "neutre"],"match_status": ["programme", "joue", "reporte", "annule"],"player_admin_status": ["licenciee", "en_cours", "non_licenciee", "pret", "essai", "partie"],"player_season_status": ["active", "pret", "blessee_longue_duree", "partie"],"position_line": ["gardienne", "defense", "milieu", "attaque"],"preferred_foot": ["droit", "gauche", "deux"],"staff_status": ["actif", "inactif", "parti"],"team_category": ["senior", "u20", "u17", "u15", "u13", "academie", "autre"],"workflow_status": ["brouillon", "soumis", "valide", "publie", "archive"]
          }
        }
} as const
