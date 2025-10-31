'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState(null)

  useEffect(() => {
    async function getSession() {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      // If there's no session, require login
      if (!data.session) {
        router.push('/login')
        return
      }

      // Require that the user has confirmed their email before onboarding
      // Supabase may set either `email_confirmed_at` on auth.users; check common fields
      const confirmed = data.session.user?.email_confirmed_at || data.session.user?.confirmed_at
      if (!confirmed) {
        // redirect back to login or a confirm-email flow with a query flag
        router.push('/login?confirmRequired=1')
        return
      }
    }
    getSession()
  }, [router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!session) return
    // Ensure the user has confirmed their email before creating profile/org
    const confirmed = session.user?.email_confirmed_at || session.user?.confirmed_at
    if (!confirmed) {
      setLoading(false)
      alert('Please confirm your email before continuing. Check your inbox for a confirmation link.')
      return
    }
    setLoading(true)
    // Ensure a profile row exists for this user to satisfy the organizations.owner_id FK
    // Upsert is idempotent: creates the profile if missing, leaves it if present
    // Upsert profile and check result — surface errors early to avoid FK failure
    const profilePayload = {
      id: session.user.id,
      full_name: session.user.user_metadata?.full_name || session.user.email || null,
      avatar_url: session.user.user_metadata?.avatar_url || null
    }

    const { data: upsertData, error: upsertError } = await supabase
      .from('profiles')
      .upsert([profilePayload], { returning: 'representation' })

    if (upsertError) {
      console.error('Profile upsert failed', upsertError)
      setLoading(false)
      alert('Unable to create profile for the current user: ' + upsertError.message + '\nThis is likely due to RLS or permissions. Check Supabase policies.')
      return
    }

    // verify profile exists
    const { data: existingProfile, error: profileSelectError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .single()

    if (profileSelectError || !existingProfile) {
      console.error('Profile select failed', profileSelectError)
      setLoading(false)
      alert('Profile was not found after upsert; cannot create organization. Check RLS policies and logs.')
      return
    }

    const { error, data } = await supabase
      .from('organizations')
      .insert([{ name: orgName, owner_id: session.user.id }])
      .select()
      .single()
    setLoading(false)
    if (error) {
      alert('Error creating organization: ' + error.message)
    } else {
      await supabase.from('org_admin_links').insert([{
        user_id: session.user.id,
        organization_id: data.id,
        permissions: ['manage_bookings','edit_details']
      }])
      router.push('/dashboard')
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Organization Onboarding</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Organization Name</span>
            <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="mt-1 block w-full rounded border-theme"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Creating...' : 'Create Organization'}
        </button>
      </form>
    </div>
  )
}
