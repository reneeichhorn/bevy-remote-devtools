import React, { useEffect, useState } from 'react';
import Typography from "@mui/material/Typography";
import { Card, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useDoApiRequest } from '../api';
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

const exclusionList = ['bevy_render2::render_phase::draw_state'];

export function EventsView(): React.ReactElement {
  const [events, setEvents] = useState<Event[]>([]);
  const apiRequest = useDoApiRequest();

  useEffect(() => {
    const request = async () => {
      const events = await apiRequest<Event[]>('/v1/tracing/events', { method: 'GET' });
      setEvents(events.filter(e => !exclusionList.includes(e.target)));
    };
    request();
    const interval = setInterval(request, 2000);

    return () => {
      clearInterval(interval);
    };
  });

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
                <TableCell scope="row">{event.record.properties?.message || ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}