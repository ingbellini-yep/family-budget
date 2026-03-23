import { useState, useRef, useEffect } from 'react'
import { FileDown, ChevronDown, Loader2 } from 'lucide-react'

export interface PDFExportOption {
  label: string
  description?: string
  onExport: () => Promise<void>
}

interface Props {
  options: PDFExportOption[]
  label?: string
  size?: 'sm' | 'md'
  variant?: 'primary' | 'secondary'
}

export default function PDFExportButton({ options, label = 'Esporta PDF', size = 'md', variant = 'secondary' }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleExport = async (opt: PDFExportOption, idx: number) => {
    setOpen(false)
    setLoading(idx)
    try {
      await opt.onExport()
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('Errore durante la generazione del PDF. Riprova.')
    } finally {
      setLoading(null)
    }
  }

  const base = size === 'sm'
    ? 'text-xs px-2.5 py-1.5 gap-1.5'
    : 'text-sm px-3 py-2 gap-2'

  const colors = variant === 'primary'
    ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-700'
    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'

  const isLoading = loading !== null

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => !isLoading && setOpen(o => !o)}
        disabled={isLoading}
        className={`inline-flex items-center rounded-lg border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60 ${base} ${colors}`}
      >
        {isLoading
          ? <Loader2 className={size === 'sm' ? 'w-3.5 h-3.5 animate-spin' : 'w-4 h-4 animate-spin'} />
          : <FileDown className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        }
        <span>{isLoading ? 'Generazione…' : label}</span>
        {!isLoading && options.length > 1 && (
          <ChevronDown className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && options.length > 0 && (
        <div className="absolute right-0 mt-1 w-60 rounded-xl bg-white shadow-lg ring-1 ring-black/10 z-50 overflow-hidden">
          <div className="py-1">
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleExport(opt, idx)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <FileDown className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
