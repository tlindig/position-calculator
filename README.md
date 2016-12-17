# PositionCalculator

Calculate the position of an element relative to another element or event. Tries to find a collision free position within the viewport of a given container.


## Getting Started
Download the [production version][min] or the [development version][max] or install it via [Bower][bower].

[min]: https://raw.github.com/tlindig/position-calculator/master/dist/position-calculator.min.js
[max]: https://raw.github.com/tlindig/position-calculator/master/dist/position-calculator.js
[bower]: http://bower.io

or for quick tests, add this tag to load it direct from github:

`<script src="http://tlindig.github.io/position-calculator/dist/position-calculator.min.js"></script>`


I will deploy it on CDN "cdnJS.com" if this requirement is met:

> Libraries must have notable popularity: 100 stars or watchers on GitHub is a good example, but
> as long as reasonable popularity can be demonstrated the library will be added."

## Documentation and Demo

Visit demonstration and documentation page: <a href="http://tlindig.github.io/position-calculator/">Position Calculator</a>

Ready to use version of this lib can be found in folder: "dist"


### Usage example:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js"></script>
  <script src="http://rawgit.com/tlindig/position-calculator/master/dist/position-calculator.min.js"></script>
  <meta charset="utf-8">
  <script>
    jQuery(function($) {

      var $tooltip = $('<div style="display:none;position:absolute;padding:10px;background:rgba(0,0,0,0.5);"></div>').appendTo(document.body);

      function showTooltip(event) {
        $tooltip.text($(this).data('tooltip'));
        $tooltip.show().css({top:0, left:0});

        var calculator = new $.PositionCalculator({
          item: $tooltip,
          itemAt: "bottom left",
          target: this,
          targetAt: "top right",
          flip: "both"
        });
        var posResult = calculator.calculate();

        $tooltip.css({
          top: posResult.moveBy.y + "px",
          left: posResult.moveBy.x + "px"
        })
      }

      $('.has_tooltip').on('mouseenter', showTooltip);
      $('.has_tooltip').on('mouseout', function(){$tooltip.hide()});
    });
  </script>
</head>
<body>
  <input type="text" class="has_tooltip" data-tooltip="this is a tooltip" value="hover me"/>
</body>
</html>
```

<b>Try this example at [jsBin](http://jsbin.com/balobomomu/2/edit?html,output)</b>


## Bugs and feature requests

Have a bug or a feature request? Please first search for existing and closed issues. If your problem or idea is not addressed yet, [please open a new issue](https://github.com/tlindig/position-calculator/issues/new).


## Build

To build run [Grunt](http://gruntjs.com/).


## Versioning

PositionCalculator use [Semantic Versioning](http://semver.org/).

Releases will be numbered with the following format:

`<major>.<minor>.<patch>`


## Author

**Tobias Lindig** <http://tlindig.de>


## Copyright and license

Code and documentation copyright 2014 Tobias Lindig
Code released under [the MIT license](LICENSE).

## Changelog

### 1.1.2 (July 1, 2014)

* set minimum required version of jQuery to >1.8. jQuery 1.7 has a bug together with css property "box-sizing: border-box" that is fixed with 1.8. ( [#10413](http://bugs.jquery.com/ticket/10413), [#11004](http://bugs.jquery.com/ticket/11004) )

### 1.1.1 (April 17, 2014)

* add support for source map file
* add support for [Bower][bower]

### 1.1.0 (March 28, 2014)

* add support for calculation without parameter "target" to calculate only overflow of item and boundary

### 1.0.1 (March 28, 2014)

* update jQuery manifest, add link to demo page

### 1.0.0 (March 28, 2014)

* first public release

### 0.0.0 (February 21, 2014)

Initial commit
