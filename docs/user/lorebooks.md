# Lorebooks

A **lorebook** is a collection of background lore. It holds a world's rules, places, factions, and history. Each piece of lore is a **lore entry**. Every entry has trigger **keywords**. When a keyword appears in the conversation, Charon feeds the matching entry to the AI. The AI reads it and keeps its replies consistent with your world. You don't have to repeat the details in every message. The keywords do that work for you.

Here is the most important thing to know about lorebooks. Activation is **GLOBAL**. An enabled lorebook applies to **all chats**, not just one chat. Turning a book on affects every conversation you have, with every character. So a lorebook meant for one story will leak into your other chats too. Keep that in mind before you enable anything.

## The Lorebooks page

The **Lorebooks** page lists your books. Each row has an on/off switch, the book's name, its description, and its entry count. Use the switch to enable or disable a book.

## Create a book

1. Click **New Lorebook**.
2. Give it a **Name**. This field is required.
3. Add a **Description** if you want. This field is optional.

The new book appears in the list, disabled by default. Turn it on with the switch when you are ready.

## Import a book

Bring your existing lorebooks over.

1. Click **Import**.
2. Choose a **world-info** JSON file from your computer. This is a file picker only; there is no text box to paste into.

Imported books start **disabled**. Turn them on with the switch.

After importing, a toast reports the result: `Imported "Name" · N entries · M skipped`. Some entries in the file may not be importable. That is normal. The count tells you how many entries came through and how many were skipped.

Importing a character card with an embedded lorebook creates a standalone book automatically, disabled by default. Turn it on with the switch like any other book.

## Work with entries

Open a book to see its entries. You can search them by text. You can filter the list with **All**, **On**, or **Off**. Add new ones with **New Entry**.

Each entry in the list shows a status dot:
- **Active**: the entry is enabled and can trigger.
- **Disabled by author**: the entry came that way, probably held in reserve.
- **Disabled by you**: you turned it off yourself.

Expand an entry to preview its content. Each entry also has a menu where you can edit or delete it.

## Edit an entry

The entry editor has these fields:

- **Comment**: a short description of the entry, just for yourself.
- **Keywords**: what triggers the entry, like "dragon, wyrm, drake".
- **Secondary keys**: extra, optional triggers.
- **Content**: the lore text itself, with a live token count. This is required.
- **Order**: where the entry sits in the context.
- **Constant (always active)**: a switch that keeps the entry active no matter what, regardless of keywords.
- **Disabled**: turn the entry off without deleting it.

The rules are simple. Content is required, and you need at least one keyword unless **Constant (always active)** is on.

## Related

- [characters.md](./characters.md) explains embedded lorebooks on character cards.
- [personas-scenes-presets.md](./personas-scenes-presets.md) covers chat settings.
- Back to the [index](./index.md).
