# Personas, backgrounds, and presets

A persona is who you are in a conversation: a name, a short description, and an optional icon. A background is the image shown behind a chat for atmosphere. A preset is a saved bundle of generation settings you can reuse.

## Where settings live

Open any chat and click the gear icon. The **Chat settings** sheet groups sections by what they affect:

- **This chat** — **Character**, **Background**, and **Chat details**. These affect only the current chat.
- **All chats** — **Model & preset**, **Your persona**, **Lorebooks**, and **Global prompts**. These are defaults shared by every chat.
- **This browser** — **Display**. These appearance options are saved in the browser, not the account.

Providers and presets are managed from **Settings → Providers** and **Settings → Presets**. Use the **Manage AI setup** links in **Model & preset** or the **Defaults** page under **Settings** to change the default provider, model, and preset. Changes save automatically; the sheet shows a **Saving…**, **Saved**, or **Couldn't save** status.

## Personas

Open **Chat settings → Your persona** under **All chats**.

To create a persona, give it a **Name** (required) and an optional **Description**. You can upload an **Icon**, a PNG, when editing the persona. Charon comes with a **Default** persona from day one, and you can edit or delete that one too.

**Your persona** is the account-wide default. It applies to every chat, not just the one you're in. It shows as your avatar in chats and is the voice used when you impersonate. A persona does not change the AI; it changes how the AI sees you and how you appear in the story.

## Backgrounds

Open **Chat settings → Background** under **This chat** to see the background library.

Pick a background and it applies to that chat only. Click the same one again to deselect it. **Clear scene** removes it from the chat. You can upload your own background images and delete ones you've added. Deleting a background removes it from every chat that used it. Charon ships with no default backgrounds, so the library starts empty.

If you use the scene panel in the chat header to show a custom image, that image takes precedence over the background library. Clear the custom image from the scene panel to see the selected background again.

## Presets

Presets are bundles of generation settings. Go to **Settings → Presets** to manage them.

Create a preset with a **Name**. You can bind it to a **Provider** and a **Model**, then set these values:

- **Temperature**: higher means more creative, lower means more focused.
- **Top P**: nucleus sampling, which narrows the AI's word choices.
- **Max tokens**: how long a reply can be.
- **Context size**: how much conversation the AI can see.
- **Frequency penalty**: discourages repeating the same words.
- **Presence penalty**: encourages talking about new topics.

Choose the preset for every chat in **Settings → Defaults** or **Chat settings → Model & preset**. Presets are shared defaults, not per-chat switches. Keep a preset bound to a provider and model if you use more than one provider.

## Character overrides

**Chat settings → Character** under **This chat** overrides the card's description, personality, scenario, or system prompt for this chat only. Empty fields use the card. Use **Show character card original** to compare and **Reset to card** to clear an override.

## Chat details

**Chat settings → Chat details** under **This chat** renames or deletes the chat. Deletion is permanent and disabled while a reply is generating.

## Display options

**Settings → Preferences** and **Chat settings → Display** expose the same three toggles:

- **Highlight dialogue**: colors quoted dialogue.
- **Auto-fix Markdown**: repairs common formatting slips.
- **Block external media**: stops messages from loading outside images or videos.

These affect how messages appear while you read, not how the AI writes. They are saved in this browser only.

## Profile

The **Profile** page under **Settings** is where you change your password. Changing it signs out your other sessions. Your username stays the same.

Back to the [overview](./index.md).
