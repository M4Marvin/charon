# Personas, backgrounds, and presets

A persona is who you are in a conversation: a name, a short description, and an optional icon. A background is the image shown behind a chat for atmosphere. A preset is a saved bundle of generation settings you can reuse.

## Where settings live

Open any chat and click the gear icon. The **Chat settings** sheet has two modes:

- **This chat** — **Character**, **Background**, and **Chat details**. These affect only the current chat.
- **Defaults** — **Model & preset**, **Your persona**, **Lorebooks**, and **Global prompts**. These are shared by every chat. **Display** is also here because it is saved in this browser.

Providers and presets are managed from **Settings → Providers** and **Settings → Presets**. Use the **Manage AI setup** links in **Model & preset** or the **Defaults** page under **Settings** to change the default provider, model, and preset. Changes save automatically; the header shows **Saving…**, **Saved**, or **Couldn't save** with a Retry action.

## Personas

Open **Chat settings → Defaults → Your persona**.

The current persona appears as a card with **Change**, **Edit**, and **Delete** actions. Use **New persona** to create one: give it a **Name** (required) and an optional **Description**, and upload a PNG **Icon** when editing.

**Your persona** is the account-wide default. It applies to every chat, not just the one you're in. It shows as your avatar in chats and is the voice used when you impersonate. A persona does not change the AI; it changes how the AI sees you and how you appear in the story.

## Backgrounds

Open **Chat settings → Background** under **This chat** to see the background library.

Pick a background card and it applies to that chat only. The card marked **In use** is the current scene; choose **No background** or **Clear scene** to remove it. Upload your own images and delete them from the card's menu. Deleting a background removes it from every chat that used it, so the library starts empty.

If you use the scene panel in the chat header to show a custom image, that image takes precedence over the background library. The notice in **Background** opens the scene panel so you can clear it.

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

**Chat settings → This chat → Character** overrides the card's description, personality, scenario, or system prompt for this chat only. Empty fields use the card. Each field is marked **Using card** or **Custom**; use **Original** to compare and **Use card** to clear an override. Long fields get an **Expand** editor.

## Chat details

**Chat settings → This chat → Chat details** shows the character, creation date, and message count. Rename the chat and press Enter or click away to save. Deletion is permanent and disabled while a reply is generating.

## Display options

**Settings → Preferences** and **Chat settings → Defaults → Display** expose the same three toggles, with a live preview:

- **Highlight dialogue**: colors quoted dialogue.
- **Auto-fix Markdown**: repairs common formatting slips.
- **Block external media**: stops messages from loading outside images or videos.

They affect display only, not how the AI writes, and are saved in this browser.

## Profile

The **Profile** page under **Settings** is where you change your password. Changing it signs out your other sessions. Your username stays the same.

Back to the [overview](./index.md).
