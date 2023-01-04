const test = require('/lib/xp/testing');
const testUtils = require('/testUtils');


const updateGetConfigMock = testUtils.mockAndGetUpdaterFunc(
    "/lib/configFile/services/getConfig.js",
    {
        getConfigOrEmpty: null
    }
);
const setMockConfig = (configToReturn) => updateGetConfigMock({
    getConfigOrEmpty: () => configToReturn
});



// Require configFile AFTER mocking the getConfig service it uses:
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
    test.assertEquals(2, result.length);
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
    test.assertEquals(0, result.length);
}



///////////////////////////////////

exports.test_configFile_getFileConfigSubTree_actualKey = () => {

    setMockConfig({
        autoinit: true,

        'something.target.subkey': 'targetValue',  // <-- Target this value

        'another.firstField': 'firstValue',
        'another.sub.myidp2.second.field': 'secondValue',
        'yetanother.myidp3.firstField': 'thirdValue',
    });

    const allConfigKeys = [
        'autoinit',
        'something.target.subkey',
        'another.firstField',
        'another.sub.myidp2.second.field',
        'yetanother.myidp3.firstField'
    ];
    const currentKey = 'something.target.subkey';
    const currentFieldIndex = 2;
    const parsingCallbacks = {};

    const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);
    test.assertEquals('targetValue', result);
}

exports.test_configFile_getFileConfigSubTree_actualKeyEmpty = () => {

    setMockConfig({
        autoinit: true,

        'something.target.subkey': '',  // <-- Target this value

        'another.firstField': 'firstValue',
        'another.sub.myidp2.second.field': 'secondValue',
        'yetanother.myidp3.firstField': 'thirdValue',
    });

    const allConfigKeys = [
        'autoinit',
        'something.target.subkey',
        'another.firstField',
        'another.sub.myidp2.second.field',
        'yetanother.myidp3.firstField'
    ];
    const currentKey = 'something.target.subkey';
    const currentFieldIndex = 2;
    const parsingCallbacks = {};

    const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);
    test.assertEquals('', result);
}


exports.test_configFile_getFileConfigSubTree_simpleSubkey = () => {
    setMockConfig({
        autoinit: true,

        'something.target.subkey': 'targetValue',  // <-- Target something.target, expect an object: {subkey: targetValue}

        'another.firstField': 'firstValue',
        'another.sub.myidp2.second.field': 'secondValue',
        'yetanother.myidp3.firstField': 'thirdValue',
    });

    const allConfigKeys = [
        'autoinit',
        'something.target.subkey',
        'another.firstField',
        'another.sub.myidp2.second.field',
        'yetanother.myidp3.firstField'
    ];
    const currentKey = 'something.target';
    const currentFieldIndex = 1;
    const parsingCallbacks = {};

    const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);
    test.assertEquals(1, Object.keys(result).length);
    test.assertEquals('targetValue', result.subkey);
}

exports.test_configFile_getFileConfigSubTree_nestedSubkey = () => {

    setMockConfig({
        autoinit: true,

        'something.target.subkey': 'targetValue',  // <-- Target 'something', expect an object: {target: {subkey: targetValue}}

        'another.firstField': 'firstValue',
        'another.sub.myidp2.second.field': 'secondValue',
        'yetanother.myidp3.firstField': 'thirdValue',
    });

    const allConfigKeys = [
        'autoinit',
        'something.target.subkey',
        'another.firstField',
        'another.sub.myidp2.second.field',
        'yetanother.myidp3.firstField'
    ];
    const currentKey = 'something';
    const currentFieldIndex = 0;
    const parsingCallbacks = {};

    const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);
    test.assertEquals(1, Object.keys(result).length);
    test.assertEquals(1, Object.keys(result.target).length);
    test.assertEquals('targetValue', result.target.subkey);
}

exports.test_configFile_getFileConfigSubTree_nestedSubTree = () => {

    setMockConfig({
        autoinit: true,

        // Target 'something.target' and everything below it
        'something.target.firstkey': 'targetValue1',
        'something.target.secondkey.one': 'targetValue2.1',
        'something.target.secondkey.two.one': 'targetValue2.2.1',
        'something.target.secondkey.two.two': 'targetValue2.2.2',
        'something.target.secondkey.three': 'targetValue2.3',
        'something.target.thirdkey': 'targetValue3',

        'another.firstField': 'firstValue',
        'another.sub.myidp2.second.field': 'secondValue',
        'yetanother.myidp3.firstField': 'thirdValue',
    });

    const allConfigKeys = [
        'autoinit',
        'something.target.firstkey',
        'something.target.secondkey.one',
        'something.target.secondkey.two.one',
        'something.target.secondkey.two.two',
        'something.target.secondkey.three',
        'something.target.thirdkey',
        'another.firstField',
        'another.sub.myidp2.second.field',
        'yetanother.myidp3.firstField'
    ];
    const currentKey = 'something.target';
    const currentFieldIndex = 1;
    const parsingCallbacks = {};

    const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);

    // Expected: a tree object
    test.assertEquals(3, Object.keys(result).length);
    test.assertEquals(3, Object.keys(result.secondkey).length);
    test.assertEquals(2, Object.keys(result.secondkey.two).length);
    test.assertEquals('targetValue1', result.firstkey);
    test.assertEquals('targetValue2.1', result.secondkey.one);
    test.assertEquals('targetValue2.2.1', result.secondkey.two.one);
    test.assertEquals('targetValue2.2.2', result.secondkey.two.two);
    test.assertEquals('targetValue2.3', result.secondkey.three);
    test.assertEquals('targetValue3', result.thirdkey);
}

