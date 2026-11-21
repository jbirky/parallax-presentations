# AI Collaborators

Give an AI chat app, such as Claude or ChatGPT, a link to one of your presentations, and the AI can read its slides while you talk to it: "what's missing from this talk?", "which slides run long?", "suggest a better title for slide 4". AI collaborator links are part of the cloud version of Parallax.

For now an AI can read a presentation through its link but not change it. Editing through a link comes next.

## Making a link

1. Open the presentation and click **Share**, next to **Present** at the top right.
2. Choose **AI collaborator link…**.
3. Give the link a name, such as "Claude", and choose how long it lasts: 7, 30 or 90 days, or never.
4. Click **Make link**, then **Copy**.

The link is shown only once. If you lose it, make a new one and revoke the old one.

## Adding the link to your AI app

| App | Where the link goes |
|-----|---------------------|
| Claude (claude.ai and Claude Desktop) | **Customize › Connectors › Add › Add custom connector**. Paste the link and choose **No sign-in**. |
| Claude Code | `claude mcp add --transport http parallax <link>` |
| ChatGPT | An admin of a Business or Enterprise/Edu workspace adds it under **Plugins › + › Add custom MCP server**, with **No authentication**. |
| Other apps | Any app that takes a remote MCP server by its URL, with no authentication. |

A few things to know:

- Claude's free plan allows one custom connector, so one presentation at a time.
- On Claude Team and Enterprise plans, only an Owner can add connectors, and they're added for everyone in the organization. Add links to a personal account instead.
- Pasted into a chat message instead, the link opens a page with the presentation as text, which the AI can read but not connect through.

## What the AI can do

Once the link is added, the AI has two tools:

| Tool | What it reads |
|------|---------------|
| `get_deck` | The outline: each slide's number, title, layout, minutes, what's on it, and its outline and speaker notes in short |
| `get_slide` | One slide in full: every element with its position and size, its text, and warnings for anything past the slide's edges or overlapping |

Text comes to the AI as Markdown, with `$…$` for math and `[@key]` for citations. Ink you drew while presenting and your practice runs are never shared.

## Managing links

Choose **Share › AI collaborator link…** again to see every link to the presentation, when each expires, and when it was last used.

| To | Do this |
|----|---------|
| Make a link last 30 more days | Click its renew button. The link stays the same. |
| Stop a link working | Click its revoke button. The AI app loses access at once. |

A presentation can have up to 10 links. Only the owner can make, renew or revoke them; editors don't see them.

## Keeping links private

Anyone who has a link can read the presentation through it, so treat it like a password. Don't paste it anywhere public, and revoke it when you're done. Links that expire are the safer choice.

If an AI app says the link doesn't work, it was revoked or has expired, or the presentation was deleted. Make a new one.
