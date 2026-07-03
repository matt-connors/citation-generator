# MLA Generator Chrome Extension

This folder is a Manifest V3 Chrome extension that cites the current tab. It extracts citation metadata from the loaded page, then uses the MLA Generator formatter so output matches the website.

## Load Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this folder: `chrome-extension`.

## Behavior

- Reads the active tab URL after the toolbar popup is opened.
- Reads citation metadata from the active tab DOM: JSON-LD, citation/DC meta tags, Open Graph, Twitter, canonical URL, visible bylines, and `time` elements.
- Calls `https://mlagenerator.com/api/format` for the selected style. It does not call `/api/cite-website` for normal page extraction.
- Copies rich citation text using the same selection-first strategy as the site, with async clipboard fallbacks.
- Keeps a local extension history of recent citations.
- Opens `mlagenerator.com/my-references` and writes the exact captured CSL item into the site's `sources_v2` reference list for editing.

## Permissions

- `activeTab`: read the current tab URL after the user opens the extension.
- `scripting`: read metadata from the current page after the user asks to cite it.
- `storage`: remember the selected citation style.
- `clipboardWrite`: copy the generated citation.
- `https://mlagenerator.com/*`: call the formatting API and open the edit handoff.
