import React, { useEffect, useState } from "react";
import { invoke } from '@tauri-apps/api/tauri'
import { MenuItem, styled, TextField } from "@mui/material";
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

  return (
    <StyledTextField
      select
      label="Choose a client..."
      value={host}
      onChange={(e) => {
        setHost(e.target.value);
      }}
      margin="dense"
      variant="outlined"
    >
      {clients.map((client) => {
        const key = `${client.host}:${client.port}`;
        return (
          <MenuItem key={key} value={key}>
            {infoCache[key].name} - {key}
          </MenuItem>
        );
      })}
    </StyledTextField>
  );
}