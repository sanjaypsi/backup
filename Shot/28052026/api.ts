import { getAuthHeader, setNewToken } from "../auth/util";
import { AuthorizationError } from "../auth/types";
import { Property, Value, GROUP, Order, SettingValue, SettingSection, ConfPrefValueType, EnvValueType } from "./types";

type PropertyListResponse = Readonly<{
  properties: Property[],
  next: string | null,
  total: number,
}>;

export async function queryProperties(
  group: string,
  section: string,
  page: number,
  rowsPerPage: number,
  order: Order,
  orderBy: string,
  searchKey: string,
  signal?: AbortSignal | null,
): Promise<PropertyListResponse> {
  const headers = getAuthHeader();
  let url: string | null = `/api/pipelineSetting/${group}`
  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  if (page !== 0) {
    params.set('page', String(page + 1));
  }
  params.set('order_by', order === 'asc' ? orderBy : '-' + orderBy);
  if (searchKey != '') {
    params.set('search_key', searchKey);
  }
  if (group == GROUP.Config) {
    url += `/sections/${section}`;
  }
  url += `/properties?${params}`;

  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch parameters.');
  }
  setNewToken(res);
  const json: PropertyListResponse = await res.json();
  return json;
}

type ValueListResponse = Readonly<{
  values: Value[],
  next: string | null,
  total: number,
}>;

export async function queryValues(
  group: string,
  section: string,
  entry: string,
  page: number,
  rowsPerPage: number,
  order: Order,
  orderBy: string,
  searchKey: string,
  signal?: AbortSignal | null,
): Promise<ValueListResponse> {
  const headers = getAuthHeader();
  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  if (page !== 0) {
    params.set('page', String(page + 1));
  }
  params.set('order_by', order === 'asc' ? orderBy : '-' + orderBy);
  if (searchKey != '') {
    params.set('search_key', searchKey);
  }
  let url: string | null = `/api/pipelineSetting/${group}/${section}s/${entry}/values?${params}`;

  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch values.');
  }
  const json: ValueListResponse = await res.json();
  setNewToken(res);

  return json;
}

type PropertyCreationData = {
  key: string,
  schema: { [k: string]: any },
  required: boolean,
};

