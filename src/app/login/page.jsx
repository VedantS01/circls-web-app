'use client'
import React from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import {
  Container,
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
} from '@mui/material'
import { AccountCircle } from '@mui/icons-material'

export default function LoginPage() {
  const router = useRouter()

  React.useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_ADDED') {
        router.push('/check-email');
      }
      if (session) {
        router.push('/');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'primary.50',
                  color: 'primary.main',
                  mb: 2,
                }}
              >
                <AccountCircle sx={{ fontSize: 40 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                Welcome to Circls
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Sign in to your account or create a new one
              </Typography>
            </Box>

            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#3b82f6',
                      brandAccent: '#2563eb',
                      inputBackground: '#ffffff',
                      inputBorder: '#cbd5e1',
                      inputBorderFocus: '#3b82f6',
                      inputBorderHover: '#94a3b8',
                    },
                    borderWidths: {
                      buttonBorderWidth: '1px',
                      inputBorderWidth: '1px',
                    },
                    radii: {
                      borderRadiusButton: '8px',
                      buttonBorderRadius: '8px',
                      inputBorderRadius: '8px',
                    },
                  },
                },
                style: {
                  button: {
                    fontWeight: '500',
                    textTransform: 'none',
                  },
                  anchor: {
                    color: '#3b82f6',
                    fontWeight: '500',
                  },
                  label: {
                    color: '#0f172a',
                    fontWeight: '500',
                  },
                  message: {
                    color: '#64748b',
                  },
                },
              }}
              providers={[]}
              socialLayout="horizontal"
              onlyThirdPartyProviders={false}
            />
          </CardContent>
        </Card>

        <Typography 
          variant="body2" 
          color="text.secondary" 
          align="center" 
          sx={{ mt: 3 }}
        >
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Typography>
      </Container>
    </Box>
  )
}
