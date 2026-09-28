<#
.SYNOPSIS
  Instala Rímac 21 en el servidor: compila, crea el .env de producción, prepara la
  base de datos, crea la cuenta admin y registra el servicio de Windows.

.EXAMPLE
  # PowerShell como Administrador, en la carpeta del repositorio:
  Set-ExecutionPolicy -Scope Process Bypass
  .\deploy\windows\instalar.ps1 -Dominio rimac21.duckdns.org

.NOTES
  Se puede volver a ejecutar: no sobrescribe el .env ni la base de datos existentes.
#>
param(
  [Parameter(Mandatory = $true)][string]$Dominio,
  [string]$SqlInstancia = "localhost\SQLEXPRESS",
  [string]$BaseDatos = "Rimac21Instruccion",
  [int]$Puerto = 3000,
  [string]$Servicio = "Rimac21"
)

$ErrorActionPreference = "Stop"
$Repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$Backend = Join-Path $Repo "backend"
$Frontend = Join-Path $Repo "frontend"
$Scripts = Join-Path $Repo "database\scripts"
$Datos = "C:\ProgramData\Rimac21"

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "    OK  $texto" -ForegroundColor Green }
function Falla($texto) { Write-Host "    ERROR  $texto" -ForegroundColor Red; exit 1 }
function Secreto([int]$bytes = 48) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}
function Ejecutar($exe, $argumentos, $carpeta) {
  Push-Location $carpeta
  try {
    & $exe @argumentos
    if ($LASTEXITCODE -ne 0) { Falla "$exe $($argumentos -join ' ') terminó con código $LASTEXITCODE" }
  } finally { Pop-Location }
}
function Sql($consulta, $bd = "master") {
  $salida = & sqlcmd -S $SqlInstancia -E -d $bd -b -I -h -1 -W -Q "SET NOCOUNT ON; $consulta" 2>&1
  if ($LASTEXITCODE -ne 0) { Falla "SQL: $salida" }
  return $salida
}

# --- 0. Requisitos ----------------------------------------------------------
Paso "Comprobando requisitos"
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Falla "Ejecute PowerShell como Administrador" }
foreach ($cmd in "node", "npm", "git", "sqlcmd") {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Falla "No se encontró '$cmd'. Instálelo (ver docs/despliegue.md)" }
}
$versionNode = [int]((node -v).TrimStart('v').Split('.')[0])
if ($versionNode -lt 20) { Falla "Se requiere Node.js 20 o superior (hay $(node -v))" }
Ok "Node $(node -v)"

$driver = Get-OdbcDriver -Platform 64-bit | Where-Object { $_.Name -match '^ODBC Driver (17|18) for SQL Server$' } |
  Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty Name
if (-not $driver) { Falla "Falta el 'ODBC Driver 17/18 for SQL Server' (descarga gratuita de Microsoft)" }
Ok "Driver: $driver"

Sql "SELECT 1" | Out-Null
Ok "SQL Server accesible en $SqlInstancia"

# --- 1. Compilar -------------------------------------------------------------
Paso "Compilando la web (frontend)"
Ejecutar "npm" @("ci", "--no-audit", "--no-fund") $Frontend
Ejecutar "npm" @("run", "build") $Frontend
Ok "frontend\dist"

Paso "Compilando la API (backend)"
Ejecutar "npm" @("ci", "--no-audit", "--no-fund") $Backend
Ejecutar "npm" @("run", "build") $Backend
Ok "backend\dist"

# --- 2. Configuración (.env) -------------------------------------------------
Paso "Configuración de producción"
$envArchivo = Join-Path $Backend ".env"
if (Test-Path $envArchivo) {
  Ok ".env ya existe: se conserva (bórrelo si quiere regenerarlo)"
} else {
  $valores = [ordered]@{
    NODE_ENV = "production"; PORT = "$Puerto"; API_PREFIX = "api"
    DB_HOST = $SqlInstancia; DB_PORT = ""; DB_NAME = $BaseDatos; DB_ODBC_DRIVER = $driver
    JWT_ACCESS_SECRET = (Secreto); JWT_REFRESH_SECRET = (Secreto); JWT_ACCESS_TTL = "5m"
    SESSION_IDLE_MINUTES = "5"; CORS_ORIGIN = "https://$Dominio"; TRUST_PROXY = "loopback"
    COOKIE_SECURE = "true"; JORNADAS_AUTOMATICAS = "false"
  }
  $lineas = @("# Generado por instalar.ps1 el $(Get-Date -Format 'yyyy-MM-dd HH:mm'). No subir a git.")
  foreach ($k in $valores.Keys) { $lineas += "$k=$($valores[$k])" }
  [IO.File]::WriteAllText($envArchivo, ($lineas -join "`r`n") + "`r`n", (New-Object Text.UTF8Encoding($false)))
  # Solo Administradores y SYSTEM pueden leer los secretos
  icacls $envArchivo /inheritance:r /grant:r "Administrators:F" "SYSTEM:F" | Out-Null
  Ok ".env creado con secretos nuevos (solo lo leen Administradores y SYSTEM)"
}

