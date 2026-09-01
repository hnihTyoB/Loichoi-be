import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiscordBotService } from '../src/modules/auth/discord-bot.service';

describe('Discord Theme Announcement Sequence Number Verification', () => {
  it('should initialize announcement sequence starting from 2379 and increment consecutively', async () => {
    const botService = new DiscordBotService();

    const seq1 = await botService.getNextAnnouncementSequenceNumber();
    assert.ok(seq1 >= 2379, `Sequence number should start at or above 2379, got ${seq1}`);

    const seq2 = await botService.getNextAnnouncementSequenceNumber();
    assert.equal(seq2, seq1 + 1, 'Consecutive calls should increment sequence number by 1');
  });

  it('should correctly parse existing sequence number from title formats and clean the theme name', () => {
    const testCases = [
      {
        input: '2379 ♡ Cyberpunk Neon Glow',
        expectedNum: 2379,
        expectedClean: 'Cyberpunk Neon Glow',
      },
      {
        input: '#2380 - Sakura Dreams',
        expectedNum: 2380,
        expectedClean: 'Sakura Dreams',
      },
      {
        input: 'No.2381 Vintage Mechanical',
        expectedNum: 2381,
        expectedClean: 'Vintage Mechanical',
      },
      {
        input: '2382 | Galaxy Nebula Edition',
        expectedNum: 2382,
        expectedClean: 'Galaxy Nebula Edition',
      },
    ];

    for (const { input, expectedNum, expectedClean } of testCases) {
      const match = input.match(/^(?:#|No\.?|№)?\s*(\d{1,6})\s*[-_♡♥:|\s]\s*(.*)$/i);
      assert.ok(match, `Should match number in ${input}`);
      assert.equal(parseInt(match[1], 10), expectedNum);
      assert.equal(match[2].trim(), expectedClean);
    }
  });
});
