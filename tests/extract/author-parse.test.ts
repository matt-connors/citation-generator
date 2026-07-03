import { describe, it, expect } from 'vitest';
import { parseAuthorList, parseAuthorName } from '../../functions/lib/extract/author-parse';

describe('parseAuthorName', () => {
  it('parses "First Last"', () => {
    expect(parseAuthorName('John Smith')).toEqual({ family: 'Smith', given: 'John' });
  });
  it('parses "First Middle Last"', () => {
    expect(parseAuthorName('John Q Smith')).toEqual({ family: 'Smith', given: 'John Q' });
  });
  it('parses "Last, First"', () => {
    expect(parseAuthorName('Smith, John')).toEqual({ family: 'Smith', given: 'John' });
  });
  it('parses single-token names', () => {
    expect(parseAuthorName('Cher')).toEqual({ family: 'Cher' });
  });
  it('treats all-caps acronyms as literal organization names', () => {
    expect(parseAuthorName('CDC')).toEqual({ literal: 'CDC' });
    expect(parseAuthorName('NASA')).toEqual({ literal: 'NASA' });
  });
  it('recognises non-dropping particles', () => {
    expect(parseAuthorName('John von Neumann')).toEqual({
      family: 'Neumann', given: 'John', 'non-dropping-particle': 'von',
    });
  });
  it('keeps multi-token non-dropping particles together', () => {
    expect(parseAuthorName('Ludwig van der Waals')).toEqual({
      family: 'Waals', given: 'Ludwig', 'non-dropping-particle': 'van der',
    });
  });
  it('recognises trailing suffixes', () => {
    expect(parseAuthorName('John Smith Jr.')).toEqual({
      family: 'Smith', given: 'John', suffix: 'Jr.',
    });
  });
  it('flags corporate authors as literal', () => {
    expect(parseAuthorName('Wikimedia Foundation')).toEqual({ literal: 'Wikimedia Foundation' });
    expect(parseAuthorName('Acme Corp.')).toEqual({ literal: 'Acme Corp.' });
    expect(parseAuthorName('Stanford University')).toEqual({ literal: 'Stanford University' });
  });
  it('treats org-suffix tokens as org markers only at end of string', () => {
    // Regression: ORG_SUFFIXES matched anywhere in the string, so a surname
    // like "Co" in "Co, John" was wrongly flagged as an organization.
    expect(parseAuthorName('Co, John')).toEqual({ family: 'Co', given: 'John' });
    // And a token like "Foundation" appearing in the middle of a name
    // (e.g., person whose middle name happens to be Foundation) should be
    // parsed as a person, not flattened to a literal.
    expect(parseAuthorName('Foundation House Smith')).toEqual({
      family: 'Smith', given: 'Foundation House',
    });
  });
  it('still flags orgs that end in a period (Foundation., Press., etc.)', () => {
    // Regression: a first attempt anchored ORG_SUFFIXES with `\s*$`, which
    // only allowed trailing whitespace. Org-suffix tokens without a built-in
    // optional period (Foundation, Press, University, Institute, Society,
    // Group, Company, Department, Office, Agency, Bureau, Commission) would
    // no longer match if the source HTML had a trailing dot.
    expect(parseAuthorName('Wikimedia Foundation.')).toEqual({ literal: 'Wikimedia Foundation.' });
    expect(parseAuthorName('Stanford University.')).toEqual({ literal: 'Stanford University.' });
  });
  it('passes through pre-structured input', () => {
    expect(parseAuthorName({ family: 'X', given: 'Y' })).toEqual({ family: 'X', given: 'Y' });
  });
  it('trims whitespace', () => {
    expect(parseAuthorName('  John Smith  ')).toEqual({ family: 'Smith', given: 'John' });
  });
  it('returns null-ish for empty input', () => {
    expect(parseAuthorName('')).toBeNull();
    expect(parseAuthorName('   ')).toBeNull();
  });
});

describe('parseAuthorList', () => {
  it('keeps "Last, First" as a single author', () => {
    expect(parseAuthorList('Smith, John')).toEqual([{ family: 'Smith', given: 'John' }]);
  });

  it('splits comma, semicolon, and conjunction separated author lists', () => {
    expect(parseAuthorList('Jane Doe, John Smith; Carlos Ruiz and Acme News')).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Smith', given: 'John' },
      { family: 'Ruiz', given: 'Carlos' },
      { literal: 'Acme News' },
    ]);
  });

  it('strips leading byline labels', () => {
    expect(parseAuthorList('By Jane Doe & John Smith')).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Smith', given: 'John' },
    ]);
  });

  it('does not split organization names that contain "and"', () => {
    expect(parseAuthorList('Research and Development Office')).toEqual([
      { literal: 'Research and Development Office' },
    ]);
  });

  it('drops trailing et al. instead of parsing it as a surname', () => {
    expect(parseAuthorList('Jane Doe et al.')).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });
});
