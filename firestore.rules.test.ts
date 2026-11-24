/**
 * Firestore Security Rules — Dirty Dozen Adversarial Verification Specification
 * Verifies all 12 adversarial payloads against the Eight Pillars in firestore.rules.
 */
export interface DirtyDozenCase {
  id: string;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
  reason: string;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    name: 'Unauthenticated Read/Write',
    path: '/projects/proj_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by isVerified() / isSignedIn() gate.'
  },
  {
    id: 'DD-02',
    name: 'Unverified Email Spoof',
    path: '/projects/proj_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by request.auth.token.email_verified == true.'
  },
  {
    id: 'DD-03',
    name: 'Cross-Owner Identity Spoofing',
    path: '/projects/proj_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'other-user-uid', title: 'Hijack' },
    reason: 'Blocked by data.ownerId == request.auth.uid inside isValidStudioProject.'
  },
  {
    id: 'DD-04',
    name: 'Shadow Ghost Field Injection',
    path: '/users/user_a',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { isAdmin: true, role: 'superadmin' },
    reason: 'Blocked by hasOnly() in isValidUserPreference and affectedKeys().hasOnly().'
  },
  {
    id: 'DD-05',
    name: 'Immutable Field Hijack',
    path: '/projects/proj_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'user_b' },
    reason: 'Blocked by incoming().ownerId == existing().ownerId and affectedKeys allowlist.'
  },
  {
    id: 'DD-06',
    name: 'Client Timestamp Forgery',
    path: '/projects/proj_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    reason: 'Blocked by incoming().createdAt == request.time.'
  },
  {
    id: 'DD-07',
    name: 'ID Poisoning Attack',
    path: '/projects/' + 'x'.repeat(200),
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by isValidId(projectId) size <= 128 and regex guard.'
  },
  {
    id: 'DD-08',
    name: 'Orphaned Backup Creation',
    path: '/projects/missing_proj/backups/b1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by Master Gate isParentProjectOwner(projectId) exists/get check.'
  },
  {
    id: 'DD-09',
    name: 'Array Flood on Asset Tags',
    path: '/assets/a1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { tags: Array.from({ length: 20 }, (_, i) => `tag${i}`) },
    reason: 'Blocked by data.tags.size() <= 10 guard in isValidAssetItem.'
  },
  {
    id: 'DD-10',
    name: 'Value Poisoning on Update',
    path: '/projects/proj_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { width: '999999' },
    reason: 'Blocked by isValidStudioProject(incoming()) type and range check.'
  },
  {
    id: 'DD-11',
    name: 'Private User Preferences Cross-Read',
    path: '/users/user_a',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by isOwner(userId) on /users/{userId}.'
  },
  {
    id: 'DD-12',
    name: 'Blanket Collection Scraping',
    path: '/projects',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by allow list: if isSignedIn() && resource.data.ownerId == request.auth.uid.'
  }
];
