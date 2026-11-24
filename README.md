# dle-submit-mcp

**Get your daily game listed everywhere players look for one.**

You made a daily guessing game: a Wordle for footballers, a Globle for rivers, a "-dle" for your favourite series. Players find these through directories that list them by theme, and there are a lot of directories. Each has its own form, its own GitHub repository or its own email address, and after the fifth one it is hard to remember where you already sent it.

`dle-submit-mcp` is an [MCP](https://modelcontextprotocol.io) server that does that round for you, from Claude, Cursor or any other assistant that speaks MCP:

- **It knows the directories**, how each one takes new games, and what each form asks for.
- **It sends your game automatically** where a directory takes submissions without an account or a captcha.
- **It prepares the rest**: every field filled in from one description of your game, a GitHub issue already written, an email ready to send.
- **It remembers, per game, where it has been**: prepared, submitted, listed, rejected or skipped, with dates and links. Ask again next month and it picks up where it stopped.
- **It checks where you are already listed**, on the directories that publish their list, and skips those.

## Install

It needs [Node.js](https://nodejs.org) 20 or later. Nothing else: no account, no key.

**Claude Code**

```bash
claude mcp add dle-submit -- npx -y github:Alldle-net/dle-submit-mcp
```

**Claude Desktop, Cursor, Windsurf, Cline** and other clients that take a JSON config:

```json
{
  "mcpServers": {
    "dle-submit": {
      "command": "npx",
      "args": ["-y", "github:Alldle-net/dle-submit-mcp"]
    }
  }
}
```

The first start takes a little longer: `npx` downloads and builds the server once.

## Use it

Tell your assistant:

> Submit my game https://mygame.example everywhere.

Or start from the `submit_everywhere` prompt (in Claude Code: `/mcp__dle-submit__submit_everywhere`). The assistant asks for what it needs once (name, link, a one-line tagline, a short description, category, languages, your name and an email), checks where the game already is, sends it where it can, then walks you through the others one at a time.

Where a directory needs an account, a captcha or a payment, the assistant stops and lets you decide. Nothing here signs up for anything, solves captchas or pays.

If your assistant can drive a browser (Claude in Chrome, a Playwright MCP server), it can fill those forms with the values this server prepared. Without one, it hands you the link and the values to paste.

## Tools

| Tool | What it does |
| --- | --- |
| `save_game` | Saves your game's details once. Every form is filled from them. |
| `list_games` | The games you saved, and how far each one got. |
| `list_directories` | Every directory, in order, with how it takes games and where your game stands there. |
| `submit` | Sends the game to a directory that takes it automatically, or to all of them with `"all"`. |
| `prepare_submission` | Everything for one directory: the page, each field's value, a prefilled issue or email, the steps. |
| `record_submission` | Remembers what happened: submitted, listed, rejected, skipped. |
| `check_listings` | Looks for your game on the directories that publish their list, and records where it is found. |
| `get_progress` | What is done, what was prepared but not confirmed, what is left, and what to do next. |

## Directories

In the order the server goes through them.

<!-- directories:start -->
| # | Directory | How it takes games | Cost | Needs / scope |
| --- | --- | --- | --- | --- |
| 1 | [Alldle](https://www.alldle.net) | Sent automatically | Free |   |
| 2 | [DLE Arena](https://dlearena.com) | Web form, sent automatically | Free |   |
| 3 | [Dailydles](https://dailydles.com) | Web form, sent automatically | Free |   |
| 4 | [Dailies.games](https://dailies.games) | Web form, sent automatically | Free |   |
| 5 | [The Dles](https://dles.aukspot.com) | Web form | Free |   |
| 6 | [Dailydle](https://www.dailydle.org) | Web form, sent automatically | Free, paid options |   |
| 7 | [Daily Game List](https://dailygamelist.com) | Contact form | Free |   |
| 8 | [Adory Vo's dailies](https://adoryvo.github.io/lists/dailies.html) | GitHub issue | Free | account |
| 9 | [The Word Finder daily games](https://www.thewordfinder.com/daily-games/) | Web form | Free |   |
| 10 | [relaydle](https://relaydle.com) | Web form | Free |   |
| 11 | [Listdle](https://listdle.com) | Web form | Free |   |
| 12 | [WordleWeb](https://github.com/rarelygoeshere/WordleWeb) | GitHub pull request | Free | account |
| 13 | [Seekdle](https://seekdle.com) | Email | Free | English, family-friendly games only |
| 14 | [awesome-wordle](https://github.com/andycyca/awesome-wordle) | GitHub pull request | Free | account |
| 15 | [dlegames.org](https://dlegames.org) | Web form | Free | account |
| 16 | [Playlin](https://playlin.io) | Web form, sent automatically | Free |   |
| 17 | [dle.games (formerly LikeWordle)](https://dle.games) | Web form | Free | account |
| 18 | [DLES.gg](https://dles.gg) | Web form | Free, paid options | captcha |
| 19 | [AllDle Games (alldle.games)](https://alldle.games) | Web form | Free | account |
| 20 | [Dle Hunt](https://dlehunt.com) | Web form | Free, paid options | account |
| 21 | [Wordles of the World](https://rwmpelstilzchen.gitlab.io/wordles/) | GitLab issue | Free | account, Wordle-like games, any language |
| 22 | [DleList](https://dlelist.com) | Web form | Free, paid options |   |
| 23 | [Goldles](https://www.goldles.com) | Web form | Free, paid options | captcha, one game per site: for a portal, its best game |
| 24 | [Sportsdle's dle list](https://www.sportsdle.com/dle-games) | Web form | Paid | sports games only |
| 25 | [dles.io](https://dles.io) | Web form | Free | account |
| 26 | [Wordleverse](https://wordleverse.net) | Web form | Free |   |
<!-- directories:end -->

Missing one? See [Adding a directory](#adding-a-directory).

## What "sent automatically" means

For a directory marked *sent automatically*, the server sends the same request that directory's own submission form sends, once per game, with a `User-Agent` that names this project. It does that only where the form is public and needs no account, no captcha and nothing meant to tell people from scripts. A decoy field meant to catch bots is left empty, as a person leaves it.

Everything else is prepared, not sent: the server never signs up, solves a captcha, pays, or works around a check a directory put in place. If a directory you run is listed here and you would rather it were not sent to automatically, open an issue and it will be switched to prepared-only.

## Memory

Everything is kept in one JSON file on your machine: `~/.dle-submit/state.json`. Set `DLE_SUBMIT_STATE` to keep it somewhere else, for example in your game's repository:

```json
{
  "mcpServers": {
    "dle-submit": {
      "command": "npx",
      "args": ["-y", "github:Alldle-net/dle-submit-mcp"],
      "env": { "DLE_SUBMIT_STATE": "/path/to/my-game/.dle-submit.json" }
    }
  }
}
```

A game is identified by its link, so `https://www.mygame.com/` and `mygame.com` are the same game. Nothing leaves your machine except the submissions themselves and the public pages `check_listings` reads.

"Submitted" means sent. The server records it on its own only when it sent the submission itself and the directory accepted it. For the others, the assistant records it when you confirm you sent it.

## Adding a directory

Directories live in [`src/directories/`](src/directories/), one entry each: how it takes games, what its form asks for, and, where possible, how to check whether a game is already listed and how to send one directly. Automatic sending is only for public endpoints that need no account and no captcha. A pull request with a new directory, or a fix to one that changed its form, is welcome. Run `npm run readme` to update the table above.

```bash
npm install
npm test            # unit tests
npm run build
node scripts/smoke.ts   # drives the built server with the official MCP client
```

## About

Made and maintained by the team behind [Alldle](https://www.alldle.net), one of the directories above.

MIT licence.
