package com.enonic.app.oidcidprovider;

import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import javax.servlet.http.HttpSession;

import com.enonic.app.oidcidprovider.mapper.ContextMapper;
import com.enonic.xp.portal.PortalRequest;
import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;
import com.enonic.xp.web.HttpStatus;
import com.enonic.xp.web.WebException;
import com.enonic.xp.web.servlet.ServletRequestUrlHelper;

public class PortalRequestBean
    implements ScriptBean
{
    private static final String AUTO_LOGIN_FAILED_ATTRIBUTE = PortalRequestBean.class.getName() + ".autoLoginFailed";

    private static final String CONTEXT_KEY = "com.enonic.app.oidcidprovider.context";

    private static final String ID_TOKEN_KEY = "com.enonic.app.oidcidprovider.idtoken";

    private static final Lock LOCK = new ReentrantLock();

    private PortalRequest portalRequest;

    public String getRequestUrl()
    {
        return ServletRequestUrlHelper.getFullUrl( this.portalRequest.getRawRequest() );
    }

    public void storeContext( final String state, final String nonce, final String originalUrl, final String redirectUri )
    {
        LOCK.lock();
        try
        {
            final var contextMap = new ConcurrentHashMap<String, Map<String, String>>();

            final HttpSession session = portalRequest.getRawRequest().getSession( true );
            Map<String, Map<String, String>> existingContextMap = (Map) session.getAttribute( CONTEXT_KEY );

            if ( existingContextMap != null )
            {
                contextMap.putAll( existingContextMap );
            }

            final Context context =
                Context.create().state( state ).nonce( nonce ).originalUrl( originalUrl ).redirectUri( redirectUri ).build();

            contextMap.put( state, context.asMap() );

            session.setAttribute( CONTEXT_KEY, Collections.unmodifiableMap( contextMap ) );
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
            final HttpSession session = portalRequest.getRawRequest().getSession( false );

            if ( session == null )
            {
                throw new WebException( HttpStatus.UNAUTHORIZED, "No session" );
            }

            final Map<String, Map<String, String>> contextMap = (Map) session.getAttribute( CONTEXT_KEY );
            session.removeAttribute( CONTEXT_KEY );

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
        final HttpSession session = portalRequest.getRawRequest().getSession( true );
        session.setAttribute( ID_TOKEN_KEY, idToken );
    }

    public String getIdToken()
    {
        final HttpSession session = portalRequest.getRawRequest().getSession( false );
        return session != null ? (String) session.getAttribute( ID_TOKEN_KEY ) : null;
    }

    public void autoLoginFailed()
    {
        this.portalRequest.getRawRequest().setAttribute( AUTO_LOGIN_FAILED_ATTRIBUTE, Boolean.TRUE );
    }

    public boolean isAutoLoginFailed()
    {
        return Boolean.TRUE.equals( this.portalRequest.getRawRequest().getAttribute( AUTO_LOGIN_FAILED_ATTRIBUTE ) );
    }

    @Override
    public void initialize( final BeanContext context )
    {
        this.portalRequest = context.getBinding( PortalRequest.class ).get();
    }
}
