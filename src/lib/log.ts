/**
 * One JSON object per line on stdout, which CloudWatch Logs Insights can query directly.
 * CloudWatch metric filters count the `event` values (see infra/modules/app/monitoring.tf).
 */
export function log(event: string, fields: Record<string, unknown> = {}, level: 'info' | 'error' = 'info') {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields })
  if (level === 'error') console.error(line)
  else console.log(line)
}
