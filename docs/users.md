# User Types & Permissions

There are two types of users: **admins** and **demo users**.

| Capability | Admin (`marv`) | Demo users (everyone else) |
|---|---|---|
| **Import characters** (PNG upload) | ✅ | ❌ |
| **Edit character card data** | ✅ | ❌ |
| **Rename characters** | ✅ | ❌ |
| **Delete characters** | ✅ | ❌ |
| **Start chats** | ✅ | ✅ |
| **Manage AI providers & presets** | ✅ | ❌ — use the shared global provider |
| **Manage lorebooks** | ✅ | ❌ |
| **View character list** | ✅ | ✅ (only 2 demo characters) |
| **View character detail** | ✅ | ✅ |
| **Edit user settings** (persona, prompts) | ✅ | ✅ |

## Character access

Demo users are pre-seeded with exactly 2 characters:

- **Captain Jack Ryder** — male, charming space rogue
- **Dr. Elena Vasquez** — female, brilliant xenobiologist

They cannot add, edit, rename, or delete any characters. These 2 characters are the only ones visible in the character list.

## AI access

Demo users do not have their own AI provider or preset. They use the **global shared provider** (`GLOBAL_PROVIDER_ID`) managed by the admin. The admin can configure the shared provider's base URL, API key, and default model via the ChatSettingsPanel — changes take effect immediately for all demo users.

## Registration

New users who sign up via `/signup` are treated as demo users. Only the hardcoded admin account (`username: "marv"`) has full access. There is no upgrade path from demo to admin.
