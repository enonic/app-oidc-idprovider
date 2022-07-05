const preconditions = require('/lib/preconditions');
const httpClient = require('/lib/http-client');

function generateToken() {
    return Java.type('com.enonic.app.oidcidprovider.OIDCUtils').generateToken();
}

function parseClaims(jwt, issuer, clientId, nonce) {
    const parsedJwt = Java.type('com.enonic.app.oidcidprovider.OIDCUtils').parseClaims(jwt, issuer, clientId, nonce);
    return __.toNativeObject(parsedJwt);
}

function generateAuthorizationUrl(params) {
    const authorizationUrl = preconditions.checkParameter(params, 'authorizationUrl');
    const clientId = preconditions.checkParameter(params, 'clientId');
    const redirectUri = preconditions.checkParameter(params, 'redirectUri');
    const scope = preconditions.checkParameter(params, 'scopes');
    const state = preconditions.checkParameter(params, 'state');
    const nonce = preconditions.checkParameter(params, 'nonce');

    //https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
    return authorizationUrl
        + '?scope=' + encodeURIComponent(scope)
        + '&response_type=code'
        + '&client_id=' + encodeURIComponent(clientId)
        + '&redirect_uri=' + encodeURIComponent(redirectUri)
        + '&state=' + state
        + '&nonce=' + nonce;
}

function getAuthentication(clientId, clientSecret) {
    const authString = `${clientId}:${clientSecret}`;
    return Java.type('com.enonic.app.oidcidprovider.OIDCUtils').base64EncodeString(authString);
}

function requestIDToken(params) {
    const issuer = preconditions.checkParameter(params, 'issuer');
    const tokenUrl = preconditions.checkParameter(params, 'tokenUrl');
    const clientId = preconditions.checkParameter(params, 'clientId');
    const clientSecret = preconditions.checkParameter(params, 'clientSecret');
    const redirectUri = preconditions.checkParameter(params, 'redirectUri');
    const authenticationMethod = preconditions.checkParameter(params, 'authenticationMethod');
    const nonce = preconditions.checkParameter(params, 'nonce');
    const code = preconditions.checkParameter(params, 'code');

    //https://openid.net/specs/openid-connect-core-1_0.html#TokenRequest
    let body = 'grant_type=authorization_code'
        + '&code=' + code
        + '&redirect_uri=' + redirectUri;

    if (authenticationMethod === 'postAuth') {
        body = body + '&client_id=' + clientId
            + '&client_secret=' + clientSecret;
    }

    const headers = authenticationMethod === "basicAuth" ?
        { Authorization: `Basic ${getAuthentication(clientId, clientSecret)}` } : {};

    const request = {
        url: tokenUrl,
        method: 'POST',
        headers,
        body,
        contentType: 'application/x-www-form-urlencoded'
    };
    log.debug('Sending token request: ' + JSON.stringify(request));

    const response = httpClient.request(request);
    log.debug('Received token response: ' + JSON.stringify(response));

    if (response.status !== 200) {
        throw 'Error ' + response.status + ' while retrieving the ID Token';
    }

    const responseBody = JSON.parse(response.body);

    if (responseBody.error) {
        throw 'Token error [' + params.error + ']' + (params.error_description ? ': ' + params.error_description : '');
    }

    const claims = parseClaims(responseBody.id_token, issuer, clientId, nonce);
    log.debug('Parsed claims: ' + JSON.stringify(claims));

    return {
        idToken: responseBody.id_token,
        accessToken: responseBody.access_token,
        claims: claims
    };
}

function requestOAuth2(params) {
    const url = preconditions.checkParameter(params, 'url');
    const accessToken = preconditions.checkParameter(params, 'accessToken');
    const request = {
        url: url,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        },
        contentType: 'application/json'
    };
    log.debug('Sending user info request: ' + JSON.stringify(request));

    const response = httpClient.request(request);
    log.debug('Received user info response: ' + JSON.stringify(response));

    return JSON.parse(response.body);
}

function mergeClaims(priorityClaims, additionalClaims) {
    const claims = {};
    Object.keys(additionalClaims).forEach(claimKey => claims[claimKey] = additionalClaims[claimKey]);
    Object.keys(priorityClaims).forEach(claimKey => claims[claimKey] = priorityClaims[claimKey]);
    return claims;
}

exports.generateToken = generateToken;
exports.generateAuthorizationUrl = generateAuthorizationUrl;
exports.requestIDToken = requestIDToken;
exports.requestOAuth2 = requestOAuth2;
exports.mergeClaims = mergeClaims;
