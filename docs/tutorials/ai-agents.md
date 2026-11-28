# AI Agents: Claude and MCP

An AI agent can build a talk in Parallax while you watch: it plans the talk with you, adds the slides with diagrams, math and speaker notes, and looks at every slide it changed. The agent runs in your own AI app, on your own subscription; Parallax gives it the tools to read and change presentations, through an MCP server. AI agents are part of the cloud version of Parallax.

There are four ways to connect one:

| You use | Connect with | The agent works on |
|---------|--------------|--------------------|
| Claude: claude.ai, the desktop app, Cowork or Claude Code | The Parallax plugin, by signing in | Your whole account |
| ChatGPT or another MCP app | Your account's MCP server, `/mcp`, by signing in | Your whole account |
| A script, or an agent that can't sign in | `/mcp` and an AI access token | Your whole account |
| Claude or ChatGPT, for one presentation | An [AI collaborator link](./ai-collaborators.md) | One presentation |

This tutorial sets up the first, then shows the others. Whichever you use, the agent appears in the presentation's avatars, its changes show up as it makes them, and a version is saved before it starts, so you can undo its work from **History**.

## 1. Add the plugin

The plugin connects Claude to your account and teaches it how a talk comes together. You sign in with your Parallax account: there's no token to make or paste.

### In claude.ai, the desktop app or Cowork

1. Open **Customize › Plugins › Add › Add marketplace**, enter `jbirky/parallax-agent`, then add the **parallax** plugin.
2. On the plugin's **Connectors** tab, click **Connect**. Parallax's sign-in opens: sign in, then allow Claude to use your account.
3. Skills need code execution, which is under **Settings › Capabilities**.

A plugin you add on claude.ai also appears in Claude Code.

### In Claude Code

Add the plugin's marketplace and install the plugin:

```text
/plugin marketplace add jbirky/parallax-agent
/plugin install parallax@parallax-agent
```

Then run `/mcp`, pick `plugin:parallax:parallax` and choose **Authenticate**. Parallax's sign-in opens in your browser: sign in, then allow Claude Code to use your account. Check the connection:

```text
/parallax:connect
```

Claude says how many presentations it can see, or what's wrong and how to fix it.

## 2. Build a talk

Ask for a talk with its topic, length and audience. In Claude Code and Cowork there's a command for it:

```text
/parallax:new-talk an introduction to RC filters for second-year students, 15 minutes
```

In claude.ai, ask in words: "Make a 15-minute introduction to RC filters for second-year students."

Claude works the way a careful speaker would:

1. It asks about anything it needs and you didn't say, such as the audience or the length.
2. It proposes an outline: slide titles in sections, each with its minutes, adding up to the talk's length. Then it stops and waits for you.
3. When you approve or change the outline, it makes the presentation in a theme that suits the subject and gives you a link to open it in the editor.
4. It adds the slides through their layouts, with outline notes, minutes, sections and speaker notes, and builds diagrams, graphs and equations as Parallax elements, not pictures.
5. It renders each slide it finishes and fixes what overflows, overlaps or is too small to read.

Open the link to watch the slides arrive. You can keep editing while Claude works: a text box you're typing in stays yours until you finish.

## 3. Turn a paper into a talk

Give an arXiv id or link, or the path of a PDF or a LaTeX source folder, with the length:

```text
/parallax:from-paper 2305.16790 12 minutes, for my group meeting
```

In Claude Code and Cowork, a `paper-reader` agent reads the paper on its own, so the long text stays out of your conversation, and converts the figures the talk is likely to use to PNG files; in claude.ai, Claude reads it in the chat. Claude then shows you the paper's claim and main results, with the outline it proposes. Once you approve it, Claude builds the talk with the paper's own figures uploaded to the slides and credited, and its key equations. It reviews the finished deck, fixes what must be fixed, and tells you which figures may need cropping and what it left out.

::: warning
Figures belong to the paper's authors. Before you share a talk publicly, check the paper's license: arXiv shows it on the abstract page. Claude tells you the license when it finds it, and which figures the paper says were reproduced with a publisher's permission.
:::

## 4. Review a presentation

```text
/parallax:review my thesis defense, focus on the figures
```

Claude finds the presentation by its title (or takes the one you changed last), checks every slide, looks at the whole deck in one picture, and returns what to fix, ranked by how much it matters, with slide numbers. A review never changes the deck. Ask Claude to make the fixes you agree with.

## Asking in your own words

The commands are shortcuts. You can also just ask, and Claude uses the plugin's skills when they fit:

- "Turn my notes in talk.md into a 12-minute conference talk."
- "Add a Feynman diagram for Compton scattering to slide 4."
- "On slide 11, annotate the equation, one term per click."
- "Plot results.csv on slide 6 as a graph."
- "Make my lecture look like a Beamer deck."

## What's in the plugin

