# Contributing

Thanks for helping. Bug reports, fixes for Telegram markup changes and translations are especially welcome.

## Report a bug

Open an [issue](https://github.com/Thien21112005/telegram-media-download/issues/new?template=bug-report.md) and include:

- the Telegram Web version (`/k/` or `/a/`) and your browser version;
- the extension version (shown on `chrome://extensions`);
- what you did, what you expected and what happened;
- errors from the DevTools console of the Telegram tab (lines starting with `[Tel Download]`).

Do not post screenshots that show private chats.

## Set up

```bash
git clone https://github.com/Thien21112005/telegram-media-download.git
cd telegram-media-download
npm ci
npx playwright-core install chromium
```

Load `extension/` in `chrome://extensions` with **Load unpacked**. After editing, click the extension's reload icon and reload the Telegram tab.

## Before you open a pull request

```bash
npm run check
npm test
```

- Keep the code dependency-free: plain JavaScript, no framework or bundler.
- Test on both `/k/` and `/a/` when you touch Telegram integration, and update `tests/fixtures.cjs` when Telegram's markup changes.
- Add or update tests for behaviour you change.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(sidepanel): ...`, `fix(scanner): ...`, `docs: ...`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the parts fit together.

## Add or fix a translation

1. In `extension/shared/i18n.js`, add the language's native name to `UI_LANGUAGES` and a full message block to `UI_MESSAGES`. Keep every key and every `{placeholder}` from the English block. Add region or script matching to `matchLanguage` if needed.
2. Add `extension/_locales/<code>/messages.json` with `extName`, `extDescription` (at most 132 characters) and `actionTitle`. Chrome uses underscores in locale folder names, for example `zh_CN`.
3. Run `npm test`: it checks that every catalog has every message and keeps its placeholders.

Translations are plain text; check that long strings still fit the 320px side panel.

## Release (maintainers)

1. Update `version` in `extension/manifest.json` and `package.json`, and add the release notes to `CHANGELOG.md`.
2. Commit: `chore(release): vX.Y.Z`.
3. Tag and push: `git tag vX.Y.Z && git push origin main vX.Y.Z`.
4. The **Release** workflow runs the checks and tests, builds `telegram-media-download-vX.Y.Z.zip` and attaches it to a GitHub release with the changelog section as notes.
