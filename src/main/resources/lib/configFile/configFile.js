const parsingLib = require('/lib/configFile/parsingCallbacks');

const AUTOINIT="autoinit"

// Expected format in this app's .cfg file, for separately configuring multiple idproviders: idprovider.<name>.<field>[.optional][.subfields][.etc...]
// For example, an idprovider named "myidp", with a configuration tree { mySetting1: "false", mySetting2: { nextLevel: true } }:
//
// idprovider.myidp.mySetting1=false
// idprovider.myidp.mySetting2.nextLevel=true
//
const CONFIG_NAMESPACE = "idprovider";
exports.CONFIG_NAMESPACE = CONFIG_NAMESPACE;




/**
 *  Returns the value or subtree under the current key in the .cfg file.
 *
 *  For example, looking for the current key "idprovider.myidp.mykey" and all keys that may or may not be below it
 *  (eg. "idprovider.myidp.mykey.subkey" and "idprovider.myidp.mykey.another", etc)
 *  allConfigKeys is an array of all keys,
 *  currentKey is "idprovider.myidp.mykey",
 *  and currentKeyIndex points to the current specific field in the key, "mykey", so that is 2 ("mykey" is the third field in the array of the key's fields).
 *
 *  A ParsingCallback is a function that provides a custom parsing function for the key
 *  @callback parsingCallback
 *  @param {string} rawValue - Raw value read in from the .cfg file
 *  @returns {Object|string|number} - A parsed value
 *
 *  @param parsingCallbacks {Object.<string, parsingCallback>} - Key -> function object that provides custom parsing
 *      functions for values of particular keys in the .cfg file.
 *      Keys are full, exact strings as found in the .cfg file including dot delimiters
 *      OR regex pattern strings, to match multiple keys. If regex patterns: key string must start with ^ and end with ^.
 *      Values are parsingCallback functions (see above).
 */
