export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          role: 'ADMIN' | 'TEC_FORMACAO' | 'TEC_ACOMPANHAMENTO'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          role?: 'ADMIN' | 'TEC_FORMACAO' | 'TEC_ACOMPANHAMENTO'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: 'ADMIN' | 'TEC_FORMACAO' | 'TEC_ACOMPANHAMENTO'
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          title: string
          type: 'FORMACAO' | 'PREMIACAO' | 'ENCONTRO' | 'OUTRO'
          status: 'PLANEJADO' | 'REALIZADO' | 'ARQUIVADO'
          start_at: string
          end_at: string | null
          location: string | null
          audience: string | null
          description: string | null
          tags: string[]
          schools: string[]
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          type: 'FORMACAO' | 'PREMIACAO' | 'ENCONTRO' | 'OUTRO'
          status?: 'PLANEJADO' | 'REALIZADO' | 'ARQUIVADO'
          start_at: string
          end_at?: string | null
          location?: string | null
          audience?: string | null
          description?: string | null
          tags?: string[]
          schools?: string[]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          type?: 'FORMACAO' | 'PREMIACAO' | 'ENCONTRO' | 'OUTRO'
          status?: 'PLANEJADO' | 'REALIZADO' | 'ARQUIVADO'
          start_at?: string
          end_at?: string | null
          location?: string | null
          audience?: string | null
          description?: string | null
          tags?: string[]
          schools?: string[]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      event_files: {
        Row: {
          id: string
          event_id: string
          kind: 'PHOTO' | 'DOC'
          scope: 'UNSCOPED' | 'REPORT_PDF' | 'ATTENDANCE_PDF' | 'REPORT_PPT'
          filename: string
          mime: string
          size: number
          url: string
          thumbnail_url: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          kind: 'PHOTO' | 'DOC'
          scope?: 'UNSCOPED' | 'REPORT_PDF' | 'ATTENDANCE_PDF' | 'REPORT_PPT'
          filename: string
          mime: string
          size: number
          url: string
          thumbnail_url?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          kind?: 'PHOTO' | 'DOC'
          scope?: 'UNSCOPED' | 'REPORT_PDF' | 'ATTENDANCE_PDF' | 'REPORT_PPT'
          filename?: string
          mime?: string
          size?: number
          url?: string
          thumbnail_url?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_files_event_id_fkey"
            columns: ["event_id"]
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      attendance: {
        Row: {
          id: string
          event_id: string
          person_name: string
          person_role: string | null
          school: string | null
          present: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          person_name: string
          person_role?: string | null
          school?: string | null
          present?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          person_name?: string
          person_role?: string | null
          school?: string | null
          present?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      event_notes: {
        Row: {
          id: string
          event_id: string
          text: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          text: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          text?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_notes_event_id_fkey"
            columns: ["event_id"]
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_notes_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      event_reports: {
        Row: {
          id: string
          event_id: string
          content: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          content: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          content?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reports_event_id_fkey"
            columns: ["event_id"]
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reports_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'ADMIN' | 'TEC_FORMACAO' | 'TEC_ACOMPANHAMENTO'
      event_type: 'FORMACAO' | 'PREMIACAO' | 'ENCONTRO' | 'OUTRO'
      event_status: 'PLANEJADO' | 'REALIZADO' | 'ARQUIVADO'
      file_kind: 'PHOTO' | 'DOC'
      file_scope: 'UNSCOPED' | 'REPORT_PDF' | 'ATTENDANCE_PDF' | 'REPORT_PPT'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
