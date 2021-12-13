import React, { useMemo, } from 'react';
import Typography from "@mui/material/Typography";
import { Button, Card, Grid, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useApiRequest } from '../api';
import groupBy from 'lodash/groupBy';
import { useAssetViewer } from '../components/AssetViewer';


interface Asset {
  id: unknown,
  name?: string;
  ty: string;
}

interface SectionProps {
  assets: Asset[],
  title: string,
  type: 'Mesh',
}

export function AssetSection({ assets, title, type }: SectionProps): React.ReactElement {
  const assetViewer = useAssetViewer();
  return (
    <>
      <Typography color="primary" variant="h5" sx={{ marginTop: 1 }}>{title}</Typography>
      <Card sx={{ padding: 1, marginTop: 2 }}>
        <Table sx={{ marginTop: 1}} >
          <TableHead>
            <TableRow>
              <TableCell>Name (if known)</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.map((asset, i) => (
              <TableRow key={i}>
                <TableCell scope="row">{asset.name || 'Unknown'}</TableCell>
                <TableCell scope="row">
                  <Button 
                    onClick={() => assetViewer.showAsset({ type, id: asset.id})}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export function AssetsView(): React.ReactElement {
  const { data: assets, refetch } = useApiRequest<Asset, void>("/v1/assets", { method: 'GET' });

  const groupedAssets = useMemo(() => {
    return groupBy(assets || [], (asset: Asset) => asset.ty);
  }, [assets]);

  return (
    <>
      <Grid container direction="row">
        <Grid item flexGrow={1}>
          <Typography color="primary" variant="h4">Assets</Typography>
        </Grid>
        <Grid item>
          <Button onClick={() => refetch()}>
            Reload
          </Button>
        </Grid>
      </Grid>
      <AssetSection assets={groupedAssets['Mesh'] || []} title="Meshes" type="Mesh" />
    </>
  );
}