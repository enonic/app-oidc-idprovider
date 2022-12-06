var lib = require('./parsingCallbacks');
var test = require('/lib/xp/testing');

exports.testParsingCallbacks = function() {

																														log.info("lib.PARSING_CALLBACKS (" +
																															(Array.isArray(lib.PARSING_CALLBACKS) ?
																																("array[" + lib.PARSING_CALLBACKS.length + "]") :
																																(typeof lib.PARSING_CALLBACKS + (lib.PARSING_CALLBACKS && typeof lib.PARSING_CALLBACKS === 'object' ? (" with keys: " + JSON.stringify(Object.keys(lib.PARSING_CALLBACKS))) : ""))
																															) + "): " + JSON.stringify(lib.PARSING_CALLBACKS, null, 2)
																														);
    test.assertEquals(1, true);
}
