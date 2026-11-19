import styles from './LoadingSkeleton.module.css'

type Shape = 'rows' | 'cards' | 'tiles' | 'metric' | 'calendar'

export default function LoadingSkeleton({
  shape = 'rows',
  label = 'Loading…',
}: {
  shape?: Shape
  label?: string
}) {
  const count = { rows: 3, cards: 3, tiles: 6, metric: 1, calendar: 7 }[shape]
  return (
    <div role="status" className={styles.status}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={styles[shape]}>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className={styles.item}>
            <span className={styles.line} />
            <span className={styles.line} />
          </div>
        ))}
      </div>
    </div>
  )
}
