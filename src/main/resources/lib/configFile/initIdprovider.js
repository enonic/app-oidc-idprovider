// Based on app-simple-idprovider

const configFile = require("/lib/configFile/configFile");

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
    var bean = __.newBean('com.enonic.app.oidcidprovider.lib.configFile.CreateIdProviderHandler');

    bean.name = required(params, 'name');
    bean.displayName = nullOrValue(params.displayName);
    bean.description = nullOrValue(params.description);
    bean.idProviderConfig = __.toScriptValue(params.idProviderConfig);
    bean.permissions = __.toScriptValue(params.permissions);

    return __.toNativeObject(bean.createIdProvider());
};

/**
 * Returns the list of all the id providers.
 *
 * @returns {object[]} Array of id providers.
 */
function getIdProviders() {
    var bean = __.newBean('com.enonic.app.oidcidprovider.lib.configFile.GetIdProvidersHandler');
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
    const configedIdProviderNames = configFile.getAllIdProviderNames();

    configedIdProviderNames.forEach(idProviderName => {

        if (
            configFile.shouldAutoInit() &&
            !exists(systemIdProviders, idProviderName)
        ) {
            log.info(`Autoinit: creating userstore '${idProviderName}'...`);

            const config = configFile.getConfigForIdProvider(idProviderName);
            const displayName = config.displayName || idProviderName;
            const description = config.description || `${configFile.CONFIG_NAMESPACE}.${idProviderName} in ${app.config["config.filename"]}`;

            const result = createIdProvider({
                name: idProviderName,
                displayName: displayName,
                descripton: description,
                idProviderConfig: {
                    descripton: description,
                    applicationKey: app.name,
                    config: [], // Skipping the node-level config entirely; we're going to use the .cfg anyway (although this causes invalid config fields when viewing it in the user manager)
                },
                permissions: [],
            });

            if (result) {
                log.info(`Autoinit: success, created userstore: ${JSON.stringify({
                    name: idProviderName,
                    displayName,
                    description
                })}`);

            } else {
                log.warning(`Autoinit: something went wrong trying to create userstore '${idProviderName}'.`);
                log.debug("createIdProvider result:");
                log.debug(result);
            }
        }
    });
}
