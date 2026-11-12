import { longDate } from '../../../core/dates'
import type { DayNote } from '../../../core/types'
import { setHabitDone } from '../repo'
import type { MonthView } from '../stats'

const ROW = 36
const CHART_W = 132
const PAD = 12

interface HabitGridProps {
  month: MonthView
  today: string
  notes: Map<string, DayNote>
  onOpenDay: (date: string) => void
}

const xFor = (value: number, max: number) => PAD + (value / max) * (CHART_W - 2 * PAD)

const format = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

/** Línea en zigzag: cada renglón es un día y la posición horizontal, cuántos hábitos se cumplieron. */
function Chart({ month, today }: { month: MonthView; today: string }) {
  const max = Math.max(1, month.columns.length)
  const height = month.days.length * ROW
  const points = month.perDay.flatMap((value, i) => (value === null ? [] : [{ x: xFor(value, max), y: i * ROW + ROW / 2, day: month.days[i] }]))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
  const summary =
    month.average === null
      ? 'Todavía no hay días para graficar'
      : `Hábitos cumplidos por día. Promedio ${format(month.average)} de ${max}.`

  return (
    <svg className="chart" width={CHART_W} height={height} viewBox={`0 0 ${CHART_W} ${height}`} role="img" aria-label={summary}>
      {Array.from({ length: max + 1 }, (_, v) => (
        <line key={v} className={v === 0 ? 'axis' : 'gridline'} x1={xFor(v, max)} x2={xFor(v, max)} y1={0} y2={height} />
      ))}
      {path && <path className="trace" d={path} />}
      {points.map((p) => (
        <circle key={p.day} className={p.day === today ? 'dot today' : 'dot'} cx={p.x} cy={p.y} r={p.day === today ? 5 : 3.5} />
      ))}
    </svg>
  )
}

function ChartScale({ max }: { max: number }) {
  return (
    <svg className="chart-scale" width={CHART_W} height={22} viewBox={`0 0 ${CHART_W} 22`} aria-hidden="true">
      {Array.from({ length: max + 1 }, (_, v) => (
        <text key={v} x={xFor(v, max)} y={16} textAnchor="middle">
          {v}
        </text>
      ))}
    </svg>
  )
}

export function HabitGrid({ month, today, notes, onOpenDay }: HabitGridProps) {
  const { days, columns } = month
  const max = Math.max(1, columns.length)

  return (
    <div className="grid-wrap" role="region" aria-label="Tabla de hábitos del mes" tabIndex={0}>
      <table className="habit-grid">
        <thead>
          <tr>
            <th className="corner" scope="col">
              <span className="sr-only">Día</span>
            </th>
            {columns.map((c) => (
              <th key={c.habit.id} scope="col" className="hab-head">
                <span>{c.habit.name}</span>
              </th>
            ))}
            <th scope="col" className="chart-head">
              <span className="sr-only">Hábitos cumplidos por día</span>
              <ChartScale max={max} />
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) => {
            const future = day > today
            const hasNote = notes.has(day)
            return (
              <tr key={day} className={day === today ? 'is-today' : undefined}>
                <th scope="row" className="day">
                  <button
                    type="button"
                    disabled={future}
                    onClick={() => onOpenDay(day)}
                    aria-label={`${longDate(day)}${hasNote ? ', con nota' : ''}`}
                  >
                    {i + 1}
                    {hasNote && <i className="note-dot" aria-hidden="true" />}
                  </button>
                </th>
                {columns.map((c) => {
                  const state = c.cells[i]
                  const done = state === 'done'
                  return (
                    <td key={c.habit.id} className={`cell ${state}`}>
                      <button
                        type="button"
                        aria-label={`${c.habit.name}, ${longDate(day)}`}
                        aria-pressed={done}
                        disabled={state === 'future' || state === 'off'}
                        onClick={() => void setHabitDone(c.habit.id, day, !done)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path className="mark" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </td>
                  )
                })}
                {i === 0 && (
                  <td className="chart-cell" rowSpan={days.length}>
                    <Chart month={month} today={today} />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="day">
              <span className="sr-only">Total</span>
            </th>
            {columns.map((c) => (
              <td key={c.habit.id} className="total" title={`${c.habit.name}: ${c.done} de ${c.outOf} días`}>
                <b>{c.done}</b>
                <span>/{c.outOf}</span>
              </td>
            ))}
            <td className="average">{month.average === null ? '' : `Promedio ${format(month.average)} de ${max}`}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
