import React from 'react';
import Typography from "@mui/material/Typography";
import { Grid, Button, Card } from '@mui/material';
import { useApiRequest } from '../api';
import { GraphViewer } from '../components/GraphViewer';
import { Graph } from '../components/GraphViewer/component';

interface Properties {
  message?: string,
}

interface Record {
  properties: Properties,
}

interface Event {
  time: string,
  target?: string;
  record: Record;
}

export function RenderGraph(): React.ReactElement {
  const { data: graphData, refetch } = useApiRequest<Graph, void>('/v1/render_graph', { method: 'GET' });

  if (!graphData) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Grid container direction="row">
        <Grid item flexGrow={1}>
          <Typography color="primary" variant="h4">Render Graph</Typography>
        </Grid>
        <Grid item>
          <Button onClick={() => refetch()}>
            Reload
          </Button>
        </Grid>
      </Grid>
      <Card sx={{ padding: 1, marginTop: 2, display: 'flex', flex: 1 }}>
        <GraphViewer graph={graphData} />
      </Card>
    </div>
  );
}