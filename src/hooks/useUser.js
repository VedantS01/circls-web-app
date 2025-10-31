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

      // memberships/organizations
      const { data: orgs1 } = await supabase.from('organizations').select('*').eq('owner_id', u.id)
      const { data: links } = await supabase.from('org_admin_links').select('organization_id').eq('user_id', u.id)
      let orgs = orgs1 || []
      if (links && links.length > 0) {
        const ids = links.map(l => l.organization_id)
        const { data: linkedOrgs } = await supabase.from('organizations').select('*').in('id', ids)
        orgs = [...orgs, ...(linkedOrgs || [])]
      }
      if (mounted) setOrganizations(orgs)

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
