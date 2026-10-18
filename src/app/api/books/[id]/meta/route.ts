import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * Personalización del libro: título y autor a mano cuando el PDF no los trae.
 * Con ambos presentes el libro es elegible para insignia y para portada real.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      title?: string;
      author?: string | null;
      dailyGoal?: number | null;
    };

    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    let title = book.title;
    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) {
        return NextResponse.json({ error: "El título no puede quedar vacío" }, { status: 400 });
      }
      title = t;
    }

    let author = book.author;
    if (body.author !== undefined) {
      const a = typeof body.author === "string" ? body.author.trim() : null;
      author = a ? a : null;
    }

    // Meta diaria propia: null o vacío → heredar el mínimo global (tope 1-500)
    let dailyGoal = book.dailyGoal;
    if (body.dailyGoal !== undefined) {
      dailyGoal =
        body.dailyGoal === null
          ? null
          : Math.min(500, Math.max(1, Math.round(body.dailyGoal)));
    }

    const updated = await db.book.update({
      where: { id },
      data: { title, author, dailyGoal },
    });
    return NextResponse.json({ book: updated });
  } catch (e) {
    console.error("PATCH /api/books/[id]/meta", e);
    return NextResponse.json({ error: "No se pudo guardar la ficha del libro" }, { status: 500 });
  }
}
