"use client";

import { useState } from "react";
import { LibraryView } from "@/components/library/LibraryView";
import { ReaderView } from "@/components/reader/ReaderView";
import { BookDTO } from "@/lib/types";

export default function Home() {
  const [activeBook, setActiveBook] = useState<BookDTO | null>(null);

  return (
    <main className="min-h-screen">
      {activeBook ? (
        <ReaderView
          book={activeBook}
          onBack={() => setActiveBook(null)}
          onBookChange={setActiveBook}
        />
      ) : (
        <LibraryView onOpen={(b) => setActiveBook(b)} />
      )}
    </main>
  );
}
