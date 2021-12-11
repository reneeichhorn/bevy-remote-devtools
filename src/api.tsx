import React, { createContext, useContext, useMemo, useState } from "react";

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