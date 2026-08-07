/**
 * Vibe clip sharing: read-only container probe for recorded blobs.
 *
 * Parses just enough of an MP4 (box walk: ftyp/moov/trak/mdia/hdlr/stbl/stsz,
 * mdat fallback) or WebM (EBML walk: Segment/Tracks/TrackEntry, Cluster
 * SimpleBlock + BlockGroup/Block frame bytes) to answer one question: does
 * this file contain a video track with real sample bytes? The recorder core
 * (engine/clipRecorder.ts) runs it before handing a clip to the preview so
 * an audio-only file is never presented as a success — the Safari failure
 * mode this guards against produces exactly that.
 *
 * Pure, DOM-free, allocation-light (walks headers, never copies payloads).
 * Verified by scripts/verify-clip-recorder.js (fixtures) and exercised
 * against real browser recordings in scripts/verify-clip-share.js.
 */

export type ClipContainerInfo = {
  containerKind: 'mp4' | 'webm'
  hasVideoTrack: boolean
  hasAudioTrack: boolean
  /** Summed video sample bytes (0 = audio-only or empty video track). */
  videoSampleBytes: number
  /** Video track dimensions when the container declares them (MP4 tkhd /
   *  WebM Video PixelWidth/PixelHeight), else null. */
  videoWidth: number | null
  videoHeight: number | null
}

// --- MP4 -----------------------------------------------------------------------

function* walkMp4Boxes(view: DataView, start: number, end: number) {
  let pos = start
  while (pos + 8 <= end) {
    let size = view.getUint32(pos)
    const type = String.fromCharCode(
      view.getUint8(pos + 4),
      view.getUint8(pos + 5),
      view.getUint8(pos + 6),
      view.getUint8(pos + 7),
    )
    let header = 8
    if (size === 1) {
      size = Number(view.getBigUint64(pos + 8))
      header = 16
    } else if (size === 0) {
      size = end - pos
    }
    if (size < header || pos + size > end) return
    yield { type, start: pos + header, end: pos + size }
    pos += size
  }
}

const MP4_CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl'])

function probeMp4(view: DataView): ClipContainerInfo {
  let videoTracks = 0
  let audioTracks = 0
  let videoBytes = 0
  let mdatBytes = 0
  let videoWidth: number | null = null
  let videoHeight: number | null = null
  const walk = (
    start: number,
    end: number,
    trackInfo: { handler?: string; sampleBytes: number; width?: number; height?: number },
  ) => {
    for (const box of walkMp4Boxes(view, start, end)) {
      if (box.type === 'mdat') mdatBytes += box.end - box.start
      if (box.type === 'tkhd') {
        // version/flags … matrix … then width/height as 16.16 fixed point.
        const version = view.getUint8(box.start)
        const offset = version === 1 ? 88 : 76
        if (box.start + offset + 8 <= box.end) {
          trackInfo.width = view.getUint32(box.start + offset) / 65536
          trackInfo.height = view.getUint32(box.start + offset + 4) / 65536
        }
      }
      if (box.type === 'hdlr') {
        // version(1) + flags(3) + pre_defined(4), then the 4cc handler type.
        trackInfo.handler = String.fromCharCode(
          view.getUint8(box.start + 8),
          view.getUint8(box.start + 9),
          view.getUint8(box.start + 10),
          view.getUint8(box.start + 11),
        )
      }
      if (box.type === 'stsz') {
        // version/flags(4) + sample_size(4) + sample_count(4) + entries.
        const sampleSize = view.getUint32(box.start + 4)
        const sampleCount = view.getUint32(box.start + 8)
        let bytes = 0
        if (sampleSize > 0) {
          bytes = sampleSize * sampleCount
        } else {
          for (let i = 0; i < sampleCount; i += 1) {
            bytes += view.getUint32(box.start + 12 + i * 4)
          }
        }
        trackInfo.sampleBytes += bytes
      }
      if (box.type === 'trak') {
        const info = { sampleBytes: 0 } as {
          handler?: string
          sampleBytes: number
          width?: number
          height?: number
        }
        walk(box.start, box.end, info)
        if (info.handler === 'vide') {
          videoTracks += 1
          videoBytes += info.sampleBytes
          if (info.width) videoWidth = info.width
          if (info.height) videoHeight = info.height
        } else if (info.handler === 'soun') {
          audioTracks += 1
        }
        continue
      }
      if (MP4_CONTAINERS.has(box.type)) walk(box.start, box.end, trackInfo)
    }
  }
  walk(0, view.byteLength, { sampleBytes: 0 })
  // Fragmented muxers leave stsz empty; the media data box is the fallback
  // evidence that samples exist at all.
  if (videoBytes === 0) videoBytes = mdatBytes
  return {
    containerKind: 'mp4',
    hasVideoTrack: videoTracks > 0,
    hasAudioTrack: audioTracks > 0,
    videoSampleBytes: videoBytes,
    videoWidth,
    videoHeight,
  }
}

// --- WebM / EBML -----------------------------------------------------------------

