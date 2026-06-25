package com.enonic.app.oidcidprovider.handler;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;

import com.enonic.app.oidcidprovider.jwt.JwtUtil;
import com.enonic.app.oidcidprovider.mapper.MapMapper;
import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;
import com.enonic.xp.script.serializer.MapSerializable;

/**
 * Mints and verifies the self-issued device-login access tokens: symmetric (HS512) JWTs following
 * RFC 9068 ({@code typ=at+jwt}, a {@code kid} header, and the iss/sub/aud/exp/iat/jti/client_id
 * claims).
 */
public class DeviceTokenHandler
    implements ScriptBean
{
    private static final Logger LOG = LoggerFactory.getLogger( DeviceTokenHandler.class );

    private static final String TYP = "at+jwt";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private static final Base64.Encoder B64URL_NOPAD = Base64.getUrlEncoder().withoutPadding();

    // RFC 8628 section 6.1 recommended user-code character set (no easily confused characters).
    private static final char[] USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ".toCharArray();

    /**
     * High-entropy, URL-safe device_code (the secret the client polls with).
     */
    public String generateDeviceCode()
    {
        final byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes( bytes );
        return B64URL_NOPAD.encodeToString( bytes );
    }

    /**
     * Short, human-enterable user_code, formatted as XXXX-XXXX.
     */
    public String generateUserCode()
    {
        final StringBuilder sb = new StringBuilder( 9 );
        for ( int i = 0; i < 8; i++ )
        {
            if ( i == 4 )
            {
                sb.append( '-' );
            }
            sb.append( USER_CODE_ALPHABET[SECURE_RANDOM.nextInt( USER_CODE_ALPHABET.length )] );
        }
        return sb.toString();
    }

    /**
     * URL-safe Base64 (no padding) of a UTF-8 string.
     */
    public String base64UrlEncode( final String value )
    {
        return B64URL_NOPAD.encodeToString( value.getBytes( StandardCharsets.UTF_8 ) );
    }

    /**
     * Reverses {@link #base64UrlEncode}; throws {@link IllegalArgumentException} on non-Base64 input.
     */
    public String base64UrlDecode( final String value )
    {
        return new String( Base64.getUrlDecoder().decode( value ), StandardCharsets.UTF_8 );
    }

    public String sign( final String secret, final String kid, final String issuer, final String subject, final String audience,
                        final String clientId, final String scope, final int expiresInSeconds )
    {
        final Instant now = Instant.now();

        // Optional claims are omitted when empty rather than emitted as empty strings.
        final com.auth0.jwt.JWTCreator.Builder builder = JWT.create()
            .withKeyId( kid )
            .withHeader( java.util.Map.of( "typ", TYP ) )
            .withIssuer( issuer )
            .withSubject( subject )
            .withIssuedAt( now )
            .withExpiresAt( now.plusSeconds( expiresInSeconds ) )
            .withJWTId( UUID.randomUUID().toString() );

        final String[] audiences = splitToArray( audience );
        if ( audiences.length > 0 )
        {
            builder.withAudience( audiences );
        }
        if ( clientId != null && !clientId.isEmpty() )
        {
            builder.withClaim( "client_id", clientId );
        }
        if ( scope != null && !scope.isEmpty() )
        {
            builder.withClaim( "scope", scope );
        }

        return builder.sign( Algorithm.HMAC512( secret ) );
    }

    /**
     * Verifies a self-issued token: signature (HS512 with the shared secret),
     * issuer, expiry and audience. The algorithm is pinned to HS512 - the
     * token header is never trusted to pick the algorithm.
     *
     * @return the decoded payload, or {@code null} if verification fails.
     */
    public MapSerializable verify( final String token, final String secret, final String issuer, final List<String> allowedAudience )
    {
        if ( token == null || secret == null )
        {
            return null;
        }

        try
        {
            final DecodedJWT decodedJWT = JWT.require( Algorithm.HMAC512( secret ) )
                .withIssuer( issuer )
                .acceptLeeway( 1 )
                .build()
                .verify( token );

            if ( allowedAudience != null && !allowedAudience.isEmpty() )
            {
                final List<String> audience = decodedJWT.getAudience();
                final Set<String> intersection = audience == null
                    ? Set.of()
                    : audience.stream().filter( allowedAudience::contains ).collect( Collectors.toSet() );
                if ( intersection.isEmpty() )
                {
                    LOG.debug( "Device token rejected: audience {} not in allowed {}", audience, allowedAudience );
                    return null;
                }
            }

            return new MapMapper( JwtUtil.parsePayload( decodedJWT.getPayload() ) );
        }
        catch ( Exception e )
        {
            LOG.debug( "Failed to verify device token: {}", e.getMessage() );
            return null;
        }
    }

    /**
     * Decodes the issuer claim of a token <b>without</b> verifying its signature.
     * Used only to route a bearer token to the correct verifier - never to trust it.
     */
    public String peekIssuer( final String token )
    {
        try
        {
            return JWT.decode( token ).getIssuer();
        }
        catch ( Exception e )
        {
            return null;
        }
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
        // no services required
    }
}
