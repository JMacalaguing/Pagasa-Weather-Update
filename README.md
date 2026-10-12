# Pagasa Weather Alert System

Pagasa Weather Alert System - Monitor new advisories and show an advisory panel in the browser extension.

Language: JavaScript, HTML

## Quick start (clone and load as a browser extension)

1. Clone the repository:

   git clone https://github.com/JMacalaguing/Pagasa-Weather-Update.git
   cd Pagasa-Weather-Update

2. (Optional) If the project has dependencies or a build step, run:

   npm install
   npm run build

   If there is no package.json or build step, you can skip this.

3. Load the extension into your browser

   Chrome / Edge:
   - Open chrome://extensions/ in your browser.
   - Enable "Developer mode" (top-right).
   - Click "Load unpacked" and select the project folder you just cloned (the folder that contains `manifest.json`).
   - The extension will appear in the toolbar. Click the extension icon to open the advisory panel (a panel appears on the right side of the browser showing advisories).

   Firefox (temporary during development):
   - Open about:debugging#/runtime/this-firefox
   - Click "Load Temporary Add-on..."
   - Select the `manifest.json` file in the project folder.
   - The extension will load temporarily until the browser restarts.

4. How to use

   - After loading the extension, click the extension icon in the toolbar. A panel will open (usually anchored to the right) showing the latest Pagasa advisories.
   - The panel updates when new advisories are detected. Use any provided settings or options page (if available) to configure behaviour.

5. Troubleshooting

   - If the extension does not show or behaves unexpectedly, open the extension's background/popup console:
     - In chrome://extensions/, find the extension tile and click "Background page" or "Inspect views" to open DevTools for the extension.
     - Check the Console for errors and missing network calls.
   - Ensure the repository folder you selected contains `manifest.json` at its root.
   - If you ran `npm run build`, double-check that the build output path is the one the manifest expects.

6. Notes

   - This project is intended to be loaded as a browser extension (development mode) so you can test the advisory panel on the right side of the browser window.
   - If you want this extension published to the Chrome Web Store or Firefox Add-ons site, follow each store's packaging and publishing guides.

7. Contact

   - For questions or contributions, open an issue on this repository or reach out to the repository owner.
