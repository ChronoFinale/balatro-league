-- Whether a signup is currently a member of the Discord server. True at signup
-- (they clicked the button), re-checked by the admin "refresh names" action.
-- Nullable: null = not yet checked. The admin roster flags false as "not in server".
ALTER TABLE "Signup" ADD COLUMN "inGuild" BOOLEAN;
