// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SlideCanvas from './SlideCanvas'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('canvas drag release', () => {
  let host, root, box, update
  const mouse = (target, type, x, buttons) => act(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, buttons, clientX: x, clientY: 20 }))
  })

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    // happy-dom has no layout; provide a 1:1 canvas scale.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(984)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(564)
    update = vi.fn()
    root = createRoot(host)
    act(() => root.render(<SlideCanvas
      slide={{ id: 'slide', elements: [{ id: 'box', type: 'shape', shape: 'rect', x: 10, y: 10, width: 100, height: 50 }] }}
      selectedElementIds={['box']}
      onToggleSelectElement={() => {}}
      onUpdateElement={update}
      onUpdateElements={() => {}}
      smartGuidesEnabled={false}
    />))
    box = host.querySelector('[data-element-id="box"]')
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.restoreAllMocks()
  })

  it('does not turn a click into a drag after a missed mouseup', () => {
    mouse(box, 'mousedown', 20, 1)
    mouse(document, 'mousemove', 50, 0)
    expect(update).not.toHaveBeenCalled()
    mouse(document, 'mousemove', 80, 1)
    expect(update).not.toHaveBeenCalled()
  })

  it('moves while held, then stops when a move reports the button released', () => {
    mouse(box, 'mousedown', 20, 1)
    mouse(document, 'mousemove', 50, 1)
    expect(update).toHaveBeenCalledWith('box', { x: 40, y: 10 })
    update.mockClear()
    mouse(document, 'mousemove', 80, 0)
    mouse(document, 'mousemove', 90, 1)
    expect(update).not.toHaveBeenCalled()
  })

  it('observes release even when content stops mouseup propagation', () => {
    box.addEventListener('mouseup', e => e.stopPropagation())
    mouse(box, 'mousedown', 20, 1)
    mouse(box, 'mouseup', 20, 0)
    mouse(document, 'mousemove', 50, 1)
    expect(update).not.toHaveBeenCalled()
  })

  it('clears the drag when the browser loses focus', () => {
    mouse(box, 'mousedown', 20, 1)
    mouse(document, 'mousemove', 50, 1)
    update.mockClear()
    act(() => window.dispatchEvent(new Event('blur')))
    mouse(document, 'mousemove', 80, 1)
    expect(update).not.toHaveBeenCalled()
  })

  it('stops on an ordinary mouseup and allows another drag', () => {
    mouse(box, 'mousedown', 20, 1)
    mouse(document, 'mouseup', 20, 0)
    mouse(document, 'mousemove', 50, 1)
    expect(update).not.toHaveBeenCalled()
    mouse(box, 'mousedown', 20, 1)
    mouse(document, 'mousemove', 50, 1)
    expect(update).toHaveBeenCalledWith('box', { x: 40, y: 10 })
  })

  it('does not start a drag from a right click', () => {
    act(() => box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2, buttons: 2, clientX: 20, clientY: 20 })))
    mouse(document, 'mousemove', 50, 1)
    expect(update).not.toHaveBeenCalled()
  })

  it.each(['se-resize', 'grab'])('stops %s handles after a missed release', cursor => {
    const handle = [...box.querySelectorAll('div')].find(el => el.style.cursor === cursor)
    expect(handle).toBeTruthy()
    mouse(handle, 'mousedown', 20, 1)
    mouse(document, 'mousemove', 50, 1)
    expect(update).toHaveBeenCalled()
    update.mockClear()
    mouse(document, 'mousemove', 80, 0)
    expect(update).not.toHaveBeenCalled()
  })
})
