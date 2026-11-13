const test = require('/lib/xp/testing');

// XP's CSP builder, recording what the page asks of it: the directives and their sources.
let policy;
test.mock('/lib/xp/portal', {
    csp: () => {
        const directives = {};
        policy = directives;
        const add = (name) => function () {
            directives[name] = (directives[name] || []).concat(Array.prototype.slice.call(arguments));
            return builder;
        };
        const builder = {
            strict: () => {
                directives['default-src'] = [`'none'`];
                directives['base-uri'] = [`'none'`];
                directives['frame-ancestors'] = [`'none'`];
                return builder;
            },
            styleSrc: add('style-src'),
            formAction: add('form-action'),
            nonceScriptSrc: () => {
                add('script-src')(`'nonce-n0nce'`);
                return 'n0nce';
            },
        };
        return builder;
    },
});

const lib = require('/lib/oauthConsentPage');

const USER = {key: 'user:myidp:alice', login: 'alice', displayName: 'Alice'};

exports.testConfirm_deviceFlow_showsAndPostsTheCode = () => {
    const response = lib.render({
        idProvider: 'myidp', action: 'confirm', flow: 'device', userCode: 'BCDF-GHJK', clientId: 'cli',
        client: {id: 'cli', displayName: 'cli', registered: false},
        scope: [], audience: ['xp'], unrestricted: true, csrf: 'c', user: USER,
    });

    test.assertEquals(200, response.status);
    test.assertTrue(response.body.indexOf('<code>BCDF-GHJK</code>') >= 0, 'the code is shown');
    test.assertTrue(response.body.indexOf('name="user_code" value="BCDF-GHJK"') >= 0, 'and posted back');
    test.assertTrue(response.body.indexOf('name="request"') < 0);
    test.assertTrue(response.body.indexOf('cli will be able to do everything your account can.') >= 0, 'no scopes: full access, said');
    test.assertTrue(response.body.indexOf('the code matches') >= 0);
};

exports.testConfirm_codeFlow_postsTheRequestAndNamesTheClient = () => {
    const response = lib.render({
        idProvider: 'myidp', action: 'confirm', flow: 'code', requestId: 'r1', clientId: 'eyJ.x.y',
        client: {id: 'eyJ.x.y', displayName: 'Claude <MCP>', uri: 'https://claude.ai', policyUri: 'https://anthropic.com/privacy', registered: true},
        scope: [
            {id: 'content:read', title: 'Read content', description: 'See content in every project', roles: ['role:cms.project.site.viewer'], required: false},
            {id: 'profile', title: 'profile', roles: [], required: true},
        ],
        audience: ['https://example.com/api/mcp'], unrestricted: false, csrf: 'c', user: USER,
    });

    const body = response.body;
    test.assertTrue(body.indexOf('<h1>Authorize Claude &lt;MCP&gt;</h1>') >= 0, 'the registered name, escaped');
    test.assertTrue(body.indexOf('name="request" value="r1"') >= 0, 'the request id is posted back');
    test.assertTrue(body.indexOf('name="user_code"') < 0 && body.indexOf('Verification code') < 0, 'no code in the code flow');
    test.assertTrue(body.indexOf('Read content<span class="scope-description">See content in every project</span>') >= 0, 'title and description');
    test.assertTrue(body.indexOf('<li>profile</li>') >= 0, 'a required scope is listed as granted');
    test.assertTrue(body.indexOf('href="https://claude.ai"') >= 0 && body.indexOf('href="https://anthropic.com/privacy"') >= 0, 'the links');
    test.assertTrue(body.indexOf('everything your account can') < 0);
    test.assertTrue(body.indexOf('Only continue if you started this request.</p>') >= 0);
    test.assertTrue(body.indexOf('action="?"') >= 0, 'the form drops the query it was opened with');
};

// The page's policy is XP's builder's: strict, inline styles, and a form that may only post to this host.
// Approving in the code flow ends in a redirect to the client, which form-action 'self' alone would block:
// the client's origin XP names is allowed, and nothing else; without one, form-action is left open.
exports.testConfirm_codeFlow_allowsTheClientsOriginOnly = () => {
    const render = (flow, redirectOrigin) => {
        policy = null;
        const response = lib.render({
            idProvider: 'myidp', action: 'confirm', flow: flow, requestId: 'r1', userCode: 'BCDF-GHJK', clientId: 'enonic-cli',
            client: {id: 'enonic-cli', displayName: 'Enonic CLI', registered: true},
            scope: [], audience: [], unrestricted: true, csrf: 'c', user: USER, redirectOrigin: redirectOrigin,
        });
        test.assertEquals(undefined, response.headers['Content-Security-Policy'], 'no header of its own');
        test.assertJsonEquals([`'none'`], policy['default-src']);
        test.assertJsonEquals([`'unsafe-inline'`], policy['style-src']);
        return policy['form-action'];
    };

    test.assertJsonEquals([`'self'`, 'http://127.0.0.1:51234'], render('code', 'http://127.0.0.1:51234'));
    test.assertEquals(undefined, render('code', undefined), 'an XP that names no origin');
    test.assertJsonEquals([`'self'`], render('device', 'http://127.0.0.1:51234'));
    policy = null;
    lib.render({idProvider: 'myidp', action: 'enter', user: USER});
    test.assertJsonEquals([`'self'`], policy['form-action'], 'entering a code');
};

// The keep-one script runs by the builder's nonce, and no other script is allowed.
exports.testConfirm_scriptRunsByTheBuildersNonce = () => {
    policy = null;
    const body = lib.render({
        idProvider: 'myidp', action: 'confirm', flow: 'code', requestId: 'r1', clientId: 'cli',
        client: {id: 'cli', displayName: 'cli', registered: false},
        scope: [{id: 'content:read', title: 'Read content', roles: [], required: false}],
        audience: [], unrestricted: false, csrf: 'c', user: USER,
    }).body;
    test.assertTrue(body.indexOf('<script nonce="n0nce">') >= 0, 'the script carries the nonce');
    test.assertJsonEquals([`'nonce-n0nce'`], policy['script-src']);
};
