const lib = require('./configFile');
const test = require('/lib/xp/testing');



////////////////////////////

exports.test_configFile_shouldAutoInit_trueBool = () => {
    test.mock("/lib/configFile/services/getConfig.js", {
        getConfigOrEmpty: () => ({
            autoinit: true,
            somethingElse: "hey"
        })
    });
    test.assertTrue(lib.shouldAutoInit())
}

exports.test_configFile_shouldAutoInit_trueString = () => {
    test.mock("/lib/configFile/services/getConfig.js", {
        getConfigOrEmpty: () => ({
            autoinit: "true",
            somethingElse: "hey"
        })
    });
    test.assertTrue(lib.shouldAutoInit())
}

exports.test_configFile_shouldAutoInit_falseBool = () => {
    test.mock("/lib/configFile/services/getConfig.js", {
        getConfigOrEmpty: () => ({
            autoinit: false,
            somethingElse: "hey"
        })
    });
    test.assertFalse(lib.shouldAutoInit())
}

exports.test_configFile_shouldAutoInit_falseBool = () => {
    test.mock("/lib/configFile/services/getConfig.js", {
        getConfigOrEmpty: () => ({
            autoinit: "false",
            somethingElse: "hey"
        })
    });
    test.assertFalse(lib.shouldAutoInit())
}

exports.test_configFile_shouldAutoInit_falseMissing = () => {
    test.mock("/lib/configFile/services/getConfig.js", {
        getConfigOrEmpty: () => ({
            somethingElse: "hey"
        })
    });
    test.assertFalse(lib.shouldAutoInit())
}

exports.test_configFile_shouldAutoInit_falseEmpty = () => {
    test.mock("/lib/configFile/services/getConfig.js", {
        getConfigOrEmpty: () => ({})
    });
    test.assertFalse(lib.shouldAutoInit())
}



///////////////////////////////////

exports.test_configFile_getAllIdProviderNames_some = () => {
    test.mock("/lib/configFile/services/getConfig.js", {
        getConfigOrEmpty: () => ({
            // myidp1 will be ignored b/c wrong 'idprovider' namespace
            'irrelevant.myidp1.field': 'someValue',

            'idprovider.myidp2.firstField': 'firstValue',
            'idprovider.myidp2.second.field': 'secondValue',

            'idprovider.myidp3.firstField': 'thirdValue',
        })
    });

    const result = lib.getAllIdProviderNames();

    test.assertTrue(Array.isArray(result));
    test.assertEqual(result.length, 2);
    test.assertTrue(result.indexOf('myidp2') > -1);
    test.assertTrue(result.indexOf('myidp3') > -1);
}



exports.test_configFile_getAllIdProviderNames_none = () => {
    test.mock("/lib/configFile/services/getConfig.js", {
        getConfigOrEmpty: () => ({

            // All keys are outside of idprovider namespace, so they are ignored
            autoinit: true,
            'irrelevant.myidp1': 'someValue',
            'idprovidermyidp2.firstField': 'firstValue',
            'idprov.ider.myidp2.second.field': 'secondValue',
            'idprovidr.myidp3.firstField': 'thirdValue',
        })
    });

    const result = lib.getAllIdProviderNames();

    test.assertTrue(Array.isArray(result));
    test.assertEqual(result.length, 0);
}



///////////////////////////////////

exports.test_configFile_getFileConfigSubTree_actualKey = () => {
    test.mock("/lib/configFile/services/getConfig.js", {
        getConfigOrEmpty: () => ({

            // All keys are outside of idprovider namespace, so they are ignored
            autoinit: true,

            'something.target.key': 'targetValue',  // <--

            'another.firstField': 'firstValue',
            'another.sub.myidp2.second.field': 'secondValue',
            'yetanother.myidp3.firstField': 'thirdValue',
        })
    });

    const allConfigKeys = [];
    const currentKey = 'something.target.key';
    const currentFieldIndex = 2;
    const parsingCallbacks = {};

    const result = lib.getFileConfigSubtree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);

    test.assertEqual(result, 'targetValue');
}


exports.test_configFile_getFileConfigSubTree_simple = () => {

}

exports.test_configFile_getFileConfigSubTree_nested = () => {

}

exports.test_configFile_getFileConfigSubTree_unmatching = () => {

}

exports.test_configFile_getFileConfigSubTree_emptyConfig = () => {

}

