# Load environment variables from .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Set Node.js to trust the Supabase certificate for HTTPS requests (JWKS fetching for JWT verification)
$env:NODE_EXTRA_CA_CERTS = "C:/Users/sayantan.sen/Downloads/prod-ca-2021.crt"

# Start the backend with tsx
npx tsx watch src/main.ts
