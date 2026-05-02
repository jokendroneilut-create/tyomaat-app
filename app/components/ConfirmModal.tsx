'use client'

type ConfirmModalProps = {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Peruuta',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        zIndex: 99999,
      }}
    >
      <div
        style={{
          width: 'min(420px, 100%)',
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          padding: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h2>

        <p style={{ color: '#4b5563', marginBottom: 18 }}>
          {message}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              borderRadius: 12,
              padding: '10px 14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            style={{
              border: danger ? '1px solid #b91c1c' : '1px solid #111827',
              background: danger ? '#b91c1c' : '#111827',
              color: '#ffffff',
              borderRadius: 12,
              padding: '10px 14px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}