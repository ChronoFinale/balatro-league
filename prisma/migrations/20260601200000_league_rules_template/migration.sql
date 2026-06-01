-- CreateTable
CREATE TABLE "LeagueRulesTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "pointsFor20Win" INTEGER NOT NULL DEFAULT 3,
    "pointsFor11Draw" INTEGER NOT NULL DEFAULT 1,
    "pointsForLoss" INTEGER NOT NULL DEFAULT 0,
    "firstPlayerBans" INTEGER NOT NULL DEFAULT 4,
    "secondPlayerBans" INTEGER NOT NULL DEFAULT 3,
    "matchPoolSize" INTEGER NOT NULL DEFAULT 9,
    "matchInviteExpiryMinutes" INTEGER NOT NULL DEFAULT 5,
    "reportAutoConfirmSeconds" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueRulesTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueRulesTemplate_name_key" ON "LeagueRulesTemplate"("name");

-- CreateIndex
CREATE INDEX "LeagueRulesTemplate_isDefault_idx" ON "LeagueRulesTemplate"("isDefault");

-- AlterTable
ALTER TABLE "Season" ADD COLUMN "leagueRulesTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueRulesTemplateId_fkey"
    FOREIGN KEY ("leagueRulesTemplateId") REFERENCES "LeagueRulesTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: create a "Standard" default template from existing LeagueConfig
-- values, falling back to the schema defaults if a key is unset.
-- Uses gen_random_uuid()::text since this DB doesn't have cuid() built-in.
INSERT INTO "LeagueRulesTemplate" (
    "id", "name", "isDefault",
    "pointsFor20Win", "pointsFor11Draw", "pointsForLoss",
    "firstPlayerBans", "secondPlayerBans", "matchPoolSize",
    "matchInviteExpiryMinutes", "reportAutoConfirmSeconds",
    "createdAt", "updatedAt"
)
SELECT
    'standard-rules-' || substr(md5(random()::text), 1, 16),
    'Standard',
    true,
    COALESCE((SELECT value::int FROM "LeagueConfig" WHERE key = 'points_for_2_0_win'), 3),
    COALESCE((SELECT value::int FROM "LeagueConfig" WHERE key = 'points_for_1_1_draw'), 1),
    COALESCE((SELECT value::int FROM "LeagueConfig" WHERE key = 'points_for_loss'), 0),
    COALESCE((SELECT value::int FROM "LeagueConfig" WHERE key = 'first_player_bans'), 4),
    COALESCE((SELECT value::int FROM "LeagueConfig" WHERE key = 'second_player_bans'), 3),
    COALESCE((SELECT value::int FROM "LeagueConfig" WHERE key = 'match_pool_size'), 9),
    COALESCE((SELECT value::int FROM "LeagueConfig" WHERE key = 'match_invite_expiry_minutes'), 5),
    COALESCE((SELECT value::int FROM "LeagueConfig" WHERE key = 'report_auto_confirm_seconds'), 120),
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM "LeagueRulesTemplate");
