package com.enonic.app.oidcidprovider.lib.configFile;

import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;
import com.enonic.xp.security.PrincipalKey;
import com.enonic.xp.security.SecurityService;
import java.util.function.Supplier;

public abstract class AbstractIdProviderHandler
        implements ScriptBean
{
    protected Supplier<SecurityService> securityService;

    protected boolean isPrincipalExists( final PrincipalKey principalKey )
    {
        return securityService.get().getPrincipal( principalKey ).isPresent();
    }

    @Override
    public void initialize( final BeanContext context )
    {
        this.securityService = context.getService( SecurityService.class );
    }
}