exports.test_configFile_getFileConfigSubTree_unmatching = () => {

    setMockConfig({
        autoinit: true,

        'something.target.subkey': 'targetValue',  // <-- NOT targeted. Nothing is matched.

        'another.firstField': 'firstValue',
        'another.sub.myidp2.second.field': 'secondValue',
        'yetanother.myidp3.firstField': 'thirdValue',
    });

    const allConfigKeys = [
        'autoinit',
        'something.target.subkey',
        'another.firstField',
        'another.sub.myidp2.second.field',
        'yetanother.myidp3.firstField'
    ];
    const currentKey = 'something.else';
    const currentFieldIndex = 1;
    const parsingCallbacks = {};

    const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);

    // Expect empty object
    test.assertEquals(0, Object.keys(result).length);
}

exports.test_configFile_getFileConfigSubTree_emptyConfig = () => {
    setMockConfig({});

    const allConfigKeys = [];
    const currentKey = '';
    const currentFieldIndex = 1;
    const parsingCallbacks = {};

    const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);

    // Expect empty object
    test.assertEquals(0, Object.keys(result).length);
}


exports.test_configFile_getFileConfigSubTree_errAmbiguous1 = () => {

    setMockConfig({
        irrelevant1: "yes",

        'something.target.subkey': 'eclipsedValue',
        'something.target': 'overlaps with .subkey',

        irrelevant2: "yes",
    });

    const allConfigKeys = [
        'irrelevant1',
        'irrelevant2',
        'something.target.subkey',
        'something.target'
    ];
    const currentKey = 'something.target';
    const currentFieldIndex = 1;
    const parsingCallbacks = {};

    let failed = false;

    try {
        const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);
        log.error("Unexpected result: " + JSON.stringify(result));
    } catch (e) {
        failed = true;
    }

    // Expect an error since something.target has both a direct value and a subkey
    test.assertTrue(failed);
}

exports.test_configFile_getFileConfigSubTree_errAmbiguous2 = () => {

    setMockConfig({
        irrelevant1: "yes",

        'something.target': 'overlaps with .subkey',
        'something.target.subkey': 'eclipsedValue',

        irrelevant2: "yes",
    });

    const allConfigKeys = [
        'irrelevant1',
        'irrelevant2',
        'something.target',
        'something.target.subkey'
    ];
    const currentKey = 'something.target';
    const currentFieldIndex = 1;
    const parsingCallbacks = {};

    let failed = false;

    try {
        const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);
        log.error("Unexpected result: " + JSON.stringify(result));
    } catch (e) {
        failed = true;
    }

    // Expect an error since something.target has both a direct value and a subkey
    test.assertTrue(failed);
}


exports.test_configFile_getFileConfigSubTree_errBadKey = () => {

    setMockConfig({
        irrelevant1: "yes",

        'something.target.': 'targetValue',  // Key ends with dot

        irrelevant2: "yes",
    });

    const allConfigKeys = [
        'irrelevant1',
        'irrelevant2',
        'something.target.'
    ];
    const currentKey = 'something.target';
    const currentFieldIndex = 1;
    const parsingCallbacks = {};

    let failed = false;

    try {
        const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);
        log.error("Unexpected result: " + JSON.stringify(result));
    } catch (e) {
        failed = true;
    }

    // Expect an error since something.target has both a direct value and a subkey
    test.assertTrue(failed);
}


exports.test_configFile_getFileConfigSubTree_parsingCallback = () => {

    setMockConfig({
        irrelephant: "yes",
        'something.target.subkey': 'targetValue',  // <-- Target and parse/change this value
    });

    const allConfigKeys = [
        'irrelephant',
        'something.target.subkey'
    ];
    const currentKey = 'something.target';
    const currentFieldIndex = 1;
    const parsingCallbacks = {
        '^something\.[a-zA-Z]+\.subkey$': (value) => `${value} is ${value}.`
    };

    const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);
    test.assertEquals(1, Object.keys(result).length);
    test.assertEquals('targetValue is targetValue.', result.subkey);
}


