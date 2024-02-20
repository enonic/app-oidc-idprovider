const authLib = require('/lib/xp/auth');
const contextLib = require('/lib/context');
const configLib = require('/lib/config');
const commonLib = require('/lib/xp/common');
const portalLib = require('/lib/xp/portal');
const preconditions = require('/lib/preconditions');
const requestLib = require('/lib/request');

const regExp = /\$\{([^\}]+)\}/g;

function login(claims, isAutoLogin) {

    const userinfoClaims = claims.userinfo;

    //Retrieves the user
    const idProviderKey = portalLib.getIdProviderKey();
    const idProviderConfig = configLib.getIdProviderConfig();
    const userName = commonLib.sanitize(preconditions.checkParameter(userinfoClaims, idProviderConfig.claimUsername));
    const principalKey = 'user:' + idProviderKey + ':' + userName;
    const user = contextLib.runAsSu(() => authLib.getPrincipal(principalKey));

    //If the user does not exist
    if (!user) {
        if (!isAutoLogin || (isAutoLogin && idProviderConfig.autoLogin.createUsers)) {
            //Creates the users
            if (idProviderConfig.rules.forceEmailVerification) {
                if (userinfoClaims.email_verified !== true) {
                    if (isAutoLogin) {
                        requestLib.autoLoginFailed();
                        return;
                    }
                    throw 'Email must be verified';
                }
            }

            const email = idProviderConfig.mappings.email.replace(regExp, (match, claimKey) => getClaim(userinfoClaims, claimKey)) ||
                          userinfoClaims.email;
            const displayName = idProviderConfig.mappings.displayName.replace(regExp,
                                    (match, claimKey) => getClaim(userinfoClaims, claimKey)) ||
                                userinfoClaims.preferred_username || userinfoClaims.name || email || userinfoClaims.sub;

            if (!email) {
                if (isAutoLogin) {
                    requestLib.autoLoginFailed();
                    return;
                }
                throw 'User can not be created without email';
            }

            let user;
            try {
                user = contextLib.runAsSu(() => authLib.createUser({
                    idProvider: idProviderKey,
                    name: userName,
                    displayName: displayName,
                    email: email
                }));
                log.info(`User [${user.key}] created`);
            } catch (e) {
                if (`${e}`.startsWith('com.enonic.xp.security.PrincipalAlreadyExistsException')) {
                    user = contextLib.runAsSu(() => authLib.getPrincipal(principalKey));
                } else {
                    log.error(`User '${userName}' could not be provided: ${e}`);
                }
            }

            if (user) {
                contextLib.runAsSu(() => {
                    idProviderConfig.defaultGroups.forEach(function (defaultGroup) {
                        authLib.addMembers(defaultGroup, [user.key]);
                        log.debug(`User [${user.key}] added to group [${defaultGroup}]`);
                    });
                });
            }
        } else if (isAutoLogin) {
            return;
        }
    }

    //Updates the profile
    const profile = contextLib.runAsSu(() => authLib.modifyProfile({
        key: principalKey,
        scope: 'oidc',
        editor: () => removeNonSupportedKeys(claims)
    }));
    log.debug(`Modified profile of [${principalKey}]: ${JSON.stringify(profile)}`);

    const loginParams = {
        user: userName,
        idProvider: idProviderKey,
        skipAuth: true
    };

    if (isAutoLogin) {
        loginParams.scope = idProviderConfig.autoLogin.createSession ? 'SESSION' : 'REQUEST';
    }

    //Logs in the user
    const loginResult = authLib.login(loginParams);
    if (loginResult.authenticated) {
        log.debug(`Logged in user [${principalKey}]`);
    } else {
        if (isAutoLogin) {
            requestLib.autoLoginFailed();
            return;
        }
        throw `Error while logging user [${principalKey}]`;
    }
}

function getClaim(claims, claimKey) {
    const claimKeys = claimKey.split('.');

    let currentClaimObject = claims;
    let claim;
    for (const claimKey of claimKeys) {
        currentClaimObject = currentClaimObject[claimKey];
        if (currentClaimObject == null) {
            log.warning(`Claim [${claimKey}] missing`);
            return '';
        }
        claim = currentClaimObject;
    }
    return claim || '';
}

function removeNonSupportedKeys(claims) {
    if (typeof claims !== 'object' || claims === null) {
        return claims;
    }

    if (Array.isArray(claims)) {
        return claims.map(removeNonSupportedKeys);
    }

    const newClaims = {};

    for (const key in claims) {
        if (claims.hasOwnProperty(key) && !(key.indexOf('.') !== -1 || key.indexOf('[') !== -1 || key.indexOf(']') !== -1)) {
            newClaims[key] = removeNonSupportedKeys(claims[key]);
        }
    }

    return newClaims;
}

exports.login = login;
