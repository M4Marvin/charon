# User Types & Permissions

There are two user roles: **admin** and **user** (demo users).

| Capability | Admin | Demo users |
|---|---|---|
| **Import characters** (PNG upload) | ✅ | ❌ |
| **Edit character card data** | ✅ | ❌ |
| **Rename characters** | ✅ | ❌ |
| **Delete characters** | ✅ | ❌ |
| **Start chats** | ✅ | ✅ |
| **Manage AI providers & presets** | ✅ | ❌ — use the shared global provider |
| **Manage lorebooks** | ✅ | ❌ |
| **Upload / delete background scenes** | ✅ | ❌ — can view and select only |
| **View character list** | ✅ | ✅ (2 pre-seeded demo characters) |
| **View character detail** | ✅ | ✅ |
| **Edit user settings** (persona, prompts) | ✅ | ✅ |
| **Access Settings page** | ✅ | ❌ |

## Role system

Roles are stored in the `user.role` database column. The default role for all signup users is `"user"`. Admin accounts can only be created via the CLI script:

```
pnpm create-admin --username <name> --email <email> --password <password>
```

If the username already exists, the script promotes it to `admin`. Otherwise it creates a new admin account.

All permission checks use `isAdmin(user)` (server-side) or `session?.user?.role === "admin"` (client-side). The `isAdmin()` helper is defined in `src/server/session.ts`.

## Authorization

- **Server-side:** `src/server/fns/admin.ts` (global AI config), `backgrounds.ts` (upload/delete), `characters.ts` (import/rename/edit/delete), `chats.ts` (selectedModel persistence), and `userSettings.ts` (defaultSelectedModel persistence) all check `isAdmin(user)`. If the user's role is not `"admin"`, the operation is rejected.
- **Client-side:** Admin-only UI elements (Settings nav link, AI/Demo-AI tabs in the chat sidebar, model badge, "No AI configured" hint, character import/rename/edit/delete buttons, background upload/delete) are gated on `session?.user?.role === "admin"`.

## Character access

Demo users are pre-seeded with exactly 2 characters:

- **Captain Jack Ryder** — male, charming space rogue
- **Dr. Elena Vasquez** — female, brilliant xenobiologist

They cannot add, edit, rename, or delete any characters.

## AI access

Demo users do not select models or manage AI providers. They use the **global shared provider** set by an admin via the Demo AI Config page. The admin configures the shared provider's base URL, API key, and default model — changes take effect immediately for all demo users.

## Registration

All users who sign up via `/signup` are created with `role: "user"` (demo). There is no upgrade path from demo to admin via the UI. Admin accounts are created exclusively via `pnpm create-admin`.
