import { describe, expect, it } from 'vitest'
import { parseQuickTask } from './parse'

// Lunes 19 de octubre de 2026
const now = new Date(2026, 9, 19, 10, 0)
const p = (s: string) => parseQuickTask(s, now)

describe('parseQuickTask', () => {
  it('deja una tarea simple sin fecha', () => {
    expect(p('comprar pan')).toMatchObject({ title: 'Comprar pan', dueDate: null, dueTime: null, priority: 0, tags: [], repeat: null })
  })

  it('entiende hoy, mañana y pasado mañana', () => {
    expect(p('llamar al contador hoy').dueDate).toBe('2026-10-19')
    expect(p('llamar al contador mañana')).toMatchObject({ title: 'Llamar al contador', dueDate: '2026-10-20' })
    expect(p('llamar al contador pasado mañana').dueDate).toBe('2026-10-21')
  })

  it('entiende días de la semana como la próxima vez que ocurren', () => {
    expect(p('dentista el jueves').dueDate).toBe('2026-10-22')
    expect(p('dentista miércoles').dueDate).toBe('2026-10-21')
    expect(p('reunión el lunes').dueDate).toBe('2026-10-26')
  })

  it('entiende fechas numéricas y con mes', () => {
    expect(p('cumple de Ana el 25/10').dueDate).toBe('2026-10-25')
    expect(p('cumple de Ana 3 de noviembre').dueDate).toBe('2026-11-03')
    expect(p('renovar registro 5/3').dueDate).toBe('2027-03-05')
    expect(p('pagar patente el 28').dueDate).toBe('2026-10-28')
    expect(p('pagar alquiler el 5').dueDate).toBe('2026-11-05')
  })

  it('entiende "en N días/semanas/meses"', () => {
    expect(p('revisar presupuesto en 3 días').dueDate).toBe('2026-10-22')
    expect(p('revisar presupuesto en 2 semanas').dueDate).toBe('2026-11-02')
    expect(p('revisar presupuesto en 1 mes').dueDate).toBe('2026-11-19')
  })

  it('entiende horas en distintos formatos', () => {
    expect(p('gimnasio hoy a las 18').dueTime).toBe('18:00')
    expect(p('gimnasio hoy 18:30').dueTime).toBe('18:30')
    expect(p('gimnasio hoy a las 6 de la tarde').dueTime).toBe('18:00')
    expect(p('gimnasio hoy 7am').dueTime).toBe('07:00')
    expect(p('gimnasio hoy 9pm').dueTime).toBe('21:00')
    expect(p('gimnasio hoy a las 12 de la mañana').dueTime).toBe('12:00')
  })

  it('no confunde cantidades con horas', () => {
    expect(p('comprar 2 leches')).toMatchObject({ title: 'Comprar 2 leches', dueTime: null })
  })

  it('no confunde "de la mañana" con la fecha de mañana', () => {
    expect(p('correr a las 7 de la mañana')).toMatchObject({ dueTime: '07:00', dueDate: null })
  })

  it('entiende prioridad y etiquetas', () => {
    expect(p('presentar informe !alta #trabajo #urgente')).toMatchObject({ title: 'Presentar informe', priority: 3, tags: ['trabajo', 'urgente'] })
    expect(p('ordenar escritorio !1').priority).toBe(1)
  })

  it('entiende repeticiones', () => {
    expect(p('tomar vitaminas todos los días')).toMatchObject({ title: 'Tomar vitaminas', repeat: { unit: 'day', interval: 1 }, dueDate: '2026-10-19' })
    expect(p('regar plantas cada lunes y jueves')).toMatchObject({
      title: 'Regar plantas',
      repeat: { unit: 'week', interval: 1, weekdays: [1, 4] },
      dueDate: '2026-10-19',
    })
    expect(p('limpiar filtros cada 2 semanas').repeat).toEqual({ unit: 'week', interval: 2 })
    expect(p('pagar expensas cada mes').repeat).toEqual({ unit: 'month', interval: 1 })
  })

  it('combina todo en una frase', () => {
    expect(p('Pagar la luz mañana a las 18 !alta #casa')).toEqual({
      title: 'Pagar la luz',
      dueDate: '2026-10-20',
      dueTime: '18:00',
      priority: 3,
      tags: ['casa'],
      repeat: null,
    })
  })

  it('si solo hay fecha, conserva el texto original como título', () => {
    expect(p('mañana').title).toBe('mañana')
  })
})

describe('límites de entrada', () => {
  it('procesa en tiempo acotado una frase enorme y la recorta', () => {
    const start = performance.now()
    const parsed = parseQuickTask('a '.repeat(50_000), now)
    expect(performance.now() - start).toBeLessThan(500)
    expect(parsed.title.length).toBeLessThanOrEqual(500)
  })
})
