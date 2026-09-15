import AiQueryBar from './components/AiQueryBar'
import CalendarModule from './components/modules/CalendarModule'
import EducationGlance from './components/widgets/home/EducationGlance'
import MoneyGlance from './components/widgets/home/MoneyGlance'
import ResearchGlance from './components/widgets/home/ResearchGlance'
import HabitsGlance from './components/widgets/home/HabitsGlance'
import DailyGoals from './components/widgets/home/DailyGoals'
import PeopleGlance from './components/widgets/home/PeopleGlance'
import AiUsageGlance from './components/widgets/home/AiUsageGlance'
import AppLauncherGlance from './components/widgets/app-launcher/AppLauncherGlance'

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <AiQueryBar />

      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DailyGoals />
        <EducationGlance />
        <MoneyGlance />
        <AiUsageGlance />
        <ResearchGlance />
        <HabitsGlance />
        <PeopleGlance />
        <AppLauncherGlance />
        <CalendarModule />
      </div>
    </main>
  )
}
