import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000'

const NAV_ITEMS = [
  'Overview',
  'Live Monitor',
  'Security Sandbox',
  'Threat Explorer',
  'Agent Risk',
  'Approval Queue',
  'Audit Logs',
] as const

type NavItem = (typeof NAV_ITEMS)[number]

type RiskLevel = 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN'

interface EventItem {
  id: string
  timestamp: string
  agent_id: string
  tool: string
  prompt: string
  risk: string
  decision: string
  reason: string
}

interface PolicyItem {
  title: string
  tools: string
  risk: 'Low' | 'Review' | 'Blocked'
  description: string
}

const POLICY_ITEMS: PolicyItem[] = [
  {
    title: 'Safe read-only tools',
    tools: 'search_web, read_docs, get_weather',
    risk: 'Low',
    description: 'Read-only requests are evaluated as low risk and allowed immediately.',
  },
  {
    title: 'Sensitive workflow actions',
    tools: 'send_email, write_database, post_tweet',
    risk: 'Review',
    description: 'These actions trigger human approval because they change external state.',
  },
  {
    title: 'Destructive system calls',
    tools: 'execute_shell, drop_database_table, delete_file',
    risk: 'Blocked',
    description: 'High-risk operations are blocked by default and logged as critical events.',
  },
]

function formatDateTime(value: string) {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function classForRisk(value: string) {
  const normalized = (value || 'UNKNOWN').toUpperCase()

  if (normalized === 'GREEN') return 'status-green'
  if (normalized === 'AMBER') return 'status-amber'
  if (normalized === 'RED') return 'status-red'
  return 'status-unknown'
}

function statusLabel(value: string) {
  const normalized = (value || 'unknown').toUpperCase()
  if (normalized === 'GREEN') return 'Allow'
  if (normalized === 'AMBER') return 'Review'
  if (normalized === 'RED') return 'Block'
  return 'Unknown'
}

function StatCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: string
  helper: string
  tone: 'blue' | 'green' | 'amber' | 'red'
}) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-helper">{helper}</div>
    </article>
  )
}

