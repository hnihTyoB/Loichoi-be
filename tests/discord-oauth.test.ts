import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { discordOAuthService } from '../src/modules/auth/discord-oauth.service';

describe('Discord OAuth Service & Security Verification', () => {
  it('should generate secure CSRF state and verify it only once (One-time token)', () => {
    const state = discordOAuthService.generateState('http://localhost:3000/custom-callback');
    assert.ok(state.length >= 32);

    // 1st verification should succeed
    const firstVerify = discordOAuthService.verifyAndConsumeState(state);
    assert.equal(firstVerify.isValid, true);
    assert.equal(firstVerify.redirectUri, 'http://localhost:3000/custom-callback');

    // 2nd verification must fail (Replay attack defense)
    const secondVerify = discordOAuthService.verifyAndConsumeState(state);
    assert.equal(secondVerify.isValid, false);
  });

  it('should enforce nonce cookie binding to protect against Login CSRF / Session Fixation', () => {
    const nonce = 'browser_secret_nonce_123';
    const state = discordOAuthService.generateState('http://localhost:3000/callback', nonce);

    // Mismatched nonce should fail
    const mismatchedVerify = discordOAuthService.verifyAndConsumeState(state, 'wrong_attacker_nonce');
    assert.equal(mismatchedVerify.isValid, false);

    // Correct nonce should succeed on fresh state
    const freshState = discordOAuthService.generateState('http://localhost:3000/callback', nonce);
    const validVerify = discordOAuthService.verifyAndConsumeState(freshState, nonce);
    assert.equal(validVerify.isValid, true);
  });

  it('should construct valid Discord OAuth2 authorize URL with required scopes', () => {
    const state = 'test_state_12345';
    const authUrl = discordOAuthService.getAuthorizationUrl(state);

    const parsed = new URL(authUrl);
    assert.equal(parsed.protocol, 'https:');
    assert.equal(parsed.hostname, 'discord.com');
    assert.equal(parsed.pathname, '/api/oauth2/authorize');
    assert.equal(parsed.searchParams.get('response_type'), 'code');
    assert.equal(parsed.searchParams.get('scope'), 'identify email');
    assert.equal(parsed.searchParams.get('state'), 'test_state_12345');
  });

  it('should format Discord avatar URL accurately (animated and static)', () => {
    const staticUser = {
      id: '123456789',
      username: 'testuser',
      discriminator: '0',
      avatar: 'abc123hash',
    };
    assert.equal(
      discordOAuthService.getAvatarUrl(staticUser),
      'https://cdn.discordapp.com/avatars/123456789/abc123hash.webp?size=256',
    );

    const animatedUser = {
      id: '987654321',
      username: 'nitro_user',
      discriminator: '0',
      avatar: 'a_animatedhash',
    };
    assert.equal(
      discordOAuthService.getAvatarUrl(animatedUser),
      'https://cdn.discordapp.com/avatars/987654321/a_animatedhash.gif?size=256',
    );

    const noAvatarUser = {
      id: '111222333',
      username: 'default_user',
      discriminator: '0',
      avatar: null,
    };
    assert.equal(discordOAuthService.getAvatarUrl(noAvatarUser), null);
  });
});
