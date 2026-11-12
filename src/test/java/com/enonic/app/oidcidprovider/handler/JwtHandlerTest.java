package com.enonic.app.oidcidprovider.handler;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

import com.enonic.xp.app.ApplicationKey;
import com.enonic.xp.resource.ResourceKey;
import com.enonic.xp.script.bean.BeanContext;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

public class JwtHandlerTest
{
    private static final String ID_PROVIDER = "jwthandlertest";

    private static final String ISSUER = "https://tenant.example.com/";

    private static KeyPair providerKeys;

    private static KeyPair otherKeys;

    private static JwtHandler handler;

    @BeforeAll
    public static void setUp( @TempDir final Path dir )
        throws Exception
    {
        final KeyPairGenerator generator = KeyPairGenerator.getInstance( "RSA" );
        generator.initialize( 2048 );
        providerKeys = generator.generateKeyPair();
        otherKeys = generator.generateKeyPair();

        final RSAPublicKey publicKey = (RSAPublicKey) providerKeys.getPublic();
        final Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        final String jwks = "{\"keys\":[{\"kty\":\"RSA\",\"use\":\"sig\",\"alg\":\"RS256\",\"kid\":\"key1\",\"n\":\"" +
            encoder.encodeToString( unsigned( publicKey.getModulus().toByteArray() ) ) + "\",\"e\":\"" +
            encoder.encodeToString( unsigned( publicKey.getPublicExponent().toByteArray() ) ) + "\"}]}";
        final Path jwksFile = Files.writeString( dir.resolve( "jwks.json" ), jwks, StandardCharsets.UTF_8 );

        final IdProviderConfigService configService = new IdProviderConfigService();
        configService.storeConfig( ID_PROVIDER, Map.of( "jwksUri", jwksFile.toUri().toString() ) );

        handler = new JwtHandler();
        handler.initialize( new BeanContext()
        {
            @Override
            public ApplicationKey getApplicationKey()
            {
                return ApplicationKey.from( "com.enonic.app.oidcidprovider" );
            }

            @Override
            public ResourceKey getResourceKey()
            {
                return null;
            }

            @Override
            public <T> Supplier<T> getBinding( final Class<T> type )
            {
                return () -> null;
            }

            @Override
            public <T> Supplier<T> getService( final Class<T> type )
            {
                return () -> type.cast( configService );
            }
        } );
    }

    private static byte[] unsigned( final byte[] bytes )
    {
        return bytes.length > 1 && bytes[0] == 0 ? java.util.Arrays.copyOfRange( bytes, 1, bytes.length ) : bytes;
    }

    private static String token( final KeyPair keys, final String issuer )
    {
        return JWT.create()
            .withKeyId( "key1" )
            .withIssuer( issuer )
            .withSubject( "alice" )
            .withAudience( "https://api.example.com/api/mcp" )
            .withExpiresAt( Instant.now().plusSeconds( 300 ) )
            .sign( Algorithm.RSA256( (RSAPublicKey) keys.getPublic(), (RSAPrivateKey) keys.getPrivate() ) );
    }

    @Test
    public void aTokenOfAnAllowedIssuerIsAccepted()
    {
        assertNotNull( handler.validateTokenAndGetPayload( token( providerKeys, ISSUER ), ID_PROVIDER, List.of(), List.of( ISSUER ) ) );
        assertNotNull( handler.validateTokenAndGetPayload( token( providerKeys, ISSUER ), ID_PROVIDER, List.of(),
                                                           List.of( "https://other.example.com/", ISSUER ) ) );
    }

    @Test
    public void aTokenOfAnotherIssuerSignedWithTheProvidersKeysIsRefused()
    {
        final String otherTenant = token( providerKeys, "https://other-tenant.example.com/" );

        assertNull( handler.validateTokenAndGetPayload( otherTenant, ID_PROVIDER, List.of(), List.of( ISSUER ) ) );
        // the issuer compares as a string
        assertNull( handler.validateTokenAndGetPayload( token( providerKeys, "https://tenant.example.com" ), ID_PROVIDER, List.of(),
                                                        List.of( ISSUER ) ) );
    }

    @Test
    public void withoutAllowedIssuersTheIssuerIsNotChecked()
    {
        final String otherTenant = token( providerKeys, "https://other-tenant.example.com/" );

        assertNotNull( handler.validateTokenAndGetPayload( otherTenant, ID_PROVIDER, List.of(), List.of() ) );
    }

    @Test
    public void aTokenSignedWithOtherKeysIsRefusedWhateverItsIssuer()
    {
        assertNull( handler.validateTokenAndGetPayload( token( otherKeys, ISSUER ), ID_PROVIDER, List.of(), List.of( ISSUER ) ) );
    }
}
