package com.enonic.app.oidcidprovider.mapper;

import java.util.Map;

import com.enonic.xp.script.serializer.MapGenerator;
import com.enonic.xp.script.serializer.MapSerializable;

public class ClaimSetMapper
    implements MapSerializable
{
    private final Map<String, Object> claimMap;

    private ClaimSetMapper( final Builder builder )
    {
        claimMap = builder.claimMap;
    }

    public static Builder create()
    {
        return new Builder();
    }

    @Override
    public void serialize( final MapGenerator gen )
    {
        for ( Map.Entry<String, Object> claimEntry : claimMap.entrySet() )
        {
            gen.value( claimEntry.getKey(), claimEntry.getValue() );
        }
    }

    public static final class Builder
    {
        private Map<String, Object> claimMap;

        private Builder()
        {
        }

        public Builder claimMap( final Map<String, Object> claimMap )
        {
            this.claimMap = claimMap;
            return this;
        }

        public ClaimSetMapper build()
        {
            return new ClaimSetMapper( this );
        }
    }
}
