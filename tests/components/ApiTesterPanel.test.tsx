import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock i18n
vi.mock('../../src/renderer/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) return `${key}:${JSON.stringify(params)}`
      return key
    },
    locale: 'fr',
    setLocale: vi.fn(),
  }),
}))

// Mock sub-components
const mockHandleSend = vi.fn()
const mockSelectRequest = vi.fn()
const mockAddCollection = vi.fn()
const mockToggleCollection = vi.fn()

vi.mock('../../src/renderer/components/api-tester', () => ({
  useApiTester: () => hookState,
  ApiSidebar: ({ data, onAddCollection, onSelectRequest, onToggleCollection }: Record<string, unknown>) => {
    const typedData = data as { collections: Array<{ id: string; name: string; requests: Array<{ id: string; name: string; method: string; url: string }> }> }
    return (
      <div data-testid="api-sidebar">
        <button onClick={onAddCollection as () => void}>add-collection</button>
        {typedData.collections.map((col) => (
          <div key={col.id} data-testid={`collection-${col.id}`}>
            <button onClick={() => (onToggleCollection as (id: string) => void)(col.id)}>{col.name}</button>
            {col.requests.map((req) => (
              <button key={req.id} onClick={() => (onSelectRequest as (cId: string, rId: string) => void)(col.id, req.id)}>
                {req.method} {req.name}
              </button>
            ))}
          </div>
        ))}
      </div>
    )
  },
  ApiRequestEditor: ({ request, sending, onSend }: Record<string, unknown>) => {
    const typedReq = request as { method: string; url: string; name: string }
    return (
      <div data-testid="api-request-editor">
        <span>{typedReq.method} {typedReq.url}</span>
        <button onClick={onSend as () => void} disabled={sending as boolean}>
          {(sending as boolean) ? 'sending...' : 'send'}
        </button>
      </div>
    )
  },
  ApiResponseViewer: ({ response }: Record<string, unknown>) => (
    <div data-testid="api-response-viewer">
      {response ? 'response-loaded' : 'no-response'}
    </div>
  ),
  ApiEnvironmentModal: ({ onClose }: Record<string, unknown>) => (
    <div data-testid="api-env-modal">
      <button onClick={onClose as () => void}>close-modal</button>
    </div>
  ),
}))

const defaultHookState = {
  activeProject: { id: 'proj-1', name: 'My Project', path: '/my-project', workspaceId: 'ws-1' },
  data: {
    version: 1,
    collections: [
      {
        id: 'col-1',
        name: 'Users API',
        requests: [
          { id: 'req-1', name: 'Get Users', method: 'GET', url: 'https://api.example.com/users', headers: [], queryParams: [], body: '', tests: '' },
          { id: 'req-2', name: 'Create User', method: 'POST', url: 'https://api.example.com/users', headers: [], queryParams: [], body: '{}', tests: '' },
        ],
      },
    ],
    environments: [],
  },
  loading: false,
  selection: null as { type: string; collectionId: string; requestId: string } | null,
  expandedCollections: new Set<string>(),
  requestTab: 'headers' as const,
  setRequestTab: vi.fn(),
  responseTab: 'body' as const,
  setResponseTab: vi.fn(),
  response: null,
  testResults: [],
  sending: false,
  selectedRequest: null as { request: { method: string; url: string; name: string }; collectionId: string } | null,
  showEnvModal: false,
  setShowEnvModal: vi.fn(),
  showDoc: false,
  setShowDoc: vi.fn(),
  activeEnv: null,
  handleSend: mockHandleSend,
  handleUrlKeyDown: vi.fn(),
  updateRequest: vi.fn(),
  addCollection: mockAddCollection,
  deleteCollection: vi.fn(),
  addRequest: vi.fn(),
  deleteRequest: vi.fn(),
  duplicateRequest: vi.fn(),
  toggleCollection: mockToggleCollection,
  selectRequest: mockSelectRequest,
  addEnvironment: vi.fn(),
  deleteEnvironment: vi.fn(),
  setActiveEnvironment: vi.fn(),
  updateEnvironment: vi.fn(),
  handleExport: vi.fn(),
  handleImport: vi.fn(),
}

let hookState = { ...defaultHookState }

import { ApiTesterPanel } from '../../src/renderer/components/ApiTesterPanel'

