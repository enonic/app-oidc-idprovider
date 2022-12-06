const parsingCallbacksTests = require('./parsingCallbacks-test');
const initIDProviderTests = require('./initIDProvider-test');

const addTests = (testLib, source) => {
    Object.keys(testLib).forEach( key => {
        // log.info(key + ": " + typeof testLib[key]);
        if (typeof testLib[key] === 'function' && key.startsWith('test_')) {
            exports[key] = testLib[key];
            log.info(`Added to tests: ${key} from ${source}`);
        }
    })
}

addTests(parsingCallbacksTests, "parsingCallbacks-tests.js");
addTests(initIDProviderTests, "initIDProvider-test.js");
