// Pictures for tests: real image files made in memory

const zlib = require('zlib')

// A real PNG of w×h gray pixels
function png(w, h) {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length)
    out.writeUInt32BE(data.length, 0)
    out.write(type, 4, 'ascii')
    data.copy(out, 8)
    out.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), data])) >>> 0, 8 + data.length)
    return out
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0
  const rows = Buffer.alloc((w + 1) * h, 0x80)
  for (let y = 0; y < h; y++) rows[y * (w + 1)] = 0
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}

module.exports = { png }
