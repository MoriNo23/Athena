const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const books = await p.book.findMany({
    select: { id: true, title: true, author: true, fileName: true, filePath: true, totalPages: true, currentPage: true, createdAt: true, lastReadAt: true, finishedAt: true, readCount: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log('BOOKS:', JSON.stringify(books, null, 1));
  const sessions = await p.readingSession.count();
  const badges = await p.badge.count();
  console.log('SESSIONS:', sessions, 'BADGES:', badges);
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
