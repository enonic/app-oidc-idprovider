const AUTOINIT="autoinit"

// Expected format in this app's .cfg file, for separately configuring multiple idproviders: idprovider.<name>.<field>[.optional][.subfields][.etc...]
// For example, an idprovider named "myidp", with a configuration tree { mySetting1: "false", mySetting2: { nextLevel: true } }:
//
// idprovider.myidp.mySetting1=false
// idprovider.myidp.mySetting2.nextLevel=true
//
const CONFIG_NAMESPACE = "idprovider";
exports.CONFIG_NAMESPACE = CONFIG_NAMESPACE;



// TODO: Redundant? Duplicates appear to be silently skipped when .cfg is read?
function checkForKeyDuplicate(targetKey, seenKeys) {
    if (seenKeys.indexOf(targetKey) === -1) {
        seenKeys.push(targetKey);

    } else {
        throw Error(`Ambiguity in ${app.name}.cfg: the key '${targetKey}' is duplicated.`);
    }
}


// For example, looking for "idprovider.myidp.mykey" and all keys that may or may not be below it (eg. "idprovider.myidp.mykey.subkey" and "idprovider.myidp.mykey.another", etc),
// allConfigKeys is an array of all keys,
// currentKey is "idprovider.myidp.mykey",
// and currentKeyIndex points to the current specific field in the key, "mykey", so that is 2 ("mykey" is the third field in the array of the key's fields).
function getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, subTree={}) {
    // Eg. "idprovider.myidp.mykey." (trailing dot)
    const currentBaseDot = `${currentKey}.`;

    let exactConfigKey=null
    const deeperSubKeys=[]
    const seenKeys=[];

    // Distribute relevant keys (starting with currentKey) to either an exact match or a list of subkeys to parse into a subtree (deeperSubKeys) - while error checking for invalid data structures.
    allConfigKeys.forEach( (k) => {
        const key = k.trim();

        if (key === currentKey) {
            checkForKeyDuplicate(key, seenKeys);
            // If at least one subtree key has already been seen: invalid
            if (deeperSubKeys.length) {
                throw Error(`Ambiguity in ${app.name}.cfg: the key '${currentKey}' can't both have a direct value and subfields (a tree) below it ('${deeperSubKeys[0]}' etc).`);
            }
            exactConfigKey = key;

        } else if (key.startsWith(currentBaseDot)) {
            checkForKeyDuplicate(key, seenKeys);
            // If an exact match with a direct value has already been seen: invalid
            if (exactConfigKey) {
                throw Error(`Ambiguity in ${app.name}.cfg: the key '${exactConfigKey}' can't both have a direct value and subfields (a tree) below it ('${key}' etc).`);
            }
            // Eg. "idprovider.myidp.mykey." with nothing after the final dot would be an invalid key.
            if (key === currentBaseDot) {
                throw Error(`Malformed key in ${app.name}.cfg: '${key}'`);

            } else {
                deeperSubKeys.push(key);
            }
        }
    });

    // Only one key; the exact one. So return the value - JSON parsed if possible.
    if (exactConfigKey) {
        const value = app.config[exactConfigKey];
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    }

    // More than one key but no duplicates so far? Parse it recursively into a subtree and return that.
    const nextFieldIndex = currentFieldIndex + 1;
    deeperSubKeys.forEach(key => {
        const fields=key.split('.');
        const currentField=fields[nextFieldIndex].trim();
        if (!currentField.length) {
            throw Error(`Malformed key in ${app.name}.cfg: '${key}'`);
        }
        subTree[currentField] = getFileConfigSubTree(deeperSubKeys, currentBaseDot+currentField, nextFieldIndex);
    });

    return subTree;
}


// Prevent flooding of state logs, only log message on state change
let alreadyLogged = null;
const KIND_FILE="using_file";
const KIND_NODE="using_node";
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
 *  Returns an object where the keys are the second subfield from well-formed configs, eg. { authorizationUrl: 'http://something', clientSecret: 'vs12jn56bn2ai4sjf' }, etc
 *  On invalid keys/datastructures, error is logged and null is returned. If no valid keys are found, returns null.
 *  A returned null is expected make the config fall back to old node-stored config, entirely skipping the file .cfg for the current idprovider name.
 */
exports.getConfigForIdProvider = function(idProviderName) {
    const idProviderKeyBase = `${CONFIG_NAMESPACE}.${idProviderName}`;

    const rawConfigKeys = Object.keys(app.config || {}).filter( k =>
        k && (k.startsWith(idProviderKeyBase))
    );

    if (!rawConfigKeys || !rawConfigKeys.length) {
        logStateOnce(KIND_FILE, `Found config for the '${idProviderKeyBase}' ID provider in ${app.name}.cfg. Using that instead of node-stored config from authLib.`);
    }

    try {
        const config = getFileConfigSubTree(rawConfigKeys, idProviderKeyBase, 1);

        if (Object.keys(config).length) {
            logStateOnce(KIND_FILE, `Found config for '${idProviderKeyBase}' in ${app.name}.cfg. Using that instead of node-stored config from authLib.`);
            return config;

        } else {
            logStateOnce(KIND_NODE, `No config for '${idProviderKeyBase}' was found in ${app.name}.cfg. Using old node-stored config from authLib.`);
        }

    } catch (e) {
        log.warning(`Error trying to parse keys below '${idProviderKeyBase}' in config file (${app.name}.cfg). Falling back to possible node-stored config from authLib. Reason: ${e.message}`);
    }

    return null;
}



/**
 *  Returns an array of idprovider names found in the .cfg file under the 'idprovider.<name>' namespace
 */
exports.getAllIdProviderNames = function() {
    const names = [];

    Object.keys(app.config || {}).forEach( key => {
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
 * TODO: Consider finer granularity for overriding particular ID provider (userstore) names, eg. autoinit.oicd=false or autoinit=["oicd", ...] etc? If so, use the idProviderName arg to match for subfields or array values
 */
exports.shouldAutoInit = function(idProviderName) {
    const autoInit = (app.config || {})[AUTOINIT];
    return autoInit === true || autoInit === "true";
}
