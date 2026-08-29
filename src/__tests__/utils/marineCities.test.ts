import { describe, expect, it } from 'vitest';
import { supportsMarineContext } from '../../utils/marineCities';

describe('supportsMarineContext', () => {
  it.each(['İstanbul', 'Istanbul', 'istanbul', 'Çanakkale', 'Canakkale'])(
    'matches coastal province %s across localized provider spellings',
    city => {
      expect(supportsMarineContext(city)).toBe(true);
    }
  );

  it('does not classify inland or missing city names as marine', () => {
    expect(supportsMarineContext('Ankara')).toBe(false);
    expect(supportsMarineContext(undefined)).toBe(false);
  });
});
