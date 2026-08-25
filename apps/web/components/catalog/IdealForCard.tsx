import { Target } from 'lucide-react'

export default function IdealForCard({ text }: { text: string }) {
  return (
    <div className="ideal-card">
      <span className="icon-disc">
        <Target size={20} aria-hidden="true" />
      </span>
      <h3>Ideal para</h3>
      <p>{text}</p>
    </div>
  )
}
