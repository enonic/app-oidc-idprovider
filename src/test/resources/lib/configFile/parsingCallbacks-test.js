var lib = require('./parsingCallbacks');
var test = require('/lib/xp/testing');



/////////////////////////////////////////

exports.test_parsingCallbacks_recognizesGenericKey_Defaultgroups = () => {
    const relevantField = 'defaultGroups';

    const testIdProviderNames = [
        'idp1',
        'idp2',
        'my_test_provider',
        'my-test-provider'
    ]

    const relevantFieldPicker = new RegExp(`.${relevantField}\\\$\$`, 'g');

    const patterns = Object.keys(lib.PARSING_CALLBACKS).filter( key => key.search(relevantFieldPicker) > -1 );
    test.assertEquals(patterns.length, 1, "Expected only one parsing callback pattern for *." + relevantField);
    const patternRx = new RegExp(patterns[0]);

    testIdProviderNames.forEach( name => {
        const cfgField = `idprovider.${name}.${relevantField}`;
        test.assertTrue(patternRx.test(cfgField), `The pattern (${patternRx}) should have recognized '${cfgField}'`);
    });
}
exports.test_parsingCallbacks_recognizesGenericKey_Scopes = () => {
    const relevantField = 'scopes';

    const testIdProviderNames = [
        'idp1',
        'idp2',
        'my_test_provider',
        'my-test-provider'
    ]

    const relevantFieldPicker = new RegExp(`.${relevantField}\\\$\$`, 'g');

    const patterns = Object.keys(lib.PARSING_CALLBACKS).filter( key => key.search(relevantFieldPicker) > -1 );
    test.assertEquals(patterns.length, 1, "Expected only one parsing callback pattern for *." + relevantField);
    const patternRx = new RegExp(patterns[0]);

    testIdProviderNames.forEach( name => {
        const cfgField = `idprovider.${name}.${relevantField}`;
        test.assertTrue(patternRx.test(cfgField), `The pattern (${patternRx}) should have recognized '${cfgField}'`);
    });
}
exports.test_parsingCallbacks_recognizesGenericKey_DisplayName = () => {
    const relevantField = 'mappings.displayName';

    const testIdProviderNames = [
        'idp1',
        'idp2',
        'my_test_provider',
        'my-test-provider'
    ]

    const relevantFieldPicker = new RegExp(`.${relevantField}\\\$\$`, 'g');

    const patterns = Object.keys(lib.PARSING_CALLBACKS).filter( key => key.search(relevantFieldPicker) > -1 );
    test.assertEquals(patterns.length, 1, "Expected only one parsing callback pattern for *." + relevantField);
    const patternRx = new RegExp(patterns[0]);

    testIdProviderNames.forEach( name => {
        const cfgField = `idprovider.${name}.${relevantField}`;
        test.assertTrue(patternRx.test(cfgField), `The pattern (${patternRx}) should have recognized '${cfgField}'`);
    });
}
exports.test_parsingCallbacks_recognizesGenericKey_Email = () => {
    const relevantField = 'mappings.email';

    const testIdProviderNames = [
        'idp1',
        'idp2',
        'my_test_provider',
        'my-test-provider'
    ]

    const relevantFieldPicker = new RegExp(`.${relevantField}\\\$\$`, 'g');

    const patterns = Object.keys(lib.PARSING_CALLBACKS).filter( key => key.search(relevantFieldPicker) > -1 );
    test.assertEquals(patterns.length, 1, "Expected only one parsing callback pattern for *." + relevantField);
    const patternRx = new RegExp(patterns[0]);

    testIdProviderNames.forEach( name => {
        const cfgField = `idprovider.${name}.${relevantField}`;
        test.assertTrue(patternRx.test(cfgField), `The pattern (${patternRx}) should have recognized '${cfgField}'`);
    });
}


exports.test_parsingCallbacks_ignoresOtherKeys = () => {
    const _includedNamespace = 'idprovider';
    const ignoredNamespace = 'autoinit';

    const _acceptableProviderName = 'idp1'
    const unacceptableProviderName = 'id.p1'

    const _includedField = 'defaultGroups';
    const ignoredField = 'somethingElse';

    const assertNotRecognized = (nameSpace, providerName, field, patternRx) => {
        const fullKey = `${nameSpace}.${providerName}.${field}`;
        test.assertFalse(patternRx.test(fullKey), `The pattern (${patternRx}) should not have recognized '${fullKey}'`);
    }

    const patternKeys = Object.keys(lib.PARSING_CALLBACKS);
    patternKeys.forEach( patternKey => {
        const patternRx = new RegExp(patternKey);

        assertNotRecognized(_includedNamespace, _acceptableProviderName, ignoredField, patternRx);
        assertNotRecognized(_includedNamespace, unacceptableProviderName, _includedField, patternRx);
        assertNotRecognized(ignoredNamespace, _acceptableProviderName, _includedField, patternRx);
    })
}



