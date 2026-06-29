-- Full Discord guild member roster (every member, not just registered players),
-- synced by the bot for username -> numeric-id resolution. Read read-only by the
-- Team Tour app, which shares this guild. Backend-only; not shown anywhere.

-- CreateTable
CREATE TABLE "GuildMember" (
    "discordId" TEXT NOT NULL,
    "username" TEXT,
    "globalName" TEXT,
    "nickname" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("discordId")
);

-- CreateIndex
CREATE INDEX "GuildMember_username_idx" ON "GuildMember"("username");
