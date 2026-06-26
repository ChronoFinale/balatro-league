import { handlers } from "@/auth";

// NextAuth catch-all route (sign-in/out, callback, session, providers).
export const { GET, POST } = handlers;
