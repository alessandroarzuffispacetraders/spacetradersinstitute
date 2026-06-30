import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Aggregati admin calcolati lato DB da funzioni RPC SECURITY DEFINER
// (guardate da is_admin()): vedi supabase/migrations/phase_e_admin_stats.sql.

export interface AdminDashboardData {
  students_total: number
  students_active: number
  coaches: number
  mental_coaches: number
  by_phase: { onboarding: number; build: number; test: number; deploy: number }
  recent: { type: string; label: string; at: string }[]
}

export interface AdminStatisticsData {
  by_status: { active: number; expired: number; blocked: number }
  lessons_completed_total: number
  avg_completion: number
}

export function useAdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.rpc('admin_dashboard').then(({ data }) => {
      if (!active) return
      setData((data as AdminDashboardData) ?? null)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  return { data, loading }
}

export function useAdminStatistics() {
  const [data, setData] = useState<AdminStatisticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.rpc('admin_statistics').then(({ data }) => {
      if (!active) return
      setData((data as AdminStatisticsData) ?? null)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  return { data, loading }
}
