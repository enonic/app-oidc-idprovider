package com.enonic.app.oidcidprovider.mapper;

import java.util.Map;

import com.enonic.xp.script.serializer.MapGenerator;
import com.enonic.xp.script.serializer.MapSerializable;

public final class MapMapper
    implements MapSerializable
{
    private final Map<?, ?> value;

    public MapMapper( final Map<?, ?> value )
    {
        this.value = value;
    }

    @Override
    public void serialize( final MapGenerator gen )
    {
        if ( this.value != null )
        {
            serializeMap( gen, this.value );
        }
    }

    public static void serializeMap( final MapGenerator gen, final Map<?, ?> map )
    {
        for ( final Map.Entry<?, ?> entry : map.entrySet() )
        {
            gen.value( entry.getKey().toString(), entry.getValue() );
        }
    }
}
