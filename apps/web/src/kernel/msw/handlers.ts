import { http, HttpResponse } from 'msw';

const seedUsers = [
  { id: 'usr_student_1', email: 'student1@campus.edu', name: 'Alex Rivera', role: 'STUDENT', created_at: '2026-10-20T08:00:00Z' },
  { id: 'usr_security_1', email: 'security@campus.edu', name: 'Officer Sarah Miller', role: 'SECURITY', created_at: '2026-10-15T09:00:00Z' },
  { id: 'usr_admin_1', email: 'admin@campus.edu', name: 'Chief Security Admin Chen', role: 'ADMIN', created_at: '2026-10-10T09:00:00Z' },
];

const items = [
  {
    id: 'item_laptop_001',
    category: 'laptop',
    public_description: 'Silver 14-inch laptop with various stickers on lid',
    hidden_description: 'Apple MacBook Pro M2, space gray, small scratch near bottom right corner, sticker of Git commit badge and Python logo, serial ending in 98A2',
    hidden_attributes: {
      brand: 'Apple',
      model: 'MacBook Pro 14 M2',
      color: 'Space Gray',
      serial_number: 'C02XYZ98A2',
      exact_location: 'Under seat 4B in Science Hall Lecture 101',
      unique_features: ['small scratch near bottom right corner', 'Git commit badge sticker', 'Python logo sticker'],
      contents: ['laptop sleeve navy blue', 'USB-C adapter inside sleeve pocket']
    },
    found_location_public: 'Science Hall 101',
    found_date: '2026-10-24T14:30:00Z',
    status: 'OPEN_FOR_CLAIMS',
    risk_level: 'HIGH',
    security_verified: true,
    finder_id: 'usr_finder_1',
    created_at: '2026-10-24T15:00:00Z'
  },
  {
    id: 'item_headphones_002',
    category: 'headphones',
    public_description: 'Black over-ear wireless headphones in black zipper case',
    hidden_description: 'Sony WH-1000XM4, matte black, replacement red audio cable inside case, custom initial A.R. on headband',
    hidden_attributes: {
      brand: 'Sony',
      model: 'WH-1000XM4',
      color: 'Matte Black',
      serial_number: 'SN8849201',
      exact_location: 'Main Library second floor study carrel 12',
      unique_features: ['replacement red audio cable', 'initial A.R. written on inner cushion'],
      contents: ['airplane adapter', 'red 3.5mm cable']
    },
    found_location_public: 'Main Library 2nd Floor',
    found_date: '2026-10-25T11:00:00Z',
    status: 'OPEN_FOR_CLAIMS',
    risk_level: 'MEDIUM',
    security_verified: true,
    finder_id: 'usr_finder_1',
    created_at: '2026-10-25T11:30:00Z'
  },
  {
    id: 'item_bottle_003',
    category: 'bottle',
    public_description: 'Stainless steel insulated water bottle 32oz',
    hidden_description: 'Hydro Flask 32oz Pacific Blue with flex straw cap, dent on the bottom rim, sticker of National Parks',
    hidden_attributes: {
      brand: 'Hydro Flask',
      model: 'Wide Mouth 32oz',
      color: 'Pacific Blue',
      exact_location: 'Gym bench by locker room A',
      unique_features: ['dent on bottom rim', 'Yosemite national park sticker']
    },
    found_location_public: 'Campus Recreation Center',
    found_date: '2026-10-26T09:00:00Z',
    status: 'OPEN_FOR_CLAIMS',
    risk_level: 'LOW',
    security_verified: true,
    finder_id: 'usr_finder_1',
    created_at: '2026-10-26T09:15:00Z'
  }
];

const claims = [
  {
    id: 'claim_laptop_001_alex',
    item_id: 'item_laptop_001',
    claimant_id: 'usr_student_1',
    description: 'I left my MacBook Pro 14 space gray during CS lecture. It has a tiny mark near lower right edge and coding stickers.',
    claimed_attributes: {
      brand: 'Apple',
      model: 'MacBook Pro 14',
      color: 'Space Gray',
      serial_number: 'C02XYZ98A2',
      unique_features: ['tiny mark near lower right edge', 'git commit badge', 'python sticker']
    },
    lost_date: '2026-10-24T14:30:00Z',
    lost_location: 'Science Hall 101 Lecture Hall',
    structured_score: 92.0,
    semantic_score: 85.5,
    final_score: 89.4,
    confidence_label: 'HIGH',
    status: 'SCORED',
    created_at: '2026-10-25T08:00:00Z'
  }
];

const notifications = [
  {
    id: 'notif_001',
    user_id: 'usr_student_1',
    title: 'Claim Update',
    message: 'Your claim for MacBook Pro has been scored with HIGH confidence.',
    read: false,
    created_at: '2026-10-25T08:05:00Z'
  }
];

