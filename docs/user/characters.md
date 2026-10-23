# Characters

Your characters live on the **Characters** page. This guide covers the library, importing cards, the character detail page, and editing.

## The library

The **Characters** page shows a grid of cards. It keeps loading more as you scroll, so you never have to click through pages. Each card shows the character's avatar, name, tagline, creator, tags, and how many chats they've been in. A tagline is a short summary of the character, shown right under their name.

Find a character with the search box. Search matches the name, the creator, and the notes on the card. Press **/** to jump straight into the search box. Sort by **Recently updated** (the default), **Name A–Z**, or **Most chats**. Use the tag filter to narrow things down.

On each card, the **⋯** button opens a menu with **Edit** and **Delete**. Deleting warns that it will permanently delete the character and all associated chats and messages. There is no undo, so read the warning before confirming.

## Import a character

A character card is a PNG file that holds everything about a character: portrait, name, description, greeting, and more. A greeting is the opening message a character sends when a new chat starts. Cards come in two versions, V2 and V3, and Charon accepts both.

To import:

1. Go to the **Characters** page and click **Import PNG**.
2. Drag a PNG onto the import page, or click to choose a file. The file must be PNG and no larger than 50 MB.
3. Review the preview. It shows the portrait, name, creator, a spec/version badge, a description excerpt, tags, and a line like "N greetings · M lorebook entries".

Warnings may appear. **No description on card** means the card has no description to show. **V3 card — data normalized to V2 for compatibility** means a V3 card was converted to the older format so it works everywhere. If the card's name matches one you already have, you get: "You already have a character named {name}. Importing will create a separate copy." Importing still works; it just makes a separate copy.

If the card fails validation, Charon lists what's wrong so you can fix the file or pick another.

4. Click **Import**. A toast says Imported "{name}" and you land on the character's page.

When a card carries a source slug, the imported character's name is derived from that slug instead of the card's sometimes-generic internal name. If the card carries an embedded lorebook, Charon also creates a standalone copy in the Lorebooks library, disabled by default, named after the book (or "{Character} [embedded]" when it has no name). Re-importing the same card does not create a duplicate.

## The character page

The detail page opens with the portrait, name, creator, tags, and stats: chat count, turns, and last updated date. Click **Start Chat** to begin a new conversation. A **Continue chat** list shows your recent chats with this character, up to five, so you can pick up where you left off.

The page has these sections:

- **Description**, **Personality**, and **Scenario** describe who the character is.
- **Greetings** lists the opening messages, with copy buttons for alternate greetings.
- **Example Messages** show how the character talks.
- **Prompts** holds the system prompt and post-history instructions.
- An embedded **Lorebook**, if the card carries one.
- **Metadata** shows the card version, talkativeness, and dates.

## Edit a character

From the detail page, open the **⋯** menu and choose **Edit**. You can change:

- **Name** (max 64 characters) and **Tagline** (max 200)
- **Creator** and **Card version**
- **Description**, **Personality**, **Scenario**, and **First message**
- **Alternate greetings** (add or remove) and **Example messages**
- **System prompt**, **Post-history instructions**, and **Creator notes**
- **Tags** and **Talkativeness** (a slider from 0 to 100)

A save bar appears at the bottom only when you have unsaved changes. Click **Save** to keep them or **Discard** to throw them away.

## Related pages

- [Chatting](./chatting.md)
- [Lorebooks](./lorebooks.md)
- [Personas, scenes, and presets](./personas-scenes-presets.md)
- [Getting started](./getting-started.md)
- [Troubleshooting](./troubleshooting.md)
- [Back to the docs home](./index.md)
