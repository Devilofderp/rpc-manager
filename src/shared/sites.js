// Sites the browser extension can read. Each one you add becomes a preset in the
// list; what it shows is fixed by the site's script in extension/content/sites/.

export const SITES = {
    youtube: {
        name: "YouTube",
        icon: "../assets/sites/youtube.png",
        domains: ["youtube.com"],
        shows: [
            "Watching <channel>",
            "<video title>",
            "Picture: the channel's profile picture",
            "Progress bar while it plays",
            "Buttons: Watch on YouTube, View Channel"
        ],
        example: {
            type: 3,
            name: "jawed",
            details: "Me at the zoo",
            assets: { large_image: "https://yt3.ggpht.com/uI3VE4PVqvCy0xnWLqMJnEzyBUm3T8VHOCp4ee-1RxdHqKXCdUE_qXYQnpf9AfuEoIPactVyDhM=s240-c-k-c0x00ffffff-no-rj" },
            buttons: [{ label: "Watch on YouTube" }, { label: "View Channel" }],
            timestamps: { start: -5_000, end: 14_000 }
        }
    },
    twitch: {
        name: "Twitch",
        icon: "../assets/sites/twitch.png",
        domains: ["twitch.tv"],
        shows: [
            "Watching <streamer>",
            "<stream title>",
            "<category>",
            "Picture: the streamer's profile picture",
            "How long the stream has been live, or a progress bar on a past broadcast",
            "Button: Watch on Twitch, plus View Channel on a past broadcast"
        ],
        example: {
            type: 3,
            name: "Twitch",
            details: "Just Chatting with the community",
            state: "Just Chatting",
            assets: { large_image: "https://static-cdn.jtvnw.net/jtv_user_pictures/7db44749-286f-4db0-9c99-574b16170d44-profile_image-300x300.png" },
            buttons: [{ label: "Watch on Twitch" }],
            timestamps: { start: -1_260_000 }
        }
    },
    hulu: {
        name: "Hulu",
        icon: "../assets/sites/hulu.png",
        domains: ["hulu.com"],
        shows: [
            "Watching <show or movie>",
            "<episode name>",
            "Season <number> · Episode <number>",
            "Progress bar from Hulu's own timeline (ads don't throw it off), or \"Live\" time for live TV",
            "Poster: Hulu's own artwork if the page has it, otherwise looked up (TVmaze for shows, IMDb for movies)",
            "Button: Watch on Hulu"
        ],
        example: {
            type: 3,
            name: "Only Murders in the Building",
            details: "True Crime",
            state: "Season 1 · Episode 1",
            assets: { large_image: "https://www.hulu.com/static/icons/apple-touch-icon.png" },
            buttons: [{ label: "Watch on Hulu" }],
            timestamps: { start: -754_000, end: 1_310_000 }
        }
    },
    primevideo: {
        name: "Prime Video",
        icon: "../assets/sites/primevideo.png",
        domains: ["primevideo.com", "amazon.com/gp/video"],
        shows: [
            "Watching <show or movie>",
            "<episode name>",
            "Season <number> · Episode <number>",
            "Progress bar while it plays (Prime's opening jingle and any ads count toward it)",
            "Poster: looked up by title (TVmaze for shows, IMDb for movies), otherwise the title's artwork",
            "Button: Watch on Prime Video"
        ],
        example: {
            type: 3,
            name: "The Boys",
            details: "The Name of the Game",
            state: "Season 1 · Episode 1",
            assets: { large_image: "https://static.tvmaze.com/uploads/images/original_untouched/619/1547768.jpg" },
            buttons: [{ label: "Watch on Prime Video" }],
            timestamps: { start: -1_380_000, end: 2_220_000 }
        }
    },
    reanime: {
        name: "ReANIME",
        icon: "../assets/sites/reanime.png",
        domains: ["reanime.to", "reanime.cz"],
        shows: [
            "Watching <anime>",
            "<episode name>, looked up on Kitsu or AniList",
            "Episode <number> · SUB or DUB",
            "Progress bar while it plays",
            "Button: View on AniList",
            "The site itself is never named or linked"
        ],
        example: {
            type: 3,
            name: "Frieren: Beyond Journey’s End",
            details: "Killing Magic",
            state: "Episode 3 · SUB",
            assets: { large_image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg" },
            buttons: [{ label: "View on AniList" }],
            timestamps: { start: -600_000, end: 869_000 }
        }
    }
};
