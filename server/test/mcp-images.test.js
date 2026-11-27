// What a picture is, read from its bytes, and one-time upload addresses
// (server/mcp/images.js)

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { imageInfo, uploadTickets } = require('../mcp/images')
const { png } = require('./pictures')

describe('imageInfo', () => {
  it('reads PNG, GIF, JPEG, WebP and SVG sizes from their bytes', () => {
    assert.deepEqual(imageInfo(png(40, 30)), { type: 'png', ext: '.png', mime: 'image/png', width: 40, height: 30 })
    const gif = Buffer.from('GIF89a\x20\x00\x10\x00\x00\x00\x00\x00', 'latin1')
    assert.deepEqual([imageInfo(gif).type, imageInfo(gif).width, imageInfo(gif).height], ['gif', 32, 16])
    // SOI, an APP0 segment, then a baseline frame of 600×400
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x90, 0x02, 0x58, 0x03, 0, 0, 0, 0, 0, 0, 0, 0])
    assert.deepEqual([imageInfo(jpeg).type, imageInfo(jpeg).width, imageInfo(jpeg).height], ['jpeg', 600, 400])
    const webp = Buffer.alloc(30)
    webp.write('RIFF', 0); webp.write('WEBP', 8); webp.write('VP8X', 12); webp.writeUIntLE(799, 24, 3); webp.writeUIntLE(449, 27, 3)
    assert.deepEqual([imageInfo(webp).type, imageInfo(webp).width, imageInfo(webp).height], ['webp', 800, 450])
    const svg = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect/></svg>')
    assert.deepEqual([imageInfo(svg).type, imageInfo(svg).width, imageInfo(svg).height], ['svg', 120, 60])
    assert.deepEqual([imageInfo(Buffer.from('<svg width="50px" height="20" xmlns="http://www.w3.org/2000/svg"/>')).width], [50])
  })

  it('takes nothing else', () => {
    assert.equal(imageInfo(Buffer.from('%PDF-1.7 not a picture at all')), null)
    assert.equal(imageInfo(Buffer.from('<html><body><svg></svg></body></html>')), null)
    assert.equal(imageInfo(Buffer.from('short')), null)
  })
})

describe('upload addresses', () => {
  it('work once, until they expire, a few at a time per link', () => {
    let now = 1000
    const tickets = uploadTickets({ ttlMs: 100, perOwner: 2, now: () => now })
    const a = tickets.make('link1', { file: 'a.png' })
    assert.match(a, /^[a-z2-7]{39}$/)
    assert.deepEqual(tickets.take(a), { file: 'a.png' })
    assert.equal(tickets.take(a), null)
    tickets.make('link1', {}); tickets.make('link1', {})
    assert.equal(tickets.make('link1', {}), null)
    assert.ok(tickets.make('link2', {}))
    const late = tickets.make('link2', { file: 'late' })
    now += 101
    assert.equal(tickets.take(late), null)
    assert.ok(tickets.make('link1', {}), 'expired ones make room')
  })
})


describe('the add_image edit', () => {
  const { runEdits } = require('../mcp/edits')
  const deck = () => ({ slides: [{ id: 's1', elements: [] }] })

  it('is made only by add_image, never through apply_edits', () => {
    const edit = { op: 'add_image', slide: 1, src: '/uploads/d/a.png', alt: 'A plot' }
    assert.throws(() => runEdits(deck(), [edit]), /must be one of: (?!.*add_image)/)
    const d = deck()
    runEdits(d, [edit], { internal: true })
    assert.equal(d.slides[0].elements[0].type, 'image')
  })

  it('fills the space under a title, keeping the picture\'s shape, unless given a box', () => {
    const wide = deck()
    runEdits(wide, [{ op: 'add_image', slide: 1, src: '/uploads/d/a.png', alt: 'Wide', size: { width: 2000, height: 500 } }], { internal: true })
    assert.deepEqual(['x', 'y', 'width', 'height'].map(k => wide.slides[0].elements[0][k]), [60, 215, 840, 210])
    const boxed = deck()
    runEdits(boxed, [{ op: 'add_image', slide: 1, src: '/uploads/d/a.png', alt: 'Boxed', height: 100, size: { width: 300, height: 100 } }], { internal: true })
    assert.deepEqual(['width', 'height'].map(k => boxed.slides[0].elements[0][k]), [300, 100])
    assert.throws(() => runEdits(deck(), [{ op: 'add_image', slide: 1, src: '/uploads/../x.png', alt: 'x' }], { internal: true }), /stored with the presentation/)
    assert.throws(() => runEdits(deck(), [{ op: 'add_image', slide: 1, src: '/uploads/d/a.png', alt: 'x', fit: 'stretch' }], { internal: true }), /fit is contain/)
  })
})
