-- Account-level Discord display name (user.global_name) captured at signup,
-- shown as the default label in the admin roster. Nullable: users without a
-- global name fall back to the @username in displayName.
ALTER TABLE "Signup" ADD COLUMN "globalName" TEXT;
