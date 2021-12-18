import React from 'react';
import { Alert, AlertTitle } from "@mui/material";
import { Route, Routes } from "react-router-dom";
import { useApiHost } from "../api";
import { EventsView } from '../views/Events';
import { WorldView } from '../views/World';
import { AssetsView } from '../views/Assets';
import { SystemProfiler } from '../views/SystemProfiler';

export function Router(): React.ReactElement {
  const host = useApiHost();
  if (!host) {
    return (
      <Alert severity="info">
        <AlertTitle>Info</AlertTitle>
        Please connect to a client first.
      </Alert>
    );
  }

  return (
    <Routes key={host}>
      <Route path="/" element={<EventsView />} />
      <Route path="/world" element={<WorldView />} />
      <Route path="/assets" element={<AssetsView />} />
      <Route path="/system-profiler" element={<SystemProfiler />} />
    </Routes>
  );
}