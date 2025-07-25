(function() {
  // Default to the local version.
  var path = '../libs/jquery/jquery.js';
  // Get any jquery=___ param from the query string.
  var jqversion = location.search.match(/[?&]jquery=(.*?)(?=&|$)/);
  // If a version was specified, use that version from code.jquery.com.
  if (jqversion) {
    var version = jqversion[1];
    // Validate the version format to prevent XSS
    if (/^\d+\.\d+\.\d+$/.test(version)) {
      path = 'https://code.jquery.com/jquery-' + version + '.js';
    }
  }
  // This is the only time I'll ever use document.write, I promise!
  document.write('<script src="' + path + '"></script>');
}());
