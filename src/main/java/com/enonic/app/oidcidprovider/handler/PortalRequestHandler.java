package com.enonic.app.oidcidprovider.handler;

import java.util.function.Supplier;

import com.enonic.xp.portal.PortalRequest;
import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;

public class PortalRequestHandler
    implements ScriptBean
{
    private static final String AUTO_LOGIN_FAILED_ATTRIBUTE = PortalRequestHandler.class.getName() + ".autoLoginFailed";

    private Supplier<PortalRequest> portalRequestSupplier;

    @Override
    public void initialize( final BeanContext context )
    {
        this.portalRequestSupplier = context.getBinding( PortalRequest.class );
    }

    public void autoLoginFailed()
    {
        final PortalRequest portalRequest = this.portalRequestSupplier.get();
        portalRequest.getRawRequest().setAttribute( AUTO_LOGIN_FAILED_ATTRIBUTE, Boolean.TRUE );
    }

    public boolean isAutoLoginFailed()
    {
        final PortalRequest portalRequest = this.portalRequestSupplier.get();
        return Boolean.TRUE.equals( portalRequest.getRawRequest().getAttribute( AUTO_LOGIN_FAILED_ATTRIBUTE ) );
    }
}
