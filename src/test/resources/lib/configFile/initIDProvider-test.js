const lib = require('./initIDProvider');
const test = require('/lib/xp/testing');

exports.test_initIDProvider_recognizesGenericKey_Defaultgroups = () => {
    const CREATED_IDPS = [];

    test.mock("/lib/configFile/configFile.js", {
        getAllIdProviderNames: () => ["myidp1", "myidp2", "myidp3", , "myidp4"],
        shouldAutoInit: () => true,
        getConfigForIdProvider: () => ({
            displayName: "MockName",
            description: "Mock description",
        })
    });

    test.mock("/lib/configFile/services/bean.js", {
        getIdProviders: () => ["myidp1", "myidp2"],
        createIdProvider: (params) => {
            CREATED_IDPS.push(params);
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

};


