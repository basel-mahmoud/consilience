namespace Consilience.Gateway;

/// <summary>
/// Adds baseline security response headers to every response. The gateway serves JSON and a
/// WebSocket hub (no HTML), so the policy is strict: deny framing, no MIME sniffing, no referrer
/// leakage, and a locked-down permissions policy.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()";
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
        return next(context);
    }
}
