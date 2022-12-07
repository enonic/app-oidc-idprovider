const test = require('/lib/xp/testing');

////////////////////////////

// test.mock only works once. Workaround

// Mutable config for returning a mock object
const mockConfig = [];
/*



};*/

const setMockConfig = (configToReturn) => {
    mockConfig[0]=configToReturn;
}

test.mock("/lib/configFile/services/getConfig.js", {
    getConfigOrEmpty: () => {
        return mockConfig[0]
    }
});

// Require configFile after mocking the getConfig service it uses:
const lib = require('./configFile');


/////////////////////////

exports.test_configFile_shouldAutoInit_trueBool = () => {
    setMockConfig({
        autoinit: true,
        somethingElse: "1"
    });
    test.assertTrue(lib.shouldAutoInit());
}

exports.test_configFile_shouldAutoInit_trueString = () => {
    setMockConfig({
        autoinit: "true",
        somethingElse: "2"
    });
    test.assertTrue(lib.shouldAutoInit());
}

exports.test_configFile_shouldAutoInit_falseBool = () => {
    setMockConfig({
        autoinit: false,
        somethingElse: "3"
    });
    test.assertFalse(lib.shouldAutoInit());
}

exports.test_configFile_shouldAutoInit_falseString = () => {
    setMockConfig({
        autoinit: "false",
        somethingElse: "4"
    });
    test.assertFalse(lib.shouldAutoInit());
}

exports.test_configFile_shouldAutoInit_falseMissing = () => {
    setMockConfig({
        somethingElse: "5"
    });
    test.assertFalse(lib.shouldAutoInit());
}

exports.test_configFile_shouldAutoInit_falseEmpty = () => {
    setMockConfig({});
    test.assertFalse(lib.shouldAutoInit());
}



///////////////////////////////////

exports.test_configFile_getAllIdProviderNames_some = () => {

    setMockConfig({
        // myidp1 will be ignored b/c wrong 'idprovider' namespace
        'irrelevant.myidp1.field': 'someValue',

        'idprovider.myidp2.firstField': 'firstValue',
        'idprovider.myidp2.second.field': 'secondValue',

        'idprovider.myidp3.firstField': 'thirdValue',
    });

    const result = lib.getAllIdProviderNames();

    test.assertTrue(Array.isArray(result));
    test.assertEquals(result.length, 2);
    test.assertTrue(result.indexOf('myidp2') > -1);
    test.assertTrue(result.indexOf('myidp3') > -1);
}



exports.test_configFile_getAllIdProviderNames_none = () => {

    setMockConfig({
        // All keys are outside of idprovider namespace, so they are ignored
        autoinit: true,
        'irrelevant.myidp1': 'someValue',
        'idprovidermyidp2.firstField': 'firstValue',
        'idprov.ider.myidp2.second.field': 'secondValue',
        'idprovidr.myidp3.firstField': 'thirdValue',
    });

    const result = lib.getAllIdProviderNames();

    test.assertTrue(Array.isArray(result));
    test.assertEquals(result.length, 0);
}



///////////////////////////////////

exports.test_configFile_getFileConfigSubTree_actualKey = () => {

    setMockConfig({
        autoinit: true,

        'something.target.key': 'targetValue',  // <-- Target this value

        'another.firstField': 'firstValue',
        'another.sub.myidp2.second.field': 'secondValue',
        'yetanother.myidp3.firstField': 'thirdValue',
    });

    const allConfigKeys = [
        'autoinit',
        'something.target.key',
        'another.firstField',
        'another.sub.myidp2.second.field',
        'yetanother.myidp3.firstField'
    ];
    const currentKey = 'something.target.key';
    const currentFieldIndex = 2;
    const parsingCallbacks = {};

    const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);
    test.assertEquals(result, 'targetValue');
}


exports.test_configFile_getFileConfigSubTree_simple = () => {

}

exports.test_configFile_getFileConfigSubTree_nested = () => {

}

exports.test_configFile_getFileConfigSubTree_unmatching = () => {

}

exports.test_configFile_getFileConfigSubTree_emptyConfig = () => {

}

