import { describe, expect, it } from 'vitest';
import { RELEASE_NOTES_VERSION, releaseNotesFor } from '../src/utils/releaseNotes';

describe('release notes for upgrade paths', () => {
  it.each([undefined, '', '1.3.3', '1.2', 'invalid'])('includes all changelogs for an installation before 1.4: %s', previous => {
    expect(releaseNotesFor(previous).map(release => release.version)).toEqual(['1.6', '1.5', '1.4']);
  });
  it.each(['1.4', '1.4.0', '1.4.9'])('includes 1.6 and 1.5 for users who saw 1.4: %s', previous => {
    expect(releaseNotesFor(previous).map(release => release.version)).toEqual(['1.6', '1.5']);
  });
  it.each(['1.5', '1.5.0', '1.5.2', '1.6'])('shows only new changes for users who saw 1.5: %s', previous => {
    expect(releaseNotesFor(previous).map(release => release.version)).toEqual(['1.6']);
  });
  it('has complete current and previous changelogs', () => {
    expect(RELEASE_NOTES_VERSION).toBe('1.6');
    const releases = releaseNotesFor('1.3.3');
    expect(releases[0].changes.map(([section]) => section)).toEqual(['Schede e Splits', 'Progressi', 'Diario e Peso', 'Allenamento']);
    expect(releases[1].changes.map(([section]) => section)).toEqual(['Palestre e macchinari', 'Scienza', 'Allenamento']);
    expect(releases[2].changes.map(([section]) => section)).toEqual(['Allenamento', 'Progressi', 'Scienza']);
  });
});
