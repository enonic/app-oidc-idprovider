const portalLib = require('/lib/xp/portal');

// Expected format in this app's .cfg file:
// eg. for an idprovider named "myidp", with a configuration tree { setting1: "hey", setting2: { nextLevel: true } }:
//
// idprovider.myidp.setting1=hey
// idprovider.myidp.setting2.nextLevel=true
//
const CONFIG_NAMESPACE = "idprovider"


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
function getIdProviderConfigFromFile() {
    const idProviderName = portalLib.getIdProviderKey();
    const idProviderKeyBase = `${CONFIG_NAMESPACE}.${idProviderName}`;
    const rawConfigKeys = Object.keys(app.config || {}).filter( k =>
        k && (k.startsWith(idProviderKeyBase))
    );

    if (!rawConfigKeys || !rawConfigKeys.length) {
        log.info(`Found config for the '${idProviderKeyBase}' ID provider in ${app.name}.cfg. Using that instead of node-stored config from authLib.`);
    }

    try {
        const config = getFileConfigSubTree(rawConfigKeys, idProviderKeyBase, 1);
        if (Object.keys(config).length) {
            log.info(`Found config for '${idProviderKeyBase}' in ${app.name}.cfg. Using that instead of node-stored config from authLib.`);
            return config;

        } else {
            log.info(`No config for '${idProviderKeyBase}' was found in ${app.name}.cfg. Using old node-stored config from authLib.`);
        }

    } catch (e) {
        log.warning(`Error trying to parse keys below '${idProviderKeyBase}' in config file (${app.name}.cfg). Falling back to possible node-stored config from authLib. Reason: ${e.message}`);
    }

    return null;
}



exports.getIdProviderConfig = getIdProviderConfigFromFile;