function StatusBadge({ value }: { value: string }) {
  const normalized = (value || 'unknown').toUpperCase()
  return <span className={`status-badge ${classForRisk(normalized)}`}>{statusLabel(normalized)}</span>
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Security</p>
          <h2>{title}</h2>
        </div>
        {description ? <p className="panel-description">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function App() {
  const [activeSection, setActiveSection] = useState<NavItem>('Overview')
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [agentForm, setAgentForm] = useState({
    agent_id: 'demo-agent',
    tool: 'search_web',
    prompt: 'Find the latest AI security research for a policy review.',
  })
  const [agentResult, setAgentResult] = useState<EventItem | null>(null)

  const fetchEvents = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/events`)
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`)
      }

      const data = (await response.json()) as EventItem[]
      setEvents(Array.isArray(data) ? data : [])
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to load the security feed.'
      setError(message)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchEvents()
  }, [])

  const summary = useMemo(() => {
    const total = events.length
    const green = events.filter((event) => (event.risk || '').toUpperCase() === 'GREEN').length
    const amber = events.filter((event) => (event.risk || '').toUpperCase() === 'AMBER').length
    const red = events.filter((event) => (event.risk || '').toUpperCase() === 'RED').length
    const approval = events.filter((event) => (event.decision || '').toUpperCase().includes('APPROVAL')).length

    return { total, green, amber, red, approval }
  }, [events])

  const riskBreakdown = useMemo(() => {
    const record = {
      GREEN: 0,
      AMBER: 0,
      RED: 0,
    }

    events.forEach((event) => {
      const risk = (event.risk || 'UNKNOWN').toUpperCase()
      if (risk in record) {
        record[risk as keyof typeof record] += 1
      }
    })

    return [
      { label: 'Low Risk', value: record.GREEN, tone: 'green' },
      { label: 'Human Review', value: record.AMBER, tone: 'amber' },
      { label: 'Blocked', value: record.RED, tone: 'red' },
    ]
  }, [events])

  const reviewQueue = useMemo(
    () => events.filter((event) => (event.decision || '').toUpperCase().includes('APPROVAL') || event.risk === 'AMBER'),
    [events],
  )

  const handleEvaluate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentForm.agent_id,
          tool: agentForm.tool,
          prompt: agentForm.prompt,
        }),
      })

      if (!response.ok) {
        throw new Error(`Evaluation failed: ${response.status}`)
      }

      const nextEvent = (await response.json()) as EventItem
      setAgentResult(nextEvent)
      setEvents((current) => [nextEvent, ...current])
      setActiveSection('Live Monitor')
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to evaluate policy.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecision = async (decision: 'APPROVE' | 'DENY', eventId: string) => {
    try {
      const response = await fetch(`${API_BASE}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, action: decision }),
      })

      if (!response.ok) {
        throw new Error(`Action failed: ${response.status}`)
      }

      const updated = await response.json()
      const updatedEvent = updated.event as EventItem
      setEvents((current) =>
        current.map((item) => (item.id === updatedEvent.id ? { ...item, ...updatedEvent } : item)),
      )
      setSelectedEvent((current) => (current && current.id === updatedEvent.id ? { ...current, ...updatedEvent } : current))
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to apply the decision.'
      setError(message)
    }
  }

  const renderContent = () => {
    if (loading) {
      return <div className="loading-panel">Loading security telemetry…</div>
    }

    if (error) {
      return (
        <div className="error-panel" role="alert">
          <strong>Connection issue.</strong>
          <span>{error}</span>
        </div>
      )
    }

    switch (activeSection) {
      case 'Live Monitor':
        return (
          <>
            <SectionCard title="Live agent activity" description="Streaming policy decisions from the security gateway.">
              <div className="status-grid">
                <div className="mini-panel">
                  <span>Last sync</span>
                  <strong>{events[0] ? formatDateTime(events[0].timestamp) : 'Awaiting events'}</strong>
                </div>
                <div className="mini-panel">
                  <span>Approval gating</span>
                  <strong>{summary.approval} pending</strong>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Agent evaluation" description="Send a request to the live policy engine.">
              <form className="agent-form" onSubmit={handleEvaluate}>
                <label>
                  Agent ID
                  <input
                    aria-label="Agent ID"
                    value={agentForm.agent_id}
                    onChange={(event) => setAgentForm({ ...agentForm, agent_id: event.target.value })}
                  />
                </label>
                <label>
                  Tool
                  <select
                    aria-label="Tool"
                    value={agentForm.tool}
                    onChange={(event) => setAgentForm({ ...agentForm, tool: event.target.value })}
                  >
                    <option value="search_web">search_web</option>
                    <option value="send_email">send_email</option>
                    <option value="execute_shell">execute_shell</option>
                    <option value="write_database">write_database</option>
                    <option value="drop_database_table">drop_database_table</option>
                  </select>
                </label>
                <label className="full-width">
                  Prompt
                  <textarea
                    aria-label="Prompt"
                    value={agentForm.prompt}
                    onChange={(event) => setAgentForm({ ...agentForm, prompt: event.target.value })}
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={submitting}>
                    {submitting ? 'Evaluating…' : 'Run policy scan'}
                  </button>
                </div>
              </form>

              {agentResult ? (
                <div className="agent-result">
                  <div className="result-header">
                    <span>Latest decision</span>
                    <StatusBadge value={agentResult.risk} />
                  </div>
                  <p>{agentResult.decision}</p>
                  <small>{agentResult.reason}</small>
                </div>
              ) : null}
            </SectionCard>
          </>
        )

      case 'Security Sandbox':
        return (
          <>
            <SectionCard title="Agent policy matrix" description="Operational risk categories and enforcement logic.">
              <div className="policy-grid">
                {POLICY_ITEMS.map((policy) => (
                  <article key={policy.title} className="policy-card">
                    <div className="policy-topline">
                      <strong>{policy.title}</strong>
                      <span className={`risk-tag ${policy.risk === 'Low' ? 'low' : policy.risk === 'Review' ? 'review' : 'blocked'}`}>
                        {policy.risk}
                      </span>
                    </div>
                    <p>{policy.tools}</p>
                    <small>{policy.description}</small>
                  </article>
                ))}
              </div>
            </SectionCard>
            <SectionCard title="Simulation feed" description="Recent security evaluations from the policy engine.">
              {events.length === 0 ? (
                <div className="empty-state">No agent events recorded yet.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Tool</th>
                        <th>Risk</th>
                        <th>Decision</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.slice(0, 5).map((event) => (
                        <tr key={event.id}>
                          <td>{event.agent_id}</td>
                          <td>{event.tool}</td>
                          <td><StatusBadge value={event.risk} /></td>
                          <td>{event.decision}</td>
                          <td>{formatDateTime(event.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )

      case 'Threat Explorer':
        return (
          <>
            <SectionCard title="Risk indicators" description="Distribution of policy decisions across recent events.">
              <div className="risk-meter-grid">
                {riskBreakdown.map((risk) => (
                  <div key={risk.label} className="risk-meter">
                    <div className="risk-metric-header">
                      <span>{risk.label}</span>
                      <strong>{risk.value}</strong>
                    </div>
                    <div className="meter-track">
                      <div
                        className={`meter-fill ${risk.tone}`}
                        style={{ width: `${summary.total ? (risk.value / summary.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Threat pattern summary" description="Patterns reviewed by the policy engine.">
              <div className="policy-list">
                {['drop database', 'sudo', 'ignore previous instructions', 'rm -rf', 'exec('].map((pattern) => (
                  <div key={pattern} className="inline-chip">
                    {pattern}
                  </div>
                ))}
              </div>
            </SectionCard>
          </>
        )

      case 'Agent Risk':
        return (
          <SectionCard title="Agent risk profiles" description="Current posture by agent and tool usage.">
            <div className="risk-grid">
              {events.length === 0 ? (
                <div className="empty-state">No risk profiles available.</div>
              ) : (
                Array.from(new Set(events.map((event) => event.agent_id))).map((agentId) => {
                  const agentEvents = events.filter((event) => event.agent_id === agentId)
                  const maxRisk = agentEvents.reduce((current, event) => {
                    if ((event.risk || '').toUpperCase() === 'RED') return 'RED'
                    if ((event.risk || '').toUpperCase() === 'AMBER' && current !== 'RED') return 'AMBER'
                    return current
                  }, 'GREEN' as RiskLevel)

                  return (
                    <article key={agentId} className="profile-card">
                      <div className="profile-header">
                        <strong>{agentId}</strong>
                        <StatusBadge value={maxRisk} />
                      </div>
                      <small>{agentEvents.length} events logged</small>
                      <ul>
                        {agentEvents.slice(0, 3).map((event) => (
                          <li key={event.id}>{event.tool} · {event.decision}</li>
                        ))}
                      </ul>
                    </article>
                  )
                })
              )}
            </div>
          </SectionCard>
        )

      case 'Approval Queue':
        return (
          <SectionCard title="Human approval queue" description="Sensitive actions awaiting intervention.">
            {reviewQueue.length === 0 ? (
              <div className="empty-state">No approval requests queued.</div>
            ) : (
              <div className="queue-list">
                {reviewQueue.map((event) => (
                  <div key={event.id} className="queue-item">
                    <div>
                      <strong>{event.tool}</strong>
                      <p>{event.reason}</p>
                    </div>
                    <div className="queue-meta">
                      <span>{event.agent_id}</span>
                      <span>{formatDateTime(event.timestamp)}</span>
                    </div>
                    <div className="queue-actions">
                      <button type="button" className="secondary-button" onClick={() => setSelectedEvent(event)}>
                        Review
                      </button>
                      <button type="button" className="split-button approve" onClick={() => void handleDecision('APPROVE', event.id)}>
                        Approve
                      </button>
                      <button type="button" className="split-button deny" onClick={() => void handleDecision('DENY', event.id)}>
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )

      case 'Audit Logs':
      default:
        return (
          <SectionCard title="Audit log" description="Detailed record of security decisions and policy output.">
            {events.length === 0 ? (
              <div className="empty-state">No audit records found.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Tool</th>
                      <th>Risk</th>
                      <th>Decision</th>
                      <th>Timestamp</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td>{event.agent_id}</td>
                        <td>{event.tool}</td>
                        <td><StatusBadge value={event.risk} /></td>
                        <td>{event.decision}</td>
                        <td>{formatDateTime(event.timestamp)}</td>
                        <td>
                          <button type="button" className="row-link" onClick={() => setSelectedEvent(event)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">AG</div>
          <div>
            <div className="brand-name">AgentGuard</div>
            <div className="brand-subtitle">AI security command center</div>
          </div>
        </div>

        <nav className="nav" aria-label="Sidebar navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              className={item === activeSection ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveSection(item)}
            >
              <span className="nav-dot" />
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="live-pill">Live</span>
          <strong>{summary.total} monitored events</strong>
          <small>Runtime gateway status: healthy</small>
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Security overview</p>
            <h1>{activeSection}</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="topbar-button">
              Export audit
            </button>
            <button type="button" className="topbar-button accent" onClick={() => void fetchEvents()}>
              Refresh
            </button>
          </div>
        </header>

        <main className="content-area">
          <section className="stats-grid">
            <StatCard label="Total events" value={String(summary.total)} helper="Gateway activity" tone="blue" />
            <StatCard label="Green" value={String(summary.green)} helper="Allowed" tone="green" />
            <StatCard label="Amber" value={String(summary.amber)} helper="Review required" tone="amber" />
            <StatCard label="Red" value={String(summary.red)} helper="Blocked" tone="red" />
          </section>

          {activeSection === 'Overview' ? (
            <>
              <SectionCard title="Security posture" description="Current risk distribution across the operational environment.">
                <div className="risk-meter-grid">
                  {riskBreakdown.map((risk) => (
                    <div key={risk.label} className="risk-meter">
                      <div className="risk-metric-header">
                        <span>{risk.label}</span>
                        <strong>{risk.value}</strong>
                      </div>
                      <div className="meter-track">
                        <div
                          className={`meter-fill ${risk.tone}`}
                          style={{ width: `${summary.total ? (risk.value / summary.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <div className="two-col-layout">
                <SectionCard title="Policy summary" description="Real-time enforcement profile.">
                  <div className="policy-list compact">
                    {POLICY_ITEMS.map((policy) => (
                      <div key={policy.title} className="policy-item">
                        <div>
                          <strong>{policy.title}</strong>
                          <p>{policy.tools}</p>
                        </div>
                        <span className={`risk-tag ${policy.risk === 'Low' ? 'low' : policy.risk === 'Review' ? 'review' : 'blocked'}`}>
                          {policy.risk}
                        </span>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Recent security events" description="Latest decisions from the gateway.">
                  {events.length === 0 ? (
                    <div className="empty-state">No recent events available.</div>
                  ) : (
                    <div className="stack-list">
                      {events.slice(0, 5).map((event) => (
                        <button key={event.id} type="button" className="event-row" onClick={() => setSelectedEvent(event)}>
                          <div>
                            <strong>{event.tool}</strong>
                            <small>{event.agent_id}</small>
                          </div>
                          <div className="event-metadata">
                            <StatusBadge value={event.risk} />
                            <span>{formatDateTime(event.timestamp)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            </>
          ) : (
            renderContent()
          )}
        </main>
      </div>

      {selectedEvent ? (
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Event detail</p>
                <h3>{selectedEvent.tool}</h3>
              </div>
              <button type="button" className="close-button" onClick={() => setSelectedEvent(null)} aria-label="Close event details">
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-row">
                <span>Agent</span>
                <strong>{selectedEvent.agent_id}</strong>
              </div>
              <div className="detail-row">
                <span>Risk</span>
                <StatusBadge value={selectedEvent.risk} />
              </div>
              <div className="detail-row">
                <span>Decision</span>
                <strong>{selectedEvent.decision}</strong>
              </div>
              <div className="detail-row">
                <span>Timestamp</span>
                <strong>{formatDateTime(selectedEvent.timestamp)}</strong>
              </div>
              <div className="detail-box">
                <span>Prompt</span>
                <p>{selectedEvent.prompt || 'No prompt supplied.'}</p>
              </div>
              <div className="detail-box">
                <span>Reason</span>
                <p>{selectedEvent.reason}</p>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setSelectedEvent(null)}>
                Close
              </button>
              <button type="button" className="split-button approve" onClick={() => { void handleDecision('APPROVE', selectedEvent.id); setSelectedEvent(null) }}>
                Approve
              </button>
              <button type="button" className="split-button deny" onClick={() => { void handleDecision('DENY', selectedEvent.id); setSelectedEvent(null) }}>
                Deny
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
