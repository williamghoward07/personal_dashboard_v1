// Module code → readable name, for the work list's module chips. Pure.

import type { WorkItem } from '@/lib/blackboard/work'

/** "Physical Geography (26/27)" → "Physical Geography". */
export function stripYearTag(name: string): string {
  return name.replace(/\s*\(\d{2}\/\d{2}\)\s*$/, '').trim()
}

/**
 * One name per module code. The timetable's `moduleName` wins (it's clean);
 * else the Blackboard course name without its year tag. A code with no name
 * is left out, so callers fall back to the code alone.
 */
export function moduleNameMap(items: Pick<WorkItem, 'moduleCode' | 'courseName' | 'session'>[]): Map<string, string> {
  const names = new Map<string, string>()
  for (const item of items) {
    const name = item.session?.moduleName.trim()
    if (item.moduleCode && name && !names.has(item.moduleCode)) names.set(item.moduleCode, name)
  }
  for (const item of items) {
    const name = item.courseName ? stripYearTag(item.courseName) : ''
    if (item.moduleCode && name && !names.has(item.moduleCode)) names.set(item.moduleCode, name)
  }
  return names
}
