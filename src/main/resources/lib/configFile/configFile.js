const getConfigService = require('/lib/configFile/services/getConfig.js');
const configIdProvider = require('/lib/configFile/configProvider');

const AUTOINIT = "autoinit"

// Expected format in this app's .cfg file, for separately configuring multiple idproviders: idprovider.<name>.<field>[.optional][.subfields][.etc...]
// For example, an idprovider named "myidp", with a configuration tree { mySetting1: "false", mySetting2: { nextLevel: true } }:
//
// idprovider.myidp.mySetting1=false
// idprovider.myidp.mySetting2.nextLevel=true
//
const CONFIG_NAMESPACE = "idprovider";
exports.CONFIG_NAMESPACE = CONFIG_NAMESPACE;


// Prevent flooding of state logs, only log message on state change
let alreadyLogged = null;
const KIND_FILE = "_file_";
const KIND_NODE = "_node_";
function logStateOnce(messageKind, message) {
    if (alreadyLogged !== messageKind) {
        log.info(message);
        alreadyLogged = messageKind;
    }
}


/** Read out and return config from this-app.cfg that apply to the relevant id provider key.
 *  That is, the config keys are dot-separated,
 *      the first field must be "idprovider" (aka CONFIG_NAMESPACE),
 *      the second is the id provider (eg. "myidp"),
 *      and deeper fields in the key are EITHER single-value nodes (eg. 'idprovider.myidp.method=post')
 *      OR nested tree structures (eg. below "mappings":
 *          idprovider.myidp.mappings.displayName=${userinfo.preferred_username}
 *          idprovider.myidp.mappings.email=${userinfo.email}
 *
 *  @param idProviderName {string} - Name of ID provider, eg. "myidp"
 *
 *  @returns An object where the keys are the second subfield from well-formed configs, eg. { authorizationUrl: 'http://something', clientSecret: 'vs12jn56bn2ai4sjf' }, etc
 *  On invalid keys/datastructures, error is logged and null is returned. If no valid keys are found, returns null.
 *  A returned null is expected make the config fall back to old node-stored config, entirely skipping the file .cfg for the current idprovider name.
 */
exports.getConfigForIdProvider = function (idProviderName) {
    const idProviderKeyBase = `${CONFIG_NAMESPACE}.${idProviderName}`;

    try {
        const config = configIdProvider.getIdProviderConfig(idProviderName);

        if (Object.keys(config).length) {
            logStateOnce(KIND_FILE, `Found config for '${idProviderKeyBase}' in ${app.name}.cfg. Using that instead of node-stored config from authLib.`);
            return config;

        } else {
            logStateOnce(KIND_NODE, `No config for '${idProviderKeyBase}' was found in ${app.name}.cfg. Using old node-stored config from authLib.`);
        }
    } catch (e) {
        log.warning(`Error trying to parse keys below '${idProviderKeyBase}' in config file (${app.name}.cfg). Falling back to possible node-stored config from authLib. Reason: ${e.message}`);
    }

    return {};
}



/**
 *  Returns an array of idprovider names found in the .cfg file under the 'idprovider.<name>' namespace
 */
exports.getAllIdProviderNames = function () {
    const names = [];

    Object.keys(getConfigService.getConfigOrEmpty()).forEach(key => {
        const fields = key.split('.');
        if (
            fields.length > 1 &&
            fields[0] === CONFIG_NAMESPACE
        ) {
            const name = (fields[1] || "").trim();
            if (
                name.length &&
                names.indexOf(name) === -1
            ) {
                names.push(name);
            }
        }
    });

    return names;
}



/**
 * Returns true or false: should the idProvider auto-initialize?
 * Currently, only autoinit=true is used.
 */
exports.shouldAutoInit = function () {
    const autoInit = getConfigService.getConfigOrEmpty()[AUTOINIT];
    return autoInit === true || autoInit === "true";
}
