'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const run = async () => {
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const next = searchParams.get('next') || '/projects'

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
  }, [router, searchParams])

  return <div style={{ padding: 24 }}>Kirjaudutaan...</div>
}