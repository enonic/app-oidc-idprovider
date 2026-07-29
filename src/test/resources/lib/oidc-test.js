const test = require('/lib/xp/testing');
const testUtils = require('/testUtils');

let capturedRequest = null;

testUtils.mockAndGetUpdaterFunc('/lib/http-client', {
    request: (request) => {
        capturedRequest = request;
        return { status: 500 };
    },
});

const oidc = require('/lib/oidc');

function tokenParams(extra) {
    const params = {
        issuer: 'https://provider.example.com',
        tokenUrl: 'https://provider.example.com/token',
        clientId: 'my-client',
        clientSecret: 's3cr3t',
        redirectUri: 'https://app.example.com/callback',
        nonce: 'nonce-value',
        code: 'auth-code',
        idProviderName: 'oidc',
    };
    Object.keys(extra || {}).forEach(key => { params[key] = extra[key]; });
    return params;
}

exports.testBasicAuthEncodesCredentials = () => {
    capturedRequest = null;
    const result = oidc.requestIDToken(tokenParams({ method: 'basic' }));

    test.assertEquals(500, result.status);
    test.assertEquals('Basic bXktY2xpZW50OnMzY3IzdA==', capturedRequest.headers.Authorization);
};

exports.testBasicAuthEncodesCredentialsAsUtf8 = () => {
    capturedRequest = null;
    const result = oidc.requestIDToken(tokenParams({ method: 'basic', clientId: 'user', clientSecret: 'pÿ€' }));

    test.assertEquals(500, result.status);
    test.assertEquals('Basic dXNlcjpww7/igqw=', capturedRequest.headers.Authorization);
};