///////////////////////////////

exports.test_parsingCallbacks_parseStringArray_parsesStringArray = () => {

    const parseAndVerify = jsonString => {
        const parsed = lib.parseStringArray(jsonString);
        test.assertEquals(parsed[0], "a", `parseStringArray should have parsed '${jsonString}' to ["a","b","c"], but instead parsed it to ${JSON.stringify(parsed)}`);
        test.assertEquals(parsed[1], "b", `parseStringArray should have parsed '${jsonString}' to ["a","b","c"], but instead parsed it to ${JSON.stringify(parsed)}`);
        test.assertEquals(parsed[2], "c", `parseStringArray should have parsed '${jsonString}' to ["a","b","c"], but instead parsed it to ${JSON.stringify(parsed)}`);
    };

    parseAndVerify(`["a", "b", "c"]`);
    parseAndVerify(`  ["a", "b", "c"]`);
    parseAndVerify(`["a", "b", "c"]  `);
    parseAndVerify(`[  "a", "b", "c"]`);
    parseAndVerify(`["a"  , "b", "c"]`);
}

exports.test_parsingCallbacks_parseStringArray_parsesFalsyToEmptyArray = () => {

    const parseAndVerifyEmpty = jsonString => {
        const parsed = lib.parseStringArray(jsonString);
        test.assertTrue(Array.isArray(parsed) && parsed.length===0, `parseStringArray should have parsed '${jsonString}' to an empty array , but instead parsed it to ${JSON.stringify(parsed)}`);
    };

    parseAndVerifyEmpty(null);
    parseAndVerifyEmpty('');
    parseAndVerifyEmpty('null');
    parseAndVerifyEmpty('""');
}

exports.test_parsingCallbacks_parseStringArray_failsOnBadJSON = () => {

    const parseAndFail = jsonString => {
        let failed = false;
        let parsed;
        try {
            parsed = lib.parseStringArray(jsonString);
        } catch (e) {
            failed = true;
        }

        test.assertTrue(failed, `parseStringArray shouldn't have been able to json-parse '${jsonString}', but parsed it to: ${JSON.stringify(parsed)}`);
    };

    parseAndFail(`Blablabla`);
    parseAndFail(`{"a", "b", "c"]`);
    parseAndFail(`["a", "b", "c"}`);
}

exports.test_parsingCallbacks_parseStringArray_failsOnNonArray = () => {

    const parseAndFail = jsonString => {
        let failed = false;
        let parsed;
        try {
            parsed = lib.parseStringArray(jsonString);
        } catch (e) {
            failed = true;
        }

        test.assertTrue(failed, `parseStringArray should have failed on the non-array JSON '${jsonString}', but parsed it to: ${JSON.stringify(parsed)}`);
    };

    parseAndFail(`"Blablabla"`);
    parseAndFail(`{"bla":"a", "blabla": "b", "blablabla": "c"}`);
    parseAndFail(`"   "`);
}

exports.test_parsingCallbacks_parseStringArray_failsOnNonStringItem = () => {
    const parseAndFail = jsonString => {
        let failed = false;
        let parsed;
        try {
            parsed = lib.parseStringArray(jsonString);
        } catch (e) {
            failed = true;
        }

        test.assertTrue(failed, `parseStringArray should have failed on a non-string array item in '${jsonString}', but parsed it to: ${JSON.stringify(parsed)}`);
    };

    parseAndFail(`[1, 2, 3]`);
    parseAndFail(`[null, null]`);
    parseAndFail(`[["a", "b", "c"]]`);
    parseAndFail(`[{}, "bla"]`);
}



///////////////////////////////

exports.test_parsingCallbacks_firstAtsToDollar_replacesFirstTwoAtsWithDollar = () => {
    test.assertEquals(lib.firstAtsToDollar("@@{hey}"), "${hey}")
}

exports.test_parsingCallbacks_firstAtsToDollar_leavesNoAtStringsAlone = () => {
    test.assertEquals(lib.firstAtsToDollar("hey"), "hey")
    test.assertEquals(lib.firstAtsToDollar(""), "")
    test.assertEquals(lib.firstAtsToDollar("${hey}"), "${hey}")
}

exports.test_parsingCallbacks_firstAtsToDollar_leavesSingleAtStringsAlone = () => {
    test.assertEquals(lib.firstAtsToDollar("@{hey}"), "@{hey}")
    test.assertEquals(lib.firstAtsToDollar("email@domain.com"), "email@domain.com")
}

exports.test_parsingCallbacks_firstAtsToDollar_changesOnlyAtsBeforeCurlybrace = () => {
    test.assertEquals(lib.firstAtsToDollar("@@hey"), "@@hey")
    test.assertEquals(lib.firstAtsToDollar("email@@domain.com"), "email@@domain.com")
}