export const handlers = [
  // Health
  http.get('/api/healthz', () => {
    return HttpResponse.json({ status: 'ok', service: 'campus-recoverer-msw' });
  }),

  // Auth
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as any;
    const user = seedUsers.find((u) => u.email === body.email) || seedUsers[0];
    return HttpResponse.json({
      user,
      token: 'msw-mock-jwt-token-for-' + user.id,
    });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as any;
    const user = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email: body.email,
      name: body.name,
      role: body.role || 'STUDENT',
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json({ user, token: 'msw-mock-jwt-token-for-' + user.id }, { status: 201 });
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({ user: seedUsers[0] });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),

  // Items
  http.get('/api/items', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const query = url.searchParams.get('query');
    let filtered = items.map(item => {
      // Public projection
      const { hidden_description, hidden_attributes, finder_id, ...pub } = item;
      return pub;
    });
    if (category) filtered = filtered.filter(i => i.category.toLowerCase().includes(category.toLowerCase()));
    if (query) filtered = filtered.filter(i => i.public_description.toLowerCase().includes(query.toLowerCase()) || i.category.toLowerCase().includes(query.toLowerCase()));
    return HttpResponse.json({ items: filtered });
  }),

  http.get('/api/items/:id', ({ params }) => {
    const item = items.find(i => i.id === params.id);
    if (!item) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 });
    const { hidden_description, hidden_attributes, finder_id, ...pub } = item;
    return HttpResponse.json({ item: pub });
  }),

  http.post('/api/items', async ({ request }) => {
    const body = (await request.json()) as any;
    const newItem = {
      id: 'item_' + Math.random().toString(36).substring(2, 9),
      category: body.category,
      public_description: body.public_description,
      hidden_description: body.hidden_description,
      hidden_attributes: body.hidden_attributes,
      found_location_public: body.found_location_public,
      found_date: body.found_date,
      status: 'PENDING_HANDOVER',
      risk_level: 'MEDIUM',
      security_verified: false,
      finder_id: 'usr_student_1',
      created_at: new Date().toISOString(),
    };
    items.push(newItem);
    const { hidden_description, hidden_attributes, finder_id, ...pub } = newItem;
    return HttpResponse.json({ item: pub }, { status: 201 });
  }),

  // Claims
  http.post('/api/claims', async ({ request }) => {
    const body = (await request.json()) as any;
    const newClaim = {
      id: 'claim_' + Math.random().toString(36).substring(2, 9),
      item_id: body.item_id,
      claimant_id: 'usr_student_1',
      description: body.description,
      claimed_attributes: body.claimed_attributes,
      lost_date: body.lost_date,
      lost_location: body.lost_location,
      structured_score: 85,
      semantic_score: 80,
      final_score: 83,
      confidence_label: 'HIGH',
      status: 'SCORED',
      created_at: new Date().toISOString(),
    };
    claims.push(newClaim);
    return HttpResponse.json({ claim: newClaim }, { status: 201 });
  }),

  http.get('/api/claims/mine', () => {
    return HttpResponse.json({ claims });
  }),

  http.get('/api/claims/:id', ({ params }) => {
    const claim = claims.find(c => c.id === params.id);
    if (!claim) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Claim not found' } }, { status: 404 });
    return HttpResponse.json({ claim });
  }),

  // Questions
  http.get('/api/workflow/claims/:id/questions', () => {
    return HttpResponse.json({
      questions: [
        { id: 'q1', question: 'What is the color of the case or sleeve?' },
        { id: 'q2', question: 'What identifying stickers or marks are present?' }
      ]
    });
  }),

  http.post('/api/workflow/claims/:id/answers', () => {
    return HttpResponse.json({ received: true, message: 'Answers recorded for security evaluation.' });
  }),

  // Handover QR
  http.get('/api/handover/claims/:claimId/qr', () => {
    // 1x1 transparent png mock or sample qr
    return HttpResponse.json({
      qr_token: 'mock-qr-token-xyz-123',
      qr_png_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=',
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString()
    });
  }),

  // Handover verify
  http.post('/api/handover/verify', () => {
    return HttpResponse.json({ success: true, item_id: 'item_laptop_001', message: 'Item handed over successfully.' });
  }),

  // Notifications
  http.get('/api/notifications', () => {
    return HttpResponse.json({ notifications });
  }),

  http.patch('/api/notifications/:id/read', ({ params }) => {
    const notif = notifications.find(n => n.id === params.id);
    if (notif) notif.read = true;
    return HttpResponse.json({ notification: notif });
  }),

  // Admin & Workflow
  http.get('/api/workflow/dashboard', () => {
    return HttpResponse.json({
      pending_reports: 1,
      awaiting_handover: 0,
      active_claims: claims.length,
      high_risk_items: 2,
      expired_items: 0
    });
  }),

  http.get('/api/workflow/items', () => {
    return HttpResponse.json({ items });
  }),

  http.get('/api/workflow/claims', () => {
    return HttpResponse.json({ claims });
  }),

  http.get('/api/workflow/items/:id/hidden', ({ params }) => {
    const item = items.find(i => i.id === params.id);
    return HttpResponse.json({
      hidden_description: item?.hidden_description || '',
      hidden_attributes: item?.hidden_attributes || {}
    });
  }),

  http.get('/api/audit', () => {
    return HttpResponse.json({
      logs: [
        {
          id: 'aud_1',
          seq: 1,
          actor_id: 'usr_finder_1',
          action: 'ITEM_REPORTED',
          item_id: 'item_laptop_001',
          claim_id: null,
          metadata: { category: 'laptop' },
          created_at: '2026-10-24T15:00:00Z',
          prev_hash: '0000000000000000000000000000000000000000000000000000000000000000',
          row_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
        }
      ],
      total: 1,
      page: 1
    });
  }),

  http.get('/api/audit/verify-chain', () => {
    return HttpResponse.json({
      verified: true,
      total_entries: 1,
      tampered_seqs: []
    });
  })
];
