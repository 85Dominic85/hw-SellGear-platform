export default function ComponentsCard({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <div className="components-card">
      <h3>Qué incluye</h3>
      <ul>
        {items.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  )
}
