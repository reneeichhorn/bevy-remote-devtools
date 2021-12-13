import { Button, Grid, styled, Typography } from '@mui/material';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { useDoApiRequest } from '../../api';
import { startMeshBrowser } from './renderer';

interface ContextType {
  showAsset: React.Dispatch<React.SetStateAction<Asset>>,
}

const Context = createContext<ContextType>(null);

interface AssetViewerProviderProps {
  children: React.ReactNode;
}

export interface Asset {
  type: 'Mesh' | 'Texture',
  id: unknown,
}

const OverlayGrid = styled(Grid)(({ theme }) => ({
  position: 'fixed',
  top: theme.spacing(1),
  bottom: theme.spacing(1),
  left: theme.spacing(1),
  right: theme.spacing(1),
  background: 'rgba(0, 0, 0, 0.8)',
  zIndex: 10000,
  padding: theme.spacing(3),
}));

interface MeshAssetResponse {
  vertices: number[][],
  indices: number[],
}

export function AssetViewerProvider({ children }: AssetViewerProviderProps): React.ReactElement {
  const [activeAsset, setActiveAsset] = useState<Asset>(null);
  const [activeAssetData, setActiveAssetData] = useState<unknown>(null);
  const [activeAssetCloseHandler, setActiveAssetCloseHandler] = useState<() => void>(null);

  const apiRequest = useDoApiRequest();
  const contextValue = useMemo(() => ({
    showAsset: async function (asset: Asset) {
      setActiveAsset(asset);
      const data = await apiRequest<MeshAssetResponse, unknown>('/v1/assets/mesh', {
        method: 'POST',
        body: asset.id,
      });
      setActiveAssetData(data);
      requestAnimationFrame(() => {
        const target = document.querySelector('#mesh-renderer');
        setActiveAssetCloseHandler(() => startMeshBrowser(target, data.vertices, data.indices));
      });
    },
  }), [apiRequest]);

  const handleClose = () => {
    setActiveAsset(null);
    setActiveAssetData(null);
    activeAssetCloseHandler();
    setActiveAssetCloseHandler(null);
  };

  return (
    <Context.Provider value={contextValue}>
      {children}
      {activeAsset ? (
        <OverlayGrid>
          <Button sx={{ zIndex: 100, position: 'absolute', right: 1, top: 1 }} onClick={handleClose}>
            Close
          </Button>

          {activeAssetData ? (
            <div 
              id="mesh-renderer" 
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}}
            > 
            </div>
          ) : (
            <Typography color="primary" variant="h4" sx={{ textAlign: 'center', flex: 1 }}>
              Loading asset content...
            </Typography>
          )}
        </OverlayGrid>
      ) : null}
    </Context.Provider>
  )
}

export function useAssetViewer(): ContextType {
  return useContext(Context);
}
