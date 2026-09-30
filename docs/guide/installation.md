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

### Download

Go to the [Releases page](https://github.com/jbirky/parallax-presentations/releases) and download the installer for your platform:

| Platform | File |
|---|---|
| Linux (AppImage) | `Slides-Editor-x.x.x.AppImage` |
| Linux (Debian/Ubuntu) | `parallax_x.x.x_amd64.deb` |
| macOS | `Slides-Editor-x.x.x.dmg` |
| Windows | `Slides-Editor-Setup-x.x.x.exe` |

### Linux AppImage

```bash
chmod +x Slides-Editor-*.AppImage
./Slides-Editor-*.AppImage
```

### Linux .deb

```bash
sudo dpkg -i parallax_*.deb
# Then launch from your application menu or run:
parallax
```

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
