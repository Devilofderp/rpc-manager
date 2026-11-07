# RPC Manager

A Windows tray app for Discord Rich Presence. Keep several custom activities live at once, drag them into the order you want, and show what you're watching in your browser.

- **Custom presets:** name, text, images, buttons, timers and activity type, with no Developer Portal setup needed.
- **Sites:** YouTube, Twitch, Hulu, Prime Video and ReANIME, through a small browser extension. They only show while a video is actually playing.
- **Live preview** of your profile and member list as others see it.
- **Themes:** accent color, OLED black, dark gray, a custom color, or see-through glass.
- **Updates itself** from the releases on this page.

## Install

1. Download the latest `RPC-Manager-Setup` file from [Releases](../../releases/latest) and open it.
2. If Windows says it protected your PC, click **More info**, then **Run anyway**. The installer isn't signed.
3. Choose where to install it, then finish the installer.

To show sites too, click **New** in the app, pick a site, and follow the steps it shows to add the browser extension. It works in Chrome, Edge, Brave and Vivaldi.

### Discord clients

You need a Discord app on your PC, not Discord in a browser.

| Client | What to do |
|---|---|
| Discord, with or without Vencord, Equicord or BetterDiscord | Nothing. On Equicord, keep the NoRPC plugin off. |
| Vesktop, Legcord, GoofCord | Turn on Rich Presence in the client's settings. |
| Equibop | Turn on Use Built-in Server in its Rich Presence settings. |

RPC Manager says so in the title bar if one of these is what's stopping it.

## Development

You need [Node.js](https://nodejs.org) on Windows.

```
npm install
npm start
```

| Command | What it does |
|---|---|
| `npm start` | Runs the app from source. |
| `npm run dist` | Builds the installer in `dist/`. |
| `npm run release` | Builds the installer and publishes it as a GitHub release. Needs the [GitHub CLI](https://cli.github.com). |
| `npm run icon` | Redraws the default icons. |
| `npm run shortcut` | Adds a Start menu shortcut that runs the app from this folder. |

To load the extension while developing, use **Load unpacked** on the `extension` folder.

Useful switches for working on it:

| Switch | What it does |
|---|---|
| `RPC_MANAGER_DEBUG=1` | Logs every change sent to Discord, with the time. |
| `RPC_MANAGER_BRIDGE_PORT=47933` | Runs a test copy beside the real one, on its own port and with no tray icon. Use it with `--user-data-dir=<folder>`. |
| `--hidden` | Starts without showing the window. |
| `--snapshot=out.png` | Saves a screenshot of the window and quits. |
| `--quit` | Closes the running copy. |

### How it fits together

The app sends each active preset to Discord over its own connection to Discord's local pipe. The browser extension connects to the app over a local WebSocket, and only browser extensions are accepted.

```
src/
  main/               the Electron app
    main.js           startup
    window.js         the window, and tucking it into the tray
    tray.js           tray icon and menu
    ipc.js            messages between the app and the window
    bridge.js         the WebSocket server the extension connects to
    store.js          saves presets and settings
    updates.js        downloads and installs new versions
    discord/          talking to Discord
    appearance/       glass blur and the icon that follows the accent color
  renderer/           the window
    app.js            startup
    state.js          what the window knows
    titlebar.js       the Discord pill and update button
    settings.js       the Settings popover
    presets/          the preset list, dragging, and the New menu
    editor/           the page for the selected preset or site
    preview/          the profile preview on the right
    styles/           one stylesheet per part of the window
  shared/             code used by both: activities, sites and themes
  assets/             icons
extension/            the browser extension
  background/         tracks tabs, builds activities, and connects to the app
  content/            scripts that read the video and each site's page
  popup/              the toolbar popup
tools/                icon, shortcut and release scripts
```

### Adding a site

1. Add the site to `src/shared/sites.js`, and its icon to `src/assets/sites/`.
2. Add a script in `extension/content/sites/` that reports what's playing. The existing ones are short and make good templates.
3. In `extension/manifest.json`, add the site to `host_permissions`, add its script to `content_scripts`, and add its host to the `player.js` entry.
4. Add its ID to `SITE_IDS` in `extension/background/activities.js`.

### Publishing a version

1. Raise `version` in `package.json`. If the extension's behavior changed, raise its version in `extension/manifest.json` too, so the app can ask people to reload it.
2. Commit and push.
3. Run `npm run release`.

Installed copies pick up the new version by themselves.

## License

[MIT](LICENSE)