describe('ApiTesterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookState = { ...defaultHookState }
  })

  describe('rendu initial', () => {
    it('affiche la sidebar avec les collections', () => {
      render(<ApiTesterPanel />)
      expect(screen.getByTestId('api-sidebar')).toBeInTheDocument()
      expect(screen.getByTestId('collection-col-1')).toBeInTheDocument()
    })

    it('affiche le message vide quand aucune requete n est selectionnee', () => {
      render(<ApiTesterPanel />)
      expect(screen.getByText('api.noCollections')).toBeInTheDocument()
    })

    it('affiche le message quand aucun projet n est actif', () => {
      hookState = { ...defaultHookState, activeProject: null }
      render(<ApiTesterPanel />)
      expect(screen.getByText('api.selectProject')).toBeInTheDocument()
    })

    it('affiche le chargement', () => {
      hookState = { ...defaultHookState, loading: true }
      render(<ApiTesterPanel />)
      expect(screen.getByText('common.loading')).toBeInTheDocument()
    })
  })

  describe('affichage des collections', () => {
    it('affiche le nom de la collection et ses requetes', () => {
      render(<ApiTesterPanel />)
      expect(screen.getByText('Users API')).toBeInTheDocument()
      expect(screen.getByText('GET Get Users')).toBeInTheDocument()
      expect(screen.getByText('POST Create User')).toBeInTheDocument()
    })

    it('affiche le bouton d ajout de collection', () => {
      render(<ApiTesterPanel />)
      expect(screen.getByText('add-collection')).toBeInTheDocument()
    })
  })

  describe('selection de requete', () => {
    it('affiche l editeur de requete quand une requete est selectionnee', () => {
      hookState = {
        ...defaultHookState,
        selection: { type: 'request', collectionId: 'col-1', requestId: 'req-1' },
        selectedRequest: {
          request: { method: 'GET', url: 'https://api.example.com/users', name: 'Get Users' },
          collectionId: 'col-1',
        },
      }
      render(<ApiTesterPanel />)
      expect(screen.getByTestId('api-request-editor')).toBeInTheDocument()
      expect(screen.getByText('GET https://api.example.com/users')).toBeInTheDocument()
    })

    it('affiche le viewer de reponse quand une requete est selectionnee', () => {
      hookState = {
        ...defaultHookState,
        selection: { type: 'request', collectionId: 'col-1', requestId: 'req-1' },
        selectedRequest: {
          request: { method: 'GET', url: 'https://api.example.com/users', name: 'Get Users' },
          collectionId: 'col-1',
        },
      }
      render(<ApiTesterPanel />)
      expect(screen.getByTestId('api-response-viewer')).toBeInTheDocument()
    })
  })

  describe('envoi de requete', () => {
    it('affiche le bouton send actif quand pas en cours d envoi', () => {
      hookState = {
        ...defaultHookState,
        selection: { type: 'request', collectionId: 'col-1', requestId: 'req-1' },
        selectedRequest: {
          request: { method: 'GET', url: 'https://api.example.com/users', name: 'Get Users' },
          collectionId: 'col-1',
        },
        sending: false,
      }
      render(<ApiTesterPanel />)
      const sendBtn = screen.getByText('send')
      expect(sendBtn).not.toBeDisabled()
    })

    it('desactive le bouton send pendant l envoi', () => {
      hookState = {
        ...defaultHookState,
        selection: { type: 'request', collectionId: 'col-1', requestId: 'req-1' },
        selectedRequest: {
          request: { method: 'GET', url: 'https://api.example.com/users', name: 'Get Users' },
          collectionId: 'col-1',
        },
        sending: true,
      }
      render(<ApiTesterPanel />)
      const sendBtn = screen.getByText('sending...')
      expect(sendBtn).toBeDisabled()
    })
  })

  describe('etat vide', () => {
    it('affiche le message vide quand il n y a pas de collections', () => {
      hookState = {
        ...defaultHookState,
        data: { version: 1, collections: [], environments: [] },
      }
      render(<ApiTesterPanel />)
      expect(screen.getByText('api.noCollections')).toBeInTheDocument()
    })
  })

  describe('banniere de documentation', () => {
    it('affiche la banniere de doc quand showDoc est true', () => {
      hookState = { ...defaultHookState, showDoc: true }
      render(<ApiTesterPanel />)
      expect(screen.getByText('api.docTitle')).toBeInTheDocument()
    })
  })
})
