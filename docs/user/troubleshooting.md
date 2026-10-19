# Troubleshooting

Stuck on something? Here are the answers to the most common questions, in plain language. If your problem is not on this page, the [getting started](getting-started.md) guide covers setup, and the [README](../../README.md) has the install details.

## Questions and answers

**Q: The app won't start.**

A: Run `charon doctor`. It checks Node, the app files, the data folder, and `/up`, then names what failed. `charon logs` shows the server log. Check that nothing else is using port 3000. With Docker, check `docker ps`. The README has the install commands.

**Q: Test connection fails when I add a provider.**

A: Check that the **Base URL** and **API key** are entered exactly as your provider gave them, and that your computer can reach the provider. Is it online? Is a proxy or firewall blocking it? See [getting-started.md](getting-started.md) for provider setup.

**Q: The model list is empty.**

A: Run **Test connection** first. Charon fetches the model list from the provider when you test. If the list stays empty, set a **Default model** manually on the provider's settings.

**Q: I forgot my password.**

A: If you're still signed in, change it under **Settings** → **Profile**. If you're locked out, the account was created on first run and can't be re-created through the UI. As a last resort, stop Charon, back up the data folder (`~/.charon/data`), delete `charon.db` there, and start again to redo the first-run setup. That erases all chats, so keep the backup. See [getting-started.md](getting-started.md).

**Q: A character card won't import.**

A: Make sure the file is a PNG, is under 50 MB, and is a valid V2 or V3 character card. The import page shows a list of what is wrong if validation fails.

**Q: I imported a lorebook but it doesn't affect my chats.**

A: Imported lorebooks start **disabled**. Enable it with the switch on the **Lorebooks** page. Remember: an enabled lorebook applies to **all** chats. See [lorebooks.md](lorebooks.md).

**Q: The AI's replies look oddly formatted.**

A: Try the display toggles. **Auto-fix Markdown** repairs common formatting slips, and **Highlight dialogue** colors quoted speech. Both live under **Settings** → **Preferences**. Messages support markdown like bold, italic, and code blocks. See [chatting.md](chatting.md).

**Q: Where is my data? How do I back up?**

A: Everything is stored in a local SQLite file, plus an uploads folder for images, inside the Charon data directory on your machine. With the one-line installer that is `~/.charon/data` (macOS/Linux) or `%LOCALAPPDATA%\Charon\data` (Windows). With Docker it is the `charon-data` volume. Backing up that folder backs up everything; `charon backup` writes a consistent snapshot. See the [README](../../README.md) for the exact path.

**Q: Will accounts be removed?**

A: Run `pnpm migrate:single-user` first. It backs the database. Restore: `cp dev.db.bak-single-user-<timestamp> dev.db` (`-wal`/`-shm` if present).

Back to the [overview](./index.md).
