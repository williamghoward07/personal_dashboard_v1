'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Year, Module } from '@/lib/types'
import YearSelect from './YearSelect'
import ModuleTabs from './ModuleTabs'
import ModuleDetail from './ModuleDetail'

export default function AcademicBoard() {
  const [years, setYears] = useState<Year[]>([])
  const [loadingYears, setLoadingYears] = useState(true)
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('years')
      .select('*')
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        setYears(data ?? [])
        if (data && data.length > 0) setSelectedYearId(data[0].id)
        setLoadingYears(false)
      })
  }, [])

  const refreshModules = (yearId: string) => {
    supabase
      .from('modules')
      .select('*')
      .eq('year_id', yearId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setModules(data ?? []))
  }

  useEffect(() => {
    setSelectedModuleId(null)
    if (!selectedYearId) {
      setModules([])
      return
    }
    refreshModules(selectedYearId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYearId])

  if (loadingYears) {
    return (
      <p className="text-sm text-on-surface-variant sm:col-span-2 xl:col-span-4">
        Loading years...
      </p>
    )
  }

  if (years.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant sm:col-span-2 xl:col-span-4">
        No academic years yet — add one to the `years` table in Supabase to
        get started.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:col-span-2 xl:col-span-4">
      <YearSelect
        years={years}
        selectedYearId={selectedYearId}
        onChange={setSelectedYearId}
      />

      {selectedYearId && (
        <div className="flex flex-col gap-4">
          <ModuleTabs
            yearId={selectedYearId}
            modules={modules}
            selectedModuleId={selectedModuleId}
            onSelect={setSelectedModuleId}
            onChange={() => refreshModules(selectedYearId)}
          />

          {selectedModuleId && <ModuleDetail moduleId={selectedModuleId} />}
        </div>
      )}
    </div>
  )
}
