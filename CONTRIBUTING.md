# Contributing to ARKA Protocol

Thank you for your interest in contributing to ARKA Protocol! This document provides guidelines and information for contributors.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

- Check existing issues to avoid duplicates
- Use the bug report template
- Include reproduction steps, expected vs actual behavior
- Include environment details (Node.js version, OS, etc.)

### Suggesting Features

- Open a discussion first for major features
- Explain the use case and benefits
- Consider backwards compatibility

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`pnpm test`)
6. Run linting (`pnpm lint`)
7. Commit with conventional commits (`feat:`, `fix:`, `docs:`, etc.)
8. Push and open a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/arka-core.git
cd arka-core

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch
```

### Coding Standards

- Use TypeScript for all new code
- Follow existing code style
- Write meaningful commit messages
- Add JSDoc comments for public APIs
- Include unit tests for new features
- Keep PRs focused and reasonably sized

### Package Structure

```
packages/
├── arka-core/        # Core engine
├── arka-types/       # Type definitions
├── arka-utils/       # Utilities
├── arka-crypto/      # Cryptography
├── arka-plugin-sdk/  # Plugin SDK
├── arka-blockchain/  # Chain adapters
├── arka-testing/     # Test utilities
└── arka-demo/        # Demo environment
```

### Running Specific Package Tests

```bash
# Test a specific package
pnpm --filter @arka/core test

# Build a specific package
pnpm --filter @arka/types build
```

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.

## Questions?

- Open a [Discussion](https://github.com/arka-protocol/arka-core/discussions)
- Join our [Discord](https://discord.gg/arka-protocol)

Thank you for contributing!
