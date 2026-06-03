import { NextResponse } from "next/server";

/**
 * Serve a binary buffer with HTTP Range support so <video>/<audio> elements can
 * seek (browsers request `Range: bytes=...` and expect a 206). Without this,
 * scrubbing a clip in the preview fails.
 */
export function rangeResponse(
  req: Request,
  buf: Buffer,
  mime: string,
): NextResponse {
  const total = buf.length;
  const base: Record<string, string> = {
    "content-type": mime,
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  };

  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] !== "" ? parseInt(m[1] as string, 10) : 0;
    let end = m && m[2] !== "" ? parseInt(m[2] as string, 10) : total - 1;
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end) || end >= total) end = total - 1;
    if (start > end || start >= total) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...base, "content-range": `bytes */${total}` },
      });
    }
    const chunk = buf.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...base,
        "content-range": `bytes ${start}-${end}/${total}`,
        "content-length": String(chunk.length),
      },
    });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: { ...base, "content-length": String(total) },
  });
}
