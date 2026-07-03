# Privacy Policy — uioption

**Last updated: July 3, 2026**

uioption is a Chrome extension that helps developers compare UI design variants and inspect components on their own local development pages.

## Data collection

uioption does **not** collect, store, transmit, or sell any user data. Specifically, it does not collect:

- Personal information
- Browsing history or page content
- Authentication information
- Analytics or telemetry of any kind

## Network requests

uioption makes **no network requests**. All code is bundled inside the extension package; nothing is fetched from remote servers.

## Where the extension runs

uioption only operates on local development pages: `http://localhost/*`, `http://127.0.0.1/*`, and `file:///*`. It has no access to public websites and never runs on production or third-party pages.

## Local settings

The extension stores only its own preferences (auto-inject on/off, picker layout, popup theme) using Chrome's `storage.sync` API. These settings live in your Chrome profile, are never transmitted to the developer, and are removed by Chrome when you uninstall the extension.

## Permissions

- **scripting** — injects the bundled picker/inspector scripts into your local dev pages.
- **storage** — saves your extension preferences.
- **tabs** — identifies the active tab for injection and checks tab URLs against the local development patterns above.

## Changes

Any changes to this policy will be published in this file with an updated date.

## Contact

Questions? Open an issue at [github.com/kiliczsh/uioption-extension](https://github.com/kiliczsh/uioption-extension/issues).
