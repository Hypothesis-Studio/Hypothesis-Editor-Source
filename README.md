# Hypothesis

> Every Great Solution Begins with a Hypothesis.

**Hypothesis** is a modern, lightweight desktop code editor. Designed for speed, extensibility, and a clean developer experience.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Git](https://git-scm.com/)

### Install

```bash
git clone https://github.com/Hypothesis-Studio/Hypothesis-Editor.git
cd Hypothesis-Editor
npm install
```

### Build

```bash
npm run build
```

### Release Artefact

```bash
git checkout main
git pull

git commit --allow-empty -m "chore: trigger release v0.2.7"

git tag -fa v0.2.7 -m "Release v0.2.7"

git push origin main
git push origin v0.2.7 --force
```

### Package

```bash
npm run package:win      # Windows: NSIS + Portable
npm run package:mac      # macOS: DMG + ZIP
npm run package:linux    # Linux: AppImage + DEB
```

### Release

```bash
npm run release:win
npm run release:mac
npm run release:linux
```

Output goes to `release/` directory.

---

## Test

```bash
npm run test             # Unit tests
npm run test:watch       # Watch mode
npm run test:e2e         # End-to-end tests
npm run test:coverage    # Coverage report
```

---

## Distribution

| Platform | Format |
|----------|--------|
| Windows  | NSIS Installer, Portable |
| macOS    | DMG, ZIP |
| Linux    | AppImage, DEB |

---

## License

[MIT](LICENSE) — © 2026 Hypothesis Team
