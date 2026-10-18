"use client";

import type { EpubBlock } from "@/lib/epub";

/**
 * Bloques de una página reflowable (EPUB o modo texto del PDF): HTML inline ya
 * saneado por el parser. Vive aparte para que ambos visores compartan marcado.
 */
export function TextBlocks({ blocks }: { blocks: EpubBlock[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === "img" ? (
          <img key={i} src={b.src} alt={b.alt} className="epub-img" draggable={false} />
        ) : b.kind === "quote" ? (
          <blockquote key={i} className="epub-quote" dangerouslySetInnerHTML={{ __html: b.html }} />
        ) : b.kind === "li" ? (
          <p key={i} className="epub-li" dangerouslySetInnerHTML={{ __html: b.html }} />
        ) : b.kind === "h1" ? (
          <h2 key={i} className="epub-h epub-h1" dangerouslySetInnerHTML={{ __html: b.html }} />
        ) : b.kind === "h2" ? (
          <h3 key={i} className="epub-h epub-h2" dangerouslySetInnerHTML={{ __html: b.html }} />
        ) : b.kind === "h3" ? (
          <h3 key={i} className="epub-h epub-h3" dangerouslySetInnerHTML={{ __html: b.html }} />
        ) : b.kind === "h4" ? (
          <h4 key={i} className="epub-h epub-h3" dangerouslySetInnerHTML={{ __html: b.html }} />
        ) : (
          <p key={i} className="epub-p" dangerouslySetInnerHTML={{ __html: b.html }} />
        )
      )}
    </>
  );
}
