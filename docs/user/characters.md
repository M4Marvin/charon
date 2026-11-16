# Characters

Your characters live on the **Characters** page. This guide covers the library, cards, editing, and version history.

## The library

The **Characters** page shows a grid of cards and keeps loading more as you scroll. Cards show the avatar, name, tagline, creator, tags, and chat count. Search matches the name, creator, and card notes (press **/** to jump into the box). Sort by **Recently updated** (default), **Name A–Z**, or **Most chats**, and filter by tag.

On each card, the **⋯** button opens a menu with **Edit** and **Delete**. Deleting permanently removes the character and all its chats and messages — no undo, so read the warning before confirming.

## Import a character

A character card is a PNG holding everything about a character: portrait, name, description, greeting, and more. Cards come in V2 and V3; Charon accepts both.

1. Go to the **Characters** page and click **Import PNG**.
2. Drag a PNG onto the import page, or click to choose a file (PNG, up to 50 MB).
3. Review the preview: portrait, name, creator, spec badge, description excerpt, tags, and counts like "N greetings · M lorebook entries".
4. Click **Import**. A toast confirms the result and you land on the character's page.

Warnings may appear: **No description on card** and **V3 card — data normalized to V2 for compatibility** are the common ones. If the card fails validation, Charon lists what's wrong so you can fix the file or pick another.

When a card carries a source slug, the imported name is derived from that slug instead of the card's sometimes-generic internal name. An embedded lorebook also gets a standalone, disabled copy in the Lorebooks library (named after the book, or "{Character} [embedded]").

## Update a character from a card

To replace a character's card with a newer version of it:

- **From the import page** — if the incoming card's name matches an existing character, choose **Update "{name}"** (the match is preselected; use the picker if several share the name), or **Import as new** to make a separate copy.
- **From the character's page** — open the **⋯** menu and choose **Update from card**, then pick the PNG. This works even if the new card has a different name.

Updating swaps in the new card's contents and keeps this character's chats and your locally set tagline. The previous version is saved to version history automatically, so you can undo a card update by restoring it there.

## The character page

The detail page opens with the portrait, name, creator, tags, and stats: chat count, turns, and last updated date. Click **Start Chat** to begin a new conversation. A **Continue chat** list shows your recent chats with this character, up to five.

The page lists the card's **Description**, **Personality**, **Scenario**, **Greetings** (with copy buttons), **Example Messages**, **Prompts**, embedded **Lorebook** if present, and **Metadata** (card version, talkativeness, dates).

## Edit a character

From the detail page, open the **⋯** menu and choose **Edit**. You can change:

- **Name** (max 64 characters) and **Tagline** (max 200)
- **Creator** and **Card version**
- **Description**, **Personality**, **Scenario**, and **First message**
- **Alternate greetings** (add or remove) and **Example messages**
- **System prompt**, **Post-history instructions**, and **Creator notes**
- **Tags** and **Talkativeness** (a slider from 0 to 100)

A save bar appears when you have unsaved changes: **Save** keeps them, **Discard** throws them away.

## Version history

Every save creates a version — a full snapshot of the card at that moment. Renaming also creates a version, so the newest version always matches the character as it is now.

From the detail page, open the **⋯** menu and choose **History**. The list shows each version with its number, name, and when it was saved; the newest is labelled **Current**. For any version you can view **Changes** (fields that differ from the version before it) or **Restore** it. Restoring is itself a save; to undo a bad edit, restore the previous one. Restoring keeps the current portrait. Versions live as long as the character does.

## Related pages

- [Chatting](./chatting.md)
- [Lorebooks](./lorebooks.md)
- [Personas, scenes, and presets](./personas-scenes-presets.md)
- [Getting started](./getting-started.md)
- [Troubleshooting](./troubleshooting.md)
- [Back to the docs home](./index.md)
