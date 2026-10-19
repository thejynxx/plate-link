// Hand-written to match supabase/migrations/0001_init.sql.
// Regenerate from your live project once it exists (overwrites this file):
//   SUPABASE_PROJECT_REF=<ref> pnpm db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3"
  }
  public: {
    Tables: {
      canteens: {
        Row: {
          address: string
          created_at: string
          id: string
          is_verified: boolean
          location: unknown
          location_lat: number
          location_lng: number
          org_name: string
          pickup_instructions: string | null
          place_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id: string
          is_verified?: boolean
          location?: never
          location_lat: number
          location_lng: number
          org_name: string
          pickup_instructions?: string | null
          place_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_verified?: boolean
          location?: never
          location_lat?: number
          location_lng?: number
          org_name?: string
          pickup_instructions?: string | null
          place_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canteens_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: { conversation_id: string; joined_at: string; last_read_at: string; user_id: string }
        Insert: { conversation_id: string; joined_at?: string; last_read_at?: string; user_id: string }
        Update: { conversation_id?: string; joined_at?: string; last_read_at?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "conversation_participants_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "conversation_participants_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          kind: string
          last_message_at: string | null
          last_message_preview: string | null
          listing_id: string | null
          order_id: string | null
          requester_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          last_message_at?: string | null
          last_message_preview?: string | null
          listing_id?: string | null
          order_id?: string | null
          requester_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          listing_id?: string | null
          order_id?: string | null
          requester_id?: string | null
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          current_lat: number
          current_lng: number
          driver_id: string
          heading: number | null
          last_updated: string
          speed_mps: number | null
        }
        Insert: {
          current_lat: number
          current_lng: number
          driver_id: string
          heading?: number | null
          last_updated?: string
          speed_mps?: number | null
        }
        Update: {
          current_lat?: number
          current_lng?: number
          driver_id?: string
          heading?: number | null
          last_updated?: string
          speed_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          is_online: boolean
          updated_at: string
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          id: string
          is_online?: boolean
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_online?: boolean
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      food_listings: {
        Row: {
          canteen_id: string
          created_at: string
          description: string | null
          expires_at: string
          food_type: Database["public"]["Enums"]["food_type"]
          id: string
          location: unknown
          location_lat: number
          location_lng: number
          photo_url: string | null
          prepared_at: string | null
          quantity: number
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
        }
        Insert: {
          canteen_id: string
          created_at?: string
          description?: string | null
          expires_at: string
          food_type?: Database["public"]["Enums"]["food_type"]
          id?: string
          location?: never
          // Filled by the listings_default_location trigger when omitted
          location_lat?: number
          location_lng?: number
          photo_url?: string | null
          prepared_at?: string | null
          quantity: number
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
        }
        Update: {
          canteen_id?: string
          created_at?: string
          description?: string | null
          expires_at?: string
          food_type?: Database["public"]["Enums"]["food_type"]
          id?: string
          location?: never
          location_lat?: number
          location_lng?: number
          photo_url?: string | null
          prepared_at?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_listings_canteen_id_fkey"
            columns: ["canteen_id"]
            isOneToOne: false
            referencedRelation: "canteens"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: { body: string; conversation_id: string; created_at: string; id: number; sender_id: string | null }
        Insert: { body: string; conversation_id: string; created_at?: string; id?: never; sender_id?: string | null }
        Update: { body?: string; conversation_id?: string; created_at?: string; id?: never; sender_id?: string | null }
        Relationships: [
          { foreignKeyName: "messages_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "conversations"; referencedColumns: ["id"] },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          canteen_id: string
          created_at: string
          delivered_at: string | null
          delivery_proof_path: string | null
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          id: string
          listing_id: string
          notes: string | null
          picked_up_at: string | null
          pickup_proof_path: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          canteen_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_proof_path?: string | null
          driver_id?: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          id?: string
          listing_id: string
          notes?: string | null
          picked_up_at?: string | null
          pickup_proof_path?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          canteen_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_proof_path?: string | null
          driver_id?: string | null
          dropoff_address?: string
          dropoff_lat?: number
          dropoff_lng?: number
          id?: string
          listing_id?: string
          notes?: string | null
          picked_up_at?: string | null
          pickup_proof_path?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_canteen_id_fkey"
            columns: ["canteen_id"]
            isOneToOne: false
            referencedRelation: "canteens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "food_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          name: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_order: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      available_pickups: {
        Args: { p_lat: number; p_lng: number; p_radius_m?: number }
        Returns: {
          canteen_name: string
          created_at: string
          distance_m: number
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          expires_at: string
          listing_id: string
          order_id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          quantity: number
          title: string
        }[]
      }
      cancel_order: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      canteen_stats: {
        Args: never
        Returns: {
          active_listings: number
          deliveries_completed: number
          portions_donated: number
          total_listings: number
        }[]
      }
      claim_listing: {
        Args: {
          p_dropoff_address: string
          p_dropoff_lat: number
          p_dropoff_lng: number
          p_listing_id: string
          p_notes?: string
        }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      mark_delivered: {
        Args: { p_order_id: string; p_proof_path?: string }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      mark_picked_up: {
        Args: { p_order_id: string; p_proof_path?: string }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      is_participant: { Args: { p_conversation: string }; Returns: boolean }
      mark_conversation_read: { Args: { p_conversation_id: string }; Returns: undefined }
      my_conversations: {
        Args: never
        Returns: {
          created_at: string
          id: string
          kind: string
          last_message_at: string | null
          last_message_preview: string | null
          listing_id: string | null
          order_id: string | null
          order_status: Database["public"]["Enums"]["order_status"] | null
          participants: Json
          photo_url: string | null
          title: string
          unread: number
        }[]
      }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      nearby_listings: {
        Args: { p_lat: number; p_lng: number; p_radius_m?: number }
        Returns: {
          canteen_id: string
          canteen_name: string
          description: string
          distance_m: number
          expires_at: string
          food_type: Database["public"]["Enums"]["food_type"]
          id: string
          location_lat: number
          location_lng: number
          photo_url: string
          quantity: number
          title: string
        }[]
      }
      open_listing_chat: { Args: { p_listing_id: string }; Returns: string }
      open_order_chat: { Args: { p_order_id: string }; Returns: string }
      release_order: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      shares_order_with: {
        Args: { other: string }
        Returns: boolean
      }
    }
    Enums: {
      food_type: "veg" | "non_veg" | "vegan" | "mixed"
      listing_status:
        | "available"
        | "claimed"
        | "picked_up"
        | "delivered"
        | "expired"
        | "cancelled"
      order_status:
        | "pending_driver"
        | "driver_assigned"
        | "on_the_way"
        | "completed"
        | "cancelled"
      user_role: "canteen" | "driver" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]
