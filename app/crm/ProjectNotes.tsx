'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/*
 * Kayttajan omat muistiinpanot yhdesta hankkeesta.
 *
 * Tallennus on viivastetty: joka nappainpainallus ei kirjoita kantaan,
 * vaan kirjoittamisen tauottua. Lisaksi tallennetaan heti kun kentasta
 * poistutaan, jottei viimeinen ajatus jaa lahettamatta jos kayttaja
 * sulkee valilehden.
 *
 * Teksti sailyy vaikka hanke poistetaan omista - siksi muistiinpanot
 * ovat omassa taulussaan (docs/sql/2026-08-28_user_project_notes.sql).
 */

const VIIVE_MS = 900

type Tila = 'idle' | 'saving' | 'saved' | 'error'

export default function ProjectNotes({
  projectId,
  userId,
  initialNote,
}: {
  projectId: string
  userId: string
  initialNote: string
}) {
  const [text, setText] = useState(initialNote)
  const [tila, setTila] = useState<Tila>('idle')

  /* Viimeksi kantaan asti paassyt teksti, jotta turhat kirjoitukset jaavat pois. */
  const tallennettu = useRef(initialNote)

  const tallenna = useCallback(
    async (arvo: string) => {
      if (arvo === tallennettu.current) return

      setTila('saving')

      const { error } = await supabase.from('user_project_notes').upsert(
        { user_id: userId, project_id: projectId, note: arvo },
        { onConflict: 'user_id,project_id' }
      )

      if (error) {
        console.error('Muistiinpanon tallennus epaonnistui:', error)
        setTila('error')
        return
      }

      tallennettu.current = arvo
      setTila('saved')
    },
    [projectId, userId]
  )

  /* Viivastetty tallennus kirjoittamisen tauottua. */
  useEffect(() => {
    if (text === tallennettu.current) return

    const t = setTimeout(() => {
      void tallenna(text)
    }, VIIVE_MS)

    return () => clearTimeout(t)
  }, [text, tallenna])

  const viesti =
    tila === 'saving'
      ? 'Tallennetaan...'
      : tila === 'error'
        ? 'Tallennus epäonnistui'
        : tila === 'saved'
          ? 'Tallennettu'
          : ''

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}
      >
        <label
          htmlFor={`note-${projectId}`}
          style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}
        >
          Omat muistiinpanot
        </label>

        <span
          aria-live="polite"
          style={{
            fontSize: 12,
            color: tila === 'error' ? '#991b1b' : '#6b7280',
          }}
        >
          {viesti}
        </span>
      </div>

      <textarea
        id={`note-${projectId}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (tila !== 'idle') setTila('idle')
        }}
        onBlur={() => void tallenna(text)}
        rows={3}
        placeholder="Kirjoita omat muistiinpanosi tästä hankkeesta..."
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 14,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
    </div>
  )
}
