package com.enonic.app.oidcidprovider.handler;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

import com.enonic.app.oidcidprovider.mapper.MapMapper;
import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;
import com.enonic.xp.script.serializer.MapSerializable;
import com.enonic.xp.security.IdProviderKey;
import com.enonic.xp.security.PrincipalKey;
import com.enonic.xp.security.token.DeviceAuthService;
import com.enonic.xp.security.token.DeviceAuthorization;
import com.enonic.xp.security.token.DeviceAuthorizationParams;
import com.enonic.xp.security.token.DeviceAuthorizationPoll;

/**
 * Wraps the XP-core {@link DeviceAuthService}: the device-code / user-code lifecycle, the
 * cluster-shared pending store and its TTLs all live in core now. This bean only marshals
 * to and from script values. (The standalone version kept this state itself in a lib-grid map.)
 */
public class DeviceAuthHandler
    implements ScriptBean
{
    private Supplier<DeviceAuthService> deviceAuthService;

    /**
     * Starts a device authorization request (RFC 8628). Returns {@code deviceCode}, {@code userCode},
     * {@code expiresIn} and {@code interval}.
     */
    public MapSerializable start( final String idProvider, final String clientId, final String scope, final String audience,
                                  final long ttlSeconds, final long intervalSeconds )
    {
        final DeviceAuthorizationParams.Builder params = DeviceAuthorizationParams.create()
            .idProvider( IdProviderKey.from( idProvider ) )
            .ttl( Duration.ofSeconds( ttlSeconds ) )
            .interval( Duration.ofSeconds( intervalSeconds ) );

        if ( clientId != null && !clientId.isEmpty() )
        {
            params.clientId( clientId );
        }
        if ( scope != null && !scope.isEmpty() )
        {
            params.scope( scope );
        }
        if ( audience != null && !audience.isEmpty() )
        {
            params.audience( audience );
        }

        final DeviceAuthorization auth = deviceAuthService.get().start( params.build() );

        final Map<String, Object> result = new LinkedHashMap<>();
        result.put( "deviceCode", auth.getDeviceCode() );
        result.put( "userCode", auth.getUserCode() );
        result.put( "expiresIn", auth.getExpiresInSeconds() );
        result.put( "interval", auth.getIntervalSeconds() );
        return new MapMapper( result );
    }

    /**
     * Resolves a pending {@code userCode} to its {@code deviceCode} (for the verification page),
     * or {@code null} if none is pending.
     */
    public String findByUserCode( final String idProvider, final String userCode )
    {
        final Optional<String> deviceCode = deviceAuthService.get().findByUserCode( IdProviderKey.from( idProvider ), userCode );
        return deviceCode.orElse( null );
    }

    /**
     * Approves (binding the subject) or denies a pending request. Returns {@code false} if the
     * request no longer exists or is no longer pending.
     */
    public boolean resolve( final String idProvider, final String deviceCode, final boolean approved, final String subject )
    {
        final PrincipalKey principal = subject == null ? null : PrincipalKey.from( subject );
        return deviceAuthService.get().resolve( IdProviderKey.from( idProvider ), deviceCode, approved, principal );
    }

    /**
     * Polls a device request. Returns the lower-cased {@code state} (pending / slow_down / denied /
     * approved / expired) plus the approved {@code sub}, {@code audience}, {@code scope} and
     * {@code clientId} when the state is approved.
     */
    public MapSerializable poll( final String idProvider, final String deviceCode )
    {
        final DeviceAuthorizationPoll result = deviceAuthService.get().poll( IdProviderKey.from( idProvider ), deviceCode );

        final Map<String, Object> map = new LinkedHashMap<>();
        map.put( "state", result.getState().name().toLowerCase() );
        if ( result.getSubject() != null )
        {
            map.put( "sub", result.getSubject().toString() );
        }
        if ( result.getAudience() != null )
        {
            map.put( "audience", result.getAudience() );
        }
        if ( result.getScope() != null )
        {
            map.put( "scope", result.getScope() );
        }
        if ( result.getClientId() != null )
        {
            map.put( "clientId", result.getClientId() );
        }
        return new MapMapper( map );
    }

    @Override
    public void initialize( final BeanContext context )
    {
        this.deviceAuthService = context.getService( DeviceAuthService.class );
    }
}
