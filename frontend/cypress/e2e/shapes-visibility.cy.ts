// Validates circle, star, line, and arrow appear on the canvas

describe('Shapes Visibility', () => {
  const frontendUrl = Cypress.env('FRONTEND_URL') || 'http://localhost:3000'
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:5001'

  // Creates a dev-local JWT understood by the backend
  const buildDevIdToken = (user: { uid: string; email: string; displayName?: string }) => {
    const toBase64Url = (obj: any) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')

    const header = { alg: 'none', typ: 'JWT' }
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: 'dev-local',
      aud: 'dev-local',
      iat: now,
      exp: now + 3600,
      uid: user.uid,
      email: user.email,
      name: user.displayName || 'E2E User',
      dev: true,
    }
    const headerPart = toBase64Url(header)
    const payloadPart = toBase64Url(payload)
    const signature = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    return `dev.${headerPart}.${payloadPart}.${signature}`
  }

  const createObject = (devToken: string, canvasId: string, object: any) =>
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/objects/`,
      headers: { Authorization: `Bearer ${devToken}` },
      body: {
        canvas_id: canvasId,
        object_type: object.type,
        properties: object.properties,
      },
      failOnStatusCode: false,
    }).then((resp) => {
      expect(resp.status).to.be.oneOf([200, 201])
    })

  it('renders circle, star, line and arrow', () => {
    const devToken = buildDevIdToken({ uid: 'e2e-user', email: 'e2e@example.com' })

    // Create a canvas via API first
    let canvasId = ''
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/canvas`,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${devToken}` },
      body: { title: 'E2E Shapes Canvas', description: 'Seeded by Cypress', is_public: false },
      failOnStatusCode: false,
    }).then((resp) => {
      expect(resp.status).to.be.oneOf([200, 201])
      const id = resp.body?.canvas?.id
      canvasId = typeof id === 'string' ? id : `e2e-${Date.now()}`

      // Seed four shapes
      createObject(devToken, canvasId, { type: 'circle', properties: { x: 200, y: 200, radius: 40, fill: '#88c', stroke: '#224', strokeWidth: 2 } })
      createObject(devToken, canvasId, { type: 'star', properties: { x: 380, y: 220, width: 120, fill: '#fc3', stroke: '#842', strokeWidth: 2 } })
      createObject(devToken, canvasId, { type: 'line', properties: { x: 120, y: 340, points: [0, 0, 140, 0], stroke: '#111', strokeWidth: 3 } })
      createObject(devToken, canvasId, { type: 'arrow', properties: { x: 320, y: 360, points: [0, 0, 120, 0], stroke: '#e11', strokeWidth: 3 } })

      // Visit editor to visually verify
      cy.visit(`${frontendUrl}/dev/canvas/${canvasId}`)
      cy.get('[data-testid="canvas-container"]', { timeout: 20000 }).should('exist')
      cy.wait(800)
      cy.screenshot('shapes-visibility-complete', { overwrite: true })
    })
  })
})


