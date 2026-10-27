/** Liveness: the process is up. The load balancer uses this. */
export function GET() {
  return Response.json({ status: 'ok' })
}
