package com.enonic.app.oidcidprovider;

import java.util.Map;

public class Context
{
    private final String state;

    private final String nonce;

    private final String redirectUri;

    private final String originalUrl;

    private Context( final Builder builder )
    {
        state = builder.state;
        nonce = builder.nonce;
        redirectUri = builder.redirectUri;
        originalUrl = builder.originalUrl;
    }

    public static Builder create()
    {
        return new Builder();
    }

    public String getState()
    {
        return state;
    }

    public String getNonce()
    {
        return nonce;
    }

    public String getRedirectUri()
    {
        return redirectUri;
    }

    public String getOriginalUrl()
    {
        return originalUrl;
    }

    public Map<String, String> asMap() {
        return Map.of( "state", state, "nonce", nonce, "redirectUri", redirectUri, "originalUrl", originalUrl );
    }

    public static Context fromMap( final Map<String, String> map ) {
        return Context.create().
                state( map.get("state") ).
                nonce( map.get("nonce") ).
                redirectUri( map.get("redirectUri") ).
                originalUrl( map.get("originalUrl") ).
                build();
    }

    public static final class Builder
    {
        private String state;

        private String nonce;

        private String redirectUri;

        private String originalUrl;

        private Builder()
        {
        }

        public Builder state( final String state )
        {
            this.state = state;
            return this;
        }

        public Builder nonce( final String nonce )
        {
            this.nonce = nonce;
            return this;
        }

        public Builder redirectUri( final String redirectUri )
        {
            this.redirectUri = redirectUri;
            return this;
        }

        public Builder originalUrl( final String originalUrl )
        {
            this.originalUrl = originalUrl;
            return this;
        }

        public Context build()
        {
            return new Context( this );
        }
    }
}
