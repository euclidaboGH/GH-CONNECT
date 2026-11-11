import fs from 'node:fs'
import path from 'node:path'

const reportPath = path.join(process.cwd(), 'docs/RUN282-ACTIVE-MODULE-MAINTENANCE.json')
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
const expected = ['Community', 'GH Chat', 'Connections', 'Matches', 'Marketplace', 'Orders', 'Wallet', 'GHC', 'Pi Payments', 'Rewards', 'Membership']
const failures = []
if (report.run !== 282) failures.push('run number must be 282')
if (report.sourceVersion !== '0.338.46') failures.push('source version mismatch')
if (report.scope.activeModules !== 11) failures.push('active module count mismatch')
if (report.scope.pointsPerModule !== 30) failures.push('maintenance points per module mismatch')
if (report.scope.totalPoints !== 330) failures.push('total maintenance point count mismatch')
if (JSON.stringify(report.modules.map((item) => item.name)) !== JSON.stringify(expected)) failures.push('active module order/identity mismatch')
for (const module of report.modules) {
  if (!Array.isArray(module.maintenancePoints) || module.maintenancePoints.length !== 30) failures.push(`${module.name}: expected exactly 30 maintenance points`)
  if (module.maintenancePoints.some((point) => typeof point !== 'string' || point.trim().length < 8)) failures.push(`${module.name}: invalid maintenance point`)
}
if (report.verification.staticAssertionsPassed !== 3599 || report.verification.staticFailures !== 0) failures.push('static verification evidence mismatch')
if (report.verification.databaseMigrationsApplied !== 0 || report.verification.deployment !== 'NOT_DEPLOYED') failures.push('safety boundary mismatch')
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(1)
}
console.log('PASS Run #282 covers exactly 11 Active modules')
console.log('PASS every Active module has 30 surgical maintenance points')
console.log('PASS total reviewed maintenance scope is 330 points')
console.log('PASS static verification evidence and safety boundaries are recorded')
console.log('Run #282 active-module maintenance: 4/4 passed')
