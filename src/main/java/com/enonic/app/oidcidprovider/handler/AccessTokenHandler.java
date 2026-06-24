package com.enonic.app.oidcidprovider.handler;

import java.time.Duration;
import java.util.Arrays;
import java.util.function.Supplier;

import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;
import com.enonic.xp.security.PrincipalKey;
import com.enonic.xp.security.token.AccessTokenParams;
import com.enonic.xp.security.token.AccessTokenService;

/**
 * Issues self-issued access tokens by delegating to the XP-core {@link AccessTokenService}.
 * <p>
 * With Plan B in place, token signing, the managed keyring and key rotation all live in core; this
 * bean only assembles the issue parameters. Token <i>verification</i> and bearer login are likewise
 * handled by core (the access-token authenticator gated on the {@code autologin} flow), so this app
 * no longer signs or verifies tokens itself - the auth0 JWT plumbing that the standalone version
 * carried for this is gone.
 */
public class AccessTokenHandler
    implements ScriptBean
{
    private Supplier<AccessTokenService> accessTokenService;

    /**
     * Issues an HS512 {@code at+jwt} access token for the given subject. {@code audience} is a
     * space-separated list of RFC 8707 resource indicators (may be empty).
     */
    public String issue( final String subject, final String issuer, final String audience, final String clientId, final String scope,
                         final long ttlSeconds )
    {
        final AccessTokenParams.Builder params = AccessTokenParams.create()
            .subject( PrincipalKey.from( subject ) )
            .issuer( issuer )
            .ttl( Duration.ofSeconds( ttlSeconds ) );

        for ( final String aud : splitToArray( audience ) )
        {
            params.addAudience( aud );
        }
        if ( clientId != null && !clientId.isEmpty() )
        {
            params.clientId( clientId );
        }
        if ( scope != null && !scope.isEmpty() )
        {
            params.scope( scope );
        }

        return accessTokenService.get().issue( params.build() );
    }

    private static String[] splitToArray( final String value )
    {
        if ( value == null || value.isBlank() )
        {
            return new String[0];
        }
        return Arrays.stream( value.trim().split( "\\s+" ) ).filter( s -> !s.isEmpty() ).toArray( String[]::new );
    }

    @Override
    public void initialize( final BeanContext context )
    {
        this.accessTokenService = context.getService( AccessTokenService.class );
    }
}
