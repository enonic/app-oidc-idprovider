package com.enonic.app.oidcidprovider;

import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import jakarta.servlet.http.HttpServletRequest;

import com.enonic.xp.app.ApplicationKey;
import com.enonic.xp.portal.PortalRequest;
import com.enonic.xp.resource.ResourceKey;
import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.web.vhost.VirtualHost;
import com.enonic.xp.web.vhost.VirtualHostHelper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class PortalRequestBeanTest
{
    private final Map<String, Object> attributes = new HashMap<>();

    private PortalRequest portalRequest;

    private PortalRequestBean bean;

    private boolean accepted;

    private Set<String> askedAudience;

    private String askedSelf;

    private String askedRequestUrl;

    private int asked;

    @BeforeEach
    public void setUp()
    {
        final HttpServletRequest rawRequest =
            (HttpServletRequest) Proxy.newProxyInstance( getClass().getClassLoader(), new Class<?>[]{HttpServletRequest.class},
                                                         ( proxy, method, args ) -> switch ( method.getName() )
                                                         {
                                                             case "getAttribute" -> attributes.get( (String) args[0] );
                                                             case "setAttribute" -> attributes.put( (String) args[0], args[1] );
                                                             default -> null;
                                                         } );
        portalRequest = new PortalRequest();
        portalRequest.setRawRequest( rawRequest );
        portalRequest.setScheme( "https" );
        portalRequest.setHost( "api.example.com" );
        portalRequest.setPort( 443 );

        bean = new PortalRequestBean();
        bean.initialize( new BeanContext()
        {
            @Override
            public ApplicationKey getApplicationKey()
            {
                return ApplicationKey.from( "com.enonic.app.oidcidprovider" );
            }

            @Override
            public ResourceKey getResourceKey()
            {
                return null;
            }

            @Override
            public <T> Supplier<T> getBinding( final Class<T> type )
            {
                return () -> type.cast( portalRequest );
            }

            @Override
            public <T> Supplier<T> getService( final Class<T> type )
            {
                return () -> null;
            }
        } );
    }

    /**
     * A virtual host that records what it is asked and answers as the test says: the rule is XP's.
     */
    @SuppressWarnings("unchecked")
    private void virtualHost( final String requestedPath )
    {
        final VirtualHost virtualHost =
            (VirtualHost) Proxy.newProxyInstance( getClass().getClassLoader(), new Class<?>[]{VirtualHost.class}, ( proxy, method, args ) -> {
                if ( "acceptsAudience".equals( method.getName() ) )
                {
                    asked++;
                    askedAudience = (Set<String>) args[0];
                    askedSelf = (String) args[1];
                    askedRequestUrl = (String) args[2];
                    return accepted;
                }
                return null;
            } );
        VirtualHostHelper.setVirtualHost( portalRequest.getRawRequest(), virtualHost );
        VirtualHostHelper.setRequestedPath( portalRequest.getRawRequest(), requestedPath );
    }

    @Test
    public void asksXpWithTheAudiencesAndTheUrlAsTheClientSentIt()
    {
        virtualHost( "/api/mcp/" );
        accepted = true;

        assertTrue( bean.acceptsAudience( List.of( "https://api.example.com/api/mcp/", "https://tenant.example.com/userinfo" ) ) );

        assertEquals( Set.of( "https://api.example.com/api/mcp/", "https://tenant.example.com/userinfo" ), askedAudience );
        assertEquals( "https://api.example.com/api/mcp/", askedRequestUrl, "the trailing slash is kept, the default port left out" );
    }

    @Test
    public void xpDecides()
    {
        virtualHost( "/api/mcp" );
        accepted = false;

        assertFalse( bean.acceptsAudience( List.of( "https://api.example.com/api/other" ) ) );
        assertEquals( 1, asked );
    }

    @Test
    public void aPortThatIsNotTheSchemesDefaultIsNamed()
    {
        portalRequest.setScheme( "http" );
        portalRequest.setHost( "localhost" );
        portalRequest.setPort( 8080 );
        virtualHost( "/api/mcp" );
        accepted = true;

        bean.acceptsAudience( List.of( "http://localhost:8080/api/mcp" ) );

        assertEquals( "http://localhost:8080/api/mcp", askedRequestUrl );
    }

    @Test
    public void noneOfTheAudiencesCountsAsXpsOwnName()
    {
        virtualHost( "/api/mcp" );
        accepted = true;

        bean.acceptsAudience( List.of( "", "-", "xp" ) );

        assertFalse( askedAudience.contains( askedSelf ) );
    }

    @Test
    public void aPathThatIsNotCanonicalNamesNoUrl()
    {
        virtualHost( null );
        accepted = false;

        assertFalse( bean.acceptsAudience( List.of( "https://api.example.com/api/mcp" ) ) );
        assertNull( askedRequestUrl );
    }

    @Test
    public void aTokenForNoAudienceIsRefusedWithoutAsking()
    {
        virtualHost( "/api/mcp" );
        accepted = true;

        assertFalse( bean.acceptsAudience( List.of() ) );
        assertEquals( 0, asked );
    }

    @Test
    public void withoutAVirtualHostNothingIsAccepted()
    {
        assertFalse( bean.acceptsAudience( List.of( "https://api.example.com/api/mcp" ) ) );
    }
}
