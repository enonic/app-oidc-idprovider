const lib = require('./initIDProvider');
const test = require('/lib/xp/testing');

exports.test_initIDProvider_initUserStores_addOnlyNewIDPs_ifShouldAutoInit = () => {
    const CREATED_IDPS = {};
    let addedProviders = 0;

    test.mock("/lib/configFile/configFile.js", {
        getAllIdProviderNames: () => ["myidp1", "myidp2", "myidp3", , "myidp4"],
        shouldAutoInit: () => true,
        getConfigForIdProvider: (idProviderName) => ({
            displayName: "Mock " + idProviderName,
            description: "Mock description",
        })
    });

    test.mock("/lib/configFile/services/bean.js", {
        getIdProviders: () => ["myidp1", "myidp2"],
        createIdProvider: (params) => {
            CREATED_IDPS[params.name] = params;
            addedProviders++;
            return true;
        }
    });

    lib.initUserStores();
																														log.info("CREATED_IDPS (" +
																															(Array.isArray(CREATED_IDPS) ?
																																("array[" + CREATED_IDPS.length + "]") :
																																(typeof CREATED_IDPS + (CREATED_IDPS && typeof CREATED_IDPS === 'object' ? (" with keys: " + JSON.stringify(Object.keys(CREATED_IDPS))) : ""))
																															) + "): " + JSON.stringify(CREATED_IDPS, null, 2)
																														);
    // Only myidp3 and -4 should have been added, since myidp1 and -2 are already in system repo,
    // according to the mocked getIdProviders:

    test.assertEquals(addedProviders, 2);

    test.assertEquals(test['myidp1'], undefined);
    test.assertEquals(test['myidp2'], undefined);

    test.assertEquals(test['myidp3'].name, "Mock myidp3");
    test.assertEquals(test['myidp3'].idProviderConfig.applicationKey, app.name);
    test.assertEquals(test['myidp3'].permissions, []);

    test.assertEquals(test['myidp4'].name, "Mock myidp4");
    test.assertEquals(test['myidp4'].idProviderConfig.applicationKey, app.name);
    test.assertEquals(test['myidp4'].permissions, []);
};

exports.test_initIDProvider_initUserStores_addNoNewIDPs_ifNoAutoInit = () => {
    const CREATED_IDPS = {};
    let addedProviders = 0;

    test.mock("/lib/configFile/configFile.js", {

        // The important difference:
        shouldAutoInit: () => false,

        getAllIdProviderNames: () => ["myidp1", "myidp2", "myidp3", , "myidp4"],
        getConfigForIdProvider: (idProviderName) => ({
            displayName: "Mock " + idProviderName,
            description: "Mock description",
        })
    });

    test.mock("/lib/configFile/services/bean.js", {
        getIdProviders: () => ["myidp1", "myidp2"],
        createIdProvider: (params) => {
            CREATED_IDPS[params.name] = params;
            addedProviders++;
            return true;
        }
    });

    lib.initUserStores();
    log.info("CREATED_IDPS (" +
        (Array.isArray(CREATED_IDPS) ?
                ("array[" + CREATED_IDPS.length + "]") :
                (typeof CREATED_IDPS + (CREATED_IDPS && typeof CREATED_IDPS === 'object' ? (" with keys: " + JSON.stringify(Object.keys(CREATED_IDPS))) : ""))
        ) + "): " + JSON.stringify(CREATED_IDPS, null, 2)
    );

    //  myidp1 and -2 are already in system repo,
    // but shouldAutoInit = false (mocked):

    test.assertEquals(addedProviders, 0);

    test.assertEquals(test['myidp1'], undefined);
    test.assertEquals(test['myidp2'], undefined);
    test.assertEquals(test['myidp3'], undefined);
    test.assertEquals(test['myidp4'], undefined);
};


