import React, { useEffect, useState } from "react";
import { invoke } from '@tauri-apps/api/tauri'
import { 
  MenuItem,
  styled,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText, 
  Grid,
} from "@mui/material";
import { useApiHost, useSetApiHost } from "../api";

const infoCache = {};

interface Client {
  host: string,
  port: number,
}

const StyledTextField = styled(TextField)({
  marginLeft: 32,
  width: 300,
  backgroundColor: "rgba(255,255,255,0.15)",
  borderRadius: 4,
  "& .MuiOutlinedInput-inputSelect": {
    color: "#fff",
  },
  "& input": {
    color: "#fff",
  },
  "& label": {
    color: "#fff",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderWidth: 0,
  },
});

export function ClientSelect({ }): React.ReactElement {
  const [manualClients, setManualClients] = useState<Client[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => {
    const runner = async () => {
      const activeClients = await invoke<Client[]>('get_clients');
      await Promise.all(activeClients.map(async client => {
        const key = `${client.host}:${client.port}`;
        if (infoCache[key]) {
          return;
        }
        const infoReq = await fetch(`http://${key}/v1/info`);
        const info = await infoReq.json();
        infoCache[key] = info;
      })); 
      setClients(activeClients);
    };
    const interval = setInterval(() => {
      runner();
    }, 5000);
    runner();
    return () => clearInterval(interval);
  }, []);

  const host = useApiHost();
  const setHost = useSetApiHost();

  const [manualOpen, setManualOpen] = useState(false);
  const [manualHost, setManualHost] = useState('127.0.0.1');
  const [manualPort, setManualPort] = useState(3030);

  async function connectManually() {
    setManualOpen(false);
    try {
      const key = `${manualHost}:${manualPort}`;
      const infoReq = await fetch(`http://${key}/v1/info`);
      const info = await infoReq.json();
      infoCache[key] = info;
      setManualClients([{ host: manualHost, port: manualPort }]);
      setHost(key);
    } catch (err) {
      alert("Failed to connect to target client. Is it running? Try reaching it manually in the browser.");
    }
  }

  return (
    <>
      <StyledTextField
        select
        label="Choose a client..."
        value={host ? host.toString() : ''}
        onChange={(e) => {
          setHost(e.target.value);
        }}
        margin="dense"
        variant="outlined"
      >
        {[...manualClients, ...clients].map((client) => {
          const key = `${client.host}:${client.port}`;
          return (
            <MenuItem key={key} value={key}>
              {infoCache[key].name} - {key}
            </MenuItem>
          );
        })}
      </StyledTextField>
      <Button variant="contained" sx={{ marginLeft: 2 }} onClick={() => setManualOpen(true)}>
        Manual
      </Button>
      <Dialog open={manualOpen} onClose={() => setManualOpen(false)}>
        <DialogTitle>Manual Connection</DialogTitle>
        <DialogContent>
          <DialogContentText>
            If automatic network discovery fails you can connect manually to your target client using ip and port.
          </DialogContentText>
          <Grid container direction="row">
            <Grid item xs={8}>
              <TextField
                autoFocus
                fullWidth
                margin="dense"
                id="host"
                label="Host / IP"
                type="text"
                variant="standard"
                value={manualHost}
                onChange={e => setManualHost(e.target.value)}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                autoFocus
                fullWidth
                margin="dense"
                id="port"
                label="Port"
                type="number"
                variant="standard"
                value={manualPort}
                onChange={e => setManualPort(parseInt(e.target.value))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualOpen(false)}>Cancel</Button>
          <Button onClick={connectManually}>Connect</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}