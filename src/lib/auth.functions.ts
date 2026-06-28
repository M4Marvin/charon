import { createServerFn } from "@tanstack/react-start";
import { tryGetSession as serverGetSession } from "@/server/session";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  return await serverGetSession();
});

export const ensureSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = await serverGetSession();
  if (!session) throw new Error("Unauthorized");
  return session;
});
