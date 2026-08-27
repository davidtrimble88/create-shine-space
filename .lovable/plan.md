# Install Google Tag Manager Container

## Goal
Inject the provided Google Tag Manager container (`GTM-WV5G89SR`) across the full site by adding the standard GTM snippets to `index.html`.

## Changes
1. **`<head>` snippet**: Insert the GTM `<script>` immediately after the existing `<meta charset>` / `<meta viewport>` tags in `index.html`.
2. **`<body>` snippet**: Insert the GTM `<noscript><iframe>...</iframe></noscript>` right after the opening `<body>` tag in `index.html`.

## Files affected
- `index.html`

## Verification
- Build the project and confirm no HTML parsing errors.
- Inspect the preview source to ensure both snippets are present and the container ID matches `GTM-WV5G89SR`.
