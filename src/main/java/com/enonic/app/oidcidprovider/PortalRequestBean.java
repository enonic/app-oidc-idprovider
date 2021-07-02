package com.enonic.app.oidcidprovider;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpSession;

import com.enonic.app.oidcidprovider.mapper.ContextMapper;
import com.enonic.xp.portal.PortalRequest;
import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;
import com.enonic.xp.web.servlet.ServletRequestUrlHelper;

public class PortalRequestBean
    implements ScriptBean
{
    private static final String CONTEXT_KEY = "com.enonic.app.oidcidprovider.context";

    private static final String ID_TOKEN_KEY = "com.enonic.app.oidcidprovider.idtoken";

    private PortalRequest portalRequest;

    public String getRequestUrl()
    {
        return ServletRequestUrlHelper.getFullUrl( this.portalRequest.getRawRequest() );
    }

    public void storeContext( final String state, final String nonce, final String originalUrl, final String redirectUri )
    {
        final HashMap<String, Map<String, String>> contextMap = new HashMap<>();

        final HttpSession session = portalRequest.getRawRequest().getSession( true );
        Map<String, Map<String, String>> existingContextMap = (Map<String, Map<String, String>>) session.getAttribute( CONTEXT_KEY );
        if ( existingContextMap != null )
        {
            contextMap.putAll( existingContextMap );
        }

        final Context context = Context.create().
            state( state ).
            nonce( nonce ).
            originalUrl( originalUrl ).
            redirectUri( redirectUri ).
            build();

        contextMap.put( state, context.asMap() );

        session.setAttribute( CONTEXT_KEY, Collections.unmodifiableMap( contextMap ) );
    }

    public ContextMapper removeContext( final String state )
    {
        final HttpSession session = portalRequest.getRawRequest().getSession( true );

        final Map<String, Map<String, String>> contextMap = (Map) session.getAttribute( CONTEXT_KEY );
        final Context context = contextMap == null ? null : Context.fromMap(contextMap.get( state ));

        if ( context != null )
        {
            session.removeAttribute( CONTEXT_KEY );
            return ContextMapper.from( context );
        }

        return null;
    }

    public void storeIdToken( final String idToken )
    {
        final HttpSession session = portalRequest.getRawRequest().getSession( true );
        session.setAttribute( ID_TOKEN_KEY, idToken );
    }

    public String getIdToken()
    {
        final HttpSession session = portalRequest.getRawRequest().getSession( true );
        return (String) session.getAttribute( ID_TOKEN_KEY );
    }

    @Override
    public void initialize( final BeanContext context )
    {
        this.portalRequest = context.getBinding( PortalRequest.class ).
            get();
    }
}
