"use client";

import { useState } from "react";
import { LibraryView } from "@/components/library/LibraryView";
import { ReaderView } from "@/components/reader/ReaderView";
import type { BookDTO } from "@/lib/types";
import type { BookWithSessions } from "@/hooks/use-library-books";

export default function Home() {
  const [activeBook, setActiveBook] = useState<BookWithSessions | null>(null);

  /**
   * El lector abre el libro CON sesiones (payload de la biblioteca). Los
   * parches de vuelta (hitos, meta, insignia) llegan sin la relación `sessions`
   * (respuestas de PATCH sin include): se preserva la que trajo el libro.
   */
  const mergeBook = (b: BookDTO) =>
    setActiveBook((prev) => ({
      ...prev,
      ...b,
      sessions: ("sessions" in b ? b.sessions : undefined) ?? prev?.sessions ?? [],
    }) as BookWithSessions);

  return (
    <main className="min-h-screen">
      {activeBook ? (
        <ReaderView
          book={activeBook}
          onBack={() => setActiveBook(null)}
          onBookChange={mergeBook}
        />
      ) : (
        <LibraryView onOpen={(b) => setActiveBook(b)} />
      )}
    </main>
  );
}
