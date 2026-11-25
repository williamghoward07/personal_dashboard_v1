import { FileText } from 'lucide-react'
import BrainDumpBoard from '../components/widgets/braindump/BrainDumpBoard'
import styles from '../components/widgets/braindump/BrainDump.module.css'

export default function BrainDumpPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>
        <FileText aria-hidden="true" />
        Brain dump
      </h1>
      <BrainDumpBoard />
    </main>
  )
}
