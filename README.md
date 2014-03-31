# PositionCalculator

Calculate the position of an element relative to another element or event. Tries to find a collision free position within the viewport of a given container.


## Getting Started
Download the [production version][min] or the [development version][max].

[min]: https://raw.github.com/tlindig/position-calculator/master/dist/position-calculator.min.js
[max]: https://raw.github.com/tlindig/position-calculator/master/dist/position-calculator.js

or for quick tests, add this tag to load it direct from github:

`<script src="http://rawgithub.com/tlindig/position-calculator/master/dist/position-calculator.min.js"></script>`


### Usage example:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js"></script>
  <script src="http://rawgithub.com/tlindig/position-calculator/master/dist/position-calculator.min.js"></script>
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

Try this example at [jsBin](http://jsbin.com/sifec/1/edit)


## Documentation

Visit demonstration and documentation page: <a href="http://tlindig.github.io/position-calculator/">Position Calculator</a>

Ready to use version of this lib can be found in folder: "dist"


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

### 1.1.0

* add support for calculation without parameter "target" to calculate only overflow of item and boundary

### 1.0.1

* update jQuery manifest, add link to demo page


### 1.0.0

* Initial commit
