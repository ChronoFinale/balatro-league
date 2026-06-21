// Admin-side loaders. This file is now a barrel: the loaders were split
// into focused sibling files (admin-shared / admin-home / admin-seasons /
// admin-players) so each stays small. Importers keep using
// "@/lib/loaders/admin" unchanged.
//
// Conventions (still apply to every loader):
//   - All admin loaders assume requireAdmin() ran in the page
//   - Return shapes are page-specific; never expose raw Prisma types
//     to the caller (so the schema can evolve without touching pages)
//   - Cached standings come from loadDivisionStandings, not inline
//     computeStandings

export * from "./admin-shared";
export * from "./admin-home";
export * from "./admin-seasons";
export * from "./admin-players";
