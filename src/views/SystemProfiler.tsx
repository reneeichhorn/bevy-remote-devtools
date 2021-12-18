import React, { useCallback, useMemo, useState, } from 'react';
import Typography from "@mui/material/Typography";
import { 
  Box,
  Button,
  Card,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel, 
  TextField
} from '@mui/material';
import { useApiRequest } from '../api';
import sortBy from 'lodash/orderBy';
import uniq from 'lodash/uniq';
import flatten from 'lodash/flatten';
import { visuallyHidden } from '@mui/utils';

interface Trace {
  cat: string,
  name: string,
  ph: string,
  ts: number,
  args?: Record<string, unknown>,
}

interface System {
  name: string,
  time: number,
}

function analyzeTraces(traces: Trace[]): Record<string, System> {
  const systemBegins = traces.map((t, i) => ({ ...t, i })).filter(t => t.ph === 'B' && t.name === 'system') || [];
  const systems: System[] = systemBegins.map(startSpan => {
    const endSpan = traces?.slice(startSpan.i).find(
      span => span.args.name === startSpan.args.name && span.ph === 'E' && span.name === 'system'
    ) || null;
    if (!endSpan) {
      return null;
    }
    return {
      name: startSpan.args.name as string || '-',
      time: endSpan.ts - startSpan.ts,
    }
  }).filter(s => !!s);
  return Object.assign({}, ...systems.map(system => ({ [system.name]: system })));
}

export function SystemProfiler(): React.ReactElement {
  const { data: traces, refetch, isFetching } = useApiRequest<Trace[][], void>(
    "/v1/tracing/frames/{numFrames}",
    { method: 'GET' },
    { numFrames: 10 }
  );

  // TODO: Instead of doing in in javascript, the plugin should provide
  // a nice endpoint to receive the data in the needed format.
  const systems = useMemo(() => {
    const allFrames = traces?.map(trace => analyzeTraces(trace)) || [];
    const allSystems = uniq(flatten(allFrames.map(frame => Object.keys(frame))));
    return allSystems.map((systemName: string) => {
      let min = Number.MAX_SAFE_INTEGER;
      let max = 0;
      let sum = 0;
      let amount = 0;
      allFrames.forEach(frame => {
        const system = frame[systemName];
        if (!system) return;
        min = Math.min(min, system.time);
        max = Math.max(max, system.time);
        sum += system.time;
        amount += 1;
      });
      return {
        name: systemName,
        min,
        max,
        average: sum / amount,
      };
    });
  }, [traces]);

  // https://stackoverflow.com/a/30800715
  function downloadObjectAsJson(exportObj: unknown, exportName: string) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [orderBy, setOrderBy] = useState<string>('average');

  const sortedSystems = useMemo(() => {
    return sortBy(systems, orderBy, order).slice(0, 200);
  }, [orderBy, order, systems]);

  const SortableHeaderCell = useCallback(({ id, label }) => {
    return (
      <TableCell>
        <TableSortLabel
          active={orderBy === id}
          direction={orderBy === id ? order : 'asc'}
          onClick={() => {
            const isAsc = orderBy === id && order === 'asc';
            setOrder(isAsc ? 'desc' : 'asc');
            setOrderBy(id);
          }}
        >
          {label}
          {orderBy === id ? (
            <Box component="span" sx={visuallyHidden as unknown}>
              {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
            </Box>
          ) : null}
        </TableSortLabel>
      </TableCell>
    );
  }, [order, orderBy]);

  const [numFrames, setFrames] = useState<number>(10);

  return (
    <>
      <Grid container direction="row">
        <Grid item flexGrow={1}>
          <Typography color="primary" variant="h4">System Profiler</Typography>
        </Grid>
        <Grid item container direction="row" justifyContent="center" sx={{ width: 'auto' }}>
          <Button onClick={() => downloadObjectAsJson(traces[0], "bevy-trace")}>
            Save Chrome Trace (.json)
          </Button>
          <Button onClick={() => refetch({ numFrames })}>
            Trace Frame(s)
          </Button>
          <TextField 
            name='Frames'
            variant="outlined"
            size='small'
            margin='dense'
            label="Frames"
            type="number"
            value={numFrames}
            onChange={e => setFrames(parseInt(e.target.value))}
            sx={{ width: 80, marginLeft: 1 }}
          />
        </Grid>
      </Grid>
      {!isFetching ? (
        <Card sx={{ padding: 1, marginTop: 2 }}>
          <Table sx={{ marginTop: 1}} >
            <TableHead>
              <TableRow>
                <SortableHeaderCell label="Name" id="name" />
                <SortableHeaderCell label="Average" id="average" />
                <SortableHeaderCell label="Min" id="min" />
                <SortableHeaderCell label="Max" id="max" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedSystems.map((system, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ wordBreak: 'break-all' }} scope="row">{system.name}</TableCell>
                  <TableCell scope="row">{system.average}</TableCell>
                  <TableCell scope="row">{system.min}</TableCell>
                  <TableCell scope="row">{system.max}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Typography 
          color="GrayText" 
          variant="h6"
        >
          Trace capturing is in progress...
        </Typography>
      )}
    </>
  );
}