function readEbmlId(buf: Uint8Array, pos: number) {
  const first = buf[pos]
  let len = 1
  let mask = 0x80
  while (len <= 8 && !(first & mask)) {
    mask >>= 1
    len += 1
  }
  if (len > 8 || pos + len > buf.length) return null
  let value = 0
  for (let i = 0; i < len; i += 1) value = value * 256 + buf[pos + i]
  return { value, length: len }
}

function readEbmlVint(buf: Uint8Array, pos: number) {
  const first = buf[pos]
  let len = 1
  let mask = 0x80
  while (len <= 8 && !(first & mask)) {
    mask >>= 1
    len += 1
  }
  if (len > 8 || pos + len > buf.length) return null
  let value = first & (mask - 1)
  for (let i = 1; i < len; i += 1) value = value * 256 + buf[pos + i]
  const unknown = value === Math.pow(2, 7 * len) - 1
  return { value, length: len, unknown }
}

function* walkEbml(buf: Uint8Array, start: number, end: number) {
  let pos = start
  while (pos < end) {
    const id = readEbmlId(buf, pos)
    if (!id) return
    const size = readEbmlVint(buf, pos + id.length)
    if (!size) return
    const payloadStart = pos + id.length + size.length
    const payloadEnd = size.unknown ? end : Math.min(end, payloadStart + size.value)
    yield { id: id.value, start: payloadStart, end: payloadEnd }
    pos = payloadEnd
  }
}

function probeWebm(buf: Uint8Array): ClipContainerInfo {
  let videoTracks = 0
  let audioTracks = 0
  let videoTrackNumber: number | null = null
  let videoBytes = 0
  let videoWidth: number | null = null
  let videoHeight: number | null = null
  const readUint = (start: number, end: number) => {
    let value = 0
    for (let i = start; i < end; i += 1) value = value * 256 + buf[i]
    return value
  }
  for (const top of walkEbml(buf, 0, buf.length)) {
    if (top.id !== 0x18538067) continue // Segment
    for (const child of walkEbml(buf, top.start, top.end)) {
      if (child.id === 0x1654ae6b) {
        // Tracks
        for (const entry of walkEbml(buf, child.start, child.end)) {
          if (entry.id !== 0xae) continue // TrackEntry
          let type: number | null = null
          let number: number | null = null
          let width: number | null = null
          let height: number | null = null
          for (const field of walkEbml(buf, entry.start, entry.end)) {
            if (field.id === 0x83 && field.end > field.start) type = buf[field.start]
            if (field.id === 0xd7 && field.end > field.start) number = buf[field.start]
            if (field.id === 0xe0) {
              // Video: PixelWidth (0xB0) / PixelHeight (0xB1) unsigned ints.
              for (const v of walkEbml(buf, field.start, field.end)) {
                if (v.id === 0xb0) width = readUint(v.start, v.end)
                else if (v.id === 0xb1) height = readUint(v.start, v.end)
              }
            }
          }
          if (type === 1) {
            videoTracks += 1
            if (videoTrackNumber === null) videoTrackNumber = number
            if (width) videoWidth = width
            if (height) videoHeight = height
          } else if (type === 2) {
            audioTracks += 1
          }
        }
      }
      if (child.id === 0x1f43b675 && videoTrackNumber !== null) {
        // Cluster: SimpleBlock (0xA3) and BlockGroup (0xA0) → Block (0xA1)
        // both carry frames as track vint + 2B timecode + 1B flags + data.
        // Chrome puts video keyframes in BlockGroups, plain frames in
        // SimpleBlocks — count both.
        const scanBlocks = function* (start: number, end: number): Generator<{ start: number; end: number }> {
          for (const el of walkEbml(buf, start, end)) {
            if (el.id === 0xa0) yield* scanBlocks(el.start, el.end)
            else if (el.id === 0xa3 || el.id === 0xa1) yield el
          }
        }
        for (const block of scanBlocks(child.start, child.end)) {
          const trackNumber = readEbmlVint(buf, block.start)
          if (trackNumber && trackNumber.value === videoTrackNumber) {
            videoBytes += Math.max(0, block.end - block.start - trackNumber.length - 3)
          }
        }
      }
    }
  }
  return {
    containerKind: 'webm',
    hasVideoTrack: videoTracks > 0,
    hasAudioTrack: audioTracks > 0,
    videoSampleBytes: videoBytes,
    videoWidth,
    videoHeight,
  }
}

/**
 * Probe a recorded clip blob's bytes. Returns null when the buffer is not a
 * recognizable MP4 or WebM container at all (the caller treats that as a
 * validation failure — never hand out an unverifiable file).
 */
export function probeClipContainer(buffer: ArrayBuffer): ClipContainerInfo | null {
  if (!buffer || buffer.byteLength < 12) return null
  const buf = new Uint8Array(buffer)
  // MP4: bytes 4..8 are 'ftyp'.
  if (
    buf[4] === 0x66 && // f
    buf[5] === 0x74 && // t
    buf[6] === 0x79 && // y
    buf[7] === 0x70 // p
  ) {
    try {
      return probeMp4(new DataView(buffer))
    } catch {
      return null
    }
  }
  // WebM: EBML header magic 0x1A45DFA3.
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    try {
      return probeWebm(buf)
    } catch {
      return null
    }
  }
  return null
}
