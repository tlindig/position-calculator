# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.3] - 2026-11-02

### Fixed

- `calculate()` threw an error if `window` was used as `target`. The visible area of the window is the target now.
- `stick: "all"` and `stick: true` threw an error if the item was larger than the boundary on an axis. They behave now like listing all four edges.

### Changed

- Grunt is replaced by `npm run build` (esbuild) and `npm test` (headless Chrome, Node 24 or newer). The source map is now `dist/position-calculator.min.js.map`.

## [1.1.2] - 2014-07-01

### Changed

- Set minimum required version of jQuery to >1.8. jQuery 1.7 has a bug together with css property "box-sizing: border-box" that is fixed with 1.8. ([#10413](http://bugs.jquery.com/ticket/10413), [#11004](http://bugs.jquery.com/ticket/11004))

## [1.1.1] - 2014-04-17

### Added

- Support for source map file.
- Support for [Bower](http://bower.io).

## [1.1.0] - 2014-03-28

### Added

- Support for calculation without parameter "target" to calculate only overflow of item and boundary.

## [1.0.1] - 2014-03-28

### Changed

- Update jQuery manifest, add link to demo page.

## [1.0.0] - 2014-03-28

### Added

- First public release.

## [0.0.0] - 2014-02-21

### Added

- Initial commit.

[Unreleased]: https://github.com/tlindig/position-calculator/compare/1.1.3...HEAD
[1.1.3]: https://github.com/tlindig/position-calculator/compare/1.1.2...1.1.3
[1.1.2]: https://github.com/tlindig/position-calculator/compare/1.1.1...1.1.2
[1.1.1]: https://github.com/tlindig/position-calculator/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/tlindig/position-calculator/compare/1.0.1...1.1.0
[1.0.1]: https://github.com/tlindig/position-calculator/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/tlindig/position-calculator/releases/tag/1.0.0
