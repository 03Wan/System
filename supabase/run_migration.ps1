param(
  [string]$MySqlHost = "127.0.0.1",
  [int]$MySqlPort = 3306,
  [string]$MySqlUser = "root",
  [string]$MySqlPassword = "123456",
  [string]$MySqlDb = "thesis_check_system",
  [string]$PgDsn = "",
  [switch]$DryRun
)

if ([string]::IsNullOrWhiteSpace($PgDsn)) {
  Write-Error "PgDsn is required. Example: postgresql://postgres:<URL_ENCODED_PASSWORD>@db.apgnzbpmnoithipeunks.supabase.co:5432/postgres?sslmode=require"
  exit 1
}

$args = @(
  "supabase/migrate_mysql_to_supabase.py",
  "--mysql-host", $MySqlHost,
  "--mysql-port", $MySqlPort,
  "--mysql-user", $MySqlUser,
  "--mysql-password", $MySqlPassword,
  "--mysql-db", $MySqlDb,
  "--pg-dsn", $PgDsn
)

if ($DryRun) {
  $args += "--dry-run"
}

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
  $pythonCommand = Get-Command py -ErrorAction SilentlyContinue
}

if (-not $pythonCommand) {
  Write-Error "Neither python nor py was found in PATH."
  exit 1
}

& $pythonCommand.Source @args
