# AI Collaborators

Give an AI chat app, such as Claude or ChatGPT, a link to one of your presentations, and the AI works on it with you while you talk to it: "what's missing from this talk?", "turn my outline into slides", "tighten slide 4". It shows up in the presentation like another editor, and its changes appear as it makes them. AI collaborator links are part of the cloud version of Parallax.

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
| ChatGPT (on the web) | **Plugins › + › Add custom MCP server**. Paste the link as the **Server URL**, choose **No authentication**, and create it as a plugin. |
| Other apps | Any app that takes a remote MCP server by its URL, with no authentication. |

A few things to know:

- Claude's free plan allows one custom connector, so one presentation at a time.
- On Claude Team and Enterprise plans, only an Owner can add connectors, and they're added for everyone in the organization. Add links to a personal account instead.
- ChatGPT's free plan can add a link as a plugin too. Type **@** and pick the plugin in each message you want it to use. On Business and Enterprise workspaces, only admins can add plugins.
- Pasted into a chat message instead, the link opens a page with the presentation as text, which the AI can read but not connect through.

## What the AI can do

Once the link is added, the AI has tools for reading the presentation and for changing it:

| Tool | What it does |
|------|--------------|
| `get_deck` | Reads the outline: each slide's number, title, layout, minutes, what's on it, and its outline and speaker notes in short |
| `get_slide` | Reads one slide in full: every element with its position and size, its text, what clicking on it does, and warnings for anything past the slide's edges or overlapping |
| `get_theme` | Reads the theme: its colors, fonts and text styles, the deck's stylesheet with any rules left out, and what a stylesheet can target |
| `render_slide` | Sees a slide as a picture, as it looks when presenting with all its steps shown, to check how its changes came out |
| `render_deck` | Sees every slide at once, small and numbered, to review a whole deck in one look |
| `check_deck` | Lists problems on every slide without drawing them: text past the edges or overlapping, slides with no title or too many words, small text, images without alt text, missing citations, speaker notes and minutes |
| `show_deck` | Shows you the presentation in the chat, live, in apps that can (below); elsewhere, gives you a link to open it in the editor |
| `list_datasets` | Reads the datasets linked to the presentation (**Tools › Datasets…**): their columns, sizes and first rows |
| `add_slide`, `update_slide` | Adds a slide in a layout, or changes one: its layout, title, subtitle and body text, speaker notes, minutes and background |
| `move_slide`, `delete_slide` | Moves or deletes a slide |
| `add_element`, `update_element`, `delete_element` | Adds a text box, shape, graph, equation, table, code block, LaTeX or TikZ picture, timeline, HTML embed or diagram; moves, resizes or deletes any element; changes what's in one |
| `get_element_guide` | Reads how to describe a graph or diagram: its fields, templates and an example |
| `update_outline` | Changes a slide's outline notes, minutes and section, never what's on the slide |
| `update_deck` | Changes the title, theme, font, text styles (the size of titles, headings and body text, and the headings' font and weight), the deck's own colors and stylesheet (as the Themes panel's Customize and CSS tabs set them), transition and talk length |
| `import_beamer` | Turns LaTeX Beamer source into slides, as **File › Import › LaTeX Beamer…** does, with the references it cites |
| `apply_edits` | Makes several of these changes at once, all or nothing |

The AI fills slides through their layouts, so its text sits in the layout's places and shrinks to fit. It writes Markdown, with `$…$` for math and `[@key]` for citations. Ink you drew while presenting and your practice runs are never read or changed.

Besides text, the AI can add and change graphs (2D and 3D, sliders, vector fields, and data from your datasets), equations with labeled parts, tables, code, LaTeX and TikZ pictures, timelines, HTML embeds with your own JavaScript (a JSXGraph or D3 plot, say), circuit, Feynman, logic, free-body, Venn, timing and geometry diagrams, the periodic table and spherical harmonics. Its graphs and diagrams are checked as their editors check them, so a mistake is caught before it reaches the slide, and it can look at a slide to see how it came out. Diagrams often start from the same templates their editors offer.

An HTML embed the AI writes runs kept apart from the rest of the presentation, as one you paste in does. It can't add images, video, molecules or plugins; it describes those, and you add them. It can move and resize them, though. Changing a text box replaces all of its text, so colors and sizes set by hand inside it go.

## Watching it work

While the AI works, it appears in the avatars at the top of the editor, under the link's name with a bot icon, on the slide it's working on. Click it to go to that slide. The elements it just changed are outlined with its name. It leaves the avatars two minutes after it stops.

Its changes reach every open copy of the presentation at once, as other editors' do.

You can also watch in the chat. In apps that show MCP Apps, claude.ai and ChatGPT among them, the AI's `show_deck` opens the presentation in a viewer under its message. A few seconds after each change, the viewer reloads at the slide the AI changed. Clear **Follow changes** to stay on the slide you're on. The AI is told which slide you're looking at, so "shorten this title" means that slide. **Open in editor** opens the presentation in Parallax, and **Full screen** fills the chat window, where the app allows it. The viewer shows the presentation as presented, from a link that stops working after half an hour; it gets a new one by itself. It stops following changes if the link is revoked.

Some apps don't let the viewer show pages from parallax-presentations.com in the chat; Claude doesn't for most connectors you add yourself. There the viewer draws the presentation itself, from the same files. Elements that show another page in a frame, such as plugins and embedded websites, stay blank there; **Open in editor** shows them.

- **Undoing a session.** Before the AI's first change after half an hour without any, a version named "Before Claude's edits" (with the link's name) is saved. To undo the session, restore that version in **History**. Each presentation keeps the five latest of these versions.
- **What you're typing in is yours.** The AI can't change a text box you're typing in, or an element whose editor you have open. It's told who has it, so it can wait or work on something else.

## Managing links

Choose **Share › AI collaborator link…** again to see every link to the presentation, when each expires, and when it was last used.

| To | Do this |
|----|---------|
| Make a link last 30 more days | Click its renew button. The link stays the same. |
| Stop a link working | Click its revoke button. The AI app loses access at once. |

A presentation can have up to 10 links. Only the owner can make, renew or revoke them; editors don't see them.

## Keeping links private

Anyone who has a link can read and change the presentation through it, so treat it like a password. Don't paste it anywhere public, and revoke it when you're done. Links that expire are the safer choice.

If an AI app says the link doesn't work, it was revoked or has expired, or the presentation was deleted. Make a new one.
