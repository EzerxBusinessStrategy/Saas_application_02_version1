# Load environment variables from .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Avoid starting a second watcher when the backend is already serving this port.
$port = if ($env:BACKEND_PORT) { [int]$env:BACKEND_PORT } else { 4000 }
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $owner = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    try {
        $live = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/v1/health/live" -UseBasicParsing -TimeoutSec 2
        if ($live.StatusCode -eq 200) {
            Write-Host "Backend already running on port $port (PID $($listener.OwningProcess))."
            exit 0
        }
    } catch {}
    throw "Port $port is already used by $($owner.ProcessName) (PID $($listener.OwningProcess)). Stop that process or set BACKEND_PORT to a free port."
}

# Set Node.js to trust the Supabase certificate for HTTPS requests (JWKS fetching for JWT verification)
$env:NODE_EXTRA_CA_CERTS = "C:/Users/sayantan.sen/Downloads/prod-ca-2021.crt"
$env:NODE_USE_SYSTEM_CA = "1"

# Start the backend with tsx
npx tsx watch src/main.ts
