import { http, HttpResponse } from 'msw'

export const handlers = [
  // Mock for creating an organization
  http.post('/api/create-organization', (req, res, ctx) => {
    // Simulate a successful response
    return HttpResponse.json({ success: true, message: 'Organization created successfully' })

    // Or simulate an error response
    // return HttpResponse.json({ success: false, message: 'Failed to create organization' }, { status: 500 })
  }),
]
