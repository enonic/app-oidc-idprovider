package com.enonic.app.oidcidprovider.handler;

import java.util.Map;
import java.util.function.Supplier;

import com.enonic.app.oidcidprovider.mapper.MapMapper;
import com.enonic.xp.script.ScriptValue;
import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;

public class IdProviderConfigHandler
    implements ScriptBean
{
    private Supplier<IdProviderConfigService> idProviderConfigServiceSupplier;

    @Override
    public void initialize( final BeanContext context )
    {
        this.idProviderConfigServiceSupplier = context.getService( IdProviderConfigService.class );
    }

    public void storeConfig( final String key, final ScriptValue config )
    {
        idProviderConfigServiceSupplier.get().storeConfig( key, config.getMap() );
    }

    public Object getConfig( final String key )
    {
        final Map<String, Object> config = idProviderConfigServiceSupplier.get().getConfig( key );
        return config != null ? new MapMapper( config ) : null;
    }
}
