# Contributing to Hypothesis

Thank you for your interest in contributing to Hypothesis!

## Getting Started

1. Fork the repository: [Hypothesis-Studio/Hypothesis-Editor](https://github.com/Hypothesis-Studio/Hypothesis-Editor)
2. Clone your fork
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Run tests: `npm run test`
6. Commit with conventional commits: `git commit -m "feat: add new feature"`
7. Push to your fork: `git push origin feature/my-feature`
8. Open a Pull Request

## Development Setup

```bash
# Clone
git clone https://github.com/<your-username>/Hypothesis-Editor.git
cd Hypothesis-Editor

# Install
npm install

# Start dev (Vite + Electron hot reload)
npm run dev

# Build
npm run build

# Test
npm run test
```

### Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server + Electron |
| `npm run build` | Full build (main + preload + renderer) |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix lint errors |
| `npm run format` | Format code with Prettier |
| `npm run package:win` | Package for Windows |
| `npm run package:mac` | Package for macOS |
| `npm run package:linux` | Package for Linux |

## Code Style

- TypeScript only (no JavaScript in source)
- ESLint + Prettier for formatting
- Functional React components with hooks
- Zustand for state management
- CSS variables for theming (no hardcoded colors)

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Usage |
|--------|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `style:` | Formatting, no code change |
| `refactor:` | Code restructuring |
| `test:` | Adding or updating tests |
| `chore:` | Maintenance, dependencies |

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include tests for new functionality
- Update documentation if needed
- Ensure `npm run test` passes
- Ensure `npm run lint` passes
- Request review from maintainers

## Reporting Issues

Use [GitHub Issues](https://github.com/Hypothesis-Studio/Hypothesis-Editor/issues):

- **Bug Report** — for bugs and unexpected behavior
- **Feature Request** — for new feature suggestions

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
