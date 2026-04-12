'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const token_hash = params.get('token_hash')
      const type = params.get('type')
      const next = params.get('next') || '/projects'

      if (!token_hash || !type) {
        router.push('/login')
        return
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      })

      if (error) {
        console.error('AUTH CALLBACK ERROR:', error)
        router.push('/login')
        return
      }

      router.push(next)
    }

    run()
  }, [router])

  return <div style={{ padding: 24 }}>Kirjaudutaan...</div>
}