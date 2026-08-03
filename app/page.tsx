import AiQueryBar from './components/AiQueryBar'
import AcademicModule from './components/modules/AcademicModule'
import FinanceModule from './components/modules/FinanceModule'
import FitnessModule from './components/modules/FitnessModule'
import ResearchModule from './components/modules/ResearchModule'
import CalendarModule from './components/modules/CalendarModule'

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-8 py-6">
      <AiQueryBar />

      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AcademicModule />
        <FinanceModule />
        <FitnessModule />
        <ResearchModule />
        <CalendarModule />
      </div>
    </main>
  )
}
