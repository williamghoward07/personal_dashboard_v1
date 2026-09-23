'use client'

import type { ComponentType } from 'react'
import type { HomeWidgetId, HomeWidgetProps } from '@/lib/home/layout'
import CalendarModule from '../modules/CalendarModule'
import AppLauncherGlance from '../widgets/app-launcher/AppLauncherGlance'
import AiUsageGlance from '../widgets/home/AiUsageGlance'
import DailyGoals from '../widgets/home/DailyGoals'
import EducationGlance from '../widgets/home/EducationGlance'
import HabitsGlance from '../widgets/home/HabitsGlance'
import HealthGlance from '../widgets/home/HealthGlance'
import MoneyGlance from '../widgets/home/MoneyGlance'
import MorningRoutineCard from '../widgets/home/MorningRoutineCard'
import PeopleGlance from '../widgets/home/PeopleGlance'
import ResearchGlance from '../widgets/home/ResearchGlance'
import WorkspacesGlance from '../widgets/home/WorkspacesGlance'

// The id -> component half of the home widget registry. Kept apart from
// lib/home/layout.ts so that file stays React-free and unit-testable; the
// ids, labels and defaults live there, the JSX lives here.
//
// Every widget is typed as accepting `HomeWidgetProps`, which a widget that
// takes no props satisfies for free — so `span` can be handed to all of
// them and only the ones that care read it.
export const HOME_WIDGET_COMPONENTS: Record<HomeWidgetId, ComponentType<HomeWidgetProps>> = {
  'daily-goals': DailyGoals,
  'morning-routine': MorningRoutineCard,
  education: EducationGlance,
  workspaces: WorkspacesGlance,
  money: MoneyGlance,
  'ai-usage': AiUsageGlance,
  research: ResearchGlance,
  habits: HabitsGlance,
  people: PeopleGlance,
  'app-launcher': AppLauncherGlance,
  calendar: CalendarModule,
  health: HealthGlance,
}

export function homeWidgetComponent(id: string): ComponentType<HomeWidgetProps> | undefined {
  return HOME_WIDGET_COMPONENTS[id as HomeWidgetId]
}
