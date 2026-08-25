import { Info } from 'lucide-react'

/**
 * Nota INTERNA para el comercial. Va en gris, no en naranja, para que se
 * distinga de un aviso al cliente. NUNCA debe salir en un PDF ni en ninguna
 * comunicación al cliente: solo se ve aquí.
 */
export default function InternalNote({ note }: { note: string }) {
  return (
    <p className="product-note product-note-internal">
      <Info
        size={15}
        aria-hidden="true"
        style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }}
      />
      <strong>Nota interna: </strong>
      {note}
    </p>
  )
}
