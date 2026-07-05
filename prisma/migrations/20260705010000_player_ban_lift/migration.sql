-- Season-count temp ban: null = permanent; a number = the season number at which
-- the ban auto-lifts (banning "for N seasons" sets it to nextSeasonNumber + N).
-- Added as a SEPARATE migration because 20260705000000_player_ban already ran in
-- production with only the three ban columns — editing an applied migration won't
-- re-run and breaks its checksum.

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "banLiftsAtSeasonNumber" INTEGER;
