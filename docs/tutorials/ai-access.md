# AI Access

**AI access**, in your avatar menu on the dashboard, is where you see and control the AI agents that work in your whole account. An agent there can list your presentations, make new ones from a template or a theme, and change the ones you can edit while you watch. AI access is part of the cloud version of Parallax.

Most agents sign in with your Parallax account: Claude with the Parallax plugin, in claude.ai, the desktop app, Cowork or Claude Code, and ChatGPT or another MCP app through your account's MCP server. The [AI Agents](./ai-agents.md) tutorial walks through each. For a script, or an agent that can't sign in, you make an AI access token instead.

To share one presentation with an AI chat app such as claude.ai or ChatGPT, use an [AI collaborator link](./ai-collaborators.md) instead.

## Connected apps

Each app you sign in from shows under **Connected apps** in **AI access**, with its name, its site and when it was last used. A connected app can make and change presentations, as a token with **Can make and change presentations** can.

Click the power icon next to an app to turn it off: it loses access at once, even if it signs in again. **Allow again** lets it back in.

## What the AI can do

Signed in or with a token, an AI has every tool an AI collaborator link has, on any presentation you can open, and four more:

| Tool | What it does |
|------|--------------|
| `list_decks` | Lists your presentations, those shared with you and your teams', with their ids |
| `create_deck` | Makes a presentation, blank in a theme or from a template |
| `list_templates` | Lists the templates it can start from |
| `list_themes` | Lists the themes, with what each looks like |

Each of the other tools names its presentation by id or by its exact title. The AI can view what you can view and change what you can edit: a presentation you only view, or one past your plan's limit, it can read but not change.

Its changes appear in the editor as it makes them, under the app's or token's name in the avatars, and a version is saved before each session on a presentation, so you can undo them from **History**.

A new presentation counts toward your plan like any other. When you're at your plan's limit, the AI is refused rather than making one that would turn your oldest presentation read-only.

## AI access tokens

### Making a token

1. On your dashboard, click your avatar at the top right and choose **AI access**.
2. Give the token a name, such as "Lab scripts", and choose how long it lasts: 30 days, 90 days or a year.
3. Leave **Can make and change presentations** on, or turn it off for a token that only reads.
4. Click **Make token**, then **Copy**.

The token is shown only once. If you lose it, make a new one and revoke the old one.

### Using a token

Send the token to your account's MCP server, `https://parallax-presentations.com/mcp`, in the header `Authorization: Bearer plx_pat_…`. In Claude Code, for example:

```bash
claude mcp add --transport http parallax https://parallax-presentations.com/mcp \
  --header "Authorization: Bearer plx_pat_…"
```

Any other MCP client that can send a header works the same way.

### Revoking a token

Open **AI access** again and click the trash icon next to the token. The agent using it loses access at once and leaves the avatars.
