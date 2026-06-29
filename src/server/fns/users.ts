import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { getSession, isAdmin } from "@/server/session";
import type { User } from "@/db/schema";
import {
  listUsers as repoListUsers,
  deleteUser as repoDeleteUser,
  countAdmins as repoCountAdmins,
  type UserListItem,
} from "@/db/repositories/users";

export type { UserListItem };

const IdInput = type({ id: "string > 0" });

function validateIdInput(data: unknown): { id: string } {
  const result = IdInput(data);
  if (result instanceof type.errors) throw new Error("Invalid id");
  return result;
}

export const listUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<UserListItem[]> => {
    const { user } = await getSession();
    if (!isAdmin(user)) throw new Error("Forbidden");
    return await repoListUsers();
  },
);

export const getUser = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<User> => {
    const { user } = await getSession();
    if (!isAdmin(user)) throw new Error("Forbidden");
    const row = db.select().from(userTable).where(eq(userTable.id, data.id)).get();
    if (!row) throw new Error("User not found");
    return row;
  });

export const deleteUser = createServerFn({ method: "POST" })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const session = await getSession();
    if (!isAdmin(session.user)) throw new Error("Forbidden");

    if (data.id === session.user.id) {
      throw new Error("You cannot delete yourself");
    }

    const adminCount = await repoCountAdmins();

    const target = db.select().from(userTable).where(eq(userTable.id, data.id)).get();
    if (!target) throw new Error("User not found");

    if (target.role === "admin" && adminCount <= 1) {
      throw new Error("Cannot delete the last admin");
    }

    await repoDeleteUser(data.id);
    return { id: data.id };
  });
