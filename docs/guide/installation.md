# Installation

Parallax can be run via Docker, as a desktop app, or directly from source with Node.js.

## Option 1: Docker (Recommended)

Docker is the easiest way to run Parallax as a persistent server.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose installed

### Steps

```bash
git clone https://github.com/jbirky/parallax-presentations.git
cd parallax-presentations
docker compose up -d
```

Then open **http://localhost:3002** in your browser.

Only this computer can open it, since the self-hosted editor has no sign-in: anyone who can reach it can read and change every presentation, and use the GitHub and Zotero accounts you've connected. To open it to your network anyway, in `docker-compose.yml`:

1. Change `"127.0.0.1:3002:3002"` to `"3002:3002"`.
2. Uncomment the `environment` lines below it, and list in `PARALLAX_ALLOWED_HOSTS` the names or addresses people will type to reach it (for example `localhost,192.168.1.20`). The server refuses any other name, which keeps other websites from reaching it through your browser.

### Useful Docker commands

```bash
# Start in background
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after pulling updates
git pull
docker compose up -d --build
```

### Data persistence

| Path inside container | Docker volume | What it stores |
|---|---|---|
| `/app/server/data` | `parallax-selfhosted-data` | Presentations, templates, version history and settings |
| `/app/server/uploads` | `parallax-selfhosted-uploads` | Uploaded images, videos and other files |

The volumes are kept when you stop or rebuild the container, including with `docker compose down`, but `docker compose down -v` deletes them.

---

## Option 2: Desktop App (Electron)

The desktop app bundles the editor and server into a standalone application — no Docker or Node.js required.

### Linux: install with your package manager

Installed this way, Parallax updates along with the rest of your system.

**Ubuntu, Debian, Linux Mint** (Ubuntu 22.04 or Debian 12 and later):

```bash
sudo curl -fsSLo /etc/apt/sources.list.d/parallax.sources https://pkg.parallax-presentations.com/apt/parallax.sources
sudo apt update
sudo apt install parallax
```

**Fedora, RHEL:**

```bash
sudo curl -fsSLo /etc/yum.repos.d/parallax.repo https://pkg.parallax-presentations.com/rpm/parallax.repo
sudo dnf install parallax
```

**openSUSE:**

```bash
sudo zypper addrepo https://pkg.parallax-presentations.com/rpm/parallax.repo
sudo zypper install parallax
```

**Arch Linux:** there's no package yet, so use the [AppImage](#linux-appimage). It needs FUSE 2:

```bash
sudo pacman -S fuse2
```

To update the AppImage, download the new one from the Releases page.

The APT and RPM repositories are signed with the key `DB2A DD58 7A04 3936 5354 2FDE 33AC 80B1 6F45 03EE` (Parallax Packages). The APT source file carries it; dnf and zypper show it on the first install and ask you to trust it.

### Download

Go to the [Releases page](https://github.com/jbirky/parallax-presentations/releases) and download the installer for your platform:

| Platform | File |
|---|---|
| Linux (Debian/Ubuntu) | `parallax_x.x.x_amd64.deb` |
| Linux (Fedora/openSUSE) | `parallax-x.x.x.x86_64.rpm` |
| Linux (AppImage) | `Parallax-x.x.x-x86_64.AppImage` |
| macOS (Apple silicon) | `Parallax-x.x.x-arm64.dmg` |
| Windows | `Parallax.Setup.x.x.x.exe` |

### Linux .deb

```bash
sudo apt install ./parallax_*.deb
# Then launch from your application menu or run:
parallax
```

The package is called `parallax`, so `sudo apt remove parallax` uninstalls it. It replaces the `revealjs-editor` package that earlier versions installed, and keeps your presentations.

### Linux AppImage

```bash
chmod +x Parallax-*.AppImage
./Parallax-*.AppImage
```

::: warning Ubuntu 24.04 and later
The app runs every page in Chromium's sandbox, since a deck can run its author's code. On Ubuntu 24.04 and later the sandbox needs an AppArmor profile, which the .deb installs and an AppImage can't, so there the AppImage stops at startup. Install the .deb instead.
:::

### macOS

Open the .dmg and drag Parallax to Applications. The app isn't signed with an Apple Developer ID yet, so the first time you open it macOS says it can't check it for malware. Click **Done**, then open **System Settings → Privacy & Security**, scroll down to the message about Parallax, and click **Open Anyway**. After that it opens normally.

The download is for Macs with Apple silicon (M1 and later).

### Windows

Run the installer. It isn't signed with a code-signing certificate yet, so Windows SmartScreen may warn that it doesn't recognize the app: click **More info**, then **Run anyway**.

::: tip
On first launch the desktop app will open both the editor window and a local server on port 3002. You can also access the editor from a browser at `http://localhost:3002`.
:::

---

## Option 3: Node.js from Source

For developers or anyone who wants to customize the editor.

### Prerequisites

- Node.js 22 and npm

### Steps

```bash
git clone https://github.com/jbirky/parallax-presentations.git
cd parallax-presentations
npm install
```

### Development mode (hot reload)

```bash
npm run dev
```

Opens the editor at `http://localhost:5173` with Vite HMR.

### Production mode

```bash
npm run build
npm start
```

Serves the built app at `http://localhost:3002`, for this computer only. To open it to your network, set `PARALLAX_HOST=0.0.0.0` and `PARALLAX_ALLOWED_HOSTS` to the names or addresses people will use (for example `localhost,192.168.1.20`), knowing that anyone who can reach it can do anything in it.

### Data persistence

Presentations are saved to `server/data/` and uploads to `server/uploads/`.

::: warning
When running from source, make sure to back up `server/data/` and `server/uploads/`. Neither is tracked by git.
:::
