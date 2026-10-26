const test = require('/lib/xp/testing');

const lib = require('/lib/deviceLoginPage');

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
