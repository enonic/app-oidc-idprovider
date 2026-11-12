package com.enonic.app.oidcidprovider.lib;

import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import jakarta.servlet.http.HttpServletRequest;


import com.enonic.xp.testing.ScriptTestSupport;
import com.enonic.xp.web.vhost.VirtualHost;
import com.enonic.xp.web.vhost.VirtualHostHelper;

public class AccessTokenTest
    extends ScriptTestSupport
{
    @Override
    protected void initialize()
        throws Exception
    {
        super.initialize();

        final Map<String, Object> attributes = new HashMap<>();
        final HttpServletRequest rawRequest =
            (HttpServletRequest) Proxy.newProxyInstance( getClass().getClassLoader(), new Class<?>[]{HttpServletRequest.class},
                                                         ( proxy, method, args ) -> switch ( method.getName() )
                                                         {
                                                             case "getAttribute" -> attributes.get( (String) args[0] );
                                                             case "setAttribute" -> attributes.put( (String) args[0], args[1] );
                                                             default -> null;
                                                         } );
        final VirtualHost virtualHost =
            (VirtualHost) Proxy.newProxyInstance( getClass().getClassLoader(), new Class<?>[]{VirtualHost.class},
                                                  ( proxy, method, args ) -> "acceptsAudience".equals( method.getName() )
                                                      ? ( (Set<?>) args[0] ).contains( "accepted" )
                                                      : null );
        VirtualHostHelper.setVirtualHost( rawRequest, virtualHost );
        VirtualHostHelper.setRequestedPath( rawRequest, "/api/mcp" );
        this.portalRequest.setRawRequest( rawRequest );
    }

    private void run( final String function )
    {
        runFunction( "/lib/accessToken-test.js", function );
    }

    @Test
    public void testFullClaims()
    {
        run( "testFullClaims" );
    }

    @Test
    public void testIdTokenShape()
    {
        run( "testIdTokenShape" );
    }

    @Test
    public void testScpListAndNoClient()
    {
        run( "testScpListAndNoClient" );
    }

    @Test
    public void testAudienceIsAskedOfTheVirtualHost()
    {
        run( "testAudienceIsAskedOfTheVirtualHost" );
    }

    @Test
    public void testNoAudienceIsRefused()
    {
        run( "testNoAudienceIsRefused" );
    }

    @Test
    public void testBareClaims()
    {
        run( "testBareClaims" );
    }
}
