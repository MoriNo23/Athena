import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  const books = await db.book.findMany({ select: { id:true, title:true, fileName:true, totalPages:true, currentPage:true, readCount:true } });
  console.log('BOOKS:', JSON.stringify(books, null, 1));
  console.log('SESSIONS:', await db.readingSession.count());
  try { console.log('BADGES:', await db.badge.count()); } catch { console.log('BADGES: n/a'); }
} catch (e) { console.log('ERR:', e.message); } finally { await db.$disconnect(); }
