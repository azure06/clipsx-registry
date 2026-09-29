export const repository = 'azure06/clipsx-registry'
export async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${options.token || process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: 'error',
  })
  if (!response.ok) throw Error(`GitHub registry operation failed: HTTP ${response.status}`)
  return response.json()
}
export const status = (sha, state, description) => api(`statuses/${sha}`, { method: 'POST', token: process.env.GH_STATUS_TOKEN, body: { state, context: 'publication-ready', description, target_url: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}` } })
