'use client'
import React from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  React.useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.push('/')
    })
    return () => listener.subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
  <div className="w-full max-w-md bg-surface p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">Sign in / Sign up</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          socialLayout="horizontal"
          onlyThirdPartyProviders={false}
        />
      </div>
    </div>
  )
}
