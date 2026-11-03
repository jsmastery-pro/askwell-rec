// Splits a source's text into chunks for embedding. Pure: no I/O, same input → same output.
// Sizes are in characters, at about 4 characters per token: a chunk is up to ~1,000 tokens
// (well under the embedding model's 8,192-token input cap, even for scripts with ~1 token per
// character) and the next one repeats ~100 tokens of it, so a sentence cut at the boundary is
// whole in one of them.

/** Packing target: a chunk grows until the next block would pass this. */
export const CHUNK_TARGET_CHARS = 3600;
/** Text carried from the end of one chunk to the start of the next. */
export const CHUNK_OVERLAP_CHARS = 400;
/** Hard cap on a chunk: the overlap, a paragraph break, then up to the target. */
export const CHUNK_MAX_CHARS = CHUNK_OVERLAP_CHARS + 2 + CHUNK_TARGET_CHARS;

const HEADING = /^(#{1,6}\s|[^\n]{1,120}\n(=+|-+)$)/;

/** Same text, with NULs dropped (Postgres text can't hold them), \r\n → \n and trailing spaces trimmed. */
export function normalizeText(text: string): string {
  return text
    .replaceAll("\u0000", "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Paragraphs and headings, in order. A Markdown heading always starts its own block. */
function toBlocks(text: string): string[] {
  const blocks: string[] = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    let current: string[] = [];
    for (const line of paragraph.split("\n")) {
      if (/^#{1,6}\s/.test(line) && current.length > 0) {
        blocks.push(current.join("\n"));
        current = [];
      }
      current.push(line);
    }
    if (current.length > 0) blocks.push(current.join("\n"));
  }
  return blocks.map((b) => b.trim()).filter((b) => b !== "");
}

/** Pieces of at most `max` chars: at sentence ends if it can, else at spaces, else anywhere. */
function splitLong(block: string, max: number): string[] {
  const pieces: string[] = [];
  let rest = block;
  while (rest.length > max) {
    const head = rest.slice(0, max);
    const sentenceEnd = Math.max(
      head.lastIndexOf(". "),
      head.lastIndexOf("! "),
      head.lastIndexOf("? "),
      head.lastIndexOf("\n"),
    );
    const space = head.lastIndexOf(" ");
    let cut = sentenceEnd > max / 2 ? sentenceEnd + 1 : space > max / 2 ? space : max;
    // Never between the two halves of a surrogate pair (an emoji, say).
    if (/[\uD800-\uDBFF]/.test(rest.charAt(cut - 1))) cut -= 1;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest !== "") pieces.push(rest);
  return pieces;
}

/** The last ~`CHUNK_OVERLAP_CHARS` of a chunk, starting at a word. */
function tail(chunk: string): string {
  if (chunk.length <= CHUNK_OVERLAP_CHARS) return chunk;
  const start = chunk.length - CHUNK_OVERLAP_CHARS;
  const space = chunk.indexOf(" ", start);
  return space === -1 ? chunk.slice(start) : chunk.slice(space + 1);
}

/**
 * Chunks of up to `CHUNK_MAX_CHARS`. Splits between paragraphs first; a heading starts a new
 * chunk once the current one is half full, so sections stay together. A paragraph too long for
 * one chunk is split at sentence ends. Chunks cut for size repeat the end of the previous one.
 * No empty chunks; empty or blank text gives `[]`.
 */
export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  // Overlap only carries across a cut made for size, not across a heading.
  let carry = "";

  const flush = (withOverlap: boolean) => {
    if (current.trim() !== "") chunks.push(current.trim());
    carry = withOverlap ? tail(current.trim()) : "";
    current = "";
  };

  for (const block of toBlocks(normalizeText(text))) {
    if (HEADING.test(block) && current.length >= CHUNK_TARGET_CHARS / 2) flush(false);

    for (const piece of splitLong(block, CHUNK_TARGET_CHARS)) {
      if (current !== "" && current.length + 2 + piece.length > CHUNK_TARGET_CHARS) flush(true);
      if (current === "" && carry !== "") current = carry;
      current = current === "" ? piece : `${current}\n\n${piece}`;
      carry = "";
    }
  }
  flush(false);
  return chunks;
}
