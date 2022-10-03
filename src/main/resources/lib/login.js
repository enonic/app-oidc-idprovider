const authLib = require('/lib/xp/auth');
const contextLib = require('/lib/context');
const configLib = require('/lib/config');
const commonLib = require('/lib/xp/common');
const portalLib = require('/lib/xp/portal');
const preconditions = require('/lib/preconditions');

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
        if (idProviderConfig.rules && idProviderConfig.rules.forceEmailVerification) {
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
        log.info('User [' + user.key + '] created');

        var defaultGroups = idProviderConfig.defaultGroups;
        contextLib.runAsSu(() => {
            toArray(defaultGroups).forEach(function (defaultGroup) {
                authLib.addMembers(defaultGroup, [user.key]);
                log.debug('User [' + user.key + '] added to group [' + defaultGroup + ']');
            });
        });
    }

    //Updates the profile
    const profile = contextLib.runAsSu(() => authLib.modifyProfile({
        key: principalKey,
        scope: 'oidc',
        editor: () => claims
    }));
    log.debug('Modified profile of [' + principalKey + ']: ' + JSON.stringify(profile));

    //Logs in the user
    const loginResult = authLib.login({
        user: userName,
        idProvider: idProviderKey,
        skipAuth: true
    });
    if (loginResult.authenticated) {
        log.debug('Logged in user [' + principalKey + ']');
    } else {
        throw 'Error while logging user [' + principalKey + ']';
    }
}

function toArray(object) {
    if (!object) {
        return [];
    }
    if (object.constructor === Array) {
        return object;
    }
    return [object];
}

function getClaim(claims, claimKey) {
    const claimKeys = claimKey.split('.');

    let currentClaimObject = claims;
    let claim;
    for (const claimKey of claimKeys) {
        currentClaimObject = currentClaimObject[claimKey];
        if (currentClaimObject == null) {
            log.warning('Claim [' + claimKey + '] missing');
            return '';
        }
        claim = currentClaimObject;
    }
    return claim || '';
}

exports.login = login;
