package com.enonic.app.oidcidprovider;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

import jakarta.servlet.http.HttpServletRequest;

import com.enonic.app.oidcidprovider.mapper.ContextMapper;
import com.enonic.xp.portal.PortalRequest;
import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;
import com.enonic.xp.web.HttpStatus;
import com.enonic.xp.web.WebException;
import com.enonic.xp.web.servlet.ServletRequestUrlHelper;
import com.enonic.xp.web.servlet.UriRewritingResult;
import com.enonic.xp.web.vhost.VirtualHost;
import com.enonic.xp.web.vhost.VirtualHostHelper;

public class PortalRequestBean
    implements ScriptBean
{
    private static final Lock LOCK = new ReentrantLock();

    private String contextSessionKey;

    private String idTokenSessionKey;

    private String autoLoginAttr;

    private PortalRequest portalRequest;

    public String getRequestUrl()
    {
        return ServletRequestUrlHelper.getFullUrl( this.portalRequest.getRawRequest() );
    }

    public void storeContext( final String state, final String nonce, final String originalUrl, final String redirectUri, final String codeVerifier )
    {
        LOCK.lock();
        try
        {
            final var contextMap = new ConcurrentHashMap<String, Map<String, String>>();

            final var session = portalRequest.getRawRequest().getSession( true );
            Map<String, Map<String, String>> existingContextMap = (Map) session.getAttribute( contextSessionKey );

            if ( existingContextMap != null )
            {
                contextMap.putAll( existingContextMap );
            }

            final Context context =
                Context.create().state( state ).nonce( nonce ).originalUrl( originalUrl ).redirectUri( redirectUri ).codeVerifier( codeVerifier ).build();

            contextMap.put( state, context.asMap() );

            session.setAttribute( contextSessionKey, Collections.unmodifiableMap( contextMap ) );
        }
        finally
        {
            LOCK.unlock();
        }

    }

    public ContextMapper removeContext( final String state )
    {
        LOCK.lock();
        try
        {
            final var session = portalRequest.getRawRequest().getSession( false );

            if ( session == null )
            {
                throw new WebException( HttpStatus.UNAUTHORIZED, "No session" );
            }

            final Map<String, Map<String, String>> contextMap = (Map) session.getAttribute( contextSessionKey );
            session.removeAttribute( contextSessionKey );

            if ( contextMap == null )
            {
                throw new WebException( HttpStatus.CONFLICT, "Invalid authentication flow" );
            }

            final Map<String, String> context = contextMap.get( state );

            if ( context == null )
            {
                throw new WebException( HttpStatus.CONFLICT, "Invalid state parameter" );
            }

            if ( !state.equals( context.get( "state" ) ) )
            {
                throw new IllegalStateException( "Session state mismatch" );
            }

            return ContextMapper.from( Context.fromMap( context ) );
        }
        finally
        {
            LOCK.unlock();
        }

    }

    public void storeIdToken( final String idToken )
    {
        final var session = portalRequest.getRawRequest().getSession( true );
        session.setAttribute( idTokenSessionKey, idToken );
    }

    public String getIdToken()
    {
        final var session = portalRequest.getRawRequest().getSession( false );
        return session != null ? (String) session.getAttribute( idTokenSessionKey ) : null;
    }

    public void autoLoginFailed()
    {
        this.portalRequest.getRawRequest().setAttribute( autoLoginAttr, Boolean.TRUE );
    }

    public boolean isAutoLoginFailed()
    {
        return Boolean.TRUE.equals( this.portalRequest.getRawRequest().getAttribute( autoLoginAttr ) );
    }

    /**
     * Whether the virtual host of the request accepts a bearer token naming these audiences, by the
     * rule XP applies when the token is handed over at login: an audience the host declares, or a URL
     * at or under the host's own that the request is at or below. XP's issuer name is not an audience
     * for an upstream token.
     */
    public boolean acceptsAudience( final List<String> audience )
    {
        final HttpServletRequest rawRequest = portalRequest.getRawRequest();
        final VirtualHost virtualHost = rawRequest == null ? null : VirtualHostHelper.getVirtualHost( rawRequest );
        final Set<String> named = audience.stream().filter( Objects::nonNull ).collect( Collectors.toUnmodifiableSet() );
        if ( virtualHost == null || named.isEmpty() )
        {
            return false;
        }
        // A name none of the audiences is, so that none of them counts as XP's own.
        String notNamed = "";
        while ( named.contains( notNamed ) )
        {
            notNamed += "-";
        }
        return virtualHost.acceptsAudience( named, notNamed, requestedUrl( rawRequest ) );
    }

    /**
     * The URL the request came to as the client sent it, the one XP holds the audience against; null
     * when the path is not in canonical form.
     */
    private String requestedUrl( final HttpServletRequest rawRequest )
    {
        final String path = VirtualHostHelper.getRequestedPath( rawRequest );
        if ( path == null )
        {
            return null;
        }
        final String scheme = portalRequest.getScheme();
        final int port = portalRequest.getPort();
        final boolean defaultPort = port <= 0 || ( "https".equals( scheme ) ? port == 443 : "http".equals( scheme ) && port == 80 );
        return scheme + "://" + portalRequest.getHost() + ( defaultPort ? "" : ":" + port ) + path;
    }

    public String getRedirectUri()
    {
        final VirtualHost virtualHost = VirtualHostHelper.getVirtualHost( portalRequest.getRawRequest() );

        final UriRewritingResult rewritingResult =
            ServletRequestUrlHelper.rewriteUri( portalRequest.getRawRequest(), virtualHost.getTarget() );

        if ( rewritingResult.isOutOfScope() )
        {
            throw new IllegalStateException( "URI out of scope on vhost target " + virtualHost.getTarget() );
        }

        final String rewrittenUri = rewritingResult.getRewrittenUri();

        final String path = rewrittenUri.endsWith( "/" ) ? rewrittenUri.substring( 0, rewrittenUri.length() - 1 ) : rewrittenUri;

        return ServletRequestUrlHelper.getServerUrl( portalRequest.getRawRequest() ) + path + "/_/idprovider/" +
            virtualHost.getDefaultIdProviderKey().toString();
    }

    @Override
    public void initialize( final BeanContext context )
    {
        this.contextSessionKey = context.getApplicationKey() + ".context";
        this.idTokenSessionKey = context.getApplicationKey() + ".idtoken";
        this.autoLoginAttr = context.getApplicationKey() + ".autoLoginFailed";
        this.portalRequest = context.getBinding( PortalRequest.class ).get();
    }
}
