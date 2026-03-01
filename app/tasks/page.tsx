'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Task = {
  id: string
  title: string
  due_date: string | null
  is_done: boolean
  project_id: string | null
  created_at: string
}

export default function TasksPage() {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [due, setDue] = useState<string>('')

  const fetchTasks = async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) {
      setTasks([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('user_tasks')
      .select('id,title,due_date,is_done,project_id,created_at')
      .eq('user_id', userId)
      .order('is_done', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) console.error(error)
    setTasks((data as Task[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const addTask = async () => {
    const t = title.trim()
    if (!t) return

    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return

    await supabase.from('user_tasks').insert({
      user_id: userId,
      title: t,
      due_date: due || null,
      is_done: false,
      project_id: null,
    })

    setTitle('')
    setDue('')
    fetchTasks()
  }

  const toggleDone = async (task: Task) => {
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return

    await supabase
      .from('user_tasks')
      .update({ is_done: !task.is_done })
      .eq('user_id', userId)
      .eq('id', task.id)

    setTasks((prev) =>
      prev.map((x) => (x.id === task.id ? { ...x, is_done: !task.is_done } : x))
    )
  }

  const removeTask = async (task: Task) => {
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return

    await supabase.from('user_tasks').delete().eq('user_id', userId).eq('id', task.id)
    setTasks((prev) => prev.filter((x) => x.id !== task.id))
  }

  const open = useMemo(() => tasks.filter((t) => !t.is_done), [tasks])
  const done = useMemo(() => tasks.filter((t) => t.is_done), [tasks])

  if (loading) return <p style={{ padding: 20 }}>Ladataan...</p>

  return (
    <div style={{ padding: 20, maxWidth: 760 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Tehtävät</h1>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Uusi tehtävä…"
          style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10, flex: 1, minWidth: 240 }}
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
        />
        <button onClick={addTask} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          Lisää
        </button>
      </div>

      <div style={{ marginBottom: 18, color: '#6b7280' }}>
        Avoinna <strong>{open.length}</strong> • Valmiit <strong>{done.length}</strong>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {open.map((t) => (
          <div key={t.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{t.title}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{t.due_date ? `Eräpäivä: ${t.due_date}` : '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggleDone(t)}
                  style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb' }}
                >
                  Valmis
                </button>
                <button
                  onClick={() => removeTask(t)}
                  style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb' }}
                >
                  Poista
                </button>
              </div>
            </div>
          </div>
        ))}

        {done.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Valmiit</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {done.map((t) => (
                <div key={t.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, opacity: 0.75 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, textDecoration: 'line-through' }}>{t.title}</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        {t.due_date ? `Eräpäivä: ${t.due_date}` : '—'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => toggleDone(t)}
                        style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb' }}
                      >
                        Palauta
                      </button>
                      <button
                        onClick={() => removeTask(t)}
                        style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb' }}
                      >
                        Poista
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}