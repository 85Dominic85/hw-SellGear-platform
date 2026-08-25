import Image from 'next/image'
import type { ProductModelOption } from '@/types/database'

interface ModelOptionsProps {
  options: ProductModelOption[]
  note?: string | null
  compact?: boolean
}

/**
 * Modelos que se envían según disponibilidad. Existe porque el catálogo no
 * debe prometer una marca única cuando el proveedor manda una u otra: el TPV
 * Pro llega como Aqprox appTPV05 o como 10POS.
 */
export default function ModelOptions({
  options,
  note,
  compact = false,
}: ModelOptionsProps) {
  if (!options.length) return null
  return (
    <div className={compact ? 'model-options compact' : 'model-options'}>
      <div className="model-option-images" aria-label="Modelos posibles">
        {options.map((option) => (
          <div
            className="model-option-image"
            key={option.name}
            title={option.name}
          >
            <Image
              src={option.image_url}
              alt={option.name}
              fill
              sizes={compact ? '38px' : '54px'}
            />
          </div>
        ))}
      </div>
      <div className="model-options-copy">
        <strong>Uno de estos modelos</strong>
        {note && <span>{note}</span>}
      </div>
    </div>
  )
}
