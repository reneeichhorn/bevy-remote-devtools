import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface ContextType {
  host: string,
  setHost: React.Dispatch<React.SetStateAction<string>>,
}

const ApiContext = createContext<ContextType | null>(null);

export function useApiHost() {
  const { host } = useContext(ApiContext);
  return host;
}

export function useSetApiHost(): React.Dispatch<React.SetStateAction<string>> {
  const { setHost } = useContext(ApiContext);
  return setHost;
}

interface RequestSettings<T> {
  method: 'GET' | 'POST',
  body?: T,
}

function parameterizeString(value: string, params: Record<string, unknown>): string {
  let newValue = value.toString();
  Object.entries(params).forEach(([key, value]) => {
    newValue = newValue.replace(`{${key}}`, value.toString());
  });
  return newValue;
}

export async function doApiRequest<T, S = void>(
  host: string,
  endpoint: string,
  settings: RequestSettings<S>,
  params: Record<string, unknown> = {},
): Promise<T> {
  const parametizedEndpoint = parameterizeString(endpoint, params);
  const request = await fetch(`http://${host}${parametizedEndpoint}`, {
    method: settings.method,
    mode: 'cors',
    headers: settings.body ? {
      'Content-Type': 'application/json',
    } : undefined,
    body: settings.body ? JSON.stringify(settings.body) : undefined,
  });
  return await request.json();
}

interface RequestOutput<T> {
  data?: T,
  refetch: (params?: Record<string, unknown>) => void,
  isFetching: boolean,
}

export function useDoApiRequest(): <T, S>(endpoint: string, settings: RequestSettings<S>) => Promise<T> {
  const host = useApiHost();
  return useCallback((endpoint, settings) => {
    return doApiRequest(host, endpoint, settings);
  }, [host]);
}

export function useApiRequest<T, S>(
  endpoint: string,
  settings: RequestSettings<S>,
  initialParams: Record<string, unknown> = {},
): RequestOutput<T> {
  const [data, setData] = useState<T>(null);
  const [params, setParams] = useState<Record<string, unknown>>(initialParams);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const host = useApiHost();

  const fetch = async (newParams = {}) => {
    if (!host) {
      setData(null);
      return;
    }

    setIsFetching(true);
    const mergedParams = { ...params, ...newParams };
    setParams(mergedParams);
    const output = await doApiRequest<T, S>(host, endpoint, settings, mergedParams);
    setData(output);
    setIsFetching(false);
  };

  useEffect(() => {
    if (host) {
      fetch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  return {
    data,
    isFetching,
    refetch: fetch,
  }
}

interface Props {
  children: React.ReactNode,
}

export function ApiProvider({ children }: Props): React.ReactElement {
  const [host, setHost] = useState();
  const value = useMemo<ContextType>(() => {
    return { host, setHost } as ContextType;
  }, [host]);

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
}