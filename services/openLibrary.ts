import { OPEN_LIBRARY_URL, GENRES } from '../constants';
import { Book, Author } from '../types';

// Custom Error classes for more specific error handling
export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchError';
  }
}

export class BookNotFoundError extends FetchError {
  constructor(workId: string) {
    super(`Book with ID "${workId}" not found.`);
    this.name = 'BookNotFoundError';
  }
}

interface SearchResult {
  docs: Book[];
  numFound: number;
}

interface BrowseOptions {
  query?: string;
  genres?: string[];
  year?: string;
  sort?: string;
  limit?: number;
  page?: number;
}

export const browseBooks = async (
  options: BrowseOptions
): Promise<{ books: Book[]; total: number }> => {
  const { query, genres, year, sort, limit = 40, page = 1 } = options;

  const searchParams = new URLSearchParams();

  // FIX: OpenLibrary breaks if q=* and subject is used → return 422
  if (query) {
    searchParams.set("q", query);
  } else if (genres?.length) {
    // Use subject name as query to avoid q=* 422 errors
    searchParams.set("q", genres[0]);
  } else {
    searchParams.set("q", "");
  }

  // Add subjects
  if (genres && genres.length > 0) {
    genres.forEach((g) => searchParams.append('subject', g));
  }

  if (year) {
    searchParams.set('publish_year', year);
  }

  if (sort && sort !== 'relevance') {
    searchParams.set('sort', sort);
  }

  const offset = (page - 1) * limit;
  searchParams.set('offset', offset.toString());
  searchParams.set('language', 'eng');
  searchParams.set('limit', limit.toString());

  searchParams.set(
    'fields',
    'key,title,author_name,cover_i,first_publish_year'
  );

  const requestUrl = `${OPEN_LIBRARY_URL}/search.json?${searchParams.toString()}`;
  const cacheKey = `browse_${requestUrl}`;

  try {
    const response = await fetch(requestUrl);
    if (!response.ok) {
      throw new FetchError(
        `Network response was not ok, status: ${response.status}`
      );
    }

    const data: SearchResult = await response.json();

    const filteredBooks = data.docs.filter((doc) => doc.key);

    const result = { books: filteredBooks, total: data.numFound };
    sessionStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
  } catch (error) {
    console.warn('Failed to fetch, checking cache...', error);
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
    throw error;
  }
};

// ---------------- Book Details -----------------

export const getBookDetails = async (workId: string): Promise<Book> => {
  const response = await fetch(`${OPEN_LIBRARY_URL}/works/${workId}.json`);
  if (!response.ok) {
    if (response.status === 404) throw new BookNotFoundError(workId);
    throw new FetchError('Failed to fetch book details from Open Library.');
  }

  const data: Book = await response.json();

  // Fetch edition for cover + identifiers
  try {
    const editionsRes = await fetch(
      `${OPEN_LIBRARY_URL}/works/${workId}/editions.json?limit=1&language=eng`
    );

    if (editionsRes.ok) {
      const editionsData = await editionsRes.json();
      const edition = editionsData.entries?.[0];

      if (edition) {
        if (edition.covers?.length > 0) {
          data.cover_i = edition.covers[0];
        }

        if (edition.identifiers) {
          data.external_links = {};

          if (edition.identifiers.goodreads?.[0]) {
            data.external_links.goodreads = `https://www.goodreads.com/book/show/${edition.identifiers.goodreads[0]}`;
          }

          if (edition.identifiers.amazon?.[0]) {
            data.external_links.amazon = `https://www.amazon.com/dp/${edition.identifiers.amazon[0]}`;
          }

          if (edition.identifiers.google?.[0]) {
            data.external_links.google = `https://books.google.com/books?id=${edition.identifiers.google[0]}`;
          }
        }
      }
    }
  } catch (error) {
    console.warn('Edition fetch failed:', error);
  }

  // Fetch author details if needed
  if (data.authors?.[0]?.author?.key) {
    const authorKey = data.authors[0].author.key;

    try {
      const authorRes = await fetch(`${OPEN_LIBRARY_URL}${authorKey}.json`);
      if (authorRes.ok) {
        const authorData: Author = await authorRes.json();
        data.author_name = [authorData.name];
        data.author_details = {
          name: authorData.name,
          bio: authorData.bio,
          birth_date: authorData.birth_date,
          death_date: authorData.death_date
        };
      }
    } catch (err) {
      console.warn(`Author fetch failed: ${authorKey}`, err);
    }
  }

  return data;
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ----------- Home Page Fetching -----------

const TRENDING_FALLBACKS = [
  'love',
  'fiction',
  'thriller',
  'adventure',
  'fantasy'
];

export const getTrendingBooks = async (
  limit: number = 20
): Promise<Book[]> => {
  for (const subject of TRENDING_FALLBACKS) {
    try {
      const { books } = await browseBooks({
        genres: [subject],
        sort: 'relevance',
        limit
      });
      if (books.length) return books;
    } catch {
      await sleep(250);
    }
  }
  return [];
};

const TOP_RATED_FALLBACKS = [
  'history',
  'classic_literature',
  'biography',
  'science'
];

export const getTopRatedBooks = async (
  limit: number = 20
): Promise<Book[]> => {
  for (const subject of TOP_RATED_FALLBACKS) {
    try {
      const { books } = await browseBooks({
        genres: [subject],
        sort: 'relevance',
        limit
      });
      if (books.length) return books;
    } catch {
      await sleep(250);
    }
  }

  return [];
};

const POPULAR_RANDOM_SUBJECTS = [
  'adventure',
  'fantasy',
  'science_fiction',
  'romance',
  'thriller',
  'mystery'
];

export const getRandomBooks = async (
  limit: number = 20
): Promise<Book[]> => {
  const shuffled = [...POPULAR_RANDOM_SUBJECTS]
    .map((v) => ({ v, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.v);

  for (const subject of shuffled) {
    try {
      const { books } = await browseBooks({
        genres: [subject],
        sort: 'relevance',
        limit
      });
      if (books.length) return books;
    } catch {
      await sleep(250);
    }
  }

  return [];
};
