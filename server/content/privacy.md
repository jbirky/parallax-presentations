# Privacy policy

_Last updated November 28, 2026_

Parallax is a presentation editor for science and teaching, run by Jess Birky. This policy says what the hosted service at parallax-presentations.com collects, why, who else handles it, and what you can do about it. It covers the website and editor, the MCP server that AI apps connect to, and the Parallax plugin for Claude.

If you run Parallax yourself, on your own server or as the desktop app, your presentations stay where you run it, and this policy doesn't apply to them.

**In short:** we collect what it takes to run your account and keep your presentations. We don't sell your data, show ads, or use ad trackers. Our analytics use no cookies. Your presentations are yours: you can export them, and ask us to delete everything.

## What we collect

### Your account

- **From signing in**, through Clerk: your email address, name, profile picture and the way you sign in. Clerk handles passwords and sign-in codes; we never see them.
- **Sign-up questions**: your field, career stage, why you're trying Parallax and how you heard of it. They're optional, and you can skip them.
- **Your plan**, and once paid plans start, whether you've paid. Card details go to Stripe and never reach us.

### What you make

- Your presentations, the versions saved of them (History), and your folders.
- Files you upload (pictures, video, PDFs, data), datasets, fonts and saved themes.
- Teams you make or join, and the invitations you send, with the invitee's email address.
- Services you connect: the tokens you give us for GitHub, Zotero or Zenodo, and the settings of live datasets (a source's request header is stored encrypted).
- AI access: your AI access tokens (stored only as a hash), AI collaborator links, the AI apps you sign in from, and which presentations each one changed and when.

### How you use Parallax

- **Usage records** tied to your account, such as how long an export or a render took and how big it was, to keep within plan limits and see how the servers are doing.
- **Page views**, counted by Umami, an analytics tool we host ourselves. It sets no cookies, honors your browser's Do Not Track setting, and records the page, the page you came from, your browser, operating system, device type and country. It doesn't store your IP address.
- **Server logs** of requests (IP address, time, address requested), kept briefly to fix problems and stop abuse.

### Trying Parallax without an account

Guest mode makes a temporary session. It and everything made in it are deleted when you close the tab, or after 12 hours without use. Cloudflare Turnstile checks that a guest isn't a bot.

## How we use it

- To run the service: to show, save and sync your presentations as you and others edit them, draw slides, and export them.
- To keep it working and safe: plan limits, preventing abuse, and fixing problems.
- To understand how Parallax is used, in aggregate, and make it better.
- To email you about your account, or with a team invitation someone sent you. We don't send marketing email without your consent.

We don't sell or rent personal information, we don't show ads, and we don't use your presentations to train AI models.

## AI apps and agents

Parallax itself doesn't send your presentations to AI models. When you connect an AI app (claude.ai, ChatGPT, Claude Code or another MCP client) with an AI access token, an AI collaborator link, or by signing in from the app, that app reads and changes your presentations at your request. What it reads goes to the app's provider, such as Anthropic or OpenAI, under that provider's terms and privacy policy.

Under **AI access** in your account menu, you can see every token and connected app, and revoke or turn off any of them at once. Pictures of slides that an AI app asks for are drawn on our servers.

## Who else handles your data

We use these services to run Parallax. Each gets only what its job needs.

| Service | What for | What it handles |
|---|---|---|
| Clerk | Signing in and accounts | Your email, name, profile picture and sign-in sessions |
| Cloudflare | The network in front of the site, file storage (R2), and guest mode's bot check (Turnstile) | Every request to the site, and the files you upload |
| Amazon Web Services | The server Parallax runs on (Lightsail, Oregon) | What the app handles |
| Neon | The database, on Amazon Web Services | Accounts, presentations and settings |
| Stripe | Payments, once paid plans start | Billing details |
| Resend | Email the site sends, such as team invitations | The recipient's address and the message |
| Google Fonts | The fonts on the site's own pages | Your IP address and browser, when a page loads its fonts |

We don't share personal information with anyone else, except when the law requires it, to protect people or the service, or if Parallax changes hands, in which case we'd tell you first.

## What others can see

- People you invite to a presentation, your team, anyone with a share or presenting link, and AI apps you connect see the presentations you give them.
- Community plugins run in a sandbox and can reach only the sites their gallery listing names. What you enter in a plugin's element may go to those sites.
- Content that loads from other sites, such as embeds, live datasets and web fonts, contacts those sites when it's shown.

## Cookies

Clerk uses cookies to keep you signed in, and Cloudflare may set one to tell people from bots. We use no advertising or tracking cookies. The editor keeps some preferences, such as light or dark, in your browser's local storage.

## Where your data is kept, and for how long

Your data is kept in the United States. If you use Parallax from elsewhere, it's transferred there.

- We keep your account and what you make while your account exists. What you delete is deleted, though copies remain in backups for a while (below).
- If you ask us to delete your account, we delete it and everything in it within 30 days.
- Backups are encrypted, and kept on a separate server we control: daily backups for 30 days, and one a month for a year. After that, deleted data is gone from them too.
- Guest sessions are deleted after 12 hours without use.

## Security

The site is served over HTTPS only. AI access tokens and links are stored as hashes, the secrets of live datasets are encrypted, and backups are encrypted with a key kept off our servers. Only Parallax's operator can reach the servers and the database. No system is perfectly secure: if a breach affects your data, we'll tell you.

## Your choices and rights

- Change your name and picture in your account, and export your presentations from the editor.
- Delete presentations, files and datasets, revoke AI tokens and turn off connected apps, and skip the sign-up questions.
- Ask us for a copy of your data, to correct it, to delete it, or to stop using it for something: email support@parallax-presentations.com. We'll answer within 30 days.

Depending on where you live, such as in the European Union, the United Kingdom or California, the law gives you these rights; we give them to everyone. You can also complain to your data protection authority.

## Children

Parallax isn't meant for children under 13, and we don't knowingly collect their information. If you think a child under 13 has an account, email us and we'll delete it.

## Changes to this policy

When we change this policy, we'll post the new version here with a new date. Before a significant change takes effect, we'll email account holders.

## Contact

Jess Birky, support@parallax-presentations.com
