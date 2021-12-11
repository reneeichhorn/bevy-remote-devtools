import React from 'react';
import { Alert, AlertTitle } from "@mui/material";
import { BrowserRouter } from "react-router-dom";
import { useApiHost } from "../api";

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
    <BrowserRouter key={host}>
    </BrowserRouter>
  );
}