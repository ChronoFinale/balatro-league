-- ALTER TYPE ... RENAME VALUE preserves existing column values without
-- the create-new-enum/copy-rows/drop-old dance Prisma would otherwise
-- generate. Existing RoleBinding rows tagged MOD become HELPER atomically.
ALTER TYPE "PermissionTier" RENAME VALUE 'MOD' TO 'HELPER';
