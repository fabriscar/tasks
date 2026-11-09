import { registerSyncTable } from '../core/sync'
import { dayNotesSync, habitLogsSync, habitsSync } from './habits/sync'
import { tasksSync } from './tasks/sync'

/** Cada módulo nuevo registra aquí las tablas que se sincronizan. */
export function registerModules(): void {
  registerSyncTable(tasksSync)
  registerSyncTable(habitsSync)
  registerSyncTable(habitLogsSync)
  registerSyncTable(dayNotesSync)
}
