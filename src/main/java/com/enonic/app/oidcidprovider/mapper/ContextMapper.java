package com.enonic.app.oidcidprovider.mapper;

import com.enonic.app.oidcidprovider.Context;
import com.enonic.xp.script.serializer.MapGenerator;
import com.enonic.xp.script.serializer.MapSerializable;

public class ContextMapper
    implements MapSerializable
{
    private final Context context;

    private ContextMapper( final Builder builder )
    {
        context = builder.context;
    }

    public static ContextMapper from( final Context context )
    {
        return create().context( context ).build();
    }

    public static Builder create()
    {
        return new Builder();
    }

    @Override
    public void serialize( final MapGenerator gen )
    {
        gen.value( "state", context.getState() );
        gen.value( "nonce", context.getNonce() );
        gen.value( "originalUrl", context.getOriginalUrl() );
        gen.value( "redirectUri", context.getRedirectUri() );
        gen.value( "codeVerifier", context.getCodeVerifier() );
    }

    public static final class Builder
    {
        private Context context;

        private Builder()
        {
        }

        public Builder context( final Context context )
        {
            this.context = context;
            return this;
        }

        public ContextMapper build()
        {
            return new ContextMapper( this );
        }
    }
}
