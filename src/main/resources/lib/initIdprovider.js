// Based on app-simple-idprovider

// TODO: appDisplayName from gradle.properties?
const DEFAULT_DESCRIPTION = "OIDC ID Provider"

const configFile = require("/lib/configFile");

function required(params, name) {
    var value = params[name];
    if (value === undefined) {
        throw "Parameter '" + name + "' is required";
    }
    return value;
}

function nullOrValue(value) {
    return value == null ? null : value;
}

/**
 * Creates an id provider.
 *
 * @param {string} name Id provider name.
 * @param {string} [params.displayName] Id provider display name.
 * @param {string} [params.description] Id provider  description.
 * @param {object} [params.idProviderConfig] ID Provider configuration.
 * @param {object} [params.permissions] Id provider permissions.
 */
function createIdProvider(params) {
    var bean = __.newBean('com.enonic.app.oidcidprovider.lib.auth.CreateIdProviderHandler');

    bean.name = required(params, 'name');
    bean.displayName = nullOrValue(params.displayName);
    bean.description = nullOrValue(params.description);
    bean.idProviderConfig = __.toScriptValue(params.idProviderConfig);
    bean.permissions = __.toScriptValue(params.permissions);

    var idProviderConfig = __.toNativeObject(bean.idProviderConfig);
																														log.info("idProviderConfig (" +
																															(Array.isArray(idProviderConfig) ?
																																("array[" + idProviderConfig.length + "]") :
																																(typeof idProviderConfig + (idProviderConfig && typeof idProviderConfig === 'object' ? (" with keys: " + JSON.stringify(Object.keys(idProviderConfig))) : ""))
																															) + "): " + JSON.stringify(idProviderConfig, null, 2)
																														);
    return true;
    //return __.toNativeObject(bean.createIdProvider());
};

/**
 * Returns the list of all the id providers.
 *
 * @returns {object[]} Array of id providers.
 */
function getIdProviders() {
    var bean = __.newBean('com.enonic.app.oidcidprovider.lib.auth.GetIdProvidersHandler');
    return __.toNativeObject(bean.getIdProviders());
};




/**
 * Check all idproviders by name
 *
 * @param {Array} providers
 * @returns {Boolean} true if exists, false if not
 */
function exists(providers, name) {
    for (const count in providers) {
        const provider = providers[count];
        if (provider && provider.key === name) {
            log.info(`Userstore '${name}' already exists - no autoinit.`);
            return true;
        }
    }
    log.info(`Userstore '${name}' doesn't exist yet. Will try autoinit.`);
    return false;
}


exports.initUserStores = function() {
    const systemIdProviders = getIdProviders();
																														log.info("Existing systemIdProviders (" +
																															(Array.isArray(systemIdProviders) ?
																																("array[" + systemIdProviders.length + "]") :
																																(typeof systemIdProviders + (systemIdProviders && typeof systemIdProviders === 'object' ? (" with keys: " + JSON.stringify(Object.keys(systemIdProviders))) : ""))
																															) + "): " + JSON.stringify(systemIdProviders, null, 2)
																														);
    const configedIdProviderNames = configFile.getAllIdProviderNames();
                                                                                                                        log.info("File config'd IdProviderNames (" +
																															(Array.isArray(configedIdProviderNames) ?
																																("array[" + configedIdProviderNames.length + "]") :
																																(typeof configedIdProviderNames + (configedIdProviderNames && typeof configedIdProviderNames === 'object' ? (" with keys: " + JSON.stringify(Object.keys(configedIdProviderNames))) : ""))
																															) + "): " + JSON.stringify(configedIdProviderNames, null, 2)
																														);

    configedIdProviderNames.forEach(idProviderName => {
        if (configFile.shouldAutoInit(idProviderName)) {
            if (!exists(systemIdProviders, idProviderName)) {
                                                                                                                        log.info("'" + idProviderName + "' noExist. SHOULD create idprovider userstore from: app (" +
                                                                                                                            (Array.isArray(app) ?
                                                                                                                                    ("array[" + app.length + "]") :
                                                                                                                                    (typeof app + (app && typeof app === 'object' ? (" with keys: " + JSON.stringify(Object.keys(app))) : ""))
                                                                                                                            ) + "): " + JSON.stringify(app, null, 2)
                                                                                                                        );
                const config = configFile.getConfigForIdProvider(idProviderName);
                const displayName = config.displayName || idProviderName;
                const description = config.description || `${DEFAULT_DESCRIPTION} ('${idProviderName}' with autoinit in ${app.config["config.filename"]})`;

                const result = createIdProvider({
                    name: idProviderName,
                    displayName,
                    descripton: description,
                    idProviderConfig: {
                        applicationKey: app.name,
                        config: config,
                    },
                    permissions: [],
                });

                if (result) {
                    log.info(`Created userstore: ${JSON.stringify({name: idProviderName, displayName, description})}`);
                }
            }
        }
    });
}
