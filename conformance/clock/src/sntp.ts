// SNTP v4 (RFC 4330): the 48-byte packet, and only the fields a steppable test clock needs.
const NTP_EPOCH_OFFSET_S = 2_208_988_800;

function writeTime(ms: number, buf: Buffer, at: number): void {
  const seconds = Math.floor(ms / 1000);
  const fraction = Math.min(Math.round(((ms - seconds * 1000) / 1000) * 2 ** 32), 2 ** 32 - 1);
  buf.writeUInt32BE((seconds + NTP_EPOCH_OFFSET_S) >>> 0, at);
  buf.writeUInt32BE(fraction >>> 0, at + 4);
}

function readTime(buf: Buffer, at: number): number {
  return (buf.readUInt32BE(at) - NTP_EPOCH_OFFSET_S) * 1000 + (buf.readUInt32BE(at + 4) / 2 ** 32) * 1000;
}

/** A client request: version 4, mode 3, our send time as the transmit timestamp. */
export function request(nowMs: number): Buffer {
  const buf = Buffer.alloc(48);
  buf[0] = (4 << 3) | 3;
  writeTime(nowMs, buf, 40);
  return buf;
}

/** A server's answer: version 4, mode 4, stratum 1; originate is the request's transmit time. */
export function response(req: Buffer, serverMs: number): Buffer {
  const buf = Buffer.alloc(48);
  buf[0] = (4 << 3) | 4;
  buf[1] = 1;
  req.copy(buf, 24, 40, 48);
  writeTime(serverMs, buf, 32);
  writeTime(serverMs, buf, 40);
  return buf;
}

export function transmitTime(packet: Buffer): number {
  return readTime(packet, 40);
}

export function isRequest(packet: Buffer): boolean {
  return packet.length >= 48 && (packet[0]! & 7) === 3;
}

export function isResponse(packet: Buffer): boolean {
  return packet.length >= 48 && (packet[0]! & 7) === 4;
}
