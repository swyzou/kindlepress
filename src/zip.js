// Minimal store-only ZIP writer.
// EPUB requires the mimetype entry first and uncompressed; storing every entry
// satisfies that without pulling in a compression dependency.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const utf8 = (s) => new TextEncoder().encode(s);

/**
 * @param {{name: string, data: Uint8Array|string}[]} entries
 * @returns {Blob} a ZIP archive with every entry stored (method 0)
 */
export function zip(entries) {
  const files = entries.map((e) => ({
    nameBytes: utf8(e.name),
    data: typeof e.data === "string" ? utf8(e.data) : e.data,
  }));

  const chunks = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const crc = crc32(f.data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); // local file header
    head.setUint16(4, 20, true); // version needed
    head.setUint16(6, 0, true); // flags
    head.setUint16(8, 0, true); // method: stored
    head.setUint16(10, 0, true); // time
    head.setUint16(12, 0x21, true); // date (1 Jan 2000, deterministic)
    head.setUint32(14, crc, true);
    head.setUint32(18, f.data.length, true);
    head.setUint32(22, f.data.length, true);
    head.setUint16(26, f.nameBytes.length, true);
    head.setUint16(28, 0, true); // extra length
    chunks.push(new Uint8Array(head.buffer), f.nameBytes, f.data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true); // central directory header
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, 0, true);
    dir.setUint16(14, 0x21, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, f.data.length, true);
    dir.setUint32(24, f.data.length, true);
    dir.setUint16(28, f.nameBytes.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), f.nameBytes);

    offset += 30 + f.nameBytes.length + f.data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], {
    type: "application/epub+zip",
  });
}
