# Clear Next.js Cache Script
Write-Host "Clearing Next.js cache..."

# Remove .next folder if it exists
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "✓ Deleted .next folder"
} else {
    Write-Host "ℹ .next folder not found"
}

# Remove node_modules cache if it exists
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache"
    Write-Host "✓ Deleted node_modules cache"
} else {
    Write-Host "ℹ node_modules cache not found"
}

# Clear npm cache
Write-Host "Clearing npm cache..."
npm cache clean --force 2>&1 | Out-Null
Write-Host "✓ npm cache cleared"

Write-Host ""
Write-Host "Cache cleared! Now restart your dev server with: npm run dev"
Write-Host "Then hard refresh your browser: Ctrl+Shift+R"

