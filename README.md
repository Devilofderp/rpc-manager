# RPC Manager

A Windows app for your Discord status. Show custom activities, several at once, and what you're watching on YouTube, Twitch, Hulu, Prime Video, Disney+ and ReANIME.

## Install

1. Download the latest `RPC-Manager-Setup` file from [Releases](../../releases/latest) and open it.
2. If Windows says it protected your PC, click **More info**, then **Run anyway**.
3. Pick who to install it for and where, then click **Finish**.

You need a Discord app on your PC, not Discord in a browser.

## Custom presets

Click **New**, then **Custom preset**, and fill in what you want people to see. The preview on the right shows your profile and member list as others will see them.

- **Name shown:** what comes after "Playing" or "Watching".
- **Activity type:** Playing, Listening, Watching or Competing.
- **Details** and **State:** the two lines under the name. Each can have a link.
- **Member list shows:** which line appears under your name in member lists and DMs.
- **Images:** a large and a small image, by web link. Each can have hover text and a click link.
- **Buttons:** up to two. Discord hides your own buttons from you, but everyone else sees them.
- **Timer:** none, time since you turned it on, the time of day, or a progress bar of any length.
- **Party size:** for Playing activities, like "2 of 5".
- **Application ID:** leave it empty. Fill it in only to use your own Discord app's icon and uploaded art.

Turn a preset on or off with its switch. Several can be on at once. Drag them into order: the top one is what people see first.

## Sites

Click **New** and pick a site. It shows on your profile only while a video is actually playing. Pausing, closing the tab or just browsing clears it.

| Site | What it shows |
|---|---|
| YouTube | The channel, the video title and the channel's picture |
| Twitch | The streamer, the stream title, the category and how long they've been live |
| Hulu | The show or movie, the episode, and the season and episode number |
| Prime Video | The show or movie, the episode, and the season and episode number |
| Disney+ | The show or movie, the episode, and the season and episode number |
| ReANIME | The anime, the episode name, the episode number, and a link to it on AniList. The site itself is never named. |

Sites need the RPC Manager browser extension. It works in Chrome, Edge, Brave and Vivaldi:

1. Open `chrome://extensions` (or `edge://`, `brave://`, `vivaldi://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose the folder that a site's page in RPC Manager shows. Its **Open folder** button opens it.

When an update changes the extension, RPC Manager and the extension's toolbar popup both ask you to click its reload arrow on that page.

## Settings

The gear at the top right holds the look and feel:

- **Accent color:** the app icon follows it.
- **Background:** OLED black, dark gray, a custom color, or see-through glass.
- **Text and UI size** and **corners**.
- **Minimize button goes to the tray:** off unless you turn it on.

Closing the window keeps RPC Manager running in the tray by the clock, with your presets still live. To clear them, right-click the tray icon and choose **Quit and clear presence**.

## Updates

RPC Manager checks for new versions by itself. When one is ready, click **Restart to update** in the title bar or the tray menu.

## If something isn't showing

The status at the top of the window says what's wrong:

| It says | Do this |
|---|---|
| Discord isn't running | Open the Discord desktop app. |
| Discord is running as admin | Quit Discord from its tray icon and open it normally, not as administrator. |
| Discord is open: turn off Equicord's NoRPC plugin | Turn off NoRPC in Equicord's plugins, then restart Discord. |
| Vesktop (or another client) is open | Turn on Rich Presence in that client's settings. Equibop calls it Use Built-in Server. |

If a site's page in RPC Manager says the extension isn't connected, check that the extension is installed and turned on. It reconnects by itself within about 30 seconds, and its toolbar popup has a **Reconnect** button.

If two sites are playing at the same time, only one of them shows on Discord.

## License

[MIT](LICENSE)