exports.test_configFile_getFileConfigSubTree_onlySpecificCallback = () => {

    setMockConfig({
        irrelephant: "yes",
        'something.target.subkey': 'targetValue',  // <-- Target and parse/change this value
    });

    const allConfigKeys = [
        'irrelephant',
        'something.target.subkey'
    ];
    const currentKey = 'something.target';
    const currentFieldIndex = 1;
    const parsingCallbacks = {
        // Shouldn't kick here in since it applies only to something.target, not a subkey:
        '^something\.[a-zA-Z]+$': (value) => `${value} is ${value}.`
    };

    const result = lib.getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks);
    test.assertEquals(1, Object.keys(result).length);
    test.assertEquals('targetValue', result.subkey);
}




////////////////////////////////////

exports.test_configFile_getConfigForIdProvider_getMatchingConfigObject = () => {

    setMockConfig({
        autoinit: true,

        // Target 'idprovider.target' and everything below it
        'idprovider.target.firstkey': 'targetValue1',
        'idprovider.target.secondkey.one': 'targetValue2.1',
        'idprovider.target.secondkey.two.one': 'targetValue2.2.1',
        'idprovider.target.secondkey.two.two': 'targetValue2.2.2',
        'idprovider.target.secondkey.three': 'targetValue2.3',
        'idprovider.target.thirdkey': 'targetValue3',

        // Ignore 'idprovider.another' and everything below it
        'idprovider.another.firstkey': 'ANOTHER1',
        'idprovider.another.secondkey.one': 'ANOTHER2.1',
        'idprovider.another.secondkey.two.one': 'ANOTHER2.2.1',
        'idprovider.another.secondkey.two.two': 'ANOTHER2.2.2',
        'idprovider.another.secondkey.three': 'ANOTHER2.3',
        'idprovider.another.thirdkey': 'ANOTHER3',

        // Ignore *.target outside of the 'idprovider' namespace
        'no.target.firstkey': 'NOTARGET1',
        'no.target.secondkey.one': 'NOTARGET2.1',
        'no.target.secondkey.two.one': 'NOTARGET2.2.1',
        'no.target.secondkey.two.two': 'NOTARGET2.2.2',
        'no.target.secondkey.three': 'NOTARGET2.3',
        'no.target.thirdkey': 'NOTARGET3',
    });

    const result = lib.getConfigForIdProvider('target');

    // Expected: a tree object
    test.assertEquals(3, Object.keys(result).length);
    test.assertEquals(3, Object.keys(result.secondkey).length);
    test.assertEquals(2, Object.keys(result.secondkey.two).length);
    test.assertEquals('targetValue1', result.firstkey);
    test.assertEquals('targetValue2.1', result.secondkey.one);
    test.assertEquals('targetValue2.2.1', result.secondkey.two.one);
    test.assertEquals('targetValue2.2.2', result.secondkey.two.two);
    test.assertEquals('targetValue2.3', result.secondkey.three);
    test.assertEquals('targetValue3', result.thirdkey);
}

exports.test_configFile_getConfigForIdProvider_getNullOnNomatch = () => {

    setMockConfig({
        autoinit: true,

        // Ingore all keys since they don't match 'nonexistingtarget':
        'idprovider.target.firstkey': 'targetValue1',
        'idprovider.target.secondkey.one': 'targetValue2.1',
        'idprovider.target.secondkey.two.one': 'targetValue2.2.1',
        'idprovider.target.secondkey.two.two': 'targetValue2.2.2',
        'idprovider.target.secondkey.three': 'targetValue2.3',
        'idprovider.target.thirdkey': 'targetValue3',

        'idprovider.another.firstkey': 'ANOTHER1',
        'idprovider.another.secondkey.one': 'ANOTHER2.1',
        'idprovider.another.secondkey.two.one': 'ANOTHER2.2.1',
        'idprovider.another.secondkey.two.two': 'ANOTHER2.2.2',
        'idprovider.another.secondkey.three': 'ANOTHER2.3',
        'idprovider.another.thirdkey': 'ANOTHER3',

        'no.target.firstkey': 'NOTARGET1',
        'no.target.secondkey.one': 'NOTARGET2.1',
        'no.target.secondkey.two.one': 'NOTARGET2.2.1',
        'no.target.secondkey.two.two': 'NOTARGET2.2.2',
        'no.target.secondkey.three': 'NOTARGET2.3',
        'no.target.thirdkey': 'NOTARGET3',
    });

    const result = lib.getConfigForIdProvider('nonexistingtarget');

    // Expected: null when target idprovider was not found
    test.assertEquals(null, result);
}
