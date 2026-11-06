-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "coverPath" TEXT,
    "totalPages" INTEGER NOT NULL,
    "currentPage" INTEGER NOT NULL DEFAULT 1,
    "milestones" INTEGER,
    "dailyGoal" INTEGER,
    "companionPath" TEXT,
    "companionPages" INTEGER,
    "extras" JSONB,
    "finishedAt" DATETIME,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" DATETIME,
    "origin" TEXT NOT NULL DEFAULT 'subido',
    "fileHash" TEXT,
    "fileBytes" INTEGER,
    "fileMtime" REAL,
    "fileMissingAt" DATETIME
);

-- CreateTable
CREATE TABLE "Vocab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "bookId" TEXT,
    "bookTitle" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "readings" INTEGER NOT NULL DEFAULT 1,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Badge_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "pagesRead" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingSession_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Vocab_createdAt_idx" ON "Vocab"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vocab_word_lang_key" ON "Vocab"("word", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_bookId_key" ON "Badge"("bookId");

-- CreateIndex
CREATE INDEX "ReadingSession_bookId_date_idx" ON "ReadingSession"("bookId", "date");

