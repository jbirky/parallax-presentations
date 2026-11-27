# AI Access

An AI access token lets an AI agent work in your whole account, as you can: list your presentations, make new ones from a template or a theme, and change the ones you can edit while you watch. It's made for Claude Code with the Parallax plugin, which also teaches Claude how to build a good talk. AI access is part of the cloud version of Parallax.

To share one presentation with an AI chat app such as claude.ai or ChatGPT, use an [AI collaborator link](./ai-collaborators.md) instead.

## Making a token

1. On your dashboard, click your avatar at the top right and choose **AI access**.
2. Give the token a name, such as "Claude Code", and choose how long it lasts: 30 days, 90 days or a year.
3. Leave **Can make and change presentations** on, or turn it off for a token that only reads.
4. Click **Make token**, then **Copy**.

The token is shown only once. If you lose it, make a new one and revoke the old one.

## Using it in Claude Code

Add the Parallax plugin in Claude Code, once:

```text
/plugin marketplace add jbirky/parallax-agent
/plugin install parallax@parallax-agent
```

Paste the token when the plugin asks for it. Claude Code keeps it in your system's credential store, not in a file. To give it a new token later, run `/plugin configure parallax@parallax-agent`, then `/mcp` to reconnect.

Run `/parallax:connect` to check the connection, then ask for a talk: `/parallax:new-talk an introduction to RC filters, 15 minutes`.

Without the plugin, add Parallax as an MCP server with the token as a header:

```bash
claude mcp add --transport http parallax https://parallax-presentations.com/mcp \
  --header "Authorization: Bearer plx_pat_…"
```

Any other MCP client that can send a header works the same way: the server is `https://parallax-presentations.com/mcp`, with `Authorization: Bearer <token>`.

## What the AI can do

With a token, an AI has every tool an AI collaborator link has, on any presentation you can open, and four more:

| Tool | What it does |
|------|--------------|
| `list_decks` | Lists your presentations, those shared with you and your teams', with their ids |
| `create_deck` | Makes a presentation, blank in a theme or from a template |
| `list_templates` | Lists the templates it can start from |
| `list_themes` | Lists the themes, with what each looks like |

Each of the other tools names its presentation by id or by its exact title. The AI can view what you can view and change what you can edit: a presentation you only view, or one past your plan's limit, it can read but not change.

Its changes appear in the editor as it makes them, under the token's name in the avatars, and a version is saved before each session on a presentation, so you can undo them from **History**.

A new presentation counts toward your plan like any other. When you're at your plan's limit, the AI is refused rather than making one that would turn your oldest presentation read-only.

## Revoking a token

Open **AI access** again and click the trash icon next to the token. The agent using it loses access at once and leaves the avatars.