| Part | What it does |
|------|--------------|
| `/parallax:new-talk` | A brief, an outline with minutes, then the slides, checked |
| `/parallax:from-paper` | A talk from an arXiv paper, a PDF or LaTeX source, with the paper's own figures |
| `/parallax:review` | Reviews a presentation whole and ranks what to fix |
| `/parallax:connect` | Checks the connection and says how to fix it |
| `building-a-talk` | The workflow: audience, outline, layouts, speaker notes, checks |
| `paper-to-talk`, `paper-reader` | Reads a paper into a talk brief and puts its figures on slides with credit |
| `scientific-figures`, `figure-builder` | Turns your data or plotting script into a live graph, or a picture when it can't |
| `diagrams` | Picks the built-in element for a subject: graphs, circuits, Feynman, logic, free-body, Venn, timing, geometry, TikZ |
| `math-and-notation` | Inline math, annotated equations, derivations and chemistry |
| `deck-themes` | Picks a theme for the subject and audience, and adjusts colors, fonts and the stylesheet |
| `review-a-deck`, `deck-reviewer` | Checks every slide, looks at the whole deck, ranks fixes |

The skills work everywhere. The `/parallax:` commands, the agents (`paper-reader`, `figure-builder`, `deck-reviewer`) and the render gate run in Claude Code and Cowork; in claude.ai, Claude does the agents' work in the chat.

The plugin is open source, under the MIT license: [github.com/jbirky/parallax-agent](https://github.com/jbirky/parallax-agent).

### The render gate

When Claude ends a turn after changing slides without looking at them since, the plugin sends it back once to render the slides it changed. To turn this off, set `PARALLAX_RENDER_GATE=off` in the environment Claude Code starts in.

## Without the plugin: the MCP server

Your account's MCP server is at `https://parallax-presentations.com/mcp`. An app that supports signing in to MCP servers needs only that address: add it as a connector, and sign in to Parallax when the app asks. The agent gets the same tools as with the plugin, but not the plugin's skills, so tell it more about what you want: an outline first, one claim per slide, a render of each slide it changes.

In ChatGPT, connectors that change things are for Business and Enterprise workspaces, added by an admin: a custom MCP server with that address, and OAuth as its authentication. In claude.ai, the plugin is the better way, but the address alone also works as a custom connector, under **Customize › Connectors › Add › Add custom connector**.

### With an AI access token

For a script, or an agent that can't sign in, make an AI access token:

1. On your dashboard, click your avatar at the top right and choose **AI access**.
2. Name the token and choose how long it lasts: 30 days, 90 days or a year.
3. Leave **Can make and change presentations** on. Turned off, the token only reads.
4. Click **Make token**, then **Copy**. The token is shown only once.

Send it in the header `Authorization: Bearer plx_pat_…`. In Claude Code, for example:

```bash
claude mcp add --transport http parallax https://parallax-presentations.com/mcp \
  --header "Authorization: Bearer plx_pat_…"
```

[AI Access](./ai-access.md) has more on tokens, such as what they can reach and how to revoke one.

The server describes its tools to the agent. Among them:

| Tools | What they do |
|-------|--------------|
| `list_decks`, `create_deck`, `list_templates`, `list_themes` | Find your presentations, or make one from a template or in a theme |
| `get_deck`, `get_slide`, `get_theme` | Read the outline, one slide in full, or the theme |
| `add_slide`, `update_slide`, `update_outline`, `apply_edits` | Add and fill slides through their layouts, plan minutes and sections, make several changes at once |
| `add_element`, `get_element_guide` | Add graphs, equations, tables, code, TikZ, HTML embeds and diagrams |
| `request_upload`, `add_image`, `add_dataset` | Send pictures and data files from the agent's computer |
| `check_deck`, `render_slide`, `render_deck` | Find problems on every slide, and see slides as they're presented |

## In Claude or ChatGPT: one presentation

To work on one presentation in a chat app, open it, click **Share**, choose **AI collaborator link…**, and add the link to the app as a connector. [AI Collaborators](./ai-collaborators.md) has the steps for each app. A link reaches only that presentation, and needs no sign-in.

## Staying in control

- **Connected apps:** each app you sign in from shows in **AI access**, under **Connected apps**, with when it was last used. A connected app can make and change presentations.
- **Undo:** a version is saved before each session of changes, named after the app or token, such as "Before Claude's edits". Restore it from **History**.
- **Read only:** a token made without **Can make and change presentations** can read your presentations but not change them.
- **Plan limits:** a new presentation counts toward your plan. At the limit, the agent is refused rather than making one that would turn your oldest presentation read-only.
- **Turn off:** in **AI access**, click the power icon next to a connected app, or the trash icon next to a token. The agent loses access at once and leaves the avatars. **Allow again** lets an app back in.
- **What it can't add yet:** video, molecules and plugins. The agent leaves a note on the slide for you to add them in the editor.

## Troubleshooting

| What happens | What to do |
|--------------|------------|
| The Parallax tools don't appear in Claude Code, or `/parallax:connect` says to sign in | Run `/mcp`, pick `plugin:parallax:parallax` and choose **Authenticate** |
| Claude in claude.ai doesn't use Parallax | Open the plugin's **Connectors** tab and check that Parallax is connected |
| An app says Parallax turned it off | You turned it off under **AI access**. Click **Allow again** next to it there |
| A token doesn't work | It expired, was revoked or was mistyped. Make a new one |
| A token can read but not change presentations | It was made without **Can make and change presentations**. Make a new one with it on |
| A change is refused because someone is typing | Someone is editing that text box. The agent tries again later or works on another slide |
| A new presentation is refused | You're at your plan's limit. Delete one you no longer need, or ask the agent to work in an existing one |
