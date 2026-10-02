# Per-repo fleet start config for civitai-mcp
# Edit ports/backend target here - start.ps1 is fleet-standard.
@{
    Name         = 'civitai-mcp'
    BackendPort  = 11124
    FrontendPort = 11125
    HealthPath   = '/api/health'
    WebRoot      = 'webapp'
    Backend = @{
        Kind          = 'uvicorn'
        UvicornTarget = 'civitai_mcp.server:app'
        SyncExtras    = @('dev')
        Env           = @{ WEB_PORT = '11124' }
    }
    Frontend = @{
        Kind           = 'vite-npm'
        PackageManager = 'npm'
        PortEnvVar     = 'VITE_PORT'
        ApiTargetEnv   = 'VITE_API_TARGET'
    }
}
