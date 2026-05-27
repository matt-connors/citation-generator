import type { CSLItem, CSLName } from '../csl-types';
import { parseAuthorName } from '../extract/author-parse';
import { parseIsoDate } from '../extract/date-parse';
import type { OpenLibraryBook } from './openlibrary';
import type { GoogleBooksVolume } from './googlebooks';

export function normalizeOpenLibrary(book: OpenLibraryBook, isbn: string): CSLItem {
  const item: CSLItem = {
    id: isbn,
    type: 'book',
    ISBN: isbn,
  };
  if (book.title) {
    item.title = book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
  }
  if (book.authors?.length) {
    const parsed = book.authors
      .map((a) => parseAuthorName(a.name))
      .filter((n): n is CSLName => n !== null);
    if (parsed.length) item.author = parsed;
  }
  if (book.publishers?.length) item.publisher = book.publishers[0].name;
  if (book.publish_date) {
    const dp = parseIsoDate(book.publish_date);
    if (dp) item.issued = { 'date-parts': [dp] };
  }
  if (book.publish_places?.length) item['publisher-place'] = book.publish_places[0].name;
  return item;
}

export function normalizeGoogleBooks(vol: GoogleBooksVolume, isbn: string): CSLItem {
  const item: CSLItem = {
    id: isbn,
    type: 'book',
    ISBN: isbn,
  };
  if (vol.title) {
    item.title = vol.subtitle ? `${vol.title}: ${vol.subtitle}` : vol.title;
  }
  if (vol.authors?.length) {
    const parsed = vol.authors
      .map((a) => parseAuthorName(a))
      .filter((n): n is CSLName => n !== null);
    if (parsed.length) item.author = parsed;
  }
  if (vol.publisher) item.publisher = vol.publisher;
  if (vol.publishedDate) {
    const dp = parseIsoDate(vol.publishedDate);
    if (dp) item.issued = { 'date-parts': [dp] };
  }
  return item;
}
