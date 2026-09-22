/**
 * Strip emoji (and leftover joiners / variation selectors) from user-typed text.
 *
 * Uses code-point ranges instead of `\p{Extended_Pictographic}` so the strip
 * still works after bundling and for the OS emoji picker.
 */

function isEmojiScalar(cp: number): boolean {
  if (cp < 0x80) return false;
  if (cp === 0x200d || cp === 0x20e3) return true;
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true;
  if (cp >= 0x20d0 && cp <= 0x20ff) return true;
  if (cp >= 0x2300 && cp <= 0x23ff) return true;
  if (cp >= 0x2600 && cp <= 0x27bf) return true;
  if (cp >= 0x2b00 && cp <= 0x2bff) return true;
  if (cp >= 0x3200 && cp <= 0x32ff) return true;
  if (cp >= 0x1f000 && cp <= 0x1ffff) return true;
  if (cp >= 0xe0020 && cp <= 0xe007f) return true;
  return false;
}

export function stripEmojis(value: string): string {
  if (!value) return value;
  let out = '';
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (cp == null || isEmojiScalar(cp)) continue;
    out += ch;
  }
  return out;
}
