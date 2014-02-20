(function($) {
  /*
    ======== A Handy Little QUnit Reference ========
    http://api.qunitjs.com/

    Test methods:
      module(name, {[setup][ ,teardown]})
      test(name, callback)
      expect(numberOfAssertions)
      stop(increment)
      start(decrement)
    Test assertions:
      ok(value, [message])
      equal(actual, expected, [message])
      notEqual(actual, expected, [message])
      deepEqual(actual, expected, [message])
      notDeepEqual(actual, expected, [message])
      strictEqual(actual, expected, [message])
      notStrictEqual(actual, expected, [message])
      throws(block, [expected], [message])
  */


//  module('jQuery#computePosition', {
//    // This will run before each test in this module.
//    setup: function() {
//      this.elems = $('#qunit-fixture').children();
//    }
//  });

  module('jQuery.computePosition');

  test('is defined', function() {
    expect(3);
    strictEqual(typeof $.PositionCalculator, 'function', 'should be typeof function');
    strictEqual(typeof $.PositionCalculator.defaults, 'object', 'should be typeof object');
    strictEqual(new $.PositionCalculator().calculate(), null, 'should be null, because of missing required options');
  });

// TODO!!

}(jQuery));
