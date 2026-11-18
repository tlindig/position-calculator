# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-11-18

Version 2 is a rewrite without jQuery. The options, the methods and the result object follow 1.x. The differences that can affect your code are marked **Breaking**.

### Added

- TypeScript declarations (`types/index.d.ts`). `target` takes a `MouseEvent`. `itemAt`, `targetAt` and `stick` accept only their keywords. `PositionCalculator.defaults` and the `options` of an instance are `Required`. An `Offset` without `mirror` means `mirror: false`.
- ES module build `dist/position-calculator.js` (ES2020) and minified IIFE build `dist/position-calculator.iife.min.js`, also available as `@tlindig/position-calculator/iife`.
- Documentation with guides, reference, examples, a playground and a comparison with other tools (`docs/`), and the benchmark in `bench/`.

### Changed

- **Breaking:** The package is `@tlindig/position-calculator` (1.x: `position-calculator`). The class and the global keep the name `PositionCalculator`.
- **Breaking:** jQuery is not needed. A jQuery object or a `NodeList` as `item` or `target` uses its first element. If `window.jQuery` exists when the IIFE build loads, it sets `jQuery.PositionCalculator`.
- **Breaking:** `require()` returns `{ PositionCalculator }`. In 1.x it returned a factory function that took jQuery.
- **Breaking:** The package is an ES module and needs Node.js 24 or later (`engines`). There is no AMD and no CommonJS build. The browser file is `position-calculator.iife.min.js` (1.x: `position-calculator.min.js`) and has no source map.
- Importing the package does not touch `window`, so it works in Node and on a server. The default `boundary` is read when it is first used.

### Removed

- `bower.json` and `position-calculator.jquery.json`.

### Fixed

- An `itemAt` or `targetAt` half that is not exactly a keyword falls back to `top` or `left`. In 1.1.3 `moveBy` was `NaN`.
- An item or target inside an open shadow tree gets its real position. In 1.1.3 `moveBy` was `{ y: 0, x: 0 }`.

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

[Unreleased]: https://github.com/tlindig/position-calculator/compare/2.0.0...HEAD
[2.0.0]: https://github.com/tlindig/position-calculator/compare/1.1.3...2.0.0
[1.1.3]: https://github.com/tlindig/position-calculator/compare/1.1.2...1.1.3
[1.1.2]: https://github.com/tlindig/position-calculator/compare/1.1.1...1.1.2
[1.1.1]: https://github.com/tlindig/position-calculator/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/tlindig/position-calculator/compare/1.0.1...1.1.0
[1.0.1]: https://github.com/tlindig/position-calculator/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/tlindig/position-calculator/releases/tag/1.0.0
