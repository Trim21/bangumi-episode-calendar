export function isNotNull<T>(s: T | null): s is T {
  return s !== null;
}

function pad(n: string, width: number, z = "0") {
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

export function hexdump(buf: ArrayBuffer): string {
  let view = new Uint8Array(buf);
  let hex = Array.from(view).map((v) => pad(v.toString(16), 2));
  return hex.join("");
}