function getFileConfigSubTree(allConfigKeys, currentKey, currentFieldIndex, parsingCallbacks, subTree={}) {
    // Eg. "idprovider.myidp.mykey." (note the trailing dot)
    const currentBaseDot = `${currentKey}.`;

    let exactConfigKey=null;
    const deeperSubKeys=[];

    // Distribute relevant keys (starting with currentKey) to either an exact match or a list of subkeys to parse into a subtree (deeperSubKeys) - while error checking for invalid data structures.
    allConfigKeys.forEach( (k) => {
        const key = k.trim();

        if (key === currentKey) {
            // If at least one subtree key has already been seen: invalid
            if (deeperSubKeys.length) {
                throw Error(`Ambiguity in ${app.name}.cfg: the key '${currentKey}' can't both have a direct value and subfields (a tree) below it ('${deeperSubKeys[0]}' etc).`);
            }
            exactConfigKey = key;

        } else if (key.startsWith(currentBaseDot)) {
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

    // Only one key; the exact one. So return the value
    // - custom parsed with a parsingCallback, if that is supplied for this exact key or a regexp pattern that matches this exact key,
    // - or the raw value if no parsingCallback mathces.
    if (exactConfigKey) {
																														log.info("exactConfigKey (" +
																															(Array.isArray(exactConfigKey) ?
																																("array[" + exactConfigKey.length + "]") :
																																(typeof exactConfigKey + (exactConfigKey && typeof exactConfigKey === 'object' ? (" with keys: " + JSON.stringify(Object.keys(exactConfigKey))) : ""))
																															) + "): " + JSON.stringify(exactConfigKey, null, 2)
																														);
        try {
            const value = app.config[exactConfigKey];
																														log.info("parsingCallbacks? (" +
																															(Array.isArray(parsingCallbacks) ?
																																("array[" + parsingCallbacks.length + "]") :
																																(typeof parsingCallbacks + (parsingCallbacks && typeof parsingCallbacks === 'object' ? (" with keys: " + JSON.stringify(Object.keys(parsingCallbacks))) : ""))
																															) + "): " + JSON.stringify(parsingCallbacks, null, 2)
																														);
            if (parsingCallbacks) {

                // Look for a parsing callback function whose key in parsingCallbacks literally matches the current exact key:
                let parsingCallback = parsingCallbacks[exactConfigKey];
                                                                                                                        log.info("FIRST parsingCallback (" +
                                                                                                                            (Array.isArray(parsingCallback) ?
                                                                                                                                ("array[" + parsingCallback.length + "]") :
                                                                                                                                (typeof parsingCallback + (parsingCallback && typeof parsingCallback === 'object' ? (" with keys: " + JSON.stringify(Object.keys(parsingCallback))) : ""))
                                                                                                                            ) + "): " + JSON.stringify(parsingCallback, null, 2)
                                                                                                                        );

                if (!parsingCallback) {
                                                                                                                        log.info("Okay, no parsingCallback.");
                    // Look for the first parsing callback function where the key in parsingCallbacks can be interpreted as a regex pattern
                    // (by starting with ^ and ending with $) that matches the current exact key.

                    // .find is not available, though:
                    let firstMatchingPatternKey;
                    for (let patternKey of Object.keys(parsingCallbacks)) {
																														log.info("patternKey (" +
																															(Array.isArray(patternKey) ?
																																("array[" + patternKey.length + "]") :
																																(typeof patternKey + (patternKey && typeof patternKey === 'object' ? (" with keys: " + JSON.stringify(Object.keys(patternKey))) : ""))
																															) + "): " + JSON.stringify(patternKey, null, 2)
																														);
                        if (
                            patternKey.startsWith('^') &&
                            patternKey.endsWith('$') &&
                            new RegExp(patternKey).test(exactConfigKey)
                        ) {
																														log.info("Yep: " + patternKey);
                            firstMatchingPatternKey = patternKey;
                            break;
                        }
                    }
                                                                                                                        log.info(`parsingCallback for ${exactConfigKey} with firstMatchingPatternKey (` +
                                                                                                                            (Array.isArray(firstMatchingPatternKey) ?
                                                                                                                                    ("array[" + firstMatchingPatternKey.length + "]") :
                                                                                                                                    (typeof firstMatchingPatternKey + (firstMatchingPatternKey && typeof firstMatchingPatternKey === 'object' ? (" with keys: " + JSON.stringify(Object.keys(firstMatchingPatternKey))) : ""))
                                                                                                                            ) + "): " + JSON.stringify(firstMatchingPatternKey, null, 2)
                                                                                                                        );
                    parsingCallback = parsingCallbacks[firstMatchingPatternKey];
                }

                                                                                                                        log.info("parsingCallback type: " + typeof parsingCallback);
                if ('function' === typeof parsingCallback) {
                    return parsingCallback(value);
                }
            }

																														log.info("Okay, so NO parsingCallback for exactConfigKey (" +
																															(Array.isArray(exactConfigKey) ?
																																("array[" + exactConfigKey.length + "]") :
																																(typeof exactConfigKey + (exactConfigKey && typeof exactConfigKey === 'object' ? (" with keys: " + JSON.stringify(Object.keys(exactConfigKey))) : ""))
																															) + "): " + JSON.stringify(exactConfigKey, null, 2) + "\n\n"
																														);
            return value;

        } catch (e) {
            throw Error(`Couldn't custom parse the value.`, e);
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
        subTree[currentField] = getFileConfigSubTree(deeperSubKeys, currentBaseDot+currentField, nextFieldIndex, parsingCallbacks);
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
 *
 *  @param idProviderName {string} - Name of ID provider, eg. "myidp"
 *
 *  @returns An object where the keys are the second subfield from well-formed configs, eg. { authorizationUrl: 'http://something', clientSecret: 'vs12jn56bn2ai4sjf' }, etc
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
        const config = getFileConfigSubTree(rawConfigKeys, idProviderKeyBase, 1, parsingLib.PARSING_CALLBACKS);

        if (Object.keys(config).length) {
            logStateOnce(KIND_FILE, `Found config for '${idProviderKeyBase}' in ${app.name}.cfg. Using that instead of node-stored config from authLib.`);
																														log.info("PARSED config (" +
																															(Array.isArray(config) ?
																																("array[" + config.length + "]") :
																																(typeof config + (config && typeof config === 'object' ? (" with keys: " + JSON.stringify(Object.keys(config))) : ""))
																															) + "): " + JSON.stringify(config, null, 2)
																														);
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
 */
exports.shouldAutoInit = function() {
    const autoInit = (app.config || {})[AUTOINIT];
    return autoInit === true || autoInit === "true";
}
