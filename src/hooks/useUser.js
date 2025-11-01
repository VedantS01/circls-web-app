"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function useUser() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      const { data } = await supabase.auth.getSession()
      const session = data?.session
      if (!session) {
        if (mounted) {
          setUser(null)
          setProfile(null)
          setOrganizations([])
          setVerified(false)
          setLoading(false)
        }
        return
      }
  const u = session?.user ?? null
  if (mounted) setUser(u)

      // fetch profile
      const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle()
      if (mounted) setProfile(p || null)

      // memberships/organizations via new membership table
      const { data: orgMemberships, error: orgMembershipError } = await supabase
        .from('organization_memberships')
        .select('organization_id, permissions, organization:organization_id (*)')
        .eq('profile_id', u.id)

      if (orgMembershipError) {
        console.error('useUser: failed to load organization memberships', orgMembershipError)
      }

      const resolvedOrgs = (orgMemberships || [])
        .map((entry) => {
          const organization = entry?.organization
          if (!organization) return null
          return {
            ...organization,
            membershipPermissions: Array.isArray(entry.permissions) ? entry.permissions : [],
          }
        })
        .filter(Boolean)

      if (mounted) setOrganizations(resolvedOrgs)

    // verified check: for email-based auth, consider users verified when their email is confirmed.
    // Supabase sets `email_confirmed_at` on the user session when verification link is clicked.
    const isVerified = !!(u?.email && (u.email_confirmed_at || u.user_metadata?.email_confirmed))
      if (mounted) setVerified(isVerified)

      if (mounted) setLoading(false)
    }

    load()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      load()
    })

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe?.()
    }
  }, [])

  return { user, profile, organizations, loading, verified }
}
