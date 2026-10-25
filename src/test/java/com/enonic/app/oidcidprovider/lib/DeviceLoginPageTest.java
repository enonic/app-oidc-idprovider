package com.enonic.app.oidcidprovider.lib;

import org.junit.jupiter.api.Test;

import com.enonic.xp.testing.ScriptTestSupport;

public class DeviceLoginPageTest
    extends ScriptTestSupport
{
    @Test
    public void testConfirm_deviceFlow_showsAndPostsTheCode()
    {
        runFunction( "/lib/deviceLoginPage-test.js", "testConfirm_deviceFlow_showsAndPostsTheCode" );
    }

    @Test
    public void testConfirm_codeFlow_postsTheRequestAndNamesTheClient()
    {
        runFunction( "/lib/deviceLoginPage-test.js", "testConfirm_codeFlow_postsTheRequestAndNamesTheClient" );
    }
}
