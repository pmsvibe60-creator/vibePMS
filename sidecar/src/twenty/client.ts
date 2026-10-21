import { config, requireSetting } from '../config.ts';

/**
 * Thin wrapper over Twenty's REST (/rest) and metadata GraphQL (/metadata) APIs.
 * REST responses wrap the payload in `data.<operationName>`; we unwrap the first key.
 */
async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${config.TWENTY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireSetting('TWENTY_API_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok || body.errors) {
    const msg = body.errors ? JSON.stringify(body.errors) : text;
    throw new Error(`Twenty ${init.method ?? 'GET'} ${path} → ${res.status}: ${msg.slice(0, 800)}`);
  }
  return body;
}

const unwrap = (body: any) => {
  const data = body?.data ?? {};
  const key = Object.keys(data)[0];
  return key ? data[key] : undefined;
};

export type TwentyRecord = { id: string; [k: string]: any };

export const twenty = {
  async list(plural: string, opts: { filter?: string; limit?: number; depth?: number; orderBy?: string } = {}): Promise<TwentyRecord[]> {
    const out: TwentyRecord[] = [];
    let cursor: string | undefined;
    do {
      const qs = new URLSearchParams();
      if (opts.filter) qs.set('filter', opts.filter);
      if (opts.orderBy) qs.set('order_by', opts.orderBy);
      qs.set('limit', String(Math.min(opts.limit ?? 200, 200)));
      qs.set('depth', String(opts.depth ?? 0));
      if (cursor) qs.set('starting_after', cursor);
      const body = await request(`/rest/${plural}?${qs}`);
      const rows: TwentyRecord[] = unwrap(body) ?? [];
      out.push(...rows);
      cursor = body.pageInfo?.hasNextPage && (!opts.limit || out.length < opts.limit) ? body.pageInfo.endCursor : undefined;
    } while (cursor);
    return opts.limit ? out.slice(0, opts.limit) : out;
  },

  async get(plural: string, id: string, depth = 1): Promise<TwentyRecord> {
    return unwrap(await request(`/rest/${plural}/${id}?depth=${depth}`));
  },

  async create(plural: string, data: Record<string, unknown>): Promise<TwentyRecord> {
    return unwrap(await request(`/rest/${plural}`, { method: 'POST', body: JSON.stringify(data) }));
  },

  async update(plural: string, id: string, data: Record<string, unknown>): Promise<TwentyRecord> {
    return unwrap(await request(`/rest/${plural}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }));
  },

  /** Adds a note on a record (shows in the record's timeline/Notes tab). */
  async addNote(targetField: 'lease' | 'unit' | 'invoice' | 'person', targetId: string, title: string, markdown: string) {
    const note = await request(`/rest/notes`, {
      method: 'POST',
      body: JSON.stringify({ title, bodyV2: { markdown, blocknote: null } }),
    }).then(unwrap);
    await request(`/rest/noteTargets`, {
      method: 'POST',
      // noteTarget.target is a morph relation: target<Object>Id
      body: JSON.stringify({ noteId: note.id, [`target${targetField[0].toUpperCase()}${targetField.slice(1)}Id`]: targetId }),
    });
    return note;
  },

  async metadata<T = any>(gql: string, variables: Record<string, unknown> = {}): Promise<T> {
    const body = await request(`/metadata`, { method: 'POST', body: JSON.stringify({ query: gql, variables }) });
    return body.data as T;
  },
};
