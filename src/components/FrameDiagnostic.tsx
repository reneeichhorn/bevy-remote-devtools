import { Grid, Typography } from '@mui/material';
import React, { useEffect } from 'react';
import { useApiRequest} from '../api';

interface FrameStats {
  fps?: number,
  frame_time?: number,
}

export function FrameDiagnostic(): React.ReactElement {
  const { data: frame, refetch } = useApiRequest<FrameStats, void>('/v1/diagnostics/frame', { method: 'GET' });

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  });

  if (!frame?.fps && !frame?.frame_time) {
    return null;
  }

  return (
    <Grid container direction="column" justifyContent="center" alignItems="flex-end" sx={{ flex: 1 }}>
      {frame.fps ? (
        <Grid item>
          <Typography variant="body2">FPS: {frame.fps.toFixed(2)}</Typography>
        </Grid>
      ) : null}
      {frame.frame_time ? (
        <Grid item>
          <Typography variant="body2">Frame Time: {frame.frame_time.toFixed(2)} ms</Typography>
        </Grid>
      ) : null}
    </Grid>
  )
}