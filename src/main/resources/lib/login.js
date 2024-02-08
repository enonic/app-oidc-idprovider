const authLib = require('/lib/xp/auth');
const contextLib = require('/lib/context');
const configLib = require('/lib/config');
const commonLib = require('/lib/xp/common');
const portalLib = require('/lib/xp/portal');
const preconditions = require('/lib/preconditions');
const oidcLib = require('./oidc');
const jwtLib = require('/lib/jwt');

const regExp = /\$\{([^\}]+)\}/g;

function login(claims) {

    const userinfoClaims = claims.userinfo;

    //Retrieves the user
    const idProviderKey = portalLib.getIdProviderKey();
    const userName = commonLib.sanitize(preconditions.checkParameter(userinfoClaims, 'sub'));
    const principalKey = 'user:' + idProviderKey + ':' + userName;
    const user = contextLib.runAsSu(() => authLib.getPrincipal(principalKey));

    //If the user does not exist
    if (!user) {

        //Creates the users
        const idProviderConfig = configLib.getIdProviderConfig();

        if (idProviderConfig.rules.forceEmailVerification) {
            preconditions.check(userinfoClaims.email_verified === true, 'Email must be verified');
        }

        const email = idProviderConfig.mappings.email.replace(regExp, (match, claimKey) => getClaim(claims, claimKey)) || null;
        const displayName = idProviderConfig.mappings.displayName.replace(regExp, (match, claimKey) => getClaim(claims, claimKey)) ||
                            userinfoClaims.preferred_username || userinfoClaims.name || email || userinfoClaims.sub;

        const user = contextLib.runAsSu(() => authLib.createUser({
            idProvider: idProviderKey,
            name: userName,
            displayName: displayName,
            email: email
        }));
        log.info(`User [${user.key}] created`);

        contextLib.runAsSu(() => {
            idProviderConfig.defaultGroups.forEach(function (defaultGroup) {
                authLib.addMembers(defaultGroup, [user.key]);
                log.debug(`User [${user.key}] added to group [${defaultGroup}]`);
            });
        });
    }

    //Updates the profile
    const profile = contextLib.runAsSu(() => authLib.modifyProfile({
        key: principalKey,
        scope: 'oidc',
        editor: () => removeNonSupportedKeys(claims)
    }));
    log.debug(`Modified profile of [${principalKey}]: ${JSON.stringify(profile)}`);

    //Logs in the user
    const loginResult = authLib.login({
        user: userName,
        idProvider: idProviderKey,
        skipAuth: true
    });
    if (loginResult.authenticated) {
        log.debug(`Logged in user [${principalKey}]`);
    } else {
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

function autoLogin(payload, idProviderConfig, jwtToken) {
    const idProviderKey = idProviderConfig._idProviderName;
    const username = commonLib.sanitize(payload[idProviderConfig.autoLogin.claimDisplayName] || payload['sub']);
    const principalKey = 'user:' + idProviderKey + ':' + username;

    let user = contextLib.runAsSu(() => authLib.getPrincipal(principalKey));

    if (!user && idProviderConfig.autoLogin.createUsers) {

        let email, displayName;

        if (idProviderConfig.autoLogin.useUserinfo) {
            const userinfoClaims = oidcLib.requestOAuth2({
                url: idProviderConfig.userinfoUrl,
                accessToken: jwtToken,
            });

            if (idProviderConfig.rules.forceEmailVerification) {
                if (userinfoClaims.email_verified !== true) {
                    jwtLib.autoLoginFailed();
                    return;
                }
            }

            email = userinfoClaims.email;
            displayName = userinfoClaims.preferred_username || userinfoClaims.name || email || userinfoClaims.sub;

        } else {
            email = payload[idProviderConfig.autoLogin.claimEmail];
            displayName = payload[idProviderConfig.autoLogin.claimDisplayName] || payload['sub'];
        }

        if (!email) {
            jwtLib.autoLoginFailed();
            return;
        }

        try {
            user = contextLib.runAsSu(() => authLib.createUser({
                idProvider: idProviderKey,
                name: username,
                displayName: displayName,
                email: email
            }));
        } catch (e) {
            const errAsString = "" + e;

            if (errAsString.startsWith('com.enonic.xp.security.PrincipalAlreadyExistsException')) {
                user = contextLib.runAsSu(() => authLib.getPrincipal(principalKey));
            } else {
                log.error(`User '${username}' could not be provided: ${errAsString}`);
            }
        }
    }

    if (user) {
        log.debug(`Logging in user '${user.login}'`);

        authLib.login({
            user: user.login,
            idProvider: idProviderConfig._idProviderName,
            skipAuth: true,
            scope: idProviderConfig.autoLogin.createSession ? 'SESSION' : 'REQUEST',
        });
    } else {
        jwtLib.autoLoginFailed();
        log.debug(`User '${username}' not found.`);
    }
}

exports.login = login;
exports.autoLogin = autoLogin;
