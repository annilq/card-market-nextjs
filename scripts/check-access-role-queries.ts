import assert from 'node:assert/strict'

import configPromise from '@payload-config'
import { getAccessResults, getPayload } from 'payload'
import type { Payload, PayloadRequest } from 'payload'

const payload = await getPayload({ config: configPromise })

const admins = await payload.find({
  collection: 'roles',
  where: { isAdmin: { equals: true } },
  depth: 0,
  limit: 1,
  overrideAccess: true,
})
const role = admins.docs[0]
assert.ok(role, 'admin role must exist')

let roleQueries = 0
const originalFindByID = payload.findByID.bind(payload)
payload.findByID = ((args: Parameters<Payload['findByID']>[0]) => {
  if (args.collection === 'roles') roleQueries += 1
  return originalFindByID(args)
}) as Payload['findByID']

const req = {
  payload,
  user: { id: 1, collection: 'users', role: role.id },
} as unknown as PayloadRequest

const access = await getAccessResults({ req })
assert.equal(access.canAccessAdmin, true)
assert.equal(
  roleQueries,
  1,
  `expected 1 roles query while building admin access, got ${roleQueries}`,
)
console.log('access check passed: admin access built with 1 roles query')
process.exit(0)
