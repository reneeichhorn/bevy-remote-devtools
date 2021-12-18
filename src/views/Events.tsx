import React, { useEffect } from 'react';
import Typography from "@mui/material/Typography";
import { Card, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useApiRequest } from '../api';
import moment from 'moment';

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

export function EventsView(): React.ReactElement {
  const { data: events, refetch } = useApiRequest<Event[], void>('/v1/tracing/events', { method: 'GET' });

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 2000);
    return () => clearInterval(interval);
  });

  if (!events) {
    return null;
  }

  return (
    <>
      <Typography color="primary" variant="h4">Tracing Events</Typography>
      <Card sx={{ padding: 1, marginTop: 2 }}>
        <Table sx={{ marginTop: 1}} >
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((event, i) => (
              <TableRow key={i}>
                <TableCell component="th" scope="row">{moment(event.time).format("L LTS")}</TableCell>
                <TableCell scope="row">{event.target}</TableCell>
                <TableCell sx={{ wordBreak: 'break-all' }} scope="row">
                  {event.record.properties?.message || ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}