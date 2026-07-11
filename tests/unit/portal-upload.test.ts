import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedMimeType } from '../../src/app/api/portal-upload/route.js'

describe('isAllowedMimeType', () => {
  test('allows common image types', () => {
    assert.ok(isAllowedMimeType('image/jpeg'))
    assert.ok(isAllowedMimeType('image/png'))
    assert.ok(isAllowedMimeType('image/webp'))
    assert.ok(isAllowedMimeType('image/gif'))
    assert.ok(isAllowedMimeType('image/heic'))
  })

  test('allows video/mp4 and video/quicktime', () => {
    assert.ok(isAllowedMimeType('video/mp4'))
    assert.ok(isAllowedMimeType('video/quicktime'))
  })

  test('allows office and PDF types', () => {
    assert.ok(isAllowedMimeType('application/pdf'))
    assert.ok(isAllowedMimeType('application/msword'))
    assert.ok(isAllowedMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
    assert.ok(isAllowedMimeType('application/vnd.ms-excel'))
    assert.ok(isAllowedMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
  })

  test('rejects dangerous / unknown types', () => {
    assert.ok(!isAllowedMimeType('application/x-executable'))
    assert.ok(!isAllowedMimeType('text/html'))
    assert.ok(!isAllowedMimeType('application/zip'))
    assert.ok(!isAllowedMimeType('application/javascript'))
    assert.ok(!isAllowedMimeType(''))
  })

  test('allows any image/* subtype via prefix check', () => {
    assert.ok(isAllowedMimeType('image/avif'))
    assert.ok(isAllowedMimeType('image/tiff'))
  })
})