# --- 3. Base de datos --------------------------------------------------------
Paso "Base de datos $BaseDatos"
$existe = (Sql "SELECT COUNT(*) FROM sys.databases WHERE name = N'$BaseDatos'").Trim()
if ($existe -eq "1") {
  Ok "Ya existe: no se modifica"
} else {
  # El script completo crea la BD con su nombre fijo; se adapta si se eligió otro
  $completo = Get-Content (Join-Path $Scripts "rimac21_base_datos_completa.sql") -Raw -Encoding UTF8
  $tmp = Join-Path $env:TEMP "rimac21_esquema.sql"
  [IO.File]::WriteAllText($tmp, $completo.Replace("Rimac21Instruccion", $BaseDatos), (New-Object Text.UTF8Encoding($true)))
  & sqlcmd -S $SqlInstancia -E -b -I -f 65001 -i $tmp | Out-Null
  if ($LASTEXITCODE -ne 0) { Falla "No se pudo crear el esquema (revise $tmp)" }
  Ok "Esquema creado"
  $migraciones = @(
    "20260927_geocerca_poligonal", "20260927_credenciales_qr", "20260927_personas_dni_opcional",
    "20260927_regla_asistencia_por_jornada", "20260927_esbas_disponible_todo_el_dia",
    "20260927_salida_dinamica_corte_diario", "20260927_jornada_automatica_y_reglas_citacion",
    "20260927_programacion_obligatoria_dinamica", "20260927_promover_solo_jefe_y_quitar_integrante"
  )
  foreach ($m in $migraciones) {
    & sqlcmd -S $SqlInstancia -E -d $BaseDatos -b -I -f 65001 -i (Join-Path $Scripts "$m.sql") | Out-Null
    if ($LASTEXITCODE -ne 0) { Falla "Falló la migración $m" }
    Ok $m
  }
}

# El servicio corre como LocalSystem: su login en SQL Server es NT AUTHORITY\SYSTEM
Sql @"
IF SUSER_ID(N'NT AUTHORITY\SYSTEM') IS NULL CREATE LOGIN [NT AUTHORITY\SYSTEM] FROM WINDOWS;
"@ | Out-Null
Sql @"
IF USER_ID(N'NT AUTHORITY\SYSTEM') IS NULL CREATE USER [NT AUTHORITY\SYSTEM] FOR LOGIN [NT AUTHORITY\SYSTEM];
ALTER ROLE db_datareader ADD MEMBER [NT AUTHORITY\SYSTEM];
ALTER ROLE db_datawriter ADD MEMBER [NT AUTHORITY\SYSTEM];
GRANT EXECUTE TO [NT AUTHORITY\SYSTEM];
"@ $BaseDatos | Out-Null
Ok "Permisos de la BD para el servicio"

# --- 4. Cuenta admin ---------------------------------------------------------
Paso "Cuenta inicial"
$hayAdmin = (Sql "SELECT COUNT(*) FROM usuarios WHERE username = 'admin'" $BaseDatos).Trim()
$passwordAdmin = $null
if ($hayAdmin -eq "0") { $passwordAdmin = Secreto 12 }
$env:NODE_ENV = "production"
$env:SEED_ADMIN_PASSWORD = $passwordAdmin
Ejecutar "npm" @("run", "seed") $Backend
Remove-Item Env:SEED_ADMIN_PASSWORD -ErrorAction SilentlyContinue
Ok "Permisos y cuenta admin listos"

# --- 5. Servicio de Windows (NSSM) -------------------------------------------
Paso "Servicio de Windows '$Servicio'"
New-Item -ItemType Directory -Force "$Datos\logs" | Out-Null
$nssm = "$Datos\nssm.exe"
if (-not (Test-Path $nssm)) {
  $zip = Join-Path $env:TEMP "nssm.zip"
  Invoke-WebRequest "https://nssm.cc/release/nssm-2.24.zip" -OutFile $zip -UseBasicParsing
  Expand-Archive $zip -DestinationPath "$env:TEMP\nssm" -Force
  Copy-Item "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" $nssm
}
$nodeExe = (Get-Command node).Source
if (Get-Service $Servicio -ErrorAction SilentlyContinue) {
  & $nssm stop $Servicio | Out-Null
} else {
  & $nssm install $Servicio $nodeExe "dist\main.js" | Out-Null
}
& $nssm set $Servicio Application $nodeExe | Out-Null
& $nssm set $Servicio AppParameters "dist\main.js" | Out-Null
& $nssm set $Servicio AppDirectory $Backend | Out-Null
& $nssm set $Servicio DisplayName "Rimac 21 - Sistema de Instruccion" | Out-Null
& $nssm set $Servicio Start SERVICE_AUTO_START | Out-Null
& $nssm set $Servicio AppStdout "$Datos\logs\salida.log" | Out-Null
& $nssm set $Servicio AppStderr "$Datos\logs\errores.log" | Out-Null
& $nssm set $Servicio AppRotateFiles 1 | Out-Null
& $nssm set $Servicio AppRotateBytes 10485760 | Out-Null
& $nssm start $Servicio | Out-Null

$sano = $false
for ($i = 0; $i -lt 30 -and -not $sano; $i++) {
  Start-Sleep -Seconds 2
  try { $sano = (Invoke-RestMethod "http://localhost:$Puerto/api/health" -TimeoutSec 3).status -eq "ok" } catch { }
}
if (-not $sano) { Falla "El servicio no responde. Revise $Datos\logs\errores.log" }
Ok "Servicio en marcha: http://localhost:$Puerto"

# --- Resumen -----------------------------------------------------------------
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " Instalación completa" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
if ($passwordAdmin) {
  Write-Host " Usuario:    admin"
  Write-Host " Contraseña: $passwordAdmin" -ForegroundColor Yellow
  Write-Host " Anótela: no se volverá a mostrar. Cámbiela al entrar."
}
Write-Host " Siguiente paso: .\deploy\windows\configurar-iis.ps1 -Dominio $Dominio"