export async function createProperty(
  keyName: string,
  schema: { [k: string]: any },
  required: boolean,
  group: string,
  section?: string,
  signal?: AbortSignal | null,
): Promise<Property> {
  const headers = getAuthHeader();
  const data: PropertyCreationData = {
    key: keyName,
    schema,
    required,
  };
  let url: string | null = `/api/pipelineSetting/${group}`
  if (group == GROUP.Config) {
    url += `/sections/${section}`;
  }
  url += `/properties`;
  const res = await fetch(
    url,
    {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(data),
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    let message: string;
    try {
      const json: { message: string } = await res.json();
      message = json.message;
    } catch (err) {
      message = `Failed to create parameter. ${JSON.stringify(data)}`;
    }
    throw new Error(message);
  }
  setNewToken(res);
  return await res.json();
}

type ValueCreationData = {
  key: string,
  value: any,
};

export async function createValue(
  key: string,
  value: ConfPrefValueType | EnvValueType,
  group: string,
  section: string,
  entry: string,
  signal?: AbortSignal | null,
): Promise<Value> {
  const headers = getAuthHeader();
  const data: ValueCreationData = { key, value };
  let url: string | null = `/api/pipelineSetting/${group}/${section}s/${entry}/values`;

  const res = await fetch(
    url,
    {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(data),
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    let message: string;
    try {
      const json: { message: string } = await res.json();
      message = json.message;
    } catch (err) {
      message = `Failed to create value. ${JSON.stringify(data)}`;
    }
    throw new Error(message);
  }
  setNewToken(res);
  return await res.json();
}

type PropertyUpdateData = {
  schema: { [k: string]: any },
  required: boolean,
};

export async function updateProperty(
  keyName: string,
  schema: { [k: string]: any },
  required: boolean,
  group: string,
  section?: string,
  signal?: AbortSignal | null,
): Promise<Property> {
  const headers = getAuthHeader();
  const data: PropertyUpdateData = { schema, required };
  let url: string | null = `/api/pipelineSetting/${group}`
  if (group == GROUP.Config) {
    url += `/sections/${section}`;
  }
  keyName = keyName.replace("/", "%2F");
  url += `/properties/${keyName}`;
  const res = await fetch(
    url,
    {
      method: 'PATCH',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(data),
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    let message: string;
    try {
      const json: { message: string } = await res.json();
      message = json.message;
    } catch (err) {
      message = `Failed to create parameter. ${JSON.stringify(data)}`;
    }
    throw new Error(message);
  }
  setNewToken(res);
  return await res.json();
}

type ValueUpdateData = {
  value: any,
  modified_by?: string,
};

export async function updateValue(
  updateKey: string,
  value: any,
  group: string,
  section: string,
  entry: string,
  signal?: AbortSignal | null,
): Promise<Value> {
  const headers = getAuthHeader();
  const data: ValueUpdateData = { value };
  updateKey = updateKey.replace("/", "%2F");
  let url: string | null = `/api/pipelineSetting/${group}/${section}s/${entry}/values/${updateKey}`;
  const res = await fetch(
    url,
    {
      method: 'PATCH',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(data),
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    let message: string;
    try {
      const json: { message: string } = await res.json();
      message = json.message;
    } catch (err) {
      message = `Failed to create parameter. ${JSON.stringify(data)}`;
    }
    throw new Error(message);
  }
  setNewToken(res);
  return await res.json();
}

export async function deleteProperty(
  keyName: string,
  group: string,
  section?: string,
  signal?: AbortSignal | null,
): Promise<void> {
  const headers = getAuthHeader();
  let url: string | null = `/api/pipelineSetting/${group}`
  if (group == GROUP.Config) {
    url += `/sections/${section}`;
  }
  keyName = keyName.replace("/", "%2F");
  url += `/properties/${keyName}`;
  const res = await fetch(
    url,
    {
      method: 'DELETE',
      headers,
      mode: 'cors',
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    let message: string;
    try {
      const json: { message: string } = await res.json();
      message = json.message;
    } catch (e) {
      message = `Failed to delete parameter: ${keyName}`;
    }
    throw new Error(message);
  }
  setNewToken(res);
}

export async function deleteValue(
  deleteKey: string,
  group: string,
  section: string,
  entry: string,
  signal?: AbortSignal | null,
): Promise<void> {
  const headers = getAuthHeader();
  deleteKey = deleteKey.replaceAll("/", "%2F");
  let url: string | null = `/api/pipelineSetting/${group}/${section}s/${entry}/values/${deleteKey}`;
  const res = await fetch(
    url,
    {
      method: 'DELETE',
      headers,
      mode: 'cors',
      signal,
    },
  );
  if (res.status == 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    let message: string;
    try {
      const json: { message: string } = await res.json();
      message = json.message;
    } catch (err) {
      message = `Failed to delete value with key ${deleteKey}.`;
    }
    throw new Error(message);
  }
  setNewToken(res);
}

export async function queryPreference(
  common: string,
  studio: string,
  project: string,
  key: string,
  signal?: AbortSignal | null,
): Promise<any> {
  const headers = getAuthHeader();
  const res = await fetch(
    `/api/pipelineSetting/preference/composite/values/${encodeURIComponent(key)}`
    + `?common=${common}&studio=${studio}&project=${project}`,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal
    },
  );
  if (res.status == 401) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch preference value with key '${key}'.`);
  }
  setNewToken(res);
  const json: SettingValue = await res.json();
  return json.value;
}

export async function queryConfig(
  section: SettingSection,
  keyName: string,
  key: string,
  signal?: AbortSignal | null,
): Promise<any> {
  const headers = getAuthHeader();
  const res = await fetch(
    `/api/pipelineSetting/config/${section}s/${keyName}/values/${key}`,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal
    },
  );
  if (res.status == 401) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch '${key}' of the ${section} '${keyName}'.`);
  }
  setNewToken(res);
  const json: SettingValue = await res.json();
  return json.value;
}
