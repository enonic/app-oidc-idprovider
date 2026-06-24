package com.enonic.app.oidcidprovider.handler;

import java.util.Optional;

import com.enonic.xp.portal.PortalRequest;
import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;
import com.enonic.xp.security.IdProviderKey;
import com.enonic.xp.web.vhost.IdProviderFlow;
import com.enonic.xp.web.vhost.VirtualHost;
import com.enonic.xp.web.vhost.VirtualHostHelper;

/**
 * Reads the per-vhost id-provider flow gating contributed by XP core (Plan B).
 * <p>
 * The standalone version could not gate issuance per vhost, because it builds against a published
 * XP that did not expose {@link VirtualHost#getIdProviderFlows(IdProviderKey)}. With Plan B in
 * place the device and native <i>issuance</i> endpoints are served only when the matching flow is
 * enabled for this id provider on the current virtual host (e.g. mapping value
 * {@code enabled=login,autologin,device}). Login/autologin gating and bearer-token acceptance are
 * enforced by core itself.
 */
public class VirtualHostFlowHandler
    implements ScriptBean
{
    private PortalRequest portalRequest;

    public boolean isFlowEnabled( final String idProvider, final String flow )
    {
        final Optional<IdProviderFlow> parsed = IdProviderFlow.from( flow );
        if ( parsed.isEmpty() )
        {
            return false;
        }

        final VirtualHost virtualHost = VirtualHostHelper.getVirtualHost( portalRequest.getRawRequest() );
        if ( virtualHost == null )
        {
            return false;
        }

        return virtualHost.getIdProviderFlows( IdProviderKey.from( idProvider ) ).contains( parsed.get() );
    }

    @Override
    public void initialize( final BeanContext context )
    {
        this.portalRequest = context.getBinding( PortalRequest.class ).get();
    }
}
