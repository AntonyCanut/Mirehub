import { useI18n } from '../../lib/i18n'
import { useApiTester } from './use-api-tester'
import type { RequestTab, ResponseTab } from './use-api-tester'
import type { ApiTestAssertion, HttpMethod } from '../../../shared/types'

function getStatusBadgeClass(status: number): string {
  if (status === 0) return 'api-status-badge api-status-badge--error'
  if (status >= 200 && status < 300) return 'api-status-badge api-status-badge--2xx'
  if (status >= 300 && status < 400) return 'api-status-badge api-status-badge--3xx'
  if (status >= 400 && status < 500) return 'api-status-badge api-status-badge--4xx'
  return 'api-status-badge api-status-badge--5xx'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function tryPrettyPrint(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export function ApiTesterPanel() {
  const { t } = useI18n()
  const api = useApiTester()

  // No project state
  if (!api.activeProject) {
    return (
      <div className="api-panel">
        <div className="api-no-project">{t('api.selectProject')}</div>
      </div>
    )
  }

  if (api.loading) {
    return (
      <div className="api-panel">
        <div className="api-no-project">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="api-panel">
      {api.showDoc && (
        <div className="api-doc-banner">
          <span className="api-doc-banner-icon">i</span>
          <div className="api-doc-banner-text">
            <div className="api-doc-banner-title">{t('api.docTitle')}</div>
            <div className="api-doc-banner-body">{t('api.docBody')}</div>
          </div>
          <button className="api-doc-close" onClick={() => api.setShowDoc(false)}>
            x
          </button>
        </div>
      )}
      <div className="api-panel-body">
        {/* Sidebar */}
        <div className="api-sidebar">
          <div className="api-sidebar-header">
            <h3>{t('api.title')}</h3>
            <div className="api-sidebar-actions">
              <button className="api-sidebar-btn" onClick={api.handleImport} title={t('api.import')}>
                {t('api.import')}
              </button>
              <button className="api-sidebar-btn" onClick={api.handleExport} title={t('api.export')}>
                {t('api.export')}
              </button>
            </div>
          </div>

          {/* Environment selector */}
          <div style={{ padding: '6px 6px 0' }}>
            <select
              className="api-env-select"
              value={api.activeEnv?.id ?? ''}
              onChange={(e) => api.setActiveEnvironment(e.target.value || null)}
            >
              <option value="">{t('api.noActiveEnv')}</option>
              {api.data.environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
            <button
              className="api-add-btn"
              style={{ width: '100%', marginTop: 2, marginBottom: 4 }}
              onClick={() => api.setShowEnvModal(true)}
            >
              {t('api.editEnvironments')}
            </button>
          </div>

          <div className="api-sidebar-content">
            {/* Collections */}
            <div className="api-sidebar-section">
              <div className="api-sidebar-section-header">
                <span>Collections</span>
                <button
                  className="api-collection-action-btn"
                  style={{ opacity: 1 }}
                  onClick={api.addCollection}
                  title={t('api.newCollection')}
                >
                  +
                </button>
              </div>

              {api.data.collections.length === 0 && (
                <div style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('api.noCollections')}
                </div>
              )}

              {api.data.collections.map((col) => (
                <div key={col.id} className="api-collection-item">
                  <div
                    className="api-collection-header"
                    onClick={() => api.toggleCollection(col.id)}
                  >
                    <span
                      className={`api-collection-toggle${api.expandedCollections.has(col.id) ? ' api-collection-toggle--open' : ''}`}
                    >
                      &#9654;
                    </span>
                    <span className="api-collection-name">{col.name}</span>
                    <span className="api-collection-count">{col.requests.length}</span>
                    <div className="api-collection-actions">
                      <button
                        className="api-collection-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          api.addRequest(col.id)
                        }}
                        title={t('api.newRequest')}
                      >
                        +
                      </button>
                      <button
                        className="api-collection-action-btn api-collection-action-btn--danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          api.deleteCollection(col.id)
                        }}
                        title={t('api.deleteCollection')}
                      >
                        x
                      </button>
                    </div>
                  </div>
                  {api.expandedCollections.has(col.id) &&
                    col.requests.map((req) => (
                      <div
                        key={req.id}
                        className={`api-request-item${
                          api.selection?.type === 'request' && api.selection.requestId === req.id
                            ? ' api-request-item--active'
                            : ''
                        }`}
                        onClick={() => api.selectRequest(col.id, req.id)}
                      >
                        <span className={`api-request-method api-request-method--${req.method}`}>
                          {req.method}
                        </span>
                        <span className="api-request-name">{req.name}</span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main area */}
        <div className="api-main">
          {!api.selection && (
            <div className="api-main-empty">
              {t('api.noCollections')}
            </div>
          )}

          {/* Request Editor */}
          {api.selectedRequest && (
            <>
              {/* Request name editor */}
              <div style={{ padding: '6px 14px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    outline: 'none',
                    flex: 1,
                    padding: '2px 0',
                  }}
                  value={api.selectedRequest.request.name}
                  onChange={(e) =>
                    api.updateRequest(api.selectedRequest!.collectionId, api.selectedRequest!.request.id, (r) => ({
                      ...r,
                      name: e.target.value,
                    }))
                  }
                />
                <button
                  className="api-collection-action-btn"
                  onClick={() =>
                    api.duplicateRequest(api.selectedRequest!.collectionId, api.selectedRequest!.request.id)
                  }
                  title={t('api.duplicateRequest')}
                  style={{ opacity: 0.7 }}
                >
                  &#x2398;
                </button>
                <button
                  className="api-collection-action-btn api-collection-action-btn--danger"
                  onClick={() =>
                    api.deleteRequest(api.selectedRequest!.collectionId, api.selectedRequest!.request.id)
                  }
                  title={t('api.deleteRequest')}
                  style={{ opacity: 0.7 }}
                >
                  x
                </button>
              </div>

              {/* Request bar */}
              <div className="api-request-bar">
                <select
                  className={`api-method-select api-method-select--${api.selectedRequest.request.method}`}
                  value={api.selectedRequest.request.method}
                  onChange={(e) =>
                    api.updateRequest(api.selectedRequest!.collectionId, api.selectedRequest!.request.id, (r) => ({
                      ...r,
                      method: e.target.value as HttpMethod,
                    }))
                  }
                >
                  {(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as HttpMethod[]).map(
                    (m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ),
                  )}
                </select>
                <input
                  className="api-url-input"
                  placeholder={t('api.urlPlaceholder')}
                  value={api.selectedRequest.request.url}
                  onChange={(e) =>
                    api.updateRequest(api.selectedRequest!.collectionId, api.selectedRequest!.request.id, (r) => ({
                      ...r,
                      url: e.target.value,
                    }))
                  }
                  onKeyDown={api.handleUrlKeyDown}
                />
                <button
                  className="api-send-btn"
                  onClick={api.handleSend}
                  disabled={api.sending || !api.selectedRequest.request.url}
                >
                  {api.sending ? t('api.sending') : t('api.send')}
                </button>
              </div>

              {/* Request tabs */}
              <div className="api-tabs">
                {(['headers', 'body', 'tests'] as RequestTab[]).map((tab) => (
                  <button
                    key={tab}
                    className={`api-tab${api.requestTab === tab ? ' api-tab--active' : ''}`}
                    onClick={() => api.setRequestTab(tab)}
                  >
                    {t(`api.${tab}` as 'api.headers' | 'api.body' | 'api.tests')}
                    {tab === 'headers' && api.selectedRequest!.request.headers.length > 0 && (
                      <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--text-muted)' }}>
                        ({api.selectedRequest!.request.headers.filter((h) => h.enabled).length})
                      </span>
                    )}
                    {tab === 'tests' && api.selectedRequest!.request.tests.length > 0 && (
                      <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--text-muted)' }}>
                        ({api.selectedRequest!.request.tests.length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="api-tab-content">
                {/* Headers tab */}
                {api.requestTab === 'headers' && (
                  <div>
                    {api.selectedRequest.request.headers.map((header, idx) => (
                      <div key={idx} className="api-header-row">
                        <input
                          type="checkbox"
                          className="api-header-toggle"
                          checked={header.enabled}
                          onChange={(e) =>
                            api.updateRequest(
                              api.selectedRequest!.collectionId,
                              api.selectedRequest!.request.id,
                              (r) => ({
                                ...r,
                                headers: r.headers.map((h, i) =>
                                  i === idx ? { ...h, enabled: e.target.checked } : h,
                                ),
                              }),
                            )
                          }
                        />
                        <input
                          className="api-header-input"
                          placeholder="Header name"
                          value={header.key}
                          onChange={(e) =>
                            api.updateRequest(
                              api.selectedRequest!.collectionId,
                              api.selectedRequest!.request.id,
                              (r) => ({
                                ...r,
                                headers: r.headers.map((h, i) =>
                                  i === idx ? { ...h, key: e.target.value } : h,
                                ),
                              }),
                            )
                          }
                        />
                        <input
                          className="api-header-input"
                          placeholder="Value"
                          value={header.value}
                          onChange={(e) =>
                            api.updateRequest(
                              api.selectedRequest!.collectionId,
                              api.selectedRequest!.request.id,
                              (r) => ({
                                ...r,
                                headers: r.headers.map((h, i) =>
                                  i === idx ? { ...h, value: e.target.value } : h,
                                ),
                              }),
                            )
                          }
                        />
                        <button
                          className="api-header-remove"
                          onClick={() =>
                            api.updateRequest(
                              api.selectedRequest!.collectionId,
                              api.selectedRequest!.request.id,
                              (r) => ({
                                ...r,
                                headers: r.headers.filter((_, i) => i !== idx),
                              }),
                            )
                          }
                        >
                          x
                        </button>
                      </div>
                    ))}
                    <button
                      className="api-add-btn"
                      onClick={() =>
                        api.updateRequest(
                          api.selectedRequest!.collectionId,
                          api.selectedRequest!.request.id,
                          (r) => ({
                            ...r,
                            headers: [...r.headers, { key: '', value: '', enabled: true }],
                          }),
                        )
                      }
                    >
                      {t('api.addHeader')}
                    </button>
                  </div>
                )}

                {/* Body tab */}
                {api.requestTab === 'body' && (
                  <div>
                    <div className="api-body-type-bar">
                      {(['json', 'form', 'text', 'none'] as const).map((bt) => (
                        <button
                          key={bt}
                          className={`api-body-type-btn${
                            api.selectedRequest!.request.bodyType === bt
                              ? ' api-body-type-btn--active'
                              : ''
                          }`}
                          onClick={() =>
                            api.updateRequest(
                              api.selectedRequest!.collectionId,
                              api.selectedRequest!.request.id,
                              (r) => ({ ...r, bodyType: bt }),
                            )
                          }
                        >
                          {t(`api.${bt}` as 'api.json' | 'api.form' | 'api.text' | 'api.none')}
                        </button>
                      ))}
                    </div>
                    {api.selectedRequest!.request.bodyType !== 'none' && (
                      <textarea
                        className="api-body-textarea"
                        placeholder={t('api.bodyPlaceholder')}
                        value={api.selectedRequest!.request.body}
                        onChange={(e) =>
                          api.updateRequest(
                            api.selectedRequest!.collectionId,
                            api.selectedRequest!.request.id,
                            (r) => ({ ...r, body: e.target.value }),
                          )
                        }
                      />
                    )}
                  </div>
                )}

                {/* Tests tab */}
                {api.requestTab === 'tests' && (
                  <div>
                    {api.selectedRequest.request.tests.map((test, idx) => (
                      <div key={idx} className="api-test-row">
                        <select
                          className="api-test-type-select"
                          value={test.type}
                          onChange={(e) =>
                            api.updateRequest(
                              api.selectedRequest!.collectionId,
                              api.selectedRequest!.request.id,
                              (r) => ({
                                ...r,
                                tests: r.tests.map((t, i) =>
                                  i === idx
                                    ? {
                                        ...t,
                                        type: e.target.value as ApiTestAssertion['type'],
                                      }
                                    : t,
                                ),
                              }),
                            )
                          }
                        >
                          <option value="status">Status =</option>
                          <option value="body_contains">Body contains</option>
                          <option value="header_contains">Header contains</option>
                          <option value="json_path">JSON path</option>
                          <option value="response_time">Response time &lt;</option>
                        </select>
                        <input
                          className="api-test-expected"
                          placeholder={t('api.expected')}
                          value={test.expected}
                          onChange={(e) =>
                            api.updateRequest(
                              api.selectedRequest!.collectionId,
                              api.selectedRequest!.request.id,
                              (r) => ({
                                ...r,
                                tests: r.tests.map((t, i) =>
                                  i === idx ? { ...t, expected: e.target.value } : t,
                                ),
                              }),
                            )
                          }
                        />
                        <button
                          className="api-header-remove"
                          onClick={() =>
                            api.updateRequest(
                              api.selectedRequest!.collectionId,
                              api.selectedRequest!.request.id,
                              (r) => ({
                                ...r,
                                tests: r.tests.filter((_, i) => i !== idx),
                              }),
                            )
                          }
                        >
                          x
                        </button>
                      </div>
                    ))}
                    <button
                      className="api-add-btn"
                      onClick={() =>
                        api.updateRequest(
                          api.selectedRequest!.collectionId,
                          api.selectedRequest!.request.id,
                          (r) => ({
                            ...r,
                            tests: [...r.tests, { type: 'status', expected: '200' }],
                          }),
                        )
                      }
                    >
                      {t('api.addTest')}
                    </button>
                  </div>
                )}
              </div>

              {/* Response area */}
              <div className="api-response">
                {!api.response && (
                  <div className="api-response-no-content">{t('api.noResponse')}</div>
                )}
                {api.response && (
                  <>
                    <div className="api-response-header">
                      <h4>{t('api.response')}</h4>
                      <span className={getStatusBadgeClass(api.response.status)}>
                        {api.response.status} {api.response.statusText}
                      </span>
                      <span className="api-response-meta">
                        {t('api.time')}: {api.response.time}ms
                      </span>
                      <span className="api-response-meta">
                        {t('api.size')}: {formatBytes(api.response.size)}
                      </span>
                    </div>

                    {/* Response tabs */}
                    <div className="api-response-tabs">
                      {(['body', 'headers', 'testResults'] as ResponseTab[]).map((tab) => (
                        <button
                          key={tab}
                          className={`api-tab${api.responseTab === tab ? ' api-tab--active' : ''}`}
                          onClick={() => api.setResponseTab(tab)}
                        >
                          {tab === 'body'
                            ? t('api.body')
                            : tab === 'headers'
                              ? t('api.headers')
                              : t('api.testResults')}
                          {tab === 'testResults' && api.testResults.length > 0 && (
                            <span
                              style={{
                                marginLeft: 4,
                                fontSize: 9,
                                color: api.testResults.every((r) => r.passed)
                                  ? 'var(--success)'
                                  : 'var(--danger)',
                              }}
                            >
                              ({api.testResults.filter((r) => r.passed).length}/{api.testResults.length})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="api-response-body">
                      {api.responseTab === 'body' && (
                        <pre>{tryPrettyPrint(api.response.body)}</pre>
                      )}

                      {api.responseTab === 'headers' && (
                        <table className="api-response-headers-table">
                          <thead>
                            <tr>
                              <th>Header</th>
                              <th>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(api.response.headers).map(([key, val]) => (
                              <tr key={key}>
                                <td>{key}</td>
                                <td>{val}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {api.responseTab === 'testResults' && (
                        <div>
                          {api.testResults.length === 0 && (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                              {t('api.noResponse')}
                            </div>
                          )}
                          {api.testResults.map((result, idx) => (
                            <div key={idx} className="api-test-result">
                              <span
                                className={`api-test-result-badge${
                                  result.passed
                                    ? ' api-test-result-badge--pass'
                                    : ' api-test-result-badge--fail'
                                }`}
                              >
                                {result.passed ? t('api.passed') : t('api.failed')}
                              </span>
                              <span className="api-test-result-type">
                                {result.assertion.type}
                              </span>
                              <span className="api-test-result-expected">
                                {result.assertion.expected}
                              </span>
                              <span className="api-test-result-actual">{result.actual}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* Environment Modal */}
      {api.showEnvModal && (
        <div className="api-env-modal" onClick={() => api.setShowEnvModal(false)}>
          <div className="api-env-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="api-env-modal-header">
              <h3>{t('api.environments')}</h3>
              <button className="api-env-modal-close" onClick={() => api.setShowEnvModal(false)}>
                x
              </button>
            </div>
            <div className="api-env-modal-body">
              {api.data.environments.map((env) => (
                <div key={env.id} className="api-env-item">
                  <div className="api-env-item-header">
                    <input
                      className="api-env-name-input"
                      placeholder={t('api.envName')}
                      value={env.name}
                      onChange={(e) =>
                        api.updateEnvironment(env.id, (en) => ({ ...en, name: e.target.value }))
                      }
                    />
                    <button
                      className="api-env-delete-btn"
                      onClick={() => api.deleteEnvironment(env.id)}
                    >
                      x
                    </button>
                  </div>
                  {Object.entries(env.variables).map(([key, val], idx) => (
                    <div key={idx} className="api-env-var-row">
                      <input
                        className="api-env-var-input"
                        placeholder={t('api.varKey')}
                        value={key}
                        onChange={(e) => {
                          const newVars = { ...env.variables }
                          const oldVal = newVars[key]!
                          delete newVars[key]
                          newVars[e.target.value] = oldVal
                          api.updateEnvironment(env.id, (en) => ({ ...en, variables: newVars }))
                        }}
                      />
                      <input
                        className="api-env-var-input"
                        placeholder={t('api.varValue')}
                        value={val}
                        onChange={(e) => {
                          const newVars = { ...env.variables, [key]: e.target.value }
                          api.updateEnvironment(env.id, (en) => ({ ...en, variables: newVars }))
                        }}
                      />
                      <button
                        className="api-header-remove"
                        onClick={() => {
                          const newVars = { ...env.variables }
                          delete newVars[key]
                          api.updateEnvironment(env.id, (en) => ({ ...en, variables: newVars }))
                        }}
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <button
                    className="api-add-btn"
                    style={{ width: '100%' }}
                    onClick={() => {
                      const newVars = { ...env.variables, ['new_variable']: '' }
                      api.updateEnvironment(env.id, (en) => ({ ...en, variables: newVars }))
                    }}
                  >
                    {t('api.addVariable')}
                  </button>
                </div>
              ))}
              <button
                className="api-add-btn"
                style={{ width: '100%' }}
                onClick={api.addEnvironment}
              >
                {t('api.addEnvironment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
