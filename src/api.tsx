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

export async function doApiRequest<T, S = void>(
  host: string,
  endpoint: string,
  settings: RequestSettings<S>
): Promise<T> {
  const request = await fetch(`http://${host}${endpoint}`, {
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
  refetch: () => void,
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
  deps: React.DependencyList = [],
): RequestOutput<T> {
  const [data, setData] = useState<T>(null);
  const host = useApiHost();

  const fetch = async () => {
    const output = await doApiRequest<T, S>(host, endpoint, settings);
    setData(output);
  };

  useEffect(() => {
    fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, ...deps]);

  return {
    data,
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