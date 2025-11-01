import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdminClient'

export async function POST(req) {
  console.log('=== CREATE ORGANIZATION API CALLED ===');
  
  if (!supabaseAdmin) {
    console.error('Admin client not configured');
    return NextResponse.json({ error: 'Admin client not configured' }, { status: 501 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    const token = body?.access_token || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const payload = body?.payload || {}
    const fallbackUserId = body?.userId || null

    console.log('Extracted token (first 20 chars):', token?.substring(0, 20));
    console.log('Payload:', payload);
    console.log('Fallback userId:', fallbackUserId);

    if (!token) {
      console.error('Missing access token');
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 })
    }

    // Verify token with admin to obtain the user id. This avoids relying on client anon keys for inserts.
    console.log('Starting user verification...');
    try {
      // Some Supabase admin clients expose getUserByCookie or getUser; prefer admin.getUserById if provided
      // Try to resolve the user from the provided access token first.
      // Different supabase-js versions expose different helpers; try several.
      let user = null
      if (token) {
        try {
          if (supabaseAdmin.auth && typeof supabaseAdmin.auth.getUser === 'function') {
            const userRes = await supabaseAdmin.auth.getUser(token)
            user = userRes?.data?.user || userRes?.user || null
          } else if (supabaseAdmin.auth && supabaseAdmin.auth.api && typeof supabaseAdmin.auth.api.getUser === 'function') {
            const userRes = await supabaseAdmin.auth.api.getUser(token)
            user = userRes?.data?.user || userRes?.user || null
          }
        } catch (e) {
          console.warn('create-organization: token-based lookup threw', e)
          user = null
        }
      }

      // If token-based lookup failed but client sent a userId, verify that user exists via admin API
      if (!user && fallbackUserId && supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.getUserById === 'function') {
        try {
          const who = await supabaseAdmin.auth.admin.getUserById(fallbackUserId)
          user = who?.data?.user || who?.user || null
        } catch (e) {
          console.warn('create-organization: admin.getUserById threw', e)
          user = null
        }
      }

      // If still no user but token looks like a UUID, try treating token as a userId
      if (!user && token && /^[0-9a-fA-F-]{36}$/.test(token) && supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.getUserById === 'function') {
        try {
          const who = await supabaseAdmin.auth.admin.getUserById(token)
          user = who?.data?.user || who?.user || null
        } catch (e) {
          console.warn('create-organization: admin.getUserById(token-as-id) threw', e)
          user = null
        }
      }

      if (!user) {
        console.error('create-organization: User not found. Token invalid or user does not exist.');
        return NextResponse.json({ 
          error: 'Invalid token or unable to verify user',
          details: 'Could not find user with provided token' 
        }, { status: 401 })
      }

      console.log('create-organization: user found', { 
        id: user.id, 
        email: user.email, 
        confirmed: user.email_confirmed_at || user.confirmed_at 
      });

      const userId = user.id

      // Optional: ensure email confirmed before allowing org creation
      const confirmed = user.email_confirmed_at || user.confirmed_at
      if (!confirmed) {
        console.error('create-organization: Email not confirmed for user', userId);
        return NextResponse.json({ 
          error: 'Email not confirmed',
          details: 'Please confirm your email before creating an organization' 
        }, { status: 403 })
      }

      console.log('create-organization: Email confirmed, proceeding with org creation');

      const insertPayload = {
        name: (payload.name || '').trim(),
        description: payload.description || null,
        contact_info: payload.contact_info || null,
        created_by: userId,
      }

      if (!insertPayload.name) {
        console.error('create-organization: Organization name is required but was empty');
        return NextResponse.json({ 
          error: 'Organization name is required',
          details: 'Please provide a valid organization name' 
        }, { status: 400 })
      }

      console.log('create-organization: Attempting to insert with payload:', insertPayload);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .insert([insertPayload])
        .select()
        .single()
      
      if (error) {
        console.error('create-organization: Insert error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return NextResponse.json({ 
          error: error.message, 
          details: error.details,
          hint: error.hint,
          code: error.code
        }, { status: 500 })
      }
      
      console.log('create-organization: Successfully created organization:', data);

      return NextResponse.json({ organization: data })
    } catch (err) {
      console.error('create-organization caught error:', err);
      console.error('Error stack:', err.stack);
      return NextResponse.json({ 
        error: String(err),
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }, { status: 500 })
    }
  } catch (err) {
    console.error('create-organization outer catch:', err);
    return NextResponse.json({ 
      error: String(err),
      message: err.message
    }, { status: 500 })
  }
}
