export type LogLevel = 'info' | 'warn' | 'error'

export function log(level: LogLevel, message: string, metadata: Record<string, unknown> = {}): void {
  const entry = { timestamp: new Date().toISOString(), level, message, ...metadata }
  const output = JSON.stringify(entry)
  if (level === 'error') console.error(output)
  else console.log(output)
}