# Position Calculator

Dynamic values in JavaScript for position, collision and collision avoidance, for popups, tooltips, dropdowns and the like. It is made for people who build their own styles and components. It hides the complexity and keeps the flexibility: it does one thing, and it does that thing very well.

You give it an item, usually a target and optionally a boundary. It measures them and returns how far the item has to move and how far it is from each edge of the boundary. It does not move anything itself and has no dependencies.

## Install

```sh
npm install @tlindig/position-calculator
```

Node.js 24 or later is needed for npm and the tests. The package has an ES module build, an IIFE build and TypeScript types.

## Use

As an ES module:

```js
import { PositionCalculator } from "@tlindig/position-calculator";

const tooltip = document.querySelector("#tooltip");
const button = document.querySelector("#button");

const calculator = new PositionCalculator({
  item: tooltip,
  target: button,
  itemAt: "top center",
  targetAt: "bottom center",
  flip: "both",
});

const { moveBy } = calculator.calculate();
const style = getComputedStyle(tooltip);
tooltip.style.left = parseFloat(style.left) + moveBy.x + "px";
tooltip.style.top = parseFloat(style.top) + moveBy.y + "px";
```

The item has to be positioned, for example with `position: absolute`, so that you can apply `moveBy` to its `left` and `top`. You can also apply it as a `transform`, a tween or a canvas drawing.

Without a bundler, load the IIFE build from `node_modules/@tlindig/position-calculator/dist/` with a script tag. The file is `position-calculator.iife.min.js`. It defines the global `PositionCalculator`.

## Documentation

The documentation has a getting started guide, the reference, examples with a try-it area, a playground and a configurator: <http://tlindig.github.io/position-calculator/>

The sources of the pages are in the folder `docs/`. `npm run docs:build` writes them to `_site/`, and `npm run docs:serve` serves that folder on your machine.

## Compared with other tools

Native CSS anchor positioning needs no JavaScript, but you get no position as a number. Floating UI, Popper and Tether do more than this library, for example updates on scroll and resize, and Popper and Tether apply the styles themselves. Position Calculator only calculates, and the result is synchronous.

In the benchmark scene of this repository (Chrome 157, one machine, one target per item), 100 elements take 0.80 ms to calculate. That number says nothing about other browsers or pages. Scene, limits, the other tools and the sizes of the bundles are on the page [Alternatives and comparison](http://tlindig.github.io/position-calculator/guides/alternatives.html). The folder `bench/` holds the benchmark, and [bench/README.md](bench/README.md) tells you how to repeat it.

## Browser support

The tests run in Chrome 157, Firefox 159 and WebKit 27.2 (state of 2026-11-11). Older versions are not tested.

## Coming from 1.x

Version 1 was a jQuery plugin. Version 2 is a standalone class and needs no jQuery. The list of differences is in the section "Coming from 1.x" of the [getting started guide](http://tlindig.github.io/position-calculator/guides/getting-started.html#coming-from-1x).

## Bugs and feature requests

Have a bug or a feature request? Please first search for existing and closed issues. If your problem or idea is not addressed yet, [please open a new issue](https://github.com/tlindig/position-calculator/issues/new).

## Build and test

`npm run build` writes `dist/`. `npm test` runs the tests in headless Chrome (Node 24 or newer, Chrome). See [CONTRIBUTING.md](CONTRIBUTING.md).

## Versioning

Position Calculator uses [Semantic Versioning](http://semver.org/).

Releases will be numbered with the following format:

`<major>.<minor>.<patch>`

## Author

**Tobias Lindig** <http://tlindig.de>

## Copyright and license

Code and documentation copyright 2014-2026 Tobias Lindig
Code released under [the MIT license](LICENSE).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
