import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** Quita una palabra del vocabulario (data de la dueña, en la BD). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await db.vocab.delete({ where: { id } }).catch(() => null); // ya no está: fine
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/vocab/[id]", e);
    return NextResponse.json({ error: "No se pudo borrar la palabra" }, { status: 500 });
  }
}
