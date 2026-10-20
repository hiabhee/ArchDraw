import { describe, expect, it } from 'vitest'
import { extractNodeLabel } from '../nodeShapes'

describe('extractNodeLabel', () => {
  it('keeps a closer that sits inside a quoted label', () => {
    expect(extractNodeLabel('canvas("Canvas (React Flow)")')).toBe('Canvas (React Flow)')
    expect(extractNodeLabel('a["List [beta]"]')).toBe('List [beta]')
    expect(extractNodeLabel('d{"Retry? (max 3)"}')).toBe('Retry? (max 3)')
    expect(extractNodeLabel('e("Say \\"hi\\" (x)")')).toBe('Say "hi" (x)')
  })

  it('still reads unquoted and plain labels', () => {
    expect(extractNodeLabel('a(Rounded)')).toBe('Rounded')
    expect(extractNodeLabel('db[("Store (main)")]')).toBe('Store (main)')
    expect(extractNodeLabel('lb{{"LB (edge)"}}')).toBe('LB (edge)')
    expect(extractNodeLabel('a')).toBeNull()
  })
})